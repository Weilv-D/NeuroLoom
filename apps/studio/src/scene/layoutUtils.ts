import { type CSSProperties } from "react";

import type { TraceBundle } from "@neuroloom/core";
import type { QwenSampleUnit } from "@neuroloom/official-traces";

import type { SelectionState } from "../types";

export type FocusState = "selected" | "related" | "muted" | "neutral";

export function focusForNode(nodeId: string, selection: SelectionState, relatedNodeIds: Set<string>): FocusState {
  if (!selection) return "neutral";
  if (selection.kind === "node" && selection.id === nodeId) return "selected";
  if (relatedNodeIds.has(nodeId)) return "related";
  return "muted";
}

export function focusForEdge(edgeId: string, selection: SelectionState, relatedEdgeIds: Set<string>): FocusState {
  if (!selection) return "neutral";
  if (relatedEdgeIds.has(edgeId)) return "related";
  return "muted";
}

export function clusterOffset(unit: QwenSampleUnit) {
  const laneOffsets: Record<QwenSampleUnit["lane"], [number, number, number]> = {
    residual: [0, 0.42, -0.18],
    attention: [-0.18, 0.56, 0.12],
    delta: [0.22, -0.52, -0.14],
    ffn: [0.16, -0.74, 0.18],
  };
  const base = laneOffsets[unit.lane];
  return {
    x: base[0] + (unit.cluster - 1) * 0.18,
    y: base[1] + Math.sin(unit.block * 0.6 + unit.cluster) * 0.08,
    z: base[2] + (unit.cluster - 1) * 0.06,
  };
}

export function quadraticPoint(start: [number, number, number], mid: [number, number, number], end: [number, number, number], t: number) {
  const inv = 1 - t;
  return [
    inv * inv * start[0] + 2 * inv * t * mid[0] + t * t * end[0],
    inv * inv * start[1] + 2 * inv * t * mid[1] + t * t * end[1],
    inv * inv * start[2] + 2 * inv * t * mid[2] + t * t * end[2],
  ] as [number, number, number];
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function addOffset(position: { x: number; y: number; z: number }, offset: { x: number; y: number; z: number }) {
  return {
    x: position.x + offset.x,
    y: position.y + offset.y,
    z: position.z + offset.z,
  };
}

export function vectorToTuple(vector: { x: number; y: number; z: number }): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

export function project(position: { x: number; y: number; z: number }) {
  return {
    left: 50 + position.x * 2.65,
    top: 50 - position.y * 5.6,
  };
}

export function residualPath(bundle: TraceBundle) {
  const residualNodes = bundle.graph.nodes.filter((node) => node.metadata.lane === "residual");
  return residualNodes
    .map((node, index) => {
      const point = project(node.position);
      return `${index === 0 ? "M" : "L"} ${point.left} ${point.top}`;
    })
    .join(" ");
}

export function edgePath(source: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) {
  const start = project(source);
  const end = project(target);
  const midX = (start.left + end.left) / 2;
  const lift = Math.abs(start.top - end.top) < 6 ? -5 : -2;
  const midY = Math.min(start.top, end.top) + lift;
  return `M ${start.left} ${start.top} Q ${midX} ${midY} ${end.left} ${end.top}`;
}

export function grainStyle(seed: string, index: number) {
  const rng = seeded(seed, index + 1);
  const left = 18 + rng() * 64;
  const top = 18 + rng() * 64;
  const delay = rng() * 1.8;
  const scale = 0.45 + rng() * 1.2;
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `${delay}s`,
    transform: `translate(-50%, -50%) scale(${scale})`,
  } satisfies CSSProperties;
}

export function seeded(seed: string, salt: number) {
  let value = hashString(`${seed}:${salt}`) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967295;
  };
}
