import { qwenFramePayloadSchema, type TraceBundle, type TraceFrame } from "@neuroloom/core";

import { qwenBlockCount, qwenClustersPerLane, qwenHeadGroupCount } from "./constants";
import { buildNeuronStates } from "./graphBuilder";
import {
  blockNodeId,
  clamp,
  edgeState,
  hashString,
  metric,
  normalize,
  nodeState,
  payloadId,
  positiveWave,
  round,
  tokenizeCompletion,
  wave,
} from "./helpers";
import type { QwenFramePayload, QwenRenderPayload, QwenSampleUnit, QwenTopLogit } from "./types";

export function buildFrame(input: {
  sessionId: string;
  tokenIndex: number;
  prompt: string;
  token: string;
  payload: QwenFramePayload;
  graph: TraceBundle["graph"];
}): TraceFrame {
  const currentBlock = input.payload.tokenIndex % qwenBlockCount;
  const tokenSeed = hashString(`${input.prompt}:${input.token}:${input.tokenIndex}`);
  const nodeStates = input.graph.nodes.map((graphNode) => {
    if (graphNode.id === "prompt") {
      return nodeState(graphNode.id, 0.28 + input.payload.attentionRow.length * 0.02, 0.55);
    }
    if (graphNode.id === "embedding") {
      return nodeState(graphNode.id, 0.42 + input.payload.residualBands[0] * 0.3, 0.72);
    }
    if (graphNode.id === "logits") {
      return nodeState(graphNode.id, input.payload.topLogits[0]?.score ?? 0.35, 0.92);
    }
    if (graphNode.id === "decode") {
      return nodeState(graphNode.id, clamp(0.55 + input.payload.topLogits[0]?.score * 0.28, 0, 1), 0.96);
    }

    const block = Number(graphNode.metadata.block ?? 0);
    const blockDigest = input.payload.blockDigest[block];
    if (!blockDigest) {
      return nodeState(graphNode.id, 0.12, 0.3);
    }

    const lane = String(graphNode.metadata.lane);
    const activation =
      lane === "residual"
        ? blockDigest.residual
        : lane === "attention"
          ? blockDigest.attention
          : lane === "delta"
            ? blockDigest.delta
            : blockDigest.ffn;
    const distance = Math.abs(block - currentBlock);
    const emphasis = clamp(0.38 + Math.exp(-distance / 4) * 0.54, 0, 1);
    return nodeState(graphNode.id, activation, emphasis);
  });

  const neuronStates = buildNeuronStates(input.graph, tokenSeed, currentBlock, input.payload.blockDigest);

  const nodeMap = new Map(nodeStates.map((state) => [state.nodeId, state]));
  const edgeStates = input.graph.edges.map((graphEdge) => {
    const source = nodeMap.get(graphEdge.source);
    const target = nodeMap.get(graphEdge.target);
    const intensity = clamp(((Math.abs(source?.activation ?? 0) + Math.abs(target?.activation ?? 0)) / 2) * graphEdge.weight + 0.05, 0, 1);
    const direction = source && target && source.activation > target.activation + 0.08 ? "backward" : "forward";
    const emphasis = clamp(0.26 + intensity * 0.68, 0, 1);
    return edgeState(graphEdge.id, intensity, direction, emphasis);
  });

  const averageResidual =
    input.payload.residualBands.reduce((total, value) => total + value, 0) / Math.max(input.payload.residualBands.length, 1);
  const averageAttention =
    input.payload.blockDigest.reduce((total, block) => total + block.attention, 0) / Math.max(input.payload.blockDigest.length, 1);
  const renderPayloadId = payloadId(input.sessionId, input.tokenIndex, "render");
  const inspectPayloadId = payloadId(input.sessionId, input.tokenIndex, "inspect");

  return {
    frame_id: input.tokenIndex,
    step: input.tokenIndex,
    substep: 0,
    phase: "decode",
    camera_anchor: input.payload.cameraAnchor,
    node_states: nodeStates,
    neuron_states: neuronStates,
    edge_states: edgeStates,
    metric_refs: [
      metric("token_index", "Token", input.tokenIndex + 1),
      metric("residual", "Residual", round(averageResidual)),
      metric("attention", "Attention", round(averageAttention)),
      metric("logit", "Top Logit", input.payload.topLogits[0]?.score ?? 0),
    ],
    payload_refs: [renderPayloadId, inspectPayloadId],
    note: `Token ${input.tokenIndex + 1} "${input.token.trim()}" ripples through grouped attention, DeltaNet memory, and the decode head.`,
  };
}

