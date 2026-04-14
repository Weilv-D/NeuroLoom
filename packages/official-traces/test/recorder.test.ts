import { describe, expect, test } from "vitest";

import { QwenSessionRecorder, type QwenLiveEvent } from "../src/index.js";
import { hydrateBundleFromLiveStart, applyLiveTokenStep } from "../src/recorder.js";

describe("QwenSessionRecorder", () => {
  test("complete lifecycle: construct → pushToken × N → complete → exportBundle", () => {
    const recorder = new QwenSessionRecorder({
      sessionId: "test-session",
      prompt: "Hello world",
    });

    const startEvent = recorder.createStartEvent();
    expect(startEvent.type).toBe("session_started");
    expect(startEvent.sessionId).toBe("test-session");

    const events: QwenLiveEvent[] = [startEvent];
    const tokens = ["Hello", " from", " Qwen"];
    for (const token of tokens) {
      const event = recorder.pushToken(token);
      expect(event.type).toBe("token_step");
      expect(event.token).toBe(token);
      events.push(event);
    }

    const completedEvent = recorder.complete();
    expect(completedEvent.type).toBe("session_completed");
    expect(completedEvent.tokenCount).toBe(tokens.length);
    events.push(completedEvent);

    // Verify event ordering
    expect(events[0]?.type).toBe("session_started");
    for (let i = 1; i <= tokens.length; i++) {
      expect(events[i]?.type).toBe("token_step");
    }
    expect(events[events.length - 1]?.type).toBe("session_completed");

    // Verify exported bundle
    const bundle = recorder.exportBundle();
    expect(bundle.timeline).toHaveLength(tokens.length);
    expect(bundle.manifest.frame_count).toBe(tokens.length);
  });

  test("hydrateBundleFromLiveStart + applyLiveTokenStep round-trip", () => {
    const recorder = new QwenSessionRecorder({
      sessionId: "round-trip-test",
      prompt: "Test prompt",
    });

    const startEvent = recorder.createStartEvent();
    const bundle = hydrateBundleFromLiveStart(startEvent);

    expect(bundle.timeline).toHaveLength(0);
    expect(bundle.payloads.size).toBe(0);
    expect(bundle.graph.nodes.length).toBeGreaterThan(0);

    const tokenEvent = recorder.pushToken("Hello");
    const updatedBundle = applyLiveTokenStep(bundle, tokenEvent);

    expect(updatedBundle.timeline).toHaveLength(1);
    expect(updatedBundle.timeline[0]!.frame_id).toBe(tokenEvent.frame.frame_id);
    expect(updatedBundle.payloads.size).toBe(2); // render + inspect
    expect(updatedBundle.manifest.frame_count).toBe(1);

    // Verify the payload catalog was updated
    expect(updatedBundle.manifest.payload_catalog).toHaveLength(2);
  });

  test("pushToken produces events with correct token indices", () => {
    const recorder = new QwenSessionRecorder({
      sessionId: "index-test",
      prompt: "test",
    });
    recorder.createStartEvent();

    const tokens = ["A", " B", " C", " D"];
    for (let i = 0; i < tokens.length; i++) {
      const event = recorder.pushToken(tokens[i]!);
      expect(event.tokenIndex).toBe(i);
      expect(event.completion).toBe(tokens.slice(0, i + 1).join(""));
    }
  });

  test("exportBundle returns independent clone", () => {
    const recorder = new QwenSessionRecorder({
      sessionId: "clone-test",
      prompt: "test",
    });
    recorder.createStartEvent();
    recorder.pushToken("Hi");

    const bundle1 = recorder.exportBundle();
    const bundle2 = recorder.exportBundle();

    expect(bundle1).not.toBe(bundle2);
    expect(bundle1.timeline).not.toBe(bundle2.timeline);
    expect(bundle1.timeline).toHaveLength(bundle2.timeline.length);
  });
});
