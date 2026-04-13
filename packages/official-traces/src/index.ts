import type { TraceBundle, TraceFamily, TraceFrame } from "@neuroloom/core";

export const officialTraceIds = ["tiny-mlp-mixer", "tiny-convnext", "tiny-llama"] as const;

export type OfficialTraceId = (typeof officialTraceIds)[number];

type PayloadCatalogEntry = TraceBundle["manifest"]["payload_catalog"][number];
type GraphNode = TraceBundle["graph"]["nodes"][number];
type GraphEdge = TraceBundle["graph"]["edges"][number];
type CameraPreset = TraceBundle["manifest"]["camera_presets"][number];
type NarrativeChapter = TraceBundle["narrative"]["chapters"][number];

const visualSemantics = {
  positive: "#15f0ff",
  negative: "#ffb45b",
  focus: "#d8ff66",
  neutral: "#eef2ff",
  bloomStrength: 1.45,
  fogDensity: 0.05,
} satisfies TraceBundle["manifest"]["visual_semantics"];

export function createOfficialTraceBundles(): TraceBundle[] {
  return [createMlpMixerTrace(), createConvNextTrace(), createLlamaTrace()];
}

export function createOfficialTraceBundle(id: OfficialTraceId): TraceBundle {
  switch (id) {
    case "tiny-mlp-mixer":
      return createMlpMixerTrace();
    case "tiny-convnext":
      return createConvNextTrace();
    case "tiny-llama":
      return createLlamaTrace();
  }
}

export function isOfficialTraceId(id: string): id is OfficialTraceId {
  return officialTraceIds.includes(id as OfficialTraceId);
}

function createMlpMixerTrace(): TraceBundle {
  const nodes: GraphNode[] = [
    node("patch", "Patch Embed", "embedding", 0, 0, -6, 0, 0, { patches: 16 }),
    node("token-mix", "Token Mixing", "mlp", 1, 0, -2, 2, 0, { type: "spatial" }),
    node("channel-mix", "Channel Mixing", "mlp", 1, 1, -2, -2, 0, { type: "feature" }),
    node("head", "Classifier", "logits", 2, 0, 4, 0, 0, { classes: 10 }),
  ];
  const edges: GraphEdge[] = [
    edge("e1", "patch", "token-mix"),
    edge("e2", "token-mix", "channel-mix"),
    edge("e3", "channel-mix", "head")
  ];
  const timeline: TraceFrame[] = [];
  const payloads = new Map<string, string>();
  const payloadCatalog: PayloadCatalogEntry[] = [];
  
  for (let frame = 0; frame < 5; frame++) {
    timeline.push({
      frame_id: frame,
      step: frame,
      substep: 0,
      phase: frame < 3 ? "forward" : "backward",
      camera_anchor: "overview",
      node_states: nodes.map(n => nodeState(n.id, 0.8, 0.8, "inspect-1")),
      edge_states: edges.map(e => ({ edgeId: e.id, intensity: 0.8, direction: "forward", emphasis: 0.8 })),
      metric_refs: [],
      payload_refs: ["inspect-1"],
    });
  }
  
  payloads.set("inspect-1", JSON.stringify({ headline: "MLP Mixer", series: [], matrix: createMatrix(16, 16, () => 1), tokens: [], heads: [], topTokens: [], selectionDetails: {} }));
  payloadCatalog.push(payloadEntry("inspect-1", "inspect"));

  return {
    manifest: {
      trace_version: "1.0.0", family: "mlp", model_id: "tiny-mlp-mixer", dataset_id: "synthetic",
      title: "Tiny MLP-Mixer", summary: "HuggingFace Google MLP-Mixer SOTA architecture replacing conventional pure MLPs.",
      phase_set: ["forward", "backward"], frame_count: 5,
      camera_presets: [camera("overview", "Overview", { x: 0, y: 0, z: 12 }, { x: 0, y: 0, z: 0 }, 32)],
      visual_semantics: visualSemantics, payload_catalog: payloadCatalog, narrative_ref: "narrative.json",
    },
    graph: { nodes, edges, rootNodeIds: ["patch"] }, timeline, payloads,
    narrative: { intro: "MLP Mixer", chapters: [chapter("start", "Start", [0, 4], "patch", "Run")] }
  };
}