export function buildInspectPayload(input: {
  prompt: string;
  token: string;
  tokenIndex: number;
  completion: string;
  totalTokens: number;
}): QwenFramePayload {
  const tokenSeed = hashString(`${input.prompt}:${input.token}:${input.tokenIndex}`);
  const focusBlock = input.tokenIndex % qwenBlockCount;
  const tokenWindow = tokenizeCompletion(input.completion).slice(-16);
  const blockDigest = Array.from({ length: qwenBlockCount }, (_, block) => {
    const distance = Math.abs(block - focusBlock);
    const focus = Math.exp(-distance / 4.2);
    const residual = clamp(0.18 + focus * 0.54 + wave(tokenSeed, block, 0.18) * 0.18, 0.04, 1);
    const attention = clamp(0.14 + focus * 0.48 + wave(tokenSeed, block, 0.47) * 0.22, 0.04, 1);
    const delta = clamp(0.16 + focus * 0.41 + wave(tokenSeed, block, 0.73) * 0.24, 0.04, 1);
    const ffn = clamp(0.2 + focus * 0.44 + wave(tokenSeed, block, 0.91) * 0.2, 0.04, 1);
    return {
      block,
      residual: round(residual),
      attention: round(attention),
      delta: round(delta),
      ffn: round(ffn),
    };
  });

  const layerNorms = blockDigest.map((block) => round(clamp(block.residual * 0.48 + block.ffn * 0.22 + 0.12, 0, 1)));
  const residualBands = blockDigest.map((block) => round(clamp(block.residual * 0.72 + block.delta * 0.16 + block.attention * 0.12, 0, 1)));
  const headGroupScores = Array.from({ length: qwenBlockCount }, (_, block) =>
    Array.from({ length: qwenHeadGroupCount }, (_, head) =>
      round(clamp(0.14 + blockDigest[block]!.attention * 0.56 + wave(tokenSeed + head * 7, block, head * 0.31) * 0.22, 0, 1)),
    ),
  );

  const attentionRaw = tokenWindow.map((_, index) => {
    const recency = Math.exp(-(tokenWindow.length - 1 - index) / 3.4);
    return 0.08 + recency * 0.78 + positiveWave(tokenSeed, index, 0.29) * 0.18;
  });
  const attentionRow = normalize(attentionRaw).map(round);
  const topLogits = buildTopLogits(input.token.trim() || "token", tokenSeed);
  const sampledUnits: QwenSampleUnit[] = [];

  for (let block = 0; block < qwenBlockCount; block++) {
    for (const lane of ["residual", "attention", "delta", "ffn"] as const) {
      const digest = blockDigest[block]!;
      const laneValue =
        lane === "residual" ? digest.residual : lane === "attention" ? digest.attention : lane === "delta" ? digest.delta : digest.ffn;
      for (let cluster = 0; cluster < qwenClustersPerLane; cluster++) {
        const local = clamp(laneValue * (0.76 + cluster * 0.12) + wave(tokenSeed + cluster * 19, block, cluster * 0.22) * 0.16, 0, 1);
        sampledUnits.push({
          id: `cluster:${lane}:${block}:${cluster}`,
          label: `${lane} ${block + 1}.${cluster + 1}`,
          nodeId: blockNodeId(lane === "ffn" ? "ffn" : lane, block),
          block,
          lane,
          cluster,
          intensity: round(local),
          polarity: round(wave(tokenSeed + cluster * 13, block, 0.18)),
          tokenAffinity: round(clamp(Math.exp(-Math.abs(block - focusBlock) / 3.8), 0, 1)),
        });
      }
    }
  }

  return qwenFramePayloadSchema.parse({
    kind: "qwen-frame",
    model: "Qwen/Qwen3.5-0.8B",
    prompt: input.prompt,
    completion: input.completion,
    token: input.token,
    tokenIndex: input.tokenIndex,
    tokenWindow,
    layerNorms,
    residualBands,
    headGroupScores,
    attentionRow,
    sampledUnits,
    topLogits,
    blockDigest,
    cameraAnchor: input.tokenIndex < 4 ? "ingress" : input.tokenIndex < 12 ? "braid" : "decode",
  });
}

