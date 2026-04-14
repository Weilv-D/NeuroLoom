import { ReplayEngine, qwenFramePayloadSchema, type TraceBundle, type TraceFrame } from "@neuroloom/core";
import { createQwenOfficialTraceBundle, type QwenFramePayload } from "@neuroloom/official-traces";
import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { ScrubberBar } from "./components/ScrubberBar";
import { StudioContext } from "./contexts/StudioContext";
import { usePlayback } from "./hooks/usePlayback";
import { useRunner } from "./hooks/useRunner";
import { useSession } from "./hooks/useSession";
import { probeRunnerBackend } from "./runnerClient";
import { SceneCanvas } from "./SceneCanvas";
import { qwenSampleTrace } from "./sampleTraces";
import { loadTraceFromUrl } from "./traceLoader";
import type { SelectionState } from "./types";

function getInspectPayload(bundle: TraceBundle, frame: TraceFrame): QwenFramePayload | null {
  const payloadId = frame.payload_refs.find((ref) =>
    bundle.manifest.payload_catalog.find((entry) => entry.id === ref && entry.kind === "inspect"),
  );
  if (!payloadId) return null;
  const raw = bundle.payloads.get(payloadId);
  if (!raw) return null;
  const result = qwenFramePayloadSchema.safeParse(JSON.parse(raw));
  return result.success ? result.data : null;
}

function readLastCompletion(bundle: TraceBundle): string {
  const lastFrame = bundle.timeline.at(-1);
  if (!lastFrame) return "";
  return getInspectPayload(bundle, lastFrame)?.completion ?? "";
}

