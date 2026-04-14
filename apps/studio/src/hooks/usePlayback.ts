import { useEffect, useRef, useState } from "react";

import type { TraceBundle } from "@neuroloom/core";

const playbackIntervalMs = 160;

export function usePlayback(bundle: TraceBundle | null) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [liveFollow, setLiveFollow] = useState(true);
  const liveFollowRef = useRef(true);

  useEffect(() => {
    liveFollowRef.current = liveFollow;
  }, [liveFollow]);

  useEffect(() => {
    if (!playing || !bundle || bundle.timeline.length === 0) return;
    const intervalId = window.setInterval(() => {
      setFrameIndex((current) => {
        const lastFrame = bundle.timeline.length - 1;
        if (current >= lastFrame) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, playbackIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [playing, bundle]);

  function stepFrame(delta: number) {
    if (!bundle || bundle.timeline.length === 0) return;
    setFrameIndex((current) => Math.max(0, Math.min(current + delta, bundle.timeline.length - 1)));
    setPlaying(false);
    setLiveFollow(false);
  }

  function jumpToChapter(
    offset: number,
    chapterIndex: number,
    chapters: TraceBundle["narrative"]["chapters"],
    onSelect: (selection: { kind: "node"; id: string } | null) => void,
  ) {
    if (!bundle || chapterIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(chapterIndex + offset, chapters.length - 1));
    const nextChapter = chapters[nextIndex];
    if (!nextChapter) return;
    setFrameIndex(nextChapter.frameRange[0]);
    setPlaying(false);
    setLiveFollow(false);
    onSelect(nextChapter.defaultSelection ? { kind: "node", id: nextChapter.defaultSelection } : null);
  }

  function registerKeyboardShortcuts(handlers: { onExportPng: () => void }) {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["TEXTAREA", "INPUT", "BUTTON", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (!bundle || bundle.timeline.length === 0) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((current) => !current);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepFrame(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stepFrame(1);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handlers.onExportPng();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }

  return {
    frameIndex,
    setFrameIndex,
    playing,
    setPlaying,
    liveFollow,
    setLiveFollow,
    liveFollowRef,
    stepFrame,
    jumpToChapter,
    registerKeyboardShortcuts,
  };
}
