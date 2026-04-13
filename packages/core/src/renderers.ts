import type { TraceBundle, TraceFrame } from "./schema.js";

export type RendererSelection = {
  id: string;
  kind: "node" | "edge";
} | null;

export type NarrativeAnchor = {
  id: string;
  label: string;
  frame: number;
  description: string;
};

export interface RendererContract<SceneHandle = unknown> {
  buildScene(trace: TraceBundle): SceneHandle;
  bindFrame(scene: SceneHandle, frame: TraceFrame): void;
  bindSelection(scene: SceneHandle, selection: RendererSelection): void;
  getNarrativeAnchors(trace: TraceBundle): NarrativeAnchor[];
}
