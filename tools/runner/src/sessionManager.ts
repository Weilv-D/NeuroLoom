import { createLoomTraceArchive } from "@neuroloom/core";
import { QwenSessionRecorder, buildSyntheticQwenResponse, tokenizeCompletion, type QwenLiveEvent } from "@neuroloom/official-traces";
import { WebSocket } from "ws";

import { resolveBackendEndpoint } from "./backendProfiles.js";
import { completedTokenCount, extractContentString, extractReasoningString, parseSseEvent } from "./sseParser.js";
import type { ChatCompletionRequest, SessionRecord } from "./types.js";

export class SessionStore {
  readonly sessions = new Map<string, SessionRecord>();
  readonly retention: number;
  readonly runnerPort: number;
  readonly backendUrl: string;
  readonly backendApiKey: string;
  readonly backendThink: boolean | string | undefined;
  readonly backendStreamingRequested: boolean;

  constructor(options: {
    retention: number;
    runnerPort: number;
    backendUrl: string;
    backendApiKey: string;
    backendThink: boolean | string | undefined;
    backendStreamingRequested: boolean;
  }) {
    this.retention = options.retention;
    this.runnerPort = options.runnerPort;
    this.backendUrl = options.backendUrl;
    this.backendApiKey = options.backendApiKey;
    this.backendThink = options.backendThink;
    this.backendStreamingRequested = options.backendStreamingRequested;
  }

