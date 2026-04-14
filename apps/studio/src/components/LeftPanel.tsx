import type { BackendProbe, RunnerHealth, RunnerSession } from "../runnerClient";
import { qwenSampleTrace } from "../sampleTraces";
import type { SelectionState } from "../types";
import type { SessionMode } from "../hooks/useSession";
import type { QwenFramePayload } from "@neuroloom/official-traces";

export function LeftPanel({
  promptDraft,
  onSetPromptDraft,
  activePrompt,
  assistantText,
  runnerHealth,
  runnerChecked: _runnerChecked,
  backendProbe,
  sessionMode,
  sessionId,
  loadingLabel,
  error,
  statusLine,
  currentPayload,
  currentTokenWindow,
  selection,
  runnerSessions,
  onStartLiveSession,
  onLoadSampleReplay,
  onRefreshRunnerStatus,
  onProbeBackend,
  onStopLiveSession,
  onSetSelection,
  onOpenRunnerReplay,
}: {
  promptDraft: string;
  onSetPromptDraft(value: string): void;
  activePrompt: string;
  assistantText: string;
  runnerHealth: RunnerHealth | null;
  runnerChecked: boolean;
  backendProbe: BackendProbe | null;
  sessionMode: SessionMode;
  sessionId: string | null;
  loadingLabel: string | null;
  error: string | null;
  statusLine: string;
  currentPayload: QwenFramePayload | null;
  currentTokenWindow: string[];
  selection: SelectionState;
  runnerSessions: RunnerSession[];
  onStartLiveSession(): void;
  onLoadSampleReplay(): void;
  onRefreshRunnerStatus(): void;
  onProbeBackend(): void;
  onStopLiveSession(): void;
  onSetSelection(selection: SelectionState): void;
  onOpenRunnerReplay(session: RunnerSession): void;
}) {
  const currentRunnerSession = sessionId ? (runnerSessions.find((entry) => entry.id === sessionId) ?? null) : null;

  return (
    <aside className="panel panel--left">
      <section className="card">
        <p className="eyebrow">Session Prompt</p>
        <form
          className="prompt-form"
          onSubmit={(event) => {
            event.preventDefault();
            onStartLiveSession();
          }}
        >
          <textarea
            value={promptDraft}
            onChange={(event) => onSetPromptDraft(event.target.value)}
            placeholder="Ask the runner for a live Qwen session…"
            rows={7}
          />
          <div className="prompt-actions">
            <button type="submit" className="primary-button" disabled={!runnerHealth || Boolean(loadingLabel)}>
              Start Live Session
            </button>
            <button type="button" className="secondary-button" onClick={onLoadSampleReplay}>
              Load Demo Replay
            </button>
            <button type="button" className="secondary-button" onClick={onRefreshRunnerStatus}>
              Refresh Runner
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onProbeBackend}
              disabled={!runnerHealth || runnerHealth.mode !== "adapter"}
            >
              Probe Backend
            </button>
            <button type="button" className="secondary-button" onClick={onStopLiveSession} disabled={!sessionId || sessionMode !== "live"}>
              Stop Live
            </button>
          </div>
        </form>
        <div className="status-list">
          <div>
            <span>Transport</span>
            <strong>
              {runnerHealth
                ? `local runner · ${runnerHealth.mode}${runnerHealth.streaming ? " · streaming" : " · buffered"}`
                : "replay fallback"}
            </strong>
          </div>
          <div>
            <span>Model</span>
            <strong>{runnerHealth?.model ?? qwenSampleTrace.model}</strong>
          </div>
          <div>
            <span>Backend</span>
            <strong>{runnerHealth?.backendModel ?? "fallback replay only"}</strong>
          </div>
          <div>
            <span>Runtime Model</span>
            <strong>{runnerHealth?.effectiveModel ?? qwenSampleTrace.model}</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>
              {runnerHealth
                ? `${runnerHealth.backendLabel}${runnerHealth.backendDetectedFrom === "override" ? " · forced" : ""}`
                : "synthetic"}
            </strong>
          </div>
          <div>
            <span>Target</span>
            <strong>{runnerHealth?.backendUrl ?? "local synthetic runner"}</strong>
          </div>
          <div>
            <span>Endpoint</span>
            <strong>{runnerHealth?.backendEndpoint ?? "not in use"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{statusLine}</strong>
          </div>
          <div>
            <span>Session</span>
            <strong>{currentRunnerSession?.status ?? sessionMode}</strong>
          </div>
        </div>
        {runnerHealth?.modelRemapped ? (
          <p className="helper-copy">
            NeuroLoom requested the canonical Qwen profile and remapped it to the configured backend model for live inference.
          </p>
        ) : null}
        {runnerHealth?.backendSetupHint ? <p className="helper-copy">{runnerHealth.backendSetupHint}</p> : null}
        {backendProbe ? (
          <div className={backendProbe.ok ? "probe-card" : "probe-card probe-card--error"}>
            <div className="card-heading">
              <p className="eyebrow">Backend Probe</p>
              <span>{new Date(backendProbe.checkedAt).toLocaleTimeString()}</span>
            </div>
            <div className="probe-grid">
              <div>
                <span>Reachable</span>
                <strong>{backendProbe.reachable ? "yes" : "no"}</strong>
              </div>
              <div>
                <span>Model Match</span>
                <strong>{backendProbe.matchedModel ? "yes" : "no"}</strong>
              </div>
              <div>
                <span>Target Model</span>
                <strong>{backendProbe.targetModel}</strong>
              </div>
              <div>
                <span>Models Endpoint</span>
                <strong>{backendProbe.modelsEndpoint ?? "not required"}</strong>
              </div>
            </div>
            <p className="helper-copy">{backendProbe.error ?? backendProbe.hint}</p>
            <div className="probe-models">
              {backendProbe.models.length === 0 ? <span className="empty-state">No model list reported.</span> : null}
              {backendProbe.models.slice(0, 6).map((modelId) => (
                <span key={modelId} className="token-pill">
                  {modelId}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        {loadingLabel ? <p className="loading-text">{loadingLabel}</p> : null}
      </section>

      <section className="card">
        <p className="eyebrow">Conversation</p>
        <div className="message message--user">
          <span className="message-role">User</span>
          <p>{activePrompt}</p>
        </div>
        <div className="message message--assistant">
          <span className="message-role">Qwen</span>
          <p>{assistantText || "No tokens yet. Start a live session or load the demo replay."}</p>
        </div>
      </section>

      <section className="card">
        <div className="card-heading">
          <p className="eyebrow">Token Window</p>
          <span>{currentTokenWindow.length} tokens</span>
        </div>
        <div className="token-cloud">
          {currentTokenWindow.length === 0 ? <span className="empty-state">Waiting for token flow.</span> : null}
          {currentTokenWindow.length > 150 ? <span className="token-pill empty-state">...</span> : null}
          {currentTokenWindow.slice(-150).map((token, mappedIndex) => {
            const absoluteIndex = (currentPayload?.tokenIndex ?? 0) - Math.min(currentTokenWindow.length, 150) + mappedIndex + 1;
            const tokenId = `token-${absoluteIndex}`;
            const isActive = selection?.kind === "token" && selection.id === tokenId;
            return (
              <button
                key={tokenId}
                type="button"
                className={isActive ? "token-pill token-pill--active" : "token-pill"}
                onClick={() => onSetSelection({ kind: "token", id: tokenId })}
              >
                {token}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-heading">
          <p className="eyebrow">Recent Sessions</p>
          <span>{runnerSessions.length}</span>
        </div>
        <div className="session-list">
          {runnerSessions.length === 0 ? <span className="empty-state">No runner sessions yet.</span> : null}
          {runnerSessions.map((session) => (
            <article key={session.id} className={session.id === sessionId ? "session-row session-row--active" : "session-row"}>
              <div className="session-row__meta">
                <strong>{session.id}</strong>
                <span>{session.status}</span>
              </div>
              <p>{session.prompt}</p>
              <div className="session-row__actions">
                <span>{session.tokenCount} tokens</span>
                {session.archiveReady ? (
                  <button type="button" className="secondary-button" onClick={() => onOpenRunnerReplay(session)}>
                    Open Replay
                  </button>
                ) : null}
                {(session.status === "live" || session.status === "booting") && session.id === sessionId ? (
                  <button type="button" className="secondary-button" onClick={onStopLiveSession}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
