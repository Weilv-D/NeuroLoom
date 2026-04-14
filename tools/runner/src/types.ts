import type { WebSocket } from "ws";

import type { QwenLiveEvent } from "@neuroloom/official-traces";
import type { QwenSessionRecorder } from "@neuroloom/official-traces";

export type ChatCompletionRequest = {
  model?: string;
  messages?: Array<{ role?: string; content?: string | Array<{ type?: string; text?: string }> }>;
  max_tokens?: number;
  temperature?: number;
};

export type SessionRecord = {
  id: string;
  prompt: string;
  recorder: QwenSessionRecorder;
  events: QwenLiveEvent[];
  sockets: Set<WebSocket>;
  archive: Uint8Array | null;
  status: "booting" | "live" | "complete" | "error" | "cancelled";
  error: string | null;
  completion: string;
  createdAt: number;
  updatedAt: number;
  abortController: AbortController;
  finishReason: "completed" | "cancelled" | "error";
};
