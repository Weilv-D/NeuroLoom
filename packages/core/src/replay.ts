import type { TraceBundle, TraceFrame, TraceNarrative } from "./schema.js";

export type FrameSelection = {
  id: string;
  kind: "node" | "edge";
} | null;

export class ReplayEngine {
  readonly trace: TraceBundle;
  private frameIndex = 0;

  constructor(trace: TraceBundle) {
    this.trace = trace;
  }

  get frameCount(): number {
    return this.trace.timeline.length;
  }

  get currentFrame(): TraceFrame {
    return this.trace.timeline[this.frameIndex]!;
  }

  get narrative(): TraceNarrative {
    return this.trace.narrative;
  }

  seek(index: number): TraceFrame {
    this.frameIndex = clamp(index, 0, this.frameCount - 1);
    return this.currentFrame;
  }

  next(): TraceFrame {
    return this.seek(this.frameIndex + 1);
  }

  prev(): TraceFrame {
    return this.seek(this.frameIndex - 1);
  }

  getFrame(index: number): TraceFrame {
    return this.trace.timeline[clamp(index, 0, this.frameCount - 1)]!;
  }

  getChapterForFrame(index: number) {
    return this.trace.narrative.chapters.find((chapter) => {
      const [start, end] = chapter.frameRange;
      return index >= start && index <= end;
    });
  }

  getNodeState(nodeId: string, index = this.frameIndex) {
    return this.getFrame(index).node_states.find((state) => state.nodeId === nodeId) ?? null;
  }

  getEdgeState(edgeId: string, index = this.frameIndex) {
    return this.getFrame(index).edge_states.find((state) => state.edgeId === edgeId) ?? null;
  }

  getPayload(payloadId: string) {
    const raw = this.trace.payloads.get(payloadId);
    return raw ? JSON.parse(raw) : null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
