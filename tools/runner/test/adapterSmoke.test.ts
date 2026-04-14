import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

type MockRequestRecord = {
  model: string;
  messages: Array<{ role?: string; content?: string }>;
  stream: boolean;
  think?: boolean | string;
  max_tokens?: number;
};

test("adapter mode probes backend and forwards the effective model", async (t) => {
  const backendRequests: MockRequestRecord[] = [];
  const backendPort = await getAvailablePort();
  const runnerPort = await getAvailablePort();
  const runnerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  const backendServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if (request.method === "GET" && url.pathname === "/v1/models") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "qwen3.5:0.8b" }] }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      const body = await readJson(request);
      backendRequests.push({
        model: body.model,
        messages: body.messages ?? [],
        stream: Boolean(body.stream),
        think: body.think,
        max_tokens: body.max_tokens,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "adapter smoke test complete.",
              },
            },
          ],
        }),
      );
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });

  backendServer.listen(backendPort, "127.0.0.1");
  await once(backendServer, "listening");
  t.after(async () => {
    backendServer.close();
    await once(backendServer, "close");
  });

  const runner = spawn(resolvePnpmBinary(), ["exec", "tsx", "src/server.ts"], {
    cwd: runnerRoot,
    env: {
      ...process.env,
      NEUROLOOM_RUNNER_PORT: String(runnerPort),
      NEUROLOOM_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
      NEUROLOOM_BACKEND_MODEL: "qwen3.5:0.8b",
      NEUROLOOM_BACKEND_PROVIDER: "ollama",
      NEUROLOOM_BACKEND_STREAM: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const runnerOutput: string[] = [];
  runner.stdout.on("data", (chunk) => runnerOutput.push(String(chunk)));
  runner.stderr.on("data", (chunk) => runnerOutput.push(String(chunk)));
  t.after(async () => {
    await stopProcess(runner);
  });

  await waitForRunnerHealth(runnerPort);

  const health = (await fetchJson(`http://127.0.0.1:${runnerPort}/health`)) as {
    effectiveModel: string;
    modelRemapped: boolean;
  };
  assert.equal(health.effectiveModel, "qwen3.5:0.8b");
  assert.equal(health.modelRemapped, true);

  const probe = (await fetchJson(`http://127.0.0.1:${runnerPort}/backend/probe`)) as {
    ok: boolean;
    matchedModel: boolean;
    models: string[];
  };
  assert.equal(probe.ok, true);
  assert.equal(probe.matchedModel, true);
  assert.deepEqual(probe.models, ["qwen3.5:0.8b"]);

  const completion = (await fetchJson(`http://127.0.0.1:${runnerPort}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "Qwen/Qwen3.5-0.8B",
      messages: [{ role: "user", content: "test the adapter remap" }],
    }),
  })) as {
    model: string;
    neuroloom: {
      requested_model: string;
      effective_model: string;
      model_remapped: boolean;
      session_id: string;
    };
  };

  assert.equal(completion.model, "qwen3.5:0.8b");
  assert.equal(completion.neuroloom.requested_model, "Qwen/Qwen3.5-0.8B");
  assert.equal(completion.neuroloom.effective_model, "qwen3.5:0.8b");
  assert.equal(completion.neuroloom.model_remapped, true);

  await waitFor(
    async () => {
      const sessions = (await fetchJson(`http://127.0.0.1:${runnerPort}/sessions`)) as {
        sessions: Array<{ id: string; status: string; completion: string }>;
      };
      const session = sessions.sessions.find((entry) => entry.id === completion.neuroloom.session_id);
      if (!session) {
        return false;
      }
      return session.status === "complete" && session.completion.length > 0;
    },
    5_000,
    "runner session did not reach complete status",
  );

  assert.equal(backendRequests.length, 1, `expected one backend request, got ${backendRequests.length}\n${runnerOutput.join("")}`);
  assert.equal(backendRequests[0]?.model, "qwen3.5:0.8b");
  assert.equal(backendRequests[0]?.stream, false);
});

