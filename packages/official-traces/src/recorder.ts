import type { TraceBundle } from "@neuroloom/core";

import { qwenOfficialTraceId, qwenRunnerModelId, qwenVisualSemantics } from "./constants";
import { buildGraph } from "./graphBuilder";
import { cameraPreset, cloneBundle, cloneJson, payloadCatalogEntry, payloadId, tokenizeCompletion } from "./helpers";
import { buildFrame, buildInspectPayload, buildNarrative, buildRenderPayload, buildSummary } from "./payloadBuilder";
import type { QwenSessionCompletedEvent, QwenSessionStartedEvent, QwenTokenStepEvent } from "./types";

export function createOfficialTraceBundles(): TraceBundle[] {
  return [createQwenOfficialTraceBundle()];
}

export function createOfficialTraceBundle(id: "qwen3.5-0.8b-sample"): TraceBundle {
  if (id !== qwenOfficialTraceId) {
    throw new Error(`Unsupported official trace id: ${id}`);
  }
  return createQwenOfficialTraceBundle();
}

export function createQwenOfficialTraceBundle(): TraceBundle {
  return createQwenReplayBundle({
    sessionId: qwenOfficialTraceId,
    prompt: "Describe how NeuroLoom turns a Qwen conversation into a starfield in one vivid paragraph.",
    responseText:
      "NeuroLoom turns each new Qwen token into a pulse that crosses a layered starfield, where attention flares, recurrent memory glides under the surface, and the reply condenses into a visible river of light you can replay frame by frame.",
    title: "Qwen3.5-0.8B Starfield Demo",
    summary: "A single Qwen replay rendered as a dense starfield of attention, residual flow, and logits.",
  });
}

export function createQwenReplayBundle(input: {
  sessionId: string;
  prompt: string;
  responseText: string;
  title?: string;
  summary?: string;
}): TraceBundle {
  const recorder = new QwenSessionRecorder({
    sessionId: input.sessionId,
    prompt: input.prompt,
    title: input.title,
    summary: input.summary,
  });
  const tokens = tokenizeCompletion(input.responseText);
  for (const token of tokens) {
    recorder.pushToken(token);
  }
  recorder.complete();
  return recorder.exportBundle();
}

export function hydrateBundleFromLiveStart(event: QwenSessionStartedEvent): TraceBundle {
  return {
    manifest: cloneJson(event.seed.manifest),
    graph: cloneJson(event.seed.graph),
    narrative: cloneJson(event.seed.narrative),
    timeline: [],
    payloads: new Map<string, string>(),
  };
}

export function applyLiveTokenStep(bundle: TraceBundle, event: QwenTokenStepEvent): TraceBundle {
  bundle.timeline.push(cloneJson(event.frame));
  bundle.payloads.set(event.renderPayloadId, JSON.stringify(event.renderPayload));
  bundle.payloads.set(event.inspectPayloadId, JSON.stringify(event.inspectPayload));
  bundle.manifest.payload_catalog.push(
    payloadCatalogEntry(event.renderPayloadId, "render"),
    payloadCatalogEntry(event.inspectPayloadId, "inspect"),
  );
  bundle.manifest.frame_count = bundle.timeline.length;
  bundle.narrative = buildNarrative(bundle.timeline.length, event.inspectPayload.prompt);
  bundle.manifest.summary = buildSummary(event.inspectPayload.prompt);
  return bundle;
}

export class QwenSessionRecorder {
  readonly sessionId: string;
  readonly prompt: string;
  readonly startedAt: number;

  private readonly tokens: string[] = [];
  private readonly bundle: TraceBundle;

  constructor(input: { sessionId: string; prompt: string; title?: string; summary?: string; startedAt?: number }) {
    this.sessionId = input.sessionId;
    this.prompt = input.prompt;
    this.startedAt = input.startedAt ?? Date.now();
    this.bundle = createEmptyBundle({
      sessionId: input.sessionId,
      prompt: input.prompt,
      title: input.title,
      summary: input.summary,
    });
  }

