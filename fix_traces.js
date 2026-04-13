import fs from "fs";

let content = fs.readFileSync("packages/official-traces/src/index.ts", "utf-8");

const newMlpMixer = `function createMlpMixerTrace(): TraceBundle {
  const nodes: GraphNode[] = [
    node("patch", "Patch Embed", "input", 0, 0, -6, 2, 0, { patches: 16 }),
    node("token-mix-1", "Token Mix", "linear", 1, 0, -3, 3, -2, { type: "spatial" }),
    node("channel-mix-1", "Channel Mix", "activation", 1, 1, -3, -3, 2, { type: "feature" }),
    node("token-mix-2", "Token Mix L2", "linear", 2, 0, 1, 3, -2, { type: "spatial" }),
    node("channel-mix-2", "Channel Mix L2", "activation", 2, 1, 1, -3, 2, { type: "feature" }),
    node("head", "Classifier", "output", 3, 0, 5, 0, 0, { classes: 10 }),
    node("loss", "Loss", "loss", 4, 0, 8, 0, 0, { metric: "cross_entropy" }),
  ];
  const edges: GraphEdge[] = [
    edge("e1", "patch", "token-mix-1"),
    edge("e2", "patch", "channel-mix-1"),
    edge("e3", "token-mix-1", "token-mix-2"),
    edge("e4", "channel-mix-1", "channel-mix-2"),
    edge("e5", "token-mix-2", "head"),
    edge("e6", "channel-mix-2", "head"),
    edge("e7", "head", "loss")
  ];
  const timeline: TraceFrame[] = [];
  const payloads = new Map<string, string>();
  const payloadCatalog: PayloadCatalogEntry[] = [];
  
  for (let frame = 0; frame < 10; frame++) {
    timeline.push({
      frame_id: frame,
      step: frame,
      substep: 0,
      phase: frame < 5 ? "forward" : "backward",
      camera_anchor: "overview",
      node_states: nodes.map(n => nodeState(n.id, 0.5 + frame*0.05, 0.8, "inspect-1")),
      edge_states: edges.map(e => ({ edgeId: e.id, intensity: 0.8, direction: frame < 5 ? "forward" : "backward", emphasis: 0.8 })),
      metric_refs: [],
      payload_refs: ["inspect-1"],
    });
  }
  
  payloads.set("inspect-1", JSON.stringify({ headline: "MLP Mixer", series: [], matrix: createMatrix(16, 16, () => 1), tokens: [], heads: [], topTokens: [], selectionDetails: {} }));
  payloadCatalog.push(payloadEntry("inspect-1", "inspect"));

  return {
    manifest: {
      trace_version: "1.0.0", family: "mlp", model_id: "tiny-mlp-mixer", dataset_id: "synthetic",
      title: "Tiny MLP-Mixer", summary: "Token and channel mixing.",
      phase_set: ["forward", "backward"], frame_count: 10,
      camera_presets: [camera("overview", "Overview", { x: 2, y: 4, z: 15 }, { x: 2, y: 0, z: 0 }, 32)],
      visual_semantics: visualSemantics, payload_catalog: payloadCatalog, narrative_ref: "narrative.json",
    },
    graph: { nodes, edges, rootNodeIds: ["patch"] }, timeline, payloads,
    narrative: { intro: "MLP Mixer", chapters: [chapter("fwd", "Forward", [0, 4], "patch", "Run"), chapter("bwd", "Backward", [5, 9], "loss", "Run")] }
  };
}`;

const newConvNext = `function createConvNextTrace(): TraceBundle {
  const nodes: GraphNode[] = [
    node("embed", "Patchify", "input", 0, 0, -8, 0, 0, { stride: 4 }),
    node("dwconv1", "DW Conv 7x7", "conv", 1, 0, -4, 4, -4, { kernel: 7 }),
    node("norm1", "Layer Norm", "norm", 1, 1, -2, 2, -2, { dims: 64 }),
    node("pwconv1", "PW Conv 1x1", "dense", 2, 0, 0, 0, 0, { expansion: 4 }),
    node("act1", "GELU", "activation", 2, 1, 2, -2, 2, { fn: "gelu" }),
    node("pwconv2", "PW Conv 1x1", "dense", 3, 0, 4, -4, 4, { kernel: 1 }),
    node("head", "Classifier", "output", 4, 0, 7, 0, 0, { classes: 10 }),
  ];
  const edges: GraphEdge[] = [
    edge("e1", "embed", "dwconv1"), edge("e2", "dwconv1", "norm1"),
    edge("e3", "norm1", "pwconv1"), edge("e4", "pwconv1", "act1"),
    edge("e5", "act1", "pwconv2"), edge("e6", "pwconv2", "head")
  ];
  const timeline: TraceFrame[] = [];
  const payloads = new Map<string, string>();
  const payloadCatalog: PayloadCatalogEntry[] = [];
  
  for (let frame = 0; frame < 10; frame++) {
    timeline.push({
      frame_id: frame, step: frame, substep: 0, phase: frame < 5 ? "forward" : "backward", camera_anchor: "overview",
      node_states: nodes.map(n => nodeState(n.id, 0.8, 0.8, "inspect-1")),
      edge_states: edges.map(e => ({ edgeId: e.id, intensity: 0.8, direction: frame < 5 ? "forward" : "backward", emphasis: 0.8 })),
      metric_refs: [], payload_refs: ["inspect-1"],
    });
  }
  
  payloads.set("inspect-1", JSON.stringify({ headline: "ConvNeXt", series: [], matrix: createMatrix(16, 16, () => 1), tokens: [], heads: [], topTokens: [], selectionDetails: {} }));
  payloadCatalog.push(payloadEntry("inspect-1", "inspect"));

  return {
    manifest: {
      trace_version: "1.0.0", family: "cnn", model_id: "tiny-convnext", dataset_id: "synthetic",
      title: "Tiny ConvNeXt", summary: "Depthwise convolutions and inverted bottlenecks.",
      phase_set: ["forward", "backward"], frame_count: 10,
      camera_presets: [camera("overview", "Overview", { x: 0, y: 5, z: 12 }, { x: 0, y: 0, z: 0 }, 32)],
      visual_semantics: visualSemantics, payload_catalog: payloadCatalog, narrative_ref: "narrative.json",
    },
    graph: { nodes, edges, rootNodeIds: ["embed"] }, timeline, payloads,
    narrative: { intro: "ConvNeXt", chapters: [chapter("fwd", "Forward", [0, 4], "embed", "Run"), chapter("bwd", "Backward", [5, 9], "head", "Run")] }
  };
}`;

