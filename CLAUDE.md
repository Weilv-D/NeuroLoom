# NeuroLoom

Monorepo for visualizing transformer model activations as a 3D starfield. Built with React 19, Three.js (R3F), TypeScript, and Python (PyTorch).

## Architecture

```
packages/core           — Zod schemas, ReplayEngine, archive I/O, validation
packages/official-traces — Qwen synthetic trace generation, live session recorder
apps/studio             — Vite + React 19 + R3F 3D visualization app
tools/runner            — Node.js proxy server (WebSocket + SSE) for live inference
tools/exporters         — Generates sample .loomtrace files for the studio
tools/activation-capture — Python tool: real neuron activations via PyTorch hooks
```

### Build chain
```
pnpm build       → core → official-traces → exporters (prebuild hook) → studio/runner
pnpm dev         → backgrounds generate:traces, starts Vite immediately
pnpm test        → core (vitest) + official-traces (vitest) + runner (node:test)
pnpm lint        → eslint apps packages
pnpm format:check → prettier
```

### Key data flow
```
TraceBundle = manifest + graph + timeline + narrative + payloads
```
- Core defines schemas (Zod) and types for TraceBundle
- Official-traces generates synthetic Qwen activations or records live sessions
- Studio renders the bundle as a 3D scene with frame-by-frame playback
- Runner proxies to LM Studio / Ollama / vLLM for live inference
- Activation-capture extracts real PyTorch activations and writes .loomtrace

## Module structure

### packages/official-traces/src/
Split into focused modules:
- `types.ts` — all exported types (QwenFramePayload, QwenLiveEvent, etc.)
- `constants.ts` — block count, neuron counts, visual semantics
- `helpers.ts` — pure utility functions (seeded RNG, math, factories)
- `graphBuilder.ts` — buildGraph(), buildNeuronStates(), neuron arc positions
- `payloadBuilder.ts` — buildFrame(), buildInspectPayload(), buildRenderPayload()
- `recorder.ts` — QwenSessionRecorder class, bundle creation, live event hydration
- `index.ts` — barrel re-export (all public API preserved)

### apps/studio/src/
- `hooks/usePlayback.ts` — frame stepping, play/pause, keyboard shortcuts
- `hooks/useSession.ts` — session lifecycle (live/replay), WebSocket events
- `hooks/useRunner.ts` — runner health, session listing, backend probing
- `contexts/StudioContext.tsx` — shared state provider
- `components/ErrorBoundary.tsx` — WebGL/shader error recovery
- `components/LeftPanel.tsx` — session form, conversation, token window
- `components/RightPanel.tsx` — metrics, logits, block digest
- `components/ScrubberBar.tsx` — playback controls, chapter navigation
- `scene/shaders.ts` — GLSL vertex/fragment shaders
- `scene/neuronField.tsx` — GPU point cloud (THREE.Points, one draw call)
- `scene/sceneParts.tsx` — CameraRig, ResidualRiver, FlowLine, NodeAnchor, etc.
- `scene/SceneOverlay.tsx` — 2D HTML/SVG overlay
- `scene/layoutUtils.ts` — projection, path generation, focus calculation

### tools/runner/src/
- `types.ts` — ChatCompletionRequest, SessionRecord
- `sseParser.ts` — SSE event parsing, content extraction
- `sessionManager.ts` — SessionStore class, broadcast/emit/finish
- `routes.ts` — HTTP routing, CORS, request parsing
- `server.ts` — thin entry: env config, HTTP + WebSocket setup

### tools/activation-capture/
- `capture.py` — CLI entry: model loading, token generation, .loomtrace output
- `hooks.py` — PyTorch forward hooks on Qwen MLP and attention layers
- `mapping.py` — raw tensor → neuron_states mapping, activation normalization
- `transport.py` — WebSocket streaming to runner
- `requirements.txt` — torch, transformers, numpy, websockets

## Neuron visualization
- 86,400 neurons: 24 blocks × (3,584 FFN + 16 attention heads)
- GPU point cloud via THREE.Points + custom ShaderMaterial
- FFN neurons: elliptical arc layout per block
- Attention heads: satellite layout per block
- ~12% sparse activation per frame (FFN), smooth for attention

## Conventions
- ESM modules with `.js` extension in TypeScript imports
- Zod schemas for runtime validation of payloads
- `import type` for type-only imports
- Unused destructured params prefixed with `_`
- No `eslint-plugin-react-hooks` — no `react-hooks/exhaustive-deps` rule available
