import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import { startTransition, useDeferredValue, useEffect, useId, useRef } from "react";
import { scaleLinear } from "d3-scale";

import { SceneCanvas } from "./SceneCanvas";
import { officialTraces } from "./sampleTraces";
import { type SelectionState, useStudioStore } from "./state";
import { loadTraceFromFile, loadTraceFromUrl } from "./traceLoader";

export function App() {
  const {
    mode,
    traceId,
    bundle,
    engine,
    loadingLabel,
    error,
    frameIndex,
    playing,
    selection,
    activeChapterId,
    setMode,
    beginLoading,
    finishLoading,
    failLoading,
    setFrameIndex,
    step,
    togglePlaying,
    setPlaying,
    setSelection,
    jumpToChapter
  } = useStudioStore();
  const uploadId = useId();
  const stageFrameRef = useRef<HTMLDivElement | null>(null);

  async function ingestTrace(nextTraceId: string, loader: () => Promise<TraceBundle>) {
    beginLoading(nextTraceId);
    try {
      const nextBundle = await loader();
      startTransition(() => {
        finishLoading(nextTraceId, nextBundle);
      });
    } catch (loadError) {
      failLoading((loadError as Error).message);
    }
  }

  useEffect(() => {
    if (bundle || loadingLabel) return;
    const firstTrace = officialTraces[0];
    void ingestTrace(firstTrace.id, () => loadTraceFromUrl(firstTrace.path));
  }, [bundle, loadingLabel]);

  useEffect(() => {
    if (!playing || !engine) return;
    const intervalId = window.setInterval(() => {
      const state = useStudioStore.getState();
      if (!state.engine) return;
      if (state.frameIndex >= state.engine.frameCount - 1) {
        state.setPlaying(false);
        return;
      }
      state.step(1);
    }, 520);

    return () => window.clearInterval(intervalId);
  }, [playing, engine]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
        return;
      }
      if (!useStudioStore.getState().engine) return;
      if (event.key === " ") {
        event.preventDefault();
        useStudioStore.getState().togglePlaying();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        useStudioStore.getState().step(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        useStudioStore.getState().step(1);
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void exportStageSnapshot();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [traceId, deferredFrame, failLoading]);

  const frame = engine ? engine.getFrame(frameIndex) : null;
  const deferredFrame = useDeferredValue(frame);
  const currentChapter =
    bundle?.narrative.chapters.find((chapter) => chapter.id === activeChapterId) ??
    (engine ? engine.getChapterForFrame(frameIndex) ?? null : null);
  const activeTrace = officialTraces.find((trace) => trace.id === traceId) ?? officialTraces.find((trace) => trace.family === bundle?.manifest.family);
  const currentChapterIndex = currentChapter && bundle ? bundle.narrative.chapters.findIndex((chapter) => chapter.id === currentChapter.id) : -1;
  const renderPayloadId =
    bundle && deferredFrame
      ? bundle.manifest.payload_catalog.find((entry) => entry.kind === "render" && deferredFrame.payload_refs.includes(entry.id))?.id ?? null
      : null;
  const renderPayload = bundle && renderPayloadId ? parsePayload(bundle.payloads.get(renderPayloadId)) : null;

  async function exportStageSnapshot() {
    if (!traceId || !deferredFrame) return;
    const canvas = stageFrameRef.current?.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      failLoading("Snapshot export failed: stage canvas is unavailable.");
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      failLoading("Snapshot export failed: browser could not create a PNG.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${traceId}-frame-${String(deferredFrame.frame_id).padStart(3, "0")}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">NeuroLoom v1</p>
          <h1>Neural networks, replayed as a precise 2.5D stage.</h1>
          <p className="hero-text">
            NeuroLoom is a replay-first explainer for <code>MLP</code>, <code>CNN</code>, and standard
            <code> GPT-style Transformer</code> traces. It reconstructs one training or inference run into a
            controllable visual scene where glow, motion, and numeric truth stay in sync.
          </p>
          <div className="hero-definition">
            <span>Definition</span>
            <strong>NeuroLoom is a neural network replay explainer.</strong>
          </div>
        </div>
        <div className="hero-stats">
          <StatCard label="Families" value="3 official" detail="MLP / CNN / Transformer" />
          <StatCard label="Modes" value="Story + Studio" detail="Guided narrative and frame-by-frame analysis" />
          <StatCard label="Input" value=".loomtrace" detail="Controlled replay bundle with schema validation" />
        </div>
      </header>

      <section className="trace-library">
        {officialTraces.map((trace) => (
          <button
            key={trace.id}
            type="button"
            className={`trace-card trace-card--${trace.accent} ${traceId === trace.id ? "is-active" : ""}`}
            onClick={() => void ingestTrace(trace.id, () => loadTraceFromUrl(trace.path))}
          >
            <span className="trace-card__family">{trace.family}</span>
            <strong>{trace.label}</strong>
            <p>{trace.summary}</p>
          </button>
        ))}
      </section>

      <section className="toolbar">
        <div className="toolbar__group">
          <button type="button" className={mode === "story" ? "chip is-active" : "chip"} onClick={() => setMode("story")}>
            Story Mode
          </button>
          <button type="button" className={mode === "studio" ? "chip is-active" : "chip"} onClick={() => setMode("studio")}>
            Studio Mode
          </button>
        </div>
        <div className="toolbar__group toolbar__group--meta">
          {bundle ? (
            <>
              <span className="meta-pill">{bundle.manifest.title}</span>
              <span className="meta-pill">{bundle.manifest.family}</span>
              <span className="meta-pill">{bundle.manifest.frame_count} frames</span>
            </>
          ) : null}
        </div>
        <div className="toolbar__group">
          <button type="button" className="chip" onClick={() => void exportStageSnapshot()} disabled={!bundle}>
            Export PNG
          </button>
          <label htmlFor={uploadId} className="chip chip--file">
            Import `.loomtrace`
          </label>
          <input
            id={uploadId}
            className="visually-hidden"
            type="file"
            accept=".loomtrace"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void ingestTrace(file.name, () => loadTraceFromFile(file));
              event.currentTarget.value = "";
            }}
          />
        </div>
      </section>

      {loadingLabel ? <div className="banner banner--info">Loading {loadingLabel}…</div> : null}
      {error ? <div className="banner banner--error">{error}</div> : null}

      {bundle && deferredFrame ? (
        <main className="workspace">
          <aside className="panel panel--left">
            <section className="panel-section">
              <header className="panel-section__header">
                <span>Trace</span>
                <strong>{bundle.manifest.summary}</strong>
              </header>
              <p className="muted-copy">{bundle.narrative.intro}</p>
            </section>

            {mode === "story" ? (
              <>
                <section className="panel-section">
                  <header className="panel-section__header">
                    <span>Narrative Track</span>
                    <strong>{bundle.narrative.chapters.length} chapters</strong>
                  </header>
                  <div className="stack-list">
                    {bundle.narrative.chapters.map((chapter, index) => (
                      <button
                        key={chapter.id}
                        type="button"
                        className={chapter.id === currentChapter?.id ? "stack-item is-active stack-item--story" : "stack-item stack-item--story"}
                        onClick={() => jumpToChapter(chapter.id)}
                      >
                        <div>
                          <span>{chapter.label}</span>
                          <small>{chapter.description}</small>
                        </div>
                        <small>
                          {index + 1}/{bundle.narrative.chapters.length}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>

                {activeTrace ? (
                  <section className="panel-section">
                    <header className="panel-section__header">
                      <span>Watch For</span>
                      <strong>{activeTrace.family}</strong>
                    </header>
                    <p className="story-title">{activeTrace.storyTitle}</p>
                    <KeyList items={activeTrace.watchFor} />
                  </section>
                ) : null}
              </>
            ) : (
              <>
                <section className="panel-section">
                  <header className="panel-section__header">
                    <span>Story Anchors</span>
                    <strong>{bundle.narrative.chapters.length} stops</strong>
                  </header>
                  <div className="stack-list">
                    {bundle.narrative.chapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        type="button"
                        className={chapter.id === currentChapter?.id ? "stack-item is-active" : "stack-item"}
                        onClick={() => jumpToChapter(chapter.id)}
                      >
                        <span>{chapter.label}</span>
                        <small>
                          {chapter.frameRange[0]}–{chapter.frameRange[1]}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel-section">
                  <header className="panel-section__header">
                    <span>Structure</span>
                    <strong>{bundle.graph.nodes.length} nodes</strong>
                  </header>
                  <StructureList bundle={bundle} selection={selection} onSelect={setSelection} />
                </section>

                {activeTrace ? (
                  <section className="panel-section">
                    <header className="panel-section__header">
                      <span>Studio Tips</span>
                      <strong>3 prompts</strong>
                    </header>
                    <KeyList items={activeTrace.studioTips} />
                  </section>
                ) : null}
              </>
            )}
          </aside>

          <section className="stage-column">
            <div className="stage-frame" ref={stageFrameRef}>
              <div className="stage-frame__overlay">
                <div>
                  <span className="overlay-label">Phase</span>
                  <strong>{deferredFrame.phase}</strong>
                </div>
                <div>
                  <span className="overlay-label">Step</span>
                  <strong>
                    {deferredFrame.step}.{deferredFrame.substep}
                  </strong>
                </div>
                {currentChapter ? (
                  <div>
                    <span className="overlay-label">Chapter</span>
                    <strong>{currentChapter.label}</strong>
                  </div>
                ) : null}
              </div>
              <div className="stage-frame__lens">
                <RenderLens payload={renderPayload} family={bundle.manifest.family} mode={mode} />
              </div>
              <div className="stage-frame__legend">
                <LegendPill colorClass="is-electric" label="Activation / forward flow" />
                <LegendPill colorClass="is-amber" label="Compression / backward pressure" />
                <LegendPill colorClass="is-lime" label="Selection / chapter focus" />
              </div>
              <SceneCanvas bundle={bundle} frame={deferredFrame} selection={selection} onSelect={setSelection} />
            </div>
            <TimelineBar
              frame={deferredFrame}
              frameIndex={frameIndex}
              frameCount={bundle.manifest.frame_count}
              playing={playing}
              chapter={currentChapter?.label ?? null}
              onSeek={setFrameIndex}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onTogglePlay={togglePlaying}
              onExport={() => void exportStageSnapshot()}
              onPrevChapter={() => {
                if (!bundle || currentChapterIndex <= 0) return;
                jumpToChapter(bundle.narrative.chapters[currentChapterIndex - 1]!.id);
              }}
              onNextChapter={() => {
                if (!bundle || currentChapterIndex < 0 || currentChapterIndex >= bundle.narrative.chapters.length - 1) return;
                jumpToChapter(bundle.narrative.chapters[currentChapterIndex + 1]!.id);
              }}
            />
          </section>

          <aside className="panel panel--right">
            {mode === "story" ? (
              <StoryPanel
                bundle={bundle}
                frame={deferredFrame}
                chapter={currentChapter}
                activeTraceTitle={activeTrace?.storyTitle ?? null}
                watchFor={activeTrace?.watchFor ?? []}
              />
            ) : (
              <InspectorPanel bundle={bundle} frame={deferredFrame} selection={selection} chapter={currentChapter?.description ?? null} />
            )}
          </aside>
        </main>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function TimelineBar({
  frame,
  frameIndex,
  frameCount,
  playing,
  chapter,
  onSeek,
  onPrev,
  onNext,
  onTogglePlay,
  onExport,
  onPrevChapter,
  onNextChapter
}: {
  frame: TraceFrame;
  frameIndex: number;
  frameCount: number;
  playing: boolean;
  chapter: string | null;
  onSeek(index: number): void;
  onPrev(): void;
  onNext(): void;
  onTogglePlay(): void;
  onExport(): void;
  onPrevChapter(): void;
  onNextChapter(): void;
}) {
  return (
    <div className="timeline">
      <div className="timeline__controls">
        <button type="button" className="chip" onClick={onPrev}>
          Prev
        </button>
        <button type="button" className="chip chip--play" onClick={onTogglePlay}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="chip" onClick={onNext}>
          Next
        </button>
        <button type="button" className="chip" onClick={onExport}>
          PNG
        </button>
      </div>
      <div className="timeline__track">
        <input
          type="range"
          min={0}
          max={frameCount - 1}
          value={frameIndex}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
        <div className="timeline__meta">
          <span>
            Frame {frame.frame_id + 1} / {frameCount}
          </span>
          <span>{chapter ?? "Free scrub"}</span>
          <span className="timeline__hotkeys">`Space` play · `←/→` step · `S` export</span>
          <div className="timeline__chapter-nav">
            <button type="button" className="chip chip--ghost" onClick={onPrevChapter}>
              Prev Chapter
            </button>
            <button type="button" className="chip chip--ghost" onClick={onNextChapter}>
              Next Chapter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StructureList({
  bundle,
  selection,
  onSelect
}: {
  bundle: TraceBundle;
  selection: SelectionState;
  onSelect(selection: SelectionState): void;
}) {
  const layerIndexes = Array.from(new Set(bundle.graph.nodes.map((node) => node.layerIndex))).sort((left, right) => left - right);

  return (
    <div className="layer-groups">
      {layerIndexes.map((layerIndex) => (
        <div key={layerIndex} className="layer-group">
          <span className="layer-group__label">Layer {layerIndex}</span>
          {bundle.graph.nodes
            .filter((node) => node.layerIndex === layerIndex)
            .sort((left, right) => left.order - right.order)
            .map((node) => (
              <button
                key={node.id}
                type="button"
                className={selection?.id === node.id ? "structure-pill is-active" : "structure-pill"}
                onClick={() => onSelect({ id: node.id, kind: "node" })}
              >
                <span>{node.label}</span>
                <small>{node.type}</small>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}

function InspectorPanel({
  bundle,
  frame,
  selection,
  chapter
}: {
  bundle: TraceBundle;
  frame: TraceFrame;
  selection: SelectionState;
  chapter: string | null;
}) {
  const inspectPayloadId =
    bundle.manifest.payload_catalog.find((entry) => entry.kind === "inspect" && frame.payload_refs.includes(entry.id))?.id ?? null;
  const inspectPayload = inspectPayloadId ? parsePayload(bundle.payloads.get(inspectPayloadId)) : null;
  const selectedDetail =
    selection?.kind === "node" && inspectPayload && typeof inspectPayload === "object" && "selectionDetails" in inspectPayload
      ? inspectPayload.selectionDetails?.[selection.id]
      : null;

  return (
    <>
      <section className="panel-section">
        <header className="panel-section__header">
          <span>Narrative Notes</span>
          <strong>{chapter ? "Current chapter" : "Frame note"}</strong>
        </header>
        <p className="muted-copy">{chapter ?? frame.note ?? "No note for this frame."}</p>
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <span>Frame Metrics</span>
          <strong>{frame.metric_refs.length} values</strong>
        </header>
        <div className="metric-grid">
          {frame.metric_refs.map((metric) => (
            <article key={metric.id} className="metric-card">
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <span>Tensor Slice</span>
          <strong>{inspectPayload?.headline ?? "No payload"}</strong>
        </header>
        {inspectPayload ? <PayloadView payload={inspectPayload} /> : <p className="muted-copy">No inspect payload.</p>}
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <span>Structure</span>
          <strong>{selection ? selection.id : "Nothing selected"}</strong>
        </header>
        {selectedDetail ? (
          <div className="detail-card">
            <strong>{selectedDetail.title}</strong>
            <p>{selectedDetail.blurb}</p>
            <div className="detail-stats">
              {selectedDetail.stats.map((stat: { label: string; value: number }) => (
                <div key={stat.label} className="detail-stat">
                  <span>{stat.label}</span>
                  <strong>{formatMetric(stat.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted-copy">Select a node to inspect family-specific details.</p>
        )}
      </section>
    </>
  );
}

function StoryPanel({
  bundle,
  frame,
  chapter,
  activeTraceTitle,
  watchFor
}: {
  bundle: TraceBundle;
  frame: TraceFrame;
  chapter: TraceBundle["narrative"]["chapters"][number] | null | undefined;
  activeTraceTitle: string | null;
  watchFor: readonly string[];
}) {
  return (
    <>
      <section className="panel-section">
        <header className="panel-section__header">
          <span>Story Focus</span>
          <strong>{chapter?.label ?? "Current frame"}</strong>
        </header>
        <p className="story-title">{activeTraceTitle ?? bundle.manifest.summary}</p>
        <p className="muted-copy">{chapter?.description ?? frame.note ?? "No chapter description available."}</p>
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <span>Chapter Metrics</span>
          <strong>{frame.metric_refs.length} values</strong>
        </header>
        <div className="metric-grid">
          {frame.metric_refs.map((metric) => (
            <article key={metric.id} className="metric-card">
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <span>What To Watch</span>
          <strong>{watchFor.length} cues</strong>
        </header>
        <KeyList items={watchFor} />
      </section>

      <section className="panel-section">
        <header className="panel-section__header">
          <span>Current Note</span>
          <strong>{frame.phase}</strong>
        </header>
        <div className="detail-card">
          <strong>{bundle.manifest.title}</strong>
          <p>{frame.note ?? "This frame has no additional note."}</p>
        </div>
      </section>
    </>
  );
}

function RenderLens({
  payload,
  family,
  mode
}: {
  payload: Record<string, unknown> | null;
  family: TraceBundle["manifest"]["family"];
  mode: "story" | "studio";
}) {
  const matrix = Array.isArray(payload?.matrix) ? (payload.matrix as number[][]) : null;
  const series = Array.isArray(payload?.series) ? (payload.series as Array<{ label: string; value: number }>) : null;
  const headline = typeof payload?.headline === "string" ? payload.headline : "Render lens";

  return (
    <div className="render-lens">
      <div className="render-lens__header">
        <span>{mode === "story" ? "Story Lens" : "Render Lens"}</span>
        <strong>{family}</strong>
      </div>
      <p className="render-lens__title">{headline}</p>
      {matrix ? <MatrixHeatmap matrix={matrix.slice(0, 6).map((row) => row.slice(0, 6))} /> : null}
      {series ? (
        <div className="render-lens__series">
          {series.slice(0, 3).map((item) => (
            <div key={item.label} className="render-lens__series-item">
              <span>{item.label}</span>
              <strong>{formatMetric(item.value)}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegendPill({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className={`legend-pill ${colorClass}`}>
      <i />
      {label}
    </span>
  );
}

function KeyList({ items }: { items: readonly string[] }) {
  return (
    <div className="key-list">
      {items.map((item) => (
        <article key={item} className="key-list__item">
          <span className="key-list__marker" />
          <p>{item}</p>
        </article>
      ))}
    </div>
  );
}

function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  const matrix = Array.isArray(payload.matrix) ? (payload.matrix as number[][]) : null;
  const series = Array.isArray(payload.series) ? (payload.series as Array<{ label: string; value: number }>) : null;

  return (
    <div className="payload-view">
      {series ? (
        <div className="series-bars">
          {series.map((item) => (
            <div key={item.label} className="series-bar">
              <div className="series-bar__meta">
                <span>{item.label}</span>
                <strong>{formatMetric(item.value)}</strong>
              </div>
              <div className="series-bar__track">
                <div className="series-bar__fill" style={{ width: `${Math.max(6, Math.abs(item.value) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {matrix ? <MatrixHeatmap matrix={matrix} /> : null}
    </div>
  );
}

function MatrixHeatmap({ matrix }: { matrix: number[][] }) {
  const scale = scaleLinear<string>().domain([-1, 0, 1]).range(["#ffb45b", "#121b2b", "#15f0ff"]);

  return (
    <div
      className="matrix-heatmap"
      style={{
        gridTemplateColumns: `repeat(${matrix[0]?.length ?? 1}, minmax(0, 1fr))`
      }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className="matrix-cell"
            title={String(value)}
            style={{ backgroundColor: scale(value) }}
          />
        ))
      )}
    </div>
  );
}

function parsePayload(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatMetric(value: number) {
  return value.toFixed(Math.abs(value) >= 1 ? 2 : 3);
}