export function buildRenderPayload(payload: QwenFramePayload): QwenRenderPayload {
  return {
    headline:
      payload.tokenIndex < 4
        ? "Ingress: tokens begin threading into the hybrid stack."
        : payload.tokenIndex < 12
          ? "Braid: grouped attention and recurrent memory tighten into a residual river."
          : "Decode: the starfield narrows and the next word condenses at the edge.",
    prompt: payload.prompt,
    completion: payload.completion,
    token: payload.token,
    tokenIndex: payload.tokenIndex,
    layerSweep: payload.residualBands,
    sampledUnits: payload.sampledUnits.filter((unit) => unit.block % 3 === payload.tokenIndex % 3 || unit.tokenAffinity > 0.42),
    topLogits: payload.topLogits,
  };
}

export function buildNarrative(frameCount: number, prompt: string): TraceBundle["narrative"] {
  if (frameCount === 0) {
    return {
      intro: `Live Qwen session seeded from prompt: "${prompt.trim() || "Awaiting input"}".`,
      chapters: [
        {
          id: "awaiting",
          label: "Awaiting Tokens",
          frameRange: [0, 0],
          defaultSelection: "embedding",
          description: "The stage is primed but the first decode step has not arrived yet.",
        },
      ],
    };
  }

  const earlyEnd = Math.min(frameCount - 1, Math.max(0, Math.floor(frameCount * 0.25)));
  const midStart = Math.min(frameCount - 1, earlyEnd + 1);
  const midEnd = Math.min(frameCount - 1, Math.max(midStart, Math.floor(frameCount * 0.72)));
  const finalStart = Math.min(frameCount - 1, Math.max(midStart, midEnd));

  return {
    intro: `Qwen3.5-0.8B transforms the prompt into a live starfield, then preserves the whole exchange as a replayable loomtrace.`,
    chapters: [
      {
        id: "ingress",
        label: "Ingress",
        frameRange: [0, earlyEnd],
        defaultSelection: "embedding",
        description: "The opening tokens cross the embedding gate and wake the first hybrid blocks.",
      },
      {
        id: "braid",
        label: "Braid",
        frameRange: [midStart, midEnd],
        defaultSelection: blockNodeId("attention", Math.min(8, qwenBlockCount - 1)),
        description: "Grouped attention and DeltaNet memory braid into the residual river at mid-stack.",
      },
      {
        id: "decode",
        label: "Decode",
        frameRange: [finalStart, frameCount - 1],
        defaultSelection: "logits",
        description: "The live response narrows into the decode head and leaves a replay trail behind it.",
      },
    ],
  };
}

export function buildSummary(prompt: string) {
  return `Live-first replay for a single Qwen3.5-0.8B conversation. Prompt seed: "${prompt.trim().slice(0, 72)}".`;
}

function buildTopLogits(token: string, seed: number): QwenTopLogit[] {
  const stem = token.replace(/^[\s]+/, "") || "token";
  const candidates = [stem, " attention", " residual", " starfield", " memory", " decode"];
  return candidates
    .map((candidate, index) => ({
      token: candidate,
      score: round(clamp(0.22 + positiveWave(seed + index * 17, index, 0.19) * 0.58 + (index === 0 ? 0.16 : 0), 0.01, 0.99)),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}
