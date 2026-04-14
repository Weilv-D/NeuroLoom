import { describe, expect, test } from "vitest";

import { qwenBlockCount, qwenFfnNeuronsPerBlock, qwenAttnHeadsPerBlock } from "../src/constants.js";
import { createQwenOfficialTraceBundle } from "../src/recorder.js";
import { validateTraceBundle } from "@neuroloom/core";

describe("createQwenOfficialTraceBundle", () => {
  const bundle = createQwenOfficialTraceBundle();

  test("produces a valid TraceBundle", () => {
    const result = validateTraceBundle(bundle);
    expect(result.ok).toBe(true);
  });

  test("frame count matches manifest", () => {
    expect(bundle.timeline.length).toBe(bundle.manifest.frame_count);
  });

  test("all payload refs resolve", () => {
    for (const frame of bundle.timeline) {
      for (const ref of frame.payload_refs) {
        expect(bundle.payloads.has(ref)).toBe(true);
      }
    }
  });

  test("neurons count matches expected total", () => {
    const expectedPerBlock = qwenFfnNeuronsPerBlock + qwenAttnHeadsPerBlock;
    const expectedTotal = qwenBlockCount * expectedPerBlock;
    expect(bundle.graph.neurons).toHaveLength(expectedTotal);
  });

  test("neuron positions exist for every neuron", () => {
    const positions = bundle.graph.neuronPositions ?? {};
    for (const neuron of bundle.graph.neurons ?? []) {
      expect(positions[neuron.id]).toBeDefined();
      expect(positions[neuron.id]).toHaveLength(3);
    }
  });

  test("each frame has neuron_states matching total neuron count", () => {
    const expectedPerBlock = qwenFfnNeuronsPerBlock + qwenAttnHeadsPerBlock;
    const expectedTotal = qwenBlockCount * expectedPerBlock;
    for (const frame of bundle.timeline) {
      expect(frame.neuron_states).toHaveLength(expectedTotal);
    }
  });

  test("narrative has chapters covering all frames", () => {
    expect(bundle.narrative.chapters.length).toBeGreaterThan(0);
    const lastChapter = bundle.narrative.chapters.at(-1)!;
    expect(lastChapter.frameRange[1]).toBe(bundle.timeline.length - 1);
  });
});