  trimSessions() {
    if (this.sessions.size <= this.retention) {
      return;
    }
    const removable = [...this.sessions.values()]
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, this.sessions.size - this.retention);
    for (const session of removable) {
      if (session.status === "live" || session.status === "booting") {
        continue;
      }
      this.sessions.delete(session.id);
    }
  }

  serializeSession(session: SessionRecord) {
    return {
      id: session.id,
      prompt: session.prompt,
      status: session.status,
      finishReason: session.finishReason,
      error: session.error,
      events: session.events.length,
      completion: session.completion,
      archiveReady: Boolean(session.archive),
      tokenCount: session.events.filter((event) => event.type === "token_step").length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      traceUrl: `http://127.0.0.1:${this.runnerPort}/sessions/${session.id}/trace`,
    };
  }

  broadcastEvent(session: SessionRecord, event: QwenLiveEvent) {
    const payload = JSON.stringify(event);
    for (const socket of session.sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  async emitCompletionAsTokens(session: SessionRecord, completionText: string, syntheticDelay: boolean) {
    session.completion = completionText;
    const tokens = tokenizeCompletion(completionText);
    for (const token of tokens) {
      if (session.abortController.signal.aborted) {
        break;
      }
      if (syntheticDelay) {
        await sleep(stepDelay(token));
      }
      if (session.abortController.signal.aborted) {
        break;
      }
      const event = session.recorder.pushToken(token);
      session.events.push(event);
      session.updatedAt = Date.now();
      this.broadcastEvent(session, event);
    }
    await this.finishSession(session);
  }

  async finishSession(session: SessionRecord) {
    if (session.archive) {
      return;
    }
    const completed = session.recorder.complete();
    session.events.push(completed);
    session.archive = await createLoomTraceArchive(session.recorder.exportBundle());
    session.status = session.finishReason === "cancelled" ? "cancelled" : session.finishReason === "error" ? "error" : "complete";
    session.updatedAt = Date.now();
    this.broadcastEvent(session, completed);
  }

  emitFreshTokens(session: SessionRecord, completion: string, emittedTokenCount: number, flushLast = false) {
    const nextTokens = tokenizeCompletion(completion);
    const readyCount = flushLast ? nextTokens.length : completedTokenCount(completion, nextTokens.length);
    for (let index = emittedTokenCount; index < readyCount; index++) {
      if (session.abortController.signal.aborted) {
        break;
      }
      const token = nextTokens[index];
      if (!token) continue;
      const event = session.recorder.pushToken(token);
      session.events.push(event);
      session.updatedAt = Date.now();
      this.broadcastEvent(session, event);
    }
    return session.abortController.signal.aborted ? emittedTokenCount : readyCount;
  }

  async runSession(session: SessionRecord, request: ChatCompletionRequest, effectiveModel: string) {
    try {
      if (!this.backendUrl) {
        const completionText = buildSyntheticQwenResponse(session.prompt);
        await this.emitCompletionAsTokens(session, completionText, true);
        return;
      }

      if (this.backendStreamingRequested) {
        const completionText = await this.streamBackendCompletion(session, request, effectiveModel);
        if (!completionText.trim()) {
          throw new Error("Streaming adapter produced an empty completion.");
        }
        if (session.status !== "complete") {
          await this.finishSession(session);
        }
        return;
      }

      const completionText = await this.resolveBufferedCompletionText(session.prompt, request, effectiveModel);
      await this.emitCompletionAsTokens(session, completionText, false);
    } catch (error) {
      const reason = session.abortController.signal.aborted ? "cancelled" : "error";
      session.status = reason;
      session.finishReason = reason;
      session.error = reason === "cancelled" ? null : (error as Error).message;
      session.updatedAt = Date.now();
      const fallbackText = buildSyntheticQwenResponse(session.prompt);
      if (reason === "cancelled") {
        await this.finishSession(session);
        return;
      }
      await this.emitCompletionAsTokens(session, fallbackText, true);
    }
  }

  async streamBackendCompletion(session: SessionRecord, request: ChatCompletionRequest, effectiveModel: string) {
    const response = await fetch(resolveBackendEndpoint(this.backendUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.backendApiKey ? { Authorization: `Bearer ${this.backendApiKey}` } : {}),
      },
      body: JSON.stringify(this.buildBackendRequestBody(request, effectiveModel, true)),
    });
    if (!response.ok) {
      throw new Error(`Adapter backend failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream") || !response.body) {
      const buffered = await extractBufferedCompletionFromResponse(response);
      await this.emitCompletionAsTokens(session, buffered, false);
      return buffered;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completion = "";
    let emittedTokenCount = 0;
    let isDone = false;
    let sawReasoning = false;

    while (!isDone) {
      if (session.abortController.signal.aborted) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        const parsed = parseSseEvent(rawEvent);
        if (!parsed) continue;
        if (parsed.reasoning) {
          sawReasoning = true;
        }
        if (parsed.content) {
          completion += parsed.content;
          session.completion = completion;
          session.updatedAt = Date.now();
          emittedTokenCount = this.emitFreshTokens(session, completion, emittedTokenCount);
        }
        if (parsed.done) {
          isDone = true;
          break;
        }
      }
    }

    if (buffer.trim()) {
      const parsed = parseSseEvent(buffer);
      if (parsed?.reasoning) {
        sawReasoning = true;
      }
      if (parsed?.content) {
        completion += parsed.content;
        session.completion = completion;
        session.updatedAt = Date.now();
        emittedTokenCount = this.emitFreshTokens(session, completion, emittedTokenCount);
      }
    }

    this.emitFreshTokens(session, completion, emittedTokenCount, true);
    session.completion = completion;
    if (!completion.trim() && sawReasoning) {
      throw new Error("Adapter backend emitted reasoning without a final answer. Disable backend thinking or increase max_tokens.");
    }
    return completion;
  }

  async resolveBufferedCompletionText(_prompt: string, request: ChatCompletionRequest, effectiveModel: string) {
    const endpoint = resolveBackendEndpoint(this.backendUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.backendApiKey ? { Authorization: `Bearer ${this.backendApiKey}` } : {}),
      },
      body: JSON.stringify(this.buildBackendRequestBody(request, effectiveModel, false)),
    });
    if (!response.ok) {
      throw new Error(`Adapter backend failed: ${response.status} ${response.statusText}`);
    }
    return extractBufferedCompletionFromResponse(response);
  }

  buildBackendRequestBody(request: ChatCompletionRequest, effectiveModel: string, stream: boolean) {
    return {
      model: effectiveModel,
      messages: request.messages,
      ...(typeof request.max_tokens === "number" ? { max_tokens: request.max_tokens } : {}),
      temperature: request.temperature ?? 0.7,
      stream,
      ...(this.backendThink === undefined ? {} : { think: this.backendThink }),
    };
  }
}

function stepDelay(token: string) {
  return Math.max(72, Math.min(180, 86 + token.length * 9));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractBufferedCompletionFromResponse(response: Response) {
  const json = (await response.json()) as {
    choices?: Array<{
      delta?: {
        content?: string | Array<{ text?: string; type?: string }>;
        reasoning?: string | Array<{ text?: string; type?: string }>;
        thinking?: string | Array<{ text?: string; type?: string }>;
      };
      message?: {
        content?: string | Array<{ text?: string; type?: string }>;
        reasoning?: string | Array<{ text?: string; type?: string }>;
        thinking?: string | Array<{ text?: string; type?: string }>;
      };
    }>;
  };
  const choice = json.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content;
  const extracted = extractContentString(content);
  if (extracted.trim()) {
    return extracted;
  }
  if (extractReasoningString(choice).trim()) {
    throw new Error("Adapter backend returned reasoning without a final answer. Disable backend thinking or increase max_tokens.");
  }
  throw new Error("Adapter backend returned an empty completion.");
}
