import { describe, expect, test } from "vitest";

import { ReplayEngine, type TraceBundle } from "../src/index.js";

const fixture: TraceBundle = {
  manifest: {
    trace_version: "1.0.0",
    family: "transformer",
    model_id: "test-model",
    dataset_id: "test",
    title: "Test",
    summary: "Test replay",
    phase_set: ["decode"],
    frame_count: 3,
    camera_presets: [{ id: "cam", label: "Cam", position: { x: 0, y: 0, z: 10 }, target: { x: 0, y: 0, z: 0 }, fov: 30 }],
    visual_semantics: { positive: "#fff", negative: "#000", focus: "#ff0", neutral: "#aaa", bloomStrength: 1, fogDensity: 0 },
    payload_catalog: [],
    narrative_ref: "narrative.json",
  },
  graph: {
    nodes: [
      { id: "a", label: "A", type: "input", layerIndex: 0, order: 0, position: { x: 0, y: 0, z: 0 }, metadata: {} },
      { id: "b", label: "B", type: "output", layerIndex: 1, order: 0, position: { x: 1, y: 0, z: 0 }, metadata: {} },
    ],
    edges: [{ id: "e1", source: "a", target: "b", type: "flow", weight: 1 }],
    rootNodeIds: ["a"],
  },
  timeline: [
    {
      frame_id: 0,
      step: 0,
      substep: 0,
      phase: "decode",
      camera_anchor: "cam",
      node_states: [
        { nodeId: "a", activation: 0.5, emphasis: 0.6 },
        { nodeId: "b", activation: 0.2, emphasis: 0.3 },
      ],
      edge_states: [{ edgeId: "e1", intensity: 0.4, direction: "forward", emphasis: 0.5 }],
      metric_refs: [{ id: "m1", label: "M1", value: 0.9 }],
      payload_refs: [],
    },
    {
      frame_id: 1,
      step: 1,
      substep: 0,
      phase: "decode",
      camera_anchor: "cam",
      node_states: [
        { nodeId: "a", activation: 0.7, emphasis: 0.8 },
        { nodeId: "b", activation: 0.3, emphasis: 0.4 },
      ],
      edge_states: [{ edgeId: "e1", intensity: 0.5, direction: "forward", emphasis: 0.6 }],
      metric_refs: [{ id: "m1", label: "M1", value: 0.5 }],
      payload_refs: [],
    },
    {
      frame_id: 2,
      step: 2,
      substep: 0,
      phase: "decode",
      camera_anchor: "cam",
      node_states: [
        { nodeId: "a", activation: 0.9, emphasis: 0.9 },
        { nodeId: "b", activation: 0.6, emphasis: 0.7 },
      ],
      edge_states: [{ edgeId: "e1", intensity: 0.8, direction: "backward", emphasis: 0.8 }],
      metric_refs: [{ id: "m1", label: "M1", value: 0.2 }],
      payload_refs: [],
    },
  ],
  narrative: {
    intro: "Test intro",
    chapters: [
      { id: "early", label: "Early", frameRange: [0, 0], defaultSelection: "a", description: "First frame" },
      { id: "mid", label: "Mid", frameRange: [1, 1], description: "Middle" },
      { id: "late", label: "Late", frameRange: [2, 2], description: "Last frame" },
    ],
  },
  payloads: new Map(),
};

describe("ReplayEngine", () => {
  test("getFrame returns correct frame by index", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.getFrame(0).frame_id).toBe(0);
    expect(engine.getFrame(2).frame_id).toBe(2);
  });

  test("getFrame clamps out-of-range indices", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.getFrame(-1).frame_id).toBe(0);
    expect(engine.getFrame(100).frame_id).toBe(2);
  });

  test("seek moves to a specific frame", () => {
    const engine = new ReplayEngine(fixture);
    const frame = engine.seek(1);
    expect(frame.frame_id).toBe(1);
  });

  test("next advances one frame", () => {
    const engine = new ReplayEngine(fixture);
    engine.seek(0);
    expect(engine.next().frame_id).toBe(1);
  });

  test("prev goes back one frame", () => {
    const engine = new ReplayEngine(fixture);
    engine.seek(2);
    expect(engine.prev().frame_id).toBe(1);
  });

  test("next/prev clamp at boundaries", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.seek(2).frame_id).toBe(2);
    expect(engine.next().frame_id).toBe(2);

    expect(engine.seek(0).frame_id).toBe(0);
    expect(engine.prev().frame_id).toBe(0);
  });

  test("getChapterForFrame returns correct chapter", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.getChapterForFrame(0)?.id).toBe("early");
    expect(engine.getChapterForFrame(1)?.id).toBe("mid");
    expect(engine.getChapterForFrame(2)?.id).toBe("late");
  });

  test("getNodeState returns state for a node", () => {
    const engine = new ReplayEngine(fixture);
    const state = engine.getNodeState("a", 0);
    expect(state?.activation).toBe(0.5);
    expect(state?.nodeId).toBe("a");
  });

  test("getNodeState returns null for missing node", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.getNodeState("missing", 0)).toBeNull();
  });

  test("getEdgeState returns state for an edge", () => {
    const engine = new ReplayEngine(fixture);
    const state = engine.getEdgeState("e1", 2);
    expect(state?.direction).toBe("backward");
  });

  test("getPayload parses JSON payload", () => {
    const bundle: TraceBundle = {
      ...fixture,
      payloads: new Map([["p1", JSON.stringify({ value: 42 })]]),
    };
    const engine = new ReplayEngine(bundle);
    expect(engine.getPayload("p1")).toEqual({ value: 42 });
  });

  test("getPayload returns null for missing payload", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.getPayload("missing")).toBeNull();
  });

  test("frameCount matches timeline length", () => {
    const engine = new ReplayEngine(fixture);
    expect(engine.frameCount).toBe(3);
  });
});