export function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [bundle, setBundleState] = useState<TraceBundle | null>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [statusLine, setStatusLine] = useState("Loading the official Qwen replay…");
  const [loadingLabel, setLoadingLabel] = useState<string | null>("Loading the official Qwen replay…");
  const [error, setError] = useState<string | null>(null);
  const [assistantText, setAssistantText] = useState("");

  const playback = usePlayback(bundle);
  const runner = useRunner();
  const session = useSession({
    liveFollowRef: playback.liveFollowRef,
    bundle,
    frameIndex: playback.frameIndex,
    runnerHealth: runner.runnerHealth,
    stageRef,
    setRunnerSessions: runner.setRunnerSessions,
    onSetBundle: (nextBundle, text, status) => {
      if (nextBundle) setBundleState(nextBundle);
      if (text !== undefined) setAssistantText(text);
      if (status !== undefined) setStatusLine(status);
    },
    onSetFrameIndex: playback.setFrameIndex,
    onSetSelection: setSelection,
    onSetPlaying: playback.setPlaying,
    onSetLiveFollow: playback.setLiveFollow,
    onError: (e) => setError(e),
    onSetLoadingLabel: setLoadingLabel,
    onSetStatusLine: setStatusLine,
  });

  // Boot: load demo replay on mount
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoadingLabel("Loading the official Qwen replay…");
      try {
        const nextBundle = await loadTraceFromUrl(qwenSampleTrace.path);
        if (cancelled) return;
        setBundleState(nextBundle);
        setAssistantText(readLastCompletion(nextBundle));
        setStatusLine("Demo replay ready. Start the local runner for live sessions.");
      } catch {
        const fallbackBundle = createQwenOfficialTraceBundle();
        if (cancelled) return;
        setBundleState(fallbackBundle);
        setAssistantText(readLastCompletion(fallbackBundle));
        setStatusLine("Demo replay loaded from the bundled fallback trace.");
      } finally {
        if (!cancelled) setLoadingLabel(null);
      }
      if (!cancelled) await runner.refreshRunnerStatus();
    }

    void boot();
    const healthInterval = window.setInterval(() => {
      if (!cancelled) void runner.refreshRunnerStatus({ includeProbe: false });
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(healthInterval);
      session.disconnectRef.current?.();
    };
    // boot effect: intentional mount-only dep list
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    return playback.registerKeyboardShortcuts({
      onExportPng: () => void session.exportPng(),
    });
  }, [playback, session]);

  // Derived state
  const engine = useMemo(() => (bundle && bundle.timeline.length > 0 ? new ReplayEngine(bundle) : null), [bundle]);
  const safeFrameIndex = bundle ? Math.max(0, Math.min(playback.frameIndex, Math.max(bundle.timeline.length - 1, 0))) : 0;
  const frame = engine ? engine.getFrame(safeFrameIndex) : null;
  const currentChapter = frame && engine ? engine.getChapterForFrame(safeFrameIndex) : (bundle?.narrative.chapters[0] ?? null);
  const currentPayload = bundle && frame ? getInspectPayload(bundle, frame) : null;
  const currentMetrics = frame?.metric_refs ?? [];
  const currentTopLogits = currentPayload?.topLogits ?? [];
  const focusBlock = currentPayload ? currentPayload.tokenIndex % 24 : 0;
  const focusDigest = currentPayload ? currentPayload.blockDigest.slice(Math.max(0, focusBlock - 2), Math.min(24, focusBlock + 3)) : [];
  const chapterIndex = currentChapter && bundle ? bundle.narrative.chapters.findIndex((chapter) => chapter.id === currentChapter.id) : -1;

  return (
    <ErrorBoundary>
      <StudioContext.Provider value={{ bundle, frame, payload: currentPayload, selection, live: session.sessionMode === "live" }}>
        <div className="app-shell">
          <header className="app-header">
            <div>
              <p className="eyebrow">NeuroLoom</p>
              <h1>Qwen3.5-0.8B, rendered as a live starfield.</h1>
              <p className="hero-text">
                A single-model stage for Qwen conversations. Live sessions stream into a dense field of residual light, grouped attention,
                DeltaNet memory, and replayable decode traces.
              </p>
            </div>
            <div className="header-badges">
              <span className="status-pill status-pill--accent">{qwenSampleTrace.label}</span>
              <span className="status-pill">{bundle?.timeline.length ?? 0} frames</span>
              <span className={`status-pill ${runner.runnerHealth ? "status-pill--live" : "status-pill--muted"}`}>
                {runner.runnerHealth ? `Runner ${runner.runnerHealth.mode}` : runner.runnerChecked ? "Runner offline" : "Runner probing"}
              </span>
              <span className={`status-pill ${session.sessionMode === "live" ? "status-pill--live" : ""}`}>{session.sessionMode}</span>
            </div>
          </header>

          <main className="workspace">
            <LeftPanel
              promptDraft={session.promptDraft}
              onSetPromptDraft={session.setPromptDraft}
              activePrompt={session.activePrompt}
              assistantText={assistantText}
              runnerHealth={runner.runnerHealth}
              runnerChecked={runner.runnerChecked}
              backendProbe={runner.backendProbe}
              sessionMode={session.sessionMode}
              sessionId={session.sessionId}
              loadingLabel={loadingLabel}
              error={error}
              statusLine={statusLine}
              currentPayload={currentPayload}
              currentTokenWindow={currentPayload?.tokenWindow ?? []}
              selection={selection}
              runnerSessions={runner.runnerSessions}
              onStartLiveSession={() => void session.startLiveSession()}
              onLoadSampleReplay={() => void session.loadSampleReplay()}
              onRefreshRunnerStatus={() => void runner.refreshRunnerStatus()}
              onProbeBackend={async () => runner.setBackendProbe(await probeRunnerBackend())}
              onStopLiveSession={() => void session.stopLiveSession()}
              onSetSelection={setSelection}
              onOpenRunnerReplay={(s) => void session.openRunnerReplay(s)}
            />

            <section className="center-column">
              <section className="stage-card" ref={stageRef}>
                <div className="stage-meta">
                  <div>
                    <p className="eyebrow">Frame</p>
                    <strong>
                      {bundle?.timeline.length ? safeFrameIndex + 1 : 0} / {bundle?.timeline.length ?? 0}
                    </strong>
                  </div>
                  <div>
                    <p className="eyebrow">Current Token</p>
                    <strong>{currentPayload?.token?.trim() || "idle"}</strong>
                  </div>
                  <div>
                    <p className="eyebrow">Chapter</p>
                    <strong>{currentChapter?.label ?? "Awaiting Tokens"}</strong>
                  </div>
                  <div>
                    <p className="eyebrow">Focus</p>
                    <strong>{selection ? `${selection.kind} · ${selection.id}` : "none"}</strong>
                  </div>
                </div>

                <ErrorBoundary>
                  {bundle ? (
                    <SceneCanvas
                      bundle={bundle}
                      frame={frame}
                      payload={currentPayload}
                      selection={selection}
                      onSelect={setSelection}
                      live={session.sessionMode === "live"}
                    />
                  ) : (
                    <div className="stage-placeholder">Preparing the starfield…</div>
                  )}
                </ErrorBoundary>
              </section>

              <ScrubberBar
                bundle={bundle}
                frameIndex={safeFrameIndex}
                playing={playback.playing}
                liveFollow={playback.liveFollow}
                chapterIndex={chapterIndex}
                frame={frame}
                onStepFrame={playback.stepFrame}
                onTogglePlay={() => playback.setPlaying((c) => !c)}
                onToggleLiveFollow={() => playback.setLiveFollow((c) => !c)}
                onJumpToChapter={(offset) => playback.jumpToChapter(offset, chapterIndex, bundle?.narrative.chapters ?? [], setSelection)}
                onSetFrameIndex={(i) => {
                  playback.setFrameIndex(i);
                  playback.setPlaying(false);
                  playback.setLiveFollow(false);
                }}
                onExportPng={() => void session.exportPng()}
                onExportReplay={() => void session.exportReplay()}
                onImportTrace={(f) => void session.importTrace(f)}
              />
            </section>

            <RightPanel
              bundle={bundle}
              frame={frame}
              payload={currentPayload}
              selection={selection}
              currentMetrics={currentMetrics}
              currentTopLogits={currentTopLogits}
              focusBlock={focusBlock}
              focusDigest={focusDigest}
            />
          </main>
        </div>
      </StudioContext.Provider>
    </ErrorBoundary>
  );
}
