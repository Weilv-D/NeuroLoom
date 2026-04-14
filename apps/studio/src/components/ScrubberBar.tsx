import { useId } from "react";

import type { TraceBundle, TraceFrame } from "@neuroloom/core";

export function ScrubberBar({
  bundle,
  frameIndex,
  playing,
  liveFollow,
  chapterIndex,
  frame,
  onStepFrame,
  onTogglePlay,
  onToggleLiveFollow,
  onJumpToChapter,
  onSetFrameIndex,
  onExportPng,
  onExportReplay,
  onImportTrace,
}: {
  bundle: TraceBundle | null;
  frameIndex: number;
  playing: boolean;
  liveFollow: boolean;
  chapterIndex: number;
  frame: TraceFrame | null;
  onStepFrame(delta: number): void;
  onTogglePlay(): void;
  onToggleLiveFollow(): void;
  onJumpToChapter(offset: number): void;
  onSetFrameIndex(index: number): void;
  onExportPng(): void;
  onExportReplay(): void;
  onImportTrace(file: File): void;
}) {
  const uploadId = useId();
  const disabled = !bundle || bundle.timeline.length === 0;

  return (
    <section className="scrubber-card">
      <div className="scrubber-actions">
        <button type="button" className="secondary-button" onClick={() => onStepFrame(-1)} disabled={disabled}>
          Prev
        </button>
        <button type="button" className="primary-button" onClick={onTogglePlay} disabled={disabled}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="secondary-button" onClick={() => onStepFrame(1)} disabled={disabled}>
          Next
        </button>
        <button type="button" className={liveFollow ? "secondary-button is-active" : "secondary-button"} onClick={onToggleLiveFollow}>
          Follow Live
        </button>
        <button type="button" className="secondary-button" onClick={onExportPng}>
          Export PNG
        </button>
        <button type="button" className="secondary-button" onClick={onExportReplay}>
          Export `.loomtrace`
        </button>
        <label htmlFor={uploadId} className="secondary-button secondary-button--file">
          Import Replay
        </label>
        <input
          id={uploadId}
          type="file"
          accept=".loomtrace"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportTrace(file);
          }}
        />
      </div>

      <input
        className="scrubber-range"
        type="range"
        min={0}
        max={Math.max((bundle?.timeline.length ?? 1) - 1, 0)}
        value={frameIndex}
        onChange={(event) => {
          onSetFrameIndex(Number(event.target.value));
        }}
        disabled={disabled}
      />

      <div className="scrubber-footer">
        <div className="range-caption">
          <span>Space play · ←/→ step · S export</span>
          <strong>{frame?.phase ?? "idle"}</strong>
        </div>
        <div className="chapter-actions">
          <button type="button" className="secondary-button" onClick={() => onJumpToChapter(-1)} disabled={!bundle || chapterIndex <= 0}>
            Prev Chapter
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onJumpToChapter(1)}
            disabled={!bundle || chapterIndex < 0 || chapterIndex >= bundle.narrative.chapters.length - 1}
          >
            Next Chapter
          </button>
        </div>
      </div>
    </section>
  );
}