function createConvNextTrace(): TraceBundle {
  const nodes: GraphNode[] = [
    node("embed", "Patchify", "embedding", 0, 0, -6, 0, 0, { stride: 4 }),
    node("dwconv", "Depthwise Conv", "convolution", 1, 0, -2, 2, 0, { kernel: 7 }),
    node("pwconv", "Pointwise Conv", "convolution", 1, 1, -2, -2, 0, { kernel: 1 }),
    node("head", "Classifier", "logits", 2, 0, 4, 0, 0, { classes: 10 }),
  ];
  const edges: GraphEdge[] = [
    edge("e1", "embed", "dwconv"),
    edge("e2", "dwconv", "pwconv"),
    edge("e3", "pwconv", "head")
  ];
  const timeline: TraceFrame[] = [];
  const payloads = new Map<string, string>();
  const payloadCatalog: PayloadCatalogEntry[] = [];
  
  for (let frame = 0; frame < 5; frame++) {
    timeline.push({
      frame_id: frame, step: frame, substep: 0, phase: "forward", camera_anchor: "overview",
      node_states: nodes.map(n => nodeState(n.id, 0.8, 0.8, "inspect-1")),
      edge_states: edges.map(e => ({ edgeId: e.id, intensity: 0.8, direction: "forward", emphasis: 0.8 })),
      metric_refs: [], payload_refs: ["inspect-1"],
    });
  }
  
  payloads.set("inspect-1", JSON.stringify({ headline: "ConvNeXt", series: [], matrix: createMatrix(16, 16, () => 1), tokens: [], heads: [], topTokens: [], selectionDetails: {} }));
  payloadCatalog.push(payloadEntry("inspect-1", "inspect"));

  return {
    manifest: {
      trace_version: "1.0.0", family: "cnn", model_id: "tiny-convnext", dataset_id: "synthetic",
      title: "Tiny ConvNeXt", summary: "HuggingFace Facebook ConvNeXt SOTA vision architecture replacing classic CNNs.",
      phase_set: ["forward"], frame_count: 5,
      camera_presets: [camera("overview", "Overview", { x: 0, y: 0, z: 12 }, { x: 0, y: 0, z: 0 }, 32)],
      visual_semantics: visualSemantics, payload_catalog: payloadCatalog, narrative_ref: "narrative.json",
    },
    graph: { nodes, edges, rootNodeIds: ["embed"] }, timeline, payloads,
    narrative: { intro: "ConvNeXt", chapters: [chapter("start", "Start", [0, 4], "embed", "Run")] }
  };
}

function createLlamaTrace(): TraceBundle {
  const nodes: GraphNode[] = [
    node("embed", "Tokens", "embedding", 0, 0, -6, 0, 0, { vocab: 32000 }),
    node("rope", "RoPE", "embedding", 1, 0, -4, 0, 0, { type: "rotary" }),
    node("gqa", "GQA", "attention", 2, 0, -2, 2, 0, { groups: 2 }),
    node("swiglu", "SwiGLU", "mlp", 3, 0, -2, -2, 0, { expansion: 8 }),
    node("head", "Logits", "logits", 4, 0, 4, 0, 0, { classes: 32000 }),
  ];
  const edges: GraphEdge[] = [
    edge("e1", "embed", "rope"), edge("e2", "rope", "gqa"),
    edge("e3", "gqa", "swiglu"), edge("e4", "swiglu", "head")
  ];
  const timeline: TraceFrame[] = [];
  const payloads = new Map<string, string>();
  const payloadCatalog: PayloadCatalogEntry[] = [];
  
  for (let frame = 0; frame < 5; frame++) {
    timeline.push({
      frame_id: frame, step: frame, substep: 0, phase: "forward", camera_anchor: "overview",
      node_states: nodes.map(n => nodeState(n.id, 0.8, 0.8, "inspect-1")),
      edge_states: edges.map(e => ({ edgeId: e.id, intensity: 0.8, direction: "forward", emphasis: 0.8 })),
      metric_refs: [], payload_refs: ["inspect-1"],
    });
  }
  
  payloads.set("inspect-1", JSON.stringify({ headline: "Llama", series: [], matrix: createMatrix(16, 16, () => 1), tokens: [], heads: [], topTokens: [], selectionDetails: {} }));
  payloadCatalog.push(payloadEntry("inspect-1", "inspect"));

  return {
    manifest: {
      trace_version: "1.0.0", family: "transformer", model_id: "tiny-llama", dataset_id: "synthetic",
      title: "Tiny Llama", summary: "TinyLlama architecture featuring RoPE, GQA, and SwiGLU.",
      phase_set: ["forward"], frame_count: 5,
      camera_presets: [camera("overview", "Overview", { x: 0, y: 0, z: 12 }, { x: 0, y: 0, z: 0 }, 32)],
      visual_semantics: visualSemantics, payload_catalog: payloadCatalog, narrative_ref: "narrative.json",
    },
    graph: { nodes, edges, rootNodeIds: ["embed"] }, timeline, payloads,
    narrative: { intro: "Llama", chapters: [chapter("start", "Start", [0, 4], "embed", "Run")] }
  };
}


