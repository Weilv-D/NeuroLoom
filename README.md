# NeuroLoom

<p align="center">
  <img src="./docs/workflow.svg" alt="NeuroLoom Workflow" width="100%">
</p>

NeuroLoom is a live-first visual stage for transformer model activations, currently profiling `Qwen/Qwen3.5-0.8B`. It turns a text conversation into a dense starfield of residual flow, grouped attention, DeltaNet memory, and decode pressure. Sessions can be exported as `.loomtrace` and replayed frame by frame.

*Languages: [English](README.md), [简体中文](README_zh.md)*

## Core Features

- **Live Session Streaming** — A local runner starts a Qwen session, streams token-step events over WebSocket, and drives the 3D stage in real time.
- **Frame-by-Frame Replay** — Export any session as `.loomtrace`, reload locally, scrub on a timeline, and inspect without the runner.
- **86,400 Neuron Starfield** — 24 transformer blocks × (3,584 FFN + 16 attention heads) rendered as a GPU point cloud with custom GLSL shaders.
- **Real Activation Capture** — Python tool extracts actual neuron activations from transformer models via PyTorch forward hooks.
- **Backend Adapter** — Plug in LM Studio, Ollama, or vLLM for live inference while preserving the NeuroLoom visual protocol.

## Monorepo Layout

| Package | Description |
|---------|-------------|
| `packages/core` | Zod schemas, ReplayEngine, `.loomtrace` archive I/O, validator |
| `packages/official-traces` | Qwen synthetic trace generation, live session recorder |
| `apps/studio` | React 19 + Vite + R3F 3D visualization frontend |
| `tools/runner` | Local proxy server (WebSocket + SSE) for live inference |
| `tools/exporters` | Generates the official fallback replay `.loomtrace` |
| `tools/activation-capture` | Python tool: real neuron activations via PyTorch hooks |

## Quick Start

Requirements:

- `Node.js 22+`
- `pnpm 10+`

Install and launch:

```bash
pnpm install
pnpm build
pnpm dev
```

`pnpm dev` backgrounds trace generation and starts Vite immediately at `http://localhost:5173`.

Run the live runner in another terminal:

```bash
pnpm dev:runner:ollama    # or :lmstudio / :vllm
```

If the runner is not available, the app falls back to the synthetic replay bundle.

## Real Activation Capture

Extract real neuron activations from any compatible transformer model:

```bash
cd tools/activation-capture
pip install -r requirements.txt

# Generate a .loomtrace with real activations
python capture.py --prompt "Hello, how are you?" --model Qwen/Qwen3.5-0.8B --output trace.loomtrace

# Or stream live to a running NeuroLoom runner
python capture.py --prompt "Explain quantum computing" --runner-url ws://127.0.0.1:7778
```

The capture tool uses PyTorch forward hooks on each transformer block's MLP and attention layers, producing neuron activations that match the 86,400-neuron layout exactly.

## Commands

```bash
pnpm build              # full monorepo build (traces + all packages)
pnpm dev                # start studio with backgrounded trace generation
pnpm test               # run all tests (41 total)
pnpm lint               # eslint check
pnpm format:check       # prettier check
pnpm generate:traces    # rebuild core → official-traces → exporters
pnpm validate:samples   # validate generated .loomtrace against schema
pnpm dev:runner         # start runner (synthetic mode)
pnpm dev:runner:ollama  # start runner with Ollama backend
pnpm dev:runner:lmstudio # start runner with LM Studio backend
pnpm dev:runner:vllm    # start runner with vLLM backend
```

## Local Runner

Endpoints:

- `POST /v1/chat/completions` — start a new session from a prompt
- `GET /sessions` — list recent sessions
- `POST /sessions/:sessionId/cancel` — stop a live session
- `GET /backend/probe` — verify backend reachability
- `WS /live/:sessionId` — stream live token events
- `GET /sessions/:sessionId/trace` — export session as `.loomtrace`
- `GET /health` — runner status and mode

Environment variables:

- `NEUROLOOM_RUNNER_PORT`
- `NEUROLOOM_BACKEND_URL`
- `NEUROLOOM_BACKEND_API_KEY`
- `NEUROLOOM_BACKEND_MODEL`
- `NEUROLOOM_BACKEND_STREAM`
- `NEUROLOOM_BACKEND_THINK`
- `NEUROLOOM_BACKEND_PROVIDER`
- `NEUROLOOM_SESSION_RETENTION`

See [docs/backends.md](./docs/backends.md) for backend setup notes.

## `.loomtrace` Format

Each frame carries: token text, layer norms, residual bands, grouped attention scores, attention row summary, sampled unit stars, top logits, camera anchor, and per-neuron activation states.

See [docs/loomtrace-spec.md](./docs/loomtrace-spec.md) for the full profile specification.