  createStartEvent(): QwenSessionStartedEvent {
    return {
      type: "session_started",
      sessionId: this.sessionId,
      prompt: this.prompt,
      model: qwenRunnerModelId,
      startedAt: this.startedAt,
      layout: {
        blockCount: 24,
        headGroupCount: 6,
        clustersPerLane: 3,
        tokenWindow: 16,
      },
      seed: {
        manifest: cloneJson(this.bundle.manifest),
        graph: cloneJson(this.bundle.graph),
        narrative: cloneJson(this.bundle.narrative),
      },
    };
  }

  pushToken(token: string): QwenTokenStepEvent {
    const tokenIndex = this.tokens.length;
    this.tokens.push(token);
    const completion = this.tokens.join("");
    const payload = buildInspectPayload({
      prompt: this.prompt,
      token,
      tokenIndex,
      completion,
      totalTokens: this.tokens.length,
    });
    const renderPayload = buildRenderPayload(payload);
    const frame = buildFrame({
      sessionId: this.sessionId,
      tokenIndex,
      prompt: this.prompt,
      token,
      payload,
      graph: this.bundle.graph,
    });
    const renderPayloadId = payloadId(this.sessionId, tokenIndex, "render");
    const inspectPayloadId = payloadId(this.sessionId, tokenIndex, "inspect");

    this.bundle.timeline.push(frame);
    this.bundle.payloads.set(renderPayloadId, JSON.stringify(renderPayload));
    this.bundle.payloads.set(inspectPayloadId, JSON.stringify(payload));
    this.bundle.manifest.payload_catalog.push(
      payloadCatalogEntry(renderPayloadId, "render"),
      payloadCatalogEntry(inspectPayloadId, "inspect"),
    );
    this.bundle.manifest.frame_count = this.bundle.timeline.length;
    this.bundle.narrative = buildNarrative(this.bundle.timeline.length, this.prompt);

    return {
      type: "token_step",
      sessionId: this.sessionId,
      token,
      tokenIndex,
      completion,
      frame: cloneJson(frame),
      renderPayloadId,
      renderPayload: cloneJson(renderPayload),
      inspectPayloadId,
      inspectPayload: cloneJson(payload),
    };
  }

  complete(): QwenSessionCompletedEvent {
    this.bundle.manifest.frame_count = this.bundle.timeline.length;
    this.bundle.narrative = buildNarrative(this.bundle.timeline.length, this.prompt);
    return {
      type: "session_completed",
      sessionId: this.sessionId,
      tokenCount: this.tokens.length,
      durationMs: Date.now() - this.startedAt,
      traceFileName: `${this.sessionId}.loomtrace`,
    };
  }

  exportBundle(): TraceBundle {
    return cloneBundle(this.bundle);
  }
}

function createEmptyBundle(input: { sessionId: string; prompt: string; title?: string; summary?: string }): TraceBundle {
  const modelId = input.sessionId === qwenOfficialTraceId ? qwenOfficialTraceId : `qwen-session-${input.sessionId}`;
  return {
    manifest: {
      trace_version: "1.0.0",
      family: "transformer",
      model_id: modelId,
      dataset_id: "qwen-live-session",
      title: input.title ?? "Qwen3.5-0.8B Live Session",
      summary: input.summary ?? buildSummary(input.prompt),
      phase_set: ["decode"],
      frame_count: 0,
      camera_presets: [
        cameraPreset("ingress", "Token Ingress", { x: -8.8, y: 4.6, z: 23.4 }, { x: -8.8, y: 0.2, z: 0 }, 31),
        cameraPreset("braid", "Residual Braid", { x: 0.2, y: 2.1, z: 24.8 }, { x: 0.8, y: -0.8, z: 0 }, 28),
        cameraPreset("decode", "Decode Head", { x: 11.6, y: 2.8, z: 18.2 }, { x: 13.9, y: -0.4, z: 0 }, 26),
      ],
      visual_semantics: qwenVisualSemantics,
      payload_catalog: [],
      narrative_ref: "narrative.json",
    },
    graph: buildGraph(),
    timeline: [],
    payloads: new Map<string, string>(),
    narrative: buildNarrative(0, input.prompt),
  };
}