function node(
  id: string,
  label: string,
  type: string,
  layerIndex: number,
  order: number,
  x: number,
  y: number,
  z: number,
  metadata: Record<string, string | number | boolean>,
): GraphNode {
  return {
    id,
    label,
    type,
    layerIndex,
    order,
    position: { x, y, z },
    metadata,
  };
}

function edge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target, type: "flow", weight: 1 };
}

function camera(
  id: string,
  label: string,
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  fov: number,
): CameraPreset {
  return { id, label, position, target, fov };
}

function chapter(id: string, label: string, frameRange: [number, number], defaultSelection: string, description: string): NarrativeChapter {
  return { id, label, frameRange, defaultSelection, description };
}

function payloadEntry(id: string, kind: "render" | "inspect"): PayloadCatalogEntry {
  return { id, kind, mimeType: "application/json", path: `payload/${id}.json` };
}

function metric(label: string, value: number) {
  return { label, value: round(value) };
}

function detail(title: string, blurb: string, stats: Array<{ label: string; value: number }>) {
  return { title, blurb, stats };
}

function nodeState(nodeId: string, activation: number, emphasis: number, payloadRef: string) {
  return { nodeId, activation: round(activation), emphasis: clamp(emphasis, 0, 1), payloadRef };
}

function createMatrix(sizeX: number, sizeY: number, fn: (x: number, y: number) => number) {
  return Array.from({ length: sizeY }, (_, row) =>
    Array.from({ length: sizeX }, (_, column) => round(fn(column / Math.max(sizeX - 1, 1), row / Math.max(sizeY - 1, 1)))),
  );
}

function createAttentionHeads(size: number, t: number) {
  return Array.from({ length: 4 }, (_, headIndex) =>
    Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => {
        const locality = Math.max(0, 0.72 - Math.abs(row - column) * (0.1 + headIndex * 0.03));
        const drift = Math.max(0, Math.sin(t * (4.2 + headIndex * 0.4) + row * 0.8 + column * (0.25 + headIndex * 0.1))) * 0.26;
        const focusBias = row === (headIndex + Math.round(t * 3)) % size ? 0.18 : 0;
        return round(clamp(0.08 + locality * (0.52 + t * 0.24) + drift + focusBias, 0, 1));
      }),
    ),
  );
}

function averageMatrices(matrices: number[][][]) {
  if (matrices.length === 0) return [];
  const rows = matrices[0]!.length;
  const columns = matrices[0]![0]!.length;

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) =>
      round(matrices.reduce((sum, matrix) => sum + (matrix[row]?.[column] ?? 0), 0) / matrices.length),
    ),
  );
}

function emphasisForPhase(phase: TraceFrame["phase"], base: number) {
  if (phase === "backward") return base * 0.88;
  if (phase === "update") return base * 0.64;
  if (phase === "loss") return base * 0.95;
  if (phase === "decode") return base * 1.05;
  return base;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

