import type { QwenBlockDigest, QwenFramePayload, QwenTopLogit } from "@neuroloom/official-traces";

import type { TraceFrame } from "@neuroloom/core";
import type { SelectionState } from "../types";

function DigestBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="digest-bar">
      <span>{label}</span>
      <div className="digest-bar__track">
        <div style={{ width: `${Math.max(8, value * 100)}%` }} />
      </div>
      <strong>{value.toFixed(2)}</strong>
    </div>
  );
}

// We create a WeakMap to cache neuron definitions for immediate lookup, 
// because bundle.graph.neurons is static across the entire session.
const neuronDefCache = new WeakMap<{ id: string }[], Map<string, any>>();

function getNeuronDef(graphNeurons: any[] | undefined, id: string) {
  if (!graphNeurons) return undefined;
  let map = neuronDefCache.get(graphNeurons);
  if (!map) {
    map = new Map();
    for (let i = 0; i < graphNeurons.length; i++) {
        map.set(graphNeurons[i].id, graphNeurons[i]);
    }
    neuronDefCache.set(graphNeurons, map);
  }
  return map.get(id);
}

// We do NOT use a WeakMap cache for neuron_states because the states array 
// is re-created on every single frame. Building an 86k element Map on every
// frame drops the framerate to a crawl. A simple array layout match or loop is
// orders of magnitude faster than allocating a new Map.
function getNeuronState(states: any[] | undefined, id: string) {
  if (!states) return undefined;
  
  // Fast path: if the states array perfectly aligns with the graph order
  // (which it normally does in NeuroLoom traces)
  // We don't have the graph index here, so we just do a linear scan.
  // A V8 linear scan of 86k elements takes <0.5ms, while Map allocation takes ~15-30ms 
  // and creates massive GC pressure.
  for (let i = 0; i < states.length; i++) {
    if (states[i].id === id) return states[i];
  }
  return undefined;
}

function describeSelection(input: {
  bundle: {
    graph: {
      nodes: Array<{ id: string; label: string; type: string; metadata: Record<string, unknown> }>;
      neurons?: Array<{ id: string; block: number; index: number; lane: string }>;
    };
  } | null;
  frame: TraceFrame | null;
  payload: QwenFramePayload | null;
  selection: SelectionState;
}) {
  if (!input.selection) {
    return {
      title: "No focus",
      description: "Click a token, structural block, neuron, or star cluster to lock the stage around it.",
      metrics: [],
    };
  }

  const sel = input.selection;

  if (sel.kind === "neuron") {
    // Array bounds / safe early escape for performance
    const neuronState = getNeuronState(input.frame?.neuron_states, sel.id);
    const neuronDef = getNeuronDef(input.bundle?.graph.neurons, sel.id);
    const label =
      neuronDef?.lane === "attn_head"
        ? `Attention Head ${neuronDef.block + 1}.${neuronDef.index}`
        : neuronDef
          ? `Neuron ${neuronDef.block + 1}:${neuronDef.index}`
          : sel.id;
    return {
      title: label,
      description:
        neuronDef?.lane === "attn_head"
          ? "An attention head neuron. Its activation reflects the head's contribution to the current token's context mixing."
          : "A single FFN intermediate neuron. Sparse activations indicate which feature detectors fire for the current token.",
      metrics: neuronDef
        ? [
            { label: "block", value: String(neuronDef.block + 1) },
            { label: "index", value: String(neuronDef.index) },
            { label: "lane", value: neuronDef.lane },
            { label: "activation", value: (neuronState?.activation ?? 0).toFixed(4) },
          ]
        : [],
    };
  }

  if (sel.kind === "token") {
    const index = Number(sel.id.replace("token-", ""));
    const payload = input.payload;
    const localIndex = payload ? payload.tokenWindow.length - (payload.tokenIndex - index + 1) : -1;
    const token = payload && localIndex >= 0 ? payload.tokenWindow[localIndex] : sel.id;
    const attention = payload && localIndex >= 0 ? (payload.attentionRow[localIndex] ?? 0) : 0;
    return {
      title: `Token ${index + 1}`,
      description: "A token focus brightens the local rail and pulls attention weights toward its recent neighborhood.",
      metrics: [
        { label: "token", value: token.trim() || "space" },
        { label: "attention", value: attention.toFixed(3) },
      ],
    };
  }

  if (sel.kind === "cluster") {
    const unit = input.payload?.sampledUnits.find((entry) => entry.id === sel.id);
    return {
      title: unit?.label ?? sel.id,
      description:
        "Sample clusters are the visible star grains inside each hybrid sub-block. They move with the same token pulse as their parent lane.",
      metrics: unit
        ? [
            { label: "lane", value: unit.lane },
            { label: "intensity", value: unit.intensity.toFixed(3) },
            { label: "affinity", value: unit.tokenAffinity.toFixed(3) },
          ]
        : [],
    };
  }

  const node = input.bundle?.graph.nodes.find((entry) => entry.id === sel.id);
  const nodeState = input.frame?.node_states.find((entry) => entry.nodeId === sel.id);
  return {
    title: node?.label ?? sel.id,
    description:
      "Structural nodes are the stable anchors of the live stage. Their star clusters show block-scale energy rather than an abstract module box.",
    metrics: node
      ? [
          { label: "type", value: node.type },
          { label: "lane", value: String(node.metadata.lane ?? "n/a") },
          { label: "activation", value: (nodeState?.activation ?? 0).toFixed(3) },
        ]
      : [],
  };
}

