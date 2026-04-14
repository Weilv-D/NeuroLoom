import { type CSSProperties, useMemo } from "react";

import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import type { QwenFramePayload } from "@neuroloom/official-traces";

import type { SelectionState } from "../types";

import { project, residualPath, edgePath, grainStyle, focusForNode } from "./layoutUtils";

export function SceneOverlay({
  bundle,
  frame,
  payload,
  selection,
  onSelect,
  live,
}: {
  bundle: TraceBundle;
  frame: TraceFrame | null;
  payload: QwenFramePayload | null;
  selection: SelectionState;
  onSelect(selection: SelectionState): void;
  live: boolean;
}) {
  const nodeMap = useMemo(() => new Map(bundle.graph.nodes.map((node) => [node.id, node])), [bundle.graph.nodes]);
  const nodeStateMap = useMemo(
    () =>
      new Map(
        (frame?.node_states ?? bundle.graph.nodes.map((node) => ({ nodeId: node.id, activation: 0.16, emphasis: 0.2 }))).map((state) => [
          state.nodeId,
          state,
        ]),
      ),
    [bundle.graph.nodes, frame?.node_states],
  );
  const focusedUnit = selection?.kind === "cluster" ? (payload?.sampledUnits.find((unit) => unit.id === selection.id) ?? null) : null;
  const focusedNodeId =
    selection?.kind === "node"
      ? selection.id
      : selection?.kind === "cluster"
        ? (focusedUnit?.nodeId ?? null)
        : selection?.kind === "token"
          ? "decode"
          : null;
  const relatedNodeIds = new Set<string>();
  if (focusedNodeId) {
    relatedNodeIds.add(focusedNodeId);
    bundle.graph.edges.forEach((edge) => {
      if (edge.source === focusedNodeId || edge.target === focusedNodeId) {
        relatedNodeIds.add(edge.source);
        relatedNodeIds.add(edge.target);
      }
    });
  }

  const overlayEdges = bundle.graph.edges
    .filter((edge) => edge.type.includes("return") || edge.type === "decode-flow" || edge.type === "residual-flow")
    .slice(0, 120);

  return (
    <div className={`stage-overlay-2d ${live ? "is-live" : ""}`}>
      {/* 
        All rigid paths, SVG rivers, and node labels removed per user request.
        The stage should feel like a fluid, textless, natural night sky / galaxy.
      */}
      {!payload ? <div className="stage-overlay">Waiting for token flow…</div> : null}
    </div>
  );
}
