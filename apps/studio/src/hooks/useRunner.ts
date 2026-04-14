import { useState } from "react";

import {
  type BackendProbe,
  checkRunnerHealth,
  listRunnerSessions,
  probeRunnerBackend,
  type RunnerHealth,
  type RunnerSession,
} from "../runnerClient";

export function useRunner() {
  const [runnerHealth, setRunnerHealth] = useState<RunnerHealth | null>(null);
  const [runnerChecked, setRunnerChecked] = useState(false);
  const [runnerSessions, setRunnerSessions] = useState<RunnerSession[]>([]);
  const [backendProbe, setBackendProbe] = useState<BackendProbe | null>(null);

  async function refreshRunnerStatus(options?: { includeProbe?: boolean }) {
    const includeProbe = options?.includeProbe ?? true;
    const health = await checkRunnerHealth();
    setRunnerHealth(health);
    setRunnerChecked(true);

    try {
      setRunnerSessions(await listRunnerSessions());
    } catch {
      setRunnerSessions([]);
    }

    if (includeProbe && health?.mode === "adapter") {
      setBackendProbe(await probeRunnerBackend());
      return;
    }

    if (!health || health.mode !== "adapter") {
      setBackendProbe(null);
    }
  }

  return {
    runnerHealth,
    runnerChecked,
    runnerSessions,
    setRunnerSessions,
    backendProbe,
    setBackendProbe,
    refreshRunnerStatus,
  };
}
