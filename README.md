# NeuroLoom

NeuroLoom is a replay-first neural network explainer for `MLP`, `CNN`, and standard `GPT-style Transformer` traces.

It reads a controlled `.loomtrace` bundle and reconstructs one training or inference run as a 2.5D scene where glow, flow, camera motion, and numeric inspector panels stay synchronized to the same frame.

## What It Is
- A guided `Story Mode` for official traces.
- A `Studio Mode` for frame-by-frame inspection, timeline scrubbing, structure selection, and payload inspection.
- A controlled `.loomtrace` contract with schema validation.
- Three official model families:
  `spiral-2d-mlp`
  `fashion-mnist-cnn`
  `tiny-gpt-style-transformer`

## What It Is Not
- Not a generic runtime visualization platform.
- Not a live model monitoring dashboard.
- Not an arbitrary model hook SDK.
- Not a generic DAG fallback viewer.

## Monorepo Layout
- `apps/studio`
  The Vite + React + React Three Fiber application.
- `packages/core`
  The `.loomtrace` schema, validator, archive reader/writer, replay engine, and renderer contracts.
- `tools/exporters`
  The official trace generators that build sample `.loomtrace` bundles for the three supported model families.

## Tech Stack
- `React 19`
- `TypeScript`
- `Vite`
- `Three.js`
- `React Three Fiber`
- `EffectComposer` via `@react-three/postprocessing`
- `Zustand`
- `D3` for inspector heatmaps
- `Zod` for trace validation

## `.loomtrace` Contract
Each bundle is a zip archive with these entries:

- `manifest.json`
- `graph.json`
- `timeline.ndjson`
- `payload/`
- `narrative.json`

Core fields:

- `manifest.json`
  Declares `trace_version`, `family`, `model_id`, `dataset_id`, `phase_set`, `frame_count`, `camera_presets`, `visual_semantics`, and payload catalog entries.
- `graph.json`
  Defines stable nodes and edges with family-specific semantic types.
- `timeline.ndjson`
  Stores one frame per line with `frame_id`, `step`, `substep`, `phase`, `camera_anchor`, node states, edge states, metrics, and payload references.
- `payload/`
  Stores JSON payloads for render-friendly slices and higher-fidelity inspector data.
- `narrative.json`
  Defines Story Mode chapters and default anchors.

Supported families:

- `mlp`
- `cnn`
- `transformer`

Supported phases:

- `forward`
- `loss`
- `backward`
- `update`
- `decode`

Formal reference:

- [docs/index.md](docs/index.md)
- [docs/loomtrace-spec.md](docs/loomtrace-spec.md)

## Getting Started
Requirements:

- `Node.js 22+`
- `pnpm 10+`

Install:

```bash
pnpm install
```

Generate official traces:

```bash
pnpm generate:traces
```

Run the studio locally:

```bash
pnpm dev
```

Build everything:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

Validate the official sample traces:

```bash
pnpm validate:samples
```

## Current Scope
V1 is intentionally narrow:

- Replay-first only.
- Desktop-first.
- Official support for three controlled model families.
- Public `.loomtrace` schema and validator.

V1 does not include:

- Live streaming
- Multi-user collaboration
- Arbitrary third-party model capture
- Generic renderer fallback

## Implementation Notes
- `packages/core` is the boundary between content generation and rendering.
- `tools/exporters` generates the official sample traces used by the studio.
- The studio loads traces from static assets or local files and validates them before replay.
- The primary rendering path uses `WebGL + bloom/postprocessing`; browser-side inference is reserved for later official demo expansion.

## Roadmap
- Expand renderer fidelity for the three supported families.
- Add screenshots/export polish.
- Add browser-side official trace regeneration for small demos.
- Publish the `.loomtrace` schema as versioned reference docs.