const newLlama = `function createLlamaTrace(): TraceBundle {
  const nodes: GraphNode[] = [
    node("embed", "Tokens", "token", 0, 0, -8, 0, 0, { vocab: 32000 }),
    node("rope", "RoPE", "embedding", 1, 0, -5, 4, -4, { type: "rotary" }),
    node("gqa", "GQA", "attention", 2, 0, -2, 0, 2, { groups: 2 }),
    node("norm1", "RMSNorm", "norm", 2, 1, -1, 0, 0, { type: "rms" }),
    node("swiglu", "SwiGLU", "mlp", 3, 0, 2, -4, 4, { expansion: 8 }),
    node("norm2", "RMSNorm", "norm", 3, 1, 3, 0, 0, { type: "rms" }),
    node("head", "Logits", "logits", 4, 0, 6, 0, 0, { classes: 32000 }),
  ];
  const edges: GraphEdge[] = [
    edge("e1", "embed", "rope"), edge("e2", "rope", "gqa"),
    edge("e3", "gqa", "norm1"), edge("e4", "norm1", "swiglu"),
    edge("e5", "swiglu", "norm2"), edge("e6", "norm2", "head")
  ];
  const timeline: TraceFrame[] = [];
  const payloads = new Map<string, string>();
  const payloadCatalog: PayloadCatalogEntry[] = [];
  
  for (let frame = 0; frame < 10; frame++) {
    timeline.push({
      frame_id: frame, step: frame, substep: 0, phase: frame < 5 ? "forward" : "backward", camera_anchor: "overview",
      node_states: nodes.map(n => nodeState(n.id, 0.8, 0.8, "inspect-1")),
      edge_states: edges.map(e => ({ edgeId: e.id, intensity: 0.8, direction: frame < 5 ? "forward" : "backward", emphasis: 0.8 })),
      metric_refs: [], payload_refs: ["inspect-1"],
    });
  }
  
  payloads.set("inspect-1", JSON.stringify({ headline: "Llama", series: [], matrix: createMatrix(16, 16, () => 1), tokens: [], heads: [], topTokens: [], selectionDetails: {} }));
  payloadCatalog.push(payloadEntry("inspect-1", "inspect"));

  return {
    manifest: {
      trace_version: "1.0.0", family: "transformer", model_id: "tiny-llama", dataset_id: "synthetic",
      title: "Tiny Llama", summary: "TinyLlama architecture featuring RoPE, GQA, and SwiGLU.",
      phase_set: ["forward", "backward"], frame_count: 10,
      camera_presets: [camera("overview", "Overview", { x: -1, y: 6, z: 12 }, { x: -1, y: 0, z: 0 }, 32)],
      visual_semantics: visualSemantics, payload_catalog: payloadCatalog, narrative_ref: "narrative.json",
    },
    graph: { nodes, edges, rootNodeIds: ["embed"] }, timeline, payloads,
    narrative: { intro: "Llama", chapters: [chapter("fwd", "Forward", [0, 4], "embed", "Run"), chapter("bwd", "Backward", [5, 9], "head", "Run")] }
  };
}`;

content = content.replace(/function createMlpMixerTrace\(\): TraceBundle \{[\s\S]*?\}\n\nfunction createConvNextTrace/g, newMlpMixer + "\n\nfunction createConvNextTrace");
content = content.replace(/function createConvNextTrace\(\): TraceBundle \{[\s\S]*?\}\n\nfunction createLlamaTrace/g, newConvNext + "\n\nfunction createLlamaTrace");
content = content.replace(/function createLlamaTrace\(\): TraceBundle \{[\s\S]*?\}\n\n/, newLlama + "\n\n");

fs.writeFileSync("packages/official-traces/src/index.ts", content);