export function RightPanel({
  bundle,
  frame,
  payload,
  selection,
  currentMetrics,
  currentTopLogits,
  focusBlock,
  focusDigest,
}: {
  bundle: Parameters<typeof describeSelection>[0]["bundle"];
  frame: TraceFrame | null;
  payload: QwenFramePayload | null;
  selection: SelectionState;
  currentMetrics: TraceFrame["metric_refs"];
  currentTopLogits: QwenTopLogit[];
  focusBlock: number;
  focusDigest: QwenBlockDigest[];
}) {
  const selectionDetail = describeSelection({ bundle, frame, payload, selection });

  return (
    <aside className="panel panel--right">
      <section className="card">
        <div className="card-heading">
          <p className="eyebrow">Current Frame</p>
          <span>{payload ? `token ${payload.tokenIndex + 1}` : "idle"}</span>
        </div>
        <div className="metric-grid">
          {currentMetrics.length === 0 ? <span className="empty-state">No metrics yet.</span> : null}
          {currentMetrics.map((metric) => (
            <div key={metric.id} className="metric-card">
              <span>{metric.label}</span>
              <strong>{metric.value.toFixed(3)}</strong>
            </div>
          ))}
        </div>
        <div className="logit-list">
          <div className="card-heading">
            <p className="eyebrow">Top Logits</p>
            <span>{currentTopLogits.length} candidates</span>
          </div>
          {currentTopLogits.length === 0 ? <span className="empty-state">Waiting for decode logits.</span> : null}
          {currentTopLogits.map((logit) => (
            <div key={`${logit.token}-${logit.score}`} className="logit-row">
              <span>{logit.token}</span>
              <div className="logit-bar">
                <div style={{ width: `${Math.max(8, logit.score * 100)}%` }} />
              </div>
              <strong>{logit.score.toFixed(3)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-heading">
          <p className="eyebrow">Focus Detail</p>
          <span>{selection ? selection.kind : "none"}</span>
        </div>
        <strong className="selection-title">{selectionDetail.title}</strong>
        <p className="selection-copy">{selectionDetail.description}</p>
        {selectionDetail.metrics.length > 0 ? (
          <div className="mini-metrics">
            {selectionDetail.metrics.map((metric) => (
              <div key={metric.label} className="mini-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <span className="empty-state">Select a token, structural block, or sample cluster.</span>
        )}
      </section>

      <section className="card">
        <div className="card-heading">
          <p className="eyebrow">Focus Blocks</p>
          <span>around block {focusBlock + 1}</span>
        </div>
        {focusDigest.length === 0 ? <span className="empty-state">Layer summaries appear after the first token.</span> : null}
        {focusDigest.map((digest) => (
          <div key={digest.block} className="digest-row">
            <strong>Block {digest.block + 1}</strong>
            <div className="digest-bars">
              <DigestBar label="res" value={digest.residual} />
              <DigestBar label="attn" value={digest.attention} />
              <DigestBar label="delta" value={digest.delta} />
              <DigestBar label="ffn" value={digest.ffn} />
            </div>
          </div>
        ))}
      </section>
    </aside>
  );
}
