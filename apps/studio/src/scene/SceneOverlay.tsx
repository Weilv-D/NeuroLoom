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
      <svg className="stage-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="river" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2fe5ff" stopOpacity="0.15" />
            <stop offset="55%" stopColor="#9ff4ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#d7ff63" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="flow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2fe5ff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffb85f" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <path d={residualPath(bundle)} className="stage-river" />
        {overlayEdges.map((edge) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          return (
            <path
              key={edge.id}
              d={edgePath(source.position, target.position)}
              className={
                selection && (edge.source === focusedNodeId || edge.target === focusedNodeId) ? "stage-flow is-focused" : "stage-flow"
              }
            />
          );
        })}
      </svg>

      <div className="stage-stars">
        {bundle.graph.nodes.map((node) => {
          const state = nodeStateMap.get(node.id);
          const focus = focusForNode(node.id, selection, relatedNodeIds);
          const projected = project(node.position);
          return (
            <button
              key={node.id}
              type="button"
              className={`star-node lane-${String(node.metadata.lane ?? node.type)} focus-${focus}`}
              style={
                {
                  left: `${projected.left}%`,
                  top: `${projected.top}%`,
                  "--node-size": `${34 + Math.abs(state?.activation ?? 0.12) * 28}px`,
                  "--node-opacity": `${focus === "muted" ? 0.16 : 0.48 + Math.abs(state?.activation ?? 0.12) * 0.4}`,
                } as CSSProperties
              }
              onClick={() => onSelect({ kind: "node", id: node.id })}
            >
              <span className="star-core" />
              {Array.from({ length: 10 }, (_, index) => (
                <span key={index} className="star-grain" style={grainStyle(node.id, index)} />
              ))}
              {selection?.kind === "node" && selection.id === node.id ? <span className="star-label">{node.label}</span> : null}
            </button>
          );
        })}

        {payload?.tokenWindow.map((token, index) => {
          const absoluteIndex = payload.tokenIndex - payload.tokenWindow.length + index + 1;
          const selected = selection?.kind === "token" && selection.id === `token-${absoluteIndex}`;
          return (
            <button
              key={`${absoluteIndex}:${token}`}
              type="button"
              className={selected ? "token-node is-selected" : "token-node"}
              style={{ left: `${12 + index * 2.8}%`, top: "10%" }}
              onClick={() => onSelect({ kind: "token", id: `token-${absoluteIndex}` })}
            >
              <span />
              {selected || index === payload.tokenWindow.length - 1 ? <em>{token.trim() || "space"}</em> : null}
            </button>
          );
        })}
      </div>

      {!payload ? <div className="stage-overlay">Waiting for token flow…</div> : null}
    </div>
  );
}