test("adapter streaming tolerates Ollama reasoning chunks and completes with final content", async (t) => {
  const backendRequests: MockRequestRecord[] = [];
  const backendPort = await getAvailablePort();
  const runnerPort = await getAvailablePort();
  const runnerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  const backendServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if (request.method === "GET" && url.pathname === "/v1/models") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "qwen3.5:0.8b" }] }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      const body = await readJson(request);
      backendRequests.push({
        model: body.model,
        messages: body.messages ?? [],
        stream: Boolean(body.stream),
        think: body.think,
        max_tokens: body.max_tokens,
      });
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(
        `data: ${JSON.stringify({
          choices: [{ index: 0, delta: { role: "assistant", content: "", reasoning: "Thinking" }, finish_reason: null }],
        })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          choices: [{ index: 0, delta: { role: "assistant", content: "", reasoning: "..." }, finish_reason: null }],
        })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          choices: [{ index: 0, delta: { role: "assistant", content: "ready" }, finish_reason: "stop" }],
        })}\n\n`,
      );
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });

  backendServer.listen(backendPort, "127.0.0.1");
  await once(backendServer, "listening");
  t.after(async () => {
    backendServer.close();
    await once(backendServer, "close");
  });

  const runner = spawn(resolvePnpmBinary(), ["exec", "tsx", "src/server.ts"], {
    cwd: runnerRoot,
    env: {
      ...process.env,
      NEUROLOOM_RUNNER_PORT: String(runnerPort),
      NEUROLOOM_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
      NEUROLOOM_BACKEND_MODEL: "qwen3.5:0.8b",
      NEUROLOOM_BACKEND_PROVIDER: "ollama",
      NEUROLOOM_BACKEND_STREAM: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  t.after(async () => {
    await stopProcess(runner);
  });

  await waitForRunnerHealth(runnerPort);

  const completion = (await fetchJson(`http://127.0.0.1:${runnerPort}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "Qwen/Qwen3.5-0.8B",
      messages: [{ role: "user", content: "Reply with exactly one word: ready" }],
    }),
  })) as {
    neuroloom: {
      session_id: string;
    };
  };

  await waitFor(
    async () => {
      const sessions = (await fetchJson(`http://127.0.0.1:${runnerPort}/sessions`)) as {
        sessions: Array<{ id: string; status: string; completion: string; archiveReady: boolean }>;
      };
      const session = sessions.sessions.find((entry) => entry.id === completion.neuroloom.session_id);
      if (!session) {
        return false;
      }
      return session.status === "complete" && session.completion === "ready" && session.archiveReady;
    },
    5_000,
    "runner stream session did not complete with final content",
  );

  assert.equal(backendRequests.length, 1);
  assert.equal(backendRequests[0]?.model, "qwen3.5:0.8b");
  assert.equal(backendRequests[0]?.stream, true);
  assert.equal(backendRequests[0]?.think, false);
  assert.equal(backendRequests[0]?.max_tokens, undefined);
});

async function waitForRunnerHealth(port: number) {
  await waitFor(
    async () => {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      return response.ok;
    },
    10_000,
    `runner on port ${port} did not become healthy`,
  );
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number, message: string) {
  const deadline = Date.now() + timeoutMs;
  // Polling is sufficient here because the runner is an external child process.
  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch {
      // Wait for the server to finish booting.
    }
    await sleep(120);
  }
  throw new Error(message);
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function readJson(request: Parameters<Parameters<typeof createServer>[0]>[0]) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, any>;
}

async function stopProcess(processRef: ChildProcess) {
  if (processRef.exitCode !== null || processRef.signalCode !== null) {
    return;
  }
  if (processRef.pid) {
    try {
      process.kill(-processRef.pid, "SIGTERM");
    } catch {
      processRef.kill("SIGTERM");
    }
  } else {
    processRef.kill("SIGTERM");
  }
  await Promise.race([
    once(processRef, "exit"),
    sleep(2_000).then(() => {
      if (processRef.exitCode === null && processRef.signalCode === null) {
        if (processRef.pid) {
          try {
            process.kill(-processRef.pid, "SIGKILL");
            return;
          } catch {
            // Fall through to direct kill.
          }
        }
        processRef.kill("SIGKILL");
      }
    }),
  ]);
}

async function getAvailablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

function resolvePnpmBinary() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
