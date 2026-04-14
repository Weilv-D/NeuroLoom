import type { TraceBundle, TraceFrame } from "@neuroloom/core";

export type QwenLane = "residual" | "attention" | "delta" | "ffn";
export type QwenTopLogit = { token: string; score: number };
export type QwenBlockDigest = {
  block: number;
  residual: number;
  attention: number;
  delta: number;
  ffn: number;
};
export type QwenSampleUnit = {
  id: string;
  label: string;
  nodeId: string;
  block: number;
  lane: QwenLane;
  cluster: number;
  intensity: number;
  polarity: number;
  tokenAffinity: number;
};
export type QwenFramePayload = {
  kind: "qwen-frame";
  model: string;
  prompt: string;
  completion: string;
  token: string;
  tokenIndex: number;
  tokenWindow: string[];
  layerNorms: number[];
  residualBands: number[];
  headGroupScores: number[][];
  attentionRow: number[];
  sampledUnits: QwenSampleUnit[];
  topLogits: QwenTopLogit[];
  blockDigest: QwenBlockDigest[];
  cameraAnchor: string;
};
export type QwenRenderPayload = {
  headline: string;
  prompt: string;
  completion: string;
  token: string;
  tokenIndex: number;
  layerSweep: number[];
  sampledUnits: QwenSampleUnit[];
  topLogits: QwenTopLogit[];
};
export type QwenLayoutMeta = {
  blockCount: number;
  headGroupCount: number;
  clustersPerLane: number;
  tokenWindow: number;
};
export type QwenSessionSeed = Pick<TraceBundle, "manifest" | "graph" | "narrative">;
export type QwenSessionStartedEvent = {
  type: "session_started";
  sessionId: string;
  prompt: string;
  model: string;
  startedAt: number;
  layout: QwenLayoutMeta;
  seed: QwenSessionSeed;
};
export type QwenTokenStepEvent = {
  type: "token_step";
  sessionId: string;
  token: string;
  tokenIndex: number;
  completion: string;
  frame: TraceFrame;
  renderPayloadId: string;
  renderPayload: QwenRenderPayload;
  inspectPayloadId: string;
  inspectPayload: QwenFramePayload;
};
export type QwenSessionCompletedEvent = {
  type: "session_completed";
  sessionId: string;
  tokenCount: number;
  durationMs: number;
  traceFileName: string;
};
export type QwenLiveEvent = QwenSessionStartedEvent | QwenTokenStepEvent | QwenSessionCompletedEvent;

// Internal types shared across modules
export type GraphNode = TraceBundle["graph"]["nodes"][number];
export type GraphEdge = TraceBundle["graph"]["edges"][number];
export type PayloadCatalogEntry = TraceBundle["manifest"]["payload_catalog"][number];
export type NeuronDef = { id: string; block: number; index: number; lane: "ffn" | "attn_head" };
