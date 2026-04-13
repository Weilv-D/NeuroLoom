import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import { startTransition, useDeferredValue, useEffect, useId } from "react";
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

  const frame = engine ? engine.getFrame(frameIndex) : null;
  const deferredFrame = useDeferredValue(frame);
  const currentChapter =
    bundle?.narrative.chapters.find((chapter) => chapter.id === activeChapterId) ??
    (engine ? engine.getChapterForFrame(frameIndex) ?? null : null);

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

            <section className="panel-section">
              <header className="panel-section__header">
                <span>{mode === "story" ? "Chapters" : "Story Anchors"}</span>
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
          </aside>

          <section className="stage-column">
            <div className="stage-frame">
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
            />
          </section>

          <aside className="panel panel--right">
            <InspectorPanel bundle={bundle} frame={deferredFrame} selection={selection} chapter={currentChapter?.description ?? null} />
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
  onTogglePlay
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
          <span>{frame.phase}</span>
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
