import type { TraceBundle } from "@neuroloom/core";

import type { PayloadCatalogEntry } from "./types";

export function seeded(seed: string, salt: number) {
  let value = hashString(`${seed}:${salt}`) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967295;
  };
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number) {
  return Number(value.toFixed(4));
}

export function round3(value: number) {
  return Number(value.toFixed(3));
}

export function normalize(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return values.map((value) => value / total);
}

export function wave(seed: number, layer: number, offset: number) {
  return Math.sin(seed * 0.0009 + layer * 0.44 + offset);
}

export function positiveWave(seed: number, layer: number, offset: number) {
  return (wave(seed, layer, offset) + 1) / 2;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneBundle(bundle: TraceBundle): TraceBundle {
  return {
    manifest: cloneJson(bundle.manifest),
    graph: cloneJson(bundle.graph),
    narrative: cloneJson(bundle.narrative),
    timeline: cloneJson(bundle.timeline),
    payloads: new Map(bundle.payloads),
    preview: bundle.preview ? new Uint8Array(bundle.preview) : undefined,
  };
}

export function tokenizeCompletion(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word : ` ${word}`));
}

export function buildSyntheticQwenResponse(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "A quiet Qwen reply enters the stage as a thin current, then thickens into a visible stream of residual light.";
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("star") || lower.includes("flow")) {
    return "Qwen answers as a star river: attention sparks jump between recent words, the recurrent lane carries memory underneath, and the next token condenses at the edge of the stage.";
  }
  if (lower.includes("why") || lower.includes("how")) {
    return "The live stage works because each token is reduced into structural summaries, then stretched into motion so the model remains readable without pretending to expose every neuron.";
  }
  if (lower.includes("qwen")) {
    return "Qwen threads the reply through stacked hybrid blocks, turning token context into a layered current that bends toward the next predicted word.";
  }

  return `Qwen receives "${trimmed.slice(0, 64)}" and returns a measured reply, with attention flares above the residual river and the decode head brightening as the sentence settles.`;
}

export function cameraPreset(
  id: string,
  label: string,
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  fov: number,
) {
  return { id, label, position, target, fov };
}

export function payloadId(seed: string, frameIndex: number, kind: "render" | "inspect") {
  const safeSeed = seed.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${safeSeed}-frame-${String(frameIndex).padStart(4, "0")}-${kind}`;
}

export function payloadCatalogEntry(id: string, kind: "render" | "inspect"): PayloadCatalogEntry {
  return {
    id,
    kind,
    mimeType: "application/json",
    path: `payload/${kind}/${id}.json`,
  };
}

export function blockNodeId(kind: "residual" | "attention" | "delta" | "ffn", block: number) {
  return `${kind}-${String(block).padStart(2, "0")}`;
}

export function node(
  id: string,
  label: string,
  type: string,
  layerIndex: number,
  order: number,
  x: number,
  y: number,
  z: number,
  metadata: Record<string, string | number | boolean>,
) {
  return {
    id,
    label,
    type,
    layerIndex,
    order,
    position: { x: round3(x), y: round3(y), z: round3(z) },
    metadata,
  };
}

export function edge(id: string, source: string, target: string, type: string, weight: number) {
  return { id, source, target, type, weight };
}

export function nodeState(nodeId: string, activation: number, emphasis: number) {
  return {
    nodeId,
    activation: round(clamp(activation, -1, 1)),
    emphasis: round(clamp(emphasis, 0, 1)),
  };
}

export function edgeState(edgeId: string, intensity: number, direction: "forward" | "backward" | "neutral", emphasis: number) {
  return {
    edgeId,
    intensity: round(clamp(intensity, 0, 1)),
    direction,
    emphasis: round(clamp(emphasis, 0, 1)),
  };
}

export function metric(id: string, label: string, value: number) {
  return { id, label, value: round(clamp(value, 0, 999)) };
}
