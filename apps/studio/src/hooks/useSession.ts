import { startTransition, useRef, useState } from "react";

import { createLoomTraceArchive, type TraceBundle } from "@neuroloom/core";
import {
  applyLiveTokenStep,
  createQwenOfficialTraceBundle,
  hydrateBundleFromLiveStart,
  type QwenTokenStepEvent,
} from "@neuroloom/official-traces";

import {
  cancelRunnerSession,
  connectToSession,
  downloadTraceFromRunner,
  listRunnerSessions,
  startChatSession,
  type RunnerSession,
} from "../runnerClient";
import { qwenSampleTrace } from "../sampleTraces";
import { loadTraceFromFile, loadTraceFromUrl } from "../traceLoader";
import type { SelectionState } from "../types";

export type SessionMode = "sample" | "connecting" | "live" | "replay";

const defaultPrompt = "Explain how NeuroLoom should make a Qwen3.5-0.8B conversation feel like light moving through a dense starfield.";

function getInspectPayload(bundle: TraceBundle, frame: { payload_refs: string[] }) {
  const pId = frame.payload_refs.find((ref) =>
    bundle.manifest.payload_catalog.find((entry) => entry.id === ref && entry.kind === "inspect"),
  );
  if (!pId) return null;
  const raw = bundle.payloads.get(pId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLastCompletion(bundle: TraceBundle) {
  const lastFrame = bundle.timeline.at(-1);
  if (!lastFrame) return "";
  return getInspectPayload(bundle, lastFrame)?.completion ?? "";
}

function cloneBundle(bundle: TraceBundle): TraceBundle {
  return {
    manifest: JSON.parse(JSON.stringify(bundle.manifest)) as TraceBundle["manifest"],
    graph: JSON.parse(JSON.stringify(bundle.graph)) as TraceBundle["graph"],
    narrative: JSON.parse(JSON.stringify(bundle.narrative)) as TraceBundle["narrative"],
    timeline: JSON.parse(JSON.stringify(bundle.timeline)) as TraceBundle["timeline"],
    payloads: new Map(bundle.payloads),
    preview: bundle.preview ? new Uint8Array(bundle.preview) : undefined,
  };
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function useSession(deps: {
  liveFollowRef: React.RefObject<boolean>;
  onSetBundle: (bundle: TraceBundle | null, assistantText?: string, statusLine?: string) => void;
  onSetFrameIndex: (index: number) => void;
  onSetSelection: (selection: SelectionState) => void;
  onSetPlaying: (playing: boolean) => void;
  onSetLiveFollow: (follow: boolean) => void;
  onError: (error: string) => void;
  onSetLoadingLabel: (label: string | null) => void;
  onSetStatusLine: (line: string) => void;
  setRunnerSessions: (sessions: RunnerSession[]) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
  bundle: TraceBundle | null;
  frameIndex: number;
  runnerHealth: { mode: string } | null;
}) {
  const [sessionMode, setSessionMode] = useState<SessionMode>("sample");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [traceUrl, setTraceUrl] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState(defaultPrompt);
  const [activePrompt, setActivePrompt] = useState(defaultPrompt);
  const [assistantText, setAssistantText] = useState("");
  const disconnectRef = useRef<(() => void) | null>(null);

  function handleTokenStep(event: QwenTokenStepEvent) {
    startTransition(() => {
      deps.onSetBundle(
        (() => {
          const base = deps.bundle ? cloneBundle(deps.bundle) : null;
          if (!base) return deps.bundle;
          return applyLiveTokenStep(base, event);
        })(),
        event.completion,
        `Live token ${event.tokenIndex + 1} flowing through the stage.`,
      );
      deps.onSetLoadingLabel(null);
      if (deps.liveFollowRef.current) {
        deps.onSetFrameIndex(event.frame.frame_id);
      }
    });
  }

  async function loadSampleReplay() {
    disconnectRef.current?.();
    deps.onSetLoadingLabel("Reloading the official Qwen replay…");
    deps.onError("" as never);
    try {
      const nextBundle = await loadTraceFromUrl(qwenSampleTrace.path);
      startTransition(() => {
        deps.onSetBundle(nextBundle, readLastCompletion(nextBundle), "Demo replay ready. Start the local runner for live sessions.");
        deps.onSetFrameIndex(0);
        deps.onSetSelection(null);
        setActivePrompt(defaultPrompt);
        setSessionMode("sample");
        setSessionId(null);
        setTraceUrl(null);
      });
    } catch {
      const fallbackBundle = createQwenOfficialTraceBundle();
      startTransition(() => {
        deps.onSetBundle(fallbackBundle, readLastCompletion(fallbackBundle), "Demo replay loaded from the bundled fallback trace.");
        deps.onSetFrameIndex(0);
        deps.onSetSelection(null);
        setActivePrompt(defaultPrompt);
        setSessionMode("sample");
        setSessionId(null);
        setTraceUrl(null);
      });
    } finally {
      deps.onSetLoadingLabel(null);
    }
  }

  async function startLiveSession() {
    if (!deps.runnerHealth) {
      deps.onError("The local NeuroLoom Runner is not reachable. Start it first, then try again.");
      return;
    }

    disconnectRef.current?.();
    deps.onSetPlaying(false);
    deps.onSetSelection(null);
    deps.onSetLiveFollow(true);
    deps.onSetLoadingLabel("Connecting to the local runner…");
    deps.onSetStatusLine("Creating a live Qwen session…");
    setSessionMode("connecting");
    setActivePrompt(promptDraft);
    setAssistantText("");

    try {
      const response = await startChatSession(promptDraft);
      setSessionId(response.neuroloom.session_id);
      setTraceUrl(response.neuroloom.trace_url);
      disconnectRef.current = connectToSession(response.neuroloom.session_id, {
        onEvent(event) {
          if (event.type === "session_started") {
            startTransition(() => {
              deps.onSetBundle(hydrateBundleFromLiveStart(event), "", "Runner connected. Waiting for the first token pulse…");
              deps.onSetFrameIndex(0);
              setSessionMode("live");
            });
            return;
          }

          if (event.type === "token_step") {
            handleTokenStep(event);
            return;
          }

          setSessionMode("replay");
          deps.onSetLoadingLabel(null);
          deps.onSetStatusLine(`Live session completed in ${(event.durationMs / 1000).toFixed(1)}s. Replay is ready.`);
          void listRunnerSessions()
            .then(deps.setRunnerSessions)
            .catch(() => undefined);
        },
        onError(message) {
          deps.onSetLoadingLabel(null);
          deps.onError(message);
        },
        onClose() {
          deps.onSetLoadingLabel(null);
        },
      });
    } catch (startError) {
      deps.onSetLoadingLabel(null);
      setSessionMode("sample");
      deps.onError((startError as Error).message);
    }
  }

  async function stopLiveSession() {
    if (!sessionId) return;
    try {
      deps.onSetStatusLine("Stopping the live session…");
      await cancelRunnerSession(sessionId);
      deps.setRunnerSessions(await listRunnerSessions());
    } catch (stopError) {
      deps.onError((stopError as Error).message);
    }
  }

  async function importTrace(file: File) {
    deps.onSetLoadingLabel(`Importing ${file.name}…`);
    try {
      const nextBundle = await loadTraceFromFile(file);
      startTransition(() => {
        deps.onSetBundle(nextBundle, readLastCompletion(nextBundle), `Imported ${file.name}.`);
        deps.onSetFrameIndex(0);
        deps.onSetSelection(null);
        setSessionMode("replay");
      });
    } catch (importError) {
      deps.onError((importError as Error).message);
    } finally {
      deps.onSetLoadingLabel(null);
    }
  }

  async function exportPng() {
    const canvas = deps.stageRef.current?.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      deps.onError("The stage canvas is unavailable for PNG export.");
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      deps.onError("The browser could not generate a PNG snapshot.");
      return;
    }
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `qwen-starfield-frame-${String(deps.frameIndex).padStart(3, "0")}.png`);
    URL.revokeObjectURL(url);
  }

  async function exportReplay() {
    try {
      if (traceUrl && sessionMode !== "sample") {
        const archive = await downloadTraceFromRunner(traceUrl);
        triggerDownload(
          URL.createObjectURL(new Blob([archive as BlobPart], { type: "application/octet-stream" })),
          `${sessionId ?? "qwen-session"}.loomtrace`,
        );
        return;
      }
      if (!deps.bundle) {
        deps.onError("There is no replay loaded to export.");
        return;
      }
      const archive = await createLoomTraceArchive(deps.bundle);
      triggerDownload(
        URL.createObjectURL(new Blob([archive as BlobPart], { type: "application/octet-stream" })),
        `${deps.bundle.manifest.model_id}.loomtrace`,
      );
    } catch (exportError) {
      deps.onError((exportError as Error).message);
    }
  }

  async function openRunnerReplay(session: RunnerSession) {
    try {
      deps.onSetLoadingLabel(`Loading replay ${session.id}…`);
      const archive = await downloadTraceFromRunner(session.traceUrl);
      const file = new File([archive as BlobPart], `${session.id}.loomtrace`, { type: "application/octet-stream" });
      const nextBundle = await loadTraceFromFile(file);
      startTransition(() => {
        deps.onSetBundle(nextBundle, session.completion, `Loaded replay ${session.id}.`);
        deps.onSetFrameIndex(0);
        deps.onSetSelection(null);
        setSessionMode("replay");
        setSessionId(session.id);
        setTraceUrl(session.traceUrl);
        setActivePrompt(session.prompt);
      });
    } catch (openError) {
      deps.onError((openError as Error).message);
    } finally {
      deps.onSetLoadingLabel(null);
    }
  }

  return {
    sessionMode,
    sessionId,
    traceUrl,
    promptDraft,
    setPromptDraft,
    activePrompt,
    assistantText,
    disconnectRef,
    loadSampleReplay,
    startLiveSession,
    stopLiveSession,
    importTrace,
    exportPng,
    exportReplay,
    openRunnerReplay,
  };
}
