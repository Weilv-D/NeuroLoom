# `.loomtrace` Specification

Version: `1.0.0`

## Purpose
`.loomtrace` is the replay bundle format used by NeuroLoom.

It captures one controlled run of a supported model family and packages:

- semantic graph structure
- deterministic timeline frames
- render-oriented payload slices
- inspector-oriented payload slices
- story chapters and camera anchors

NeuroLoom v1 supports three families only:

- `mlp`
- `cnn`
- `transformer`

## Archive Layout
`.loomtrace` is a zip archive with these required entries:

```text
manifest.json
graph.json
timeline.ndjson
narrative.json
payload/
```

Optional:

```text
preview.webp
```

## `manifest.json`
Top-level replay metadata.

```json
{
  "trace_version": "1.0.0",
  "family": "mlp",
  "model_id": "spiral-2d-mlp",
  "dataset_id": "spiral-2d",
  "title": "Spiral MLP",
  "summary": "A compact multilayer perceptron learning a spiral decision boundary.",
  "phase_set": ["forward", "loss", "backward", "update"],
  "frame_count": 24,
  "camera_presets": [],
  "visual_semantics": {},
  "payload_catalog": [],
  "narrative_ref": "narrative.json"
}
```

Required fields:

- `trace_version`
  Fixed to `1.0.0` in v1.
- `family`
  One of `mlp`, `cnn`, `transformer`.
- `model_id`
  Stable content identifier.
- `dataset_id`
  Stable dataset or prompt identifier.
- `title`
  Human-readable title.
- `summary`
  Short replay description.
- `phase_set`
  Subset of `forward`, `loss`, `backward`, `update`, `decode`.
- `frame_count`
  Must equal the number of lines in `timeline.ndjson`.
- `camera_presets`
  Ordered list of named camera anchors.
- `visual_semantics`
  The color and atmosphere vocabulary for the replay.
- `payload_catalog`
  Payload inventory. Each entry declares `id`, `kind`, `mimeType`, and archive `path`.
- `narrative_ref`
  Relative path to the narrative file, normally `narrative.json`.

## `graph.json`
Semantic structure for one supported family.

```json
{
  "nodes": [
    {
      "id": "hidden-a",
      "label": "H1-A",
      "type": "linear",
      "layerIndex": 1,
      "order": 0,
      "position": { "x": -2, "y": 2.2, "z": 0 },
      "metadata": { "width": 16 }
    }
  ],
  "edges": [
    {
      "id": "e-ha-ma",
      "source": "hidden-a",
      "target": "mix-a",
      "type": "flow",
      "weight": 1
    }
  ],
  "rootNodeIds": ["input-x", "input-y"]
}
```

Rules:

- `id` values must be stable and unique.
- `source` and `target` must reference existing nodes.
- Node `type` must be valid for the declared `family`.

Family-specific node type allowlists:

- `mlp`
  `input`, `linear`, `activation`, `output`, `loss`
- `cnn`
  `input`, `stage`, `conv`, `norm`, `activation`, `pool`, `dense`, `output`, `loss`
- `transformer`
  `token`, `embedding`, `attention`, `residual`, `mlp`, `norm`, `logits`, `loss`, `decode`

## `timeline.ndjson`
One JSON object per line. Each line is a replay frame.

```json
{
  "frame_id": 12,
  "step": 2,
  "substep": 0,
  "phase": "backward",
  "camera_anchor": "output-focus",
  "node_states": [],
  "edge_states": [],
  "metric_refs": [],
  "payload_refs": [],
  "note": "Backward frames push the strongest pulse from the output head into earlier layers."
}
```

Rules:

- `frame_id` should be zero-based and contiguous.
- `camera_anchor` must exist in `manifest.camera_presets`.
- `node_states[].nodeId` must reference a graph node.
- `edge_states[].edgeId` must reference a graph edge.
- `payload_refs[]` should reference ids declared in `payload_catalog`.

### `node_states`
Each node state includes:

- `nodeId`
- `activation`
- `emphasis`
- optional `payloadRef`

`activation` is the signed scalar used by the renderer and inspector.
`emphasis` is a normalized display strength in `[0, 1]`.

### `edge_states`
Each edge state includes:

- `edgeId`
- `intensity`
- `direction`
- `emphasis`

`direction` is one of `forward`, `backward`, `neutral`.

### `metric_refs`
Inline frame-level metrics. Each metric includes:

- `id`
- `label`
- `value`
- optional `unit`

## `payload/`
Payloads are referenced from timeline frames and catalogued in `manifest.payload_catalog`.

Kinds:

- `render`
  Fast slices used by the main scene and visual overlays.
- `inspect`
  Higher-fidelity slices used by the inspector, notes, and detailed panels.

V1 exporters use JSON payloads. Future versions may allow additional MIME types, but v1 Studio expects JSON for official content.

## `narrative.json`
Story Mode structure.

```json
{
  "intro": "The replay starts wide, then narrows onto the decision plane and finally into the output head.",
  "chapters": [
    {
      "id": "input-to-hidden",
      "label": "Input Fan-Out",
      "frameRange": [0, 6],
      "defaultSelection": "hidden-a",
      "description": "Forward pulses spread raw x/y features into the first hidden layer."
    }
  ]
}
```

Rules:

- `frameRange` must be valid within the timeline.
- `defaultSelection`, when present, should reference a graph node.

## Validation
NeuroLoom validates a bundle in this order:

1. schema validation
2. family semantic validation
3. camera, node, edge, and payload reference validation
4. narrative range validation

If any step fails, the bundle is rejected before rendering.

## CLI
Validate one or more bundles:

```bash
pnpm --filter @neuroloom/core loomtrace path/to/trace.loomtrace
```

## Design Constraints
`.loomtrace` is intentionally not a generic runtime dump format.

It exists to support:

- deterministic replay
- renderer-specific semantics
- visual consistency
- stable story chapters

It does not attempt to describe arbitrary model graphs outside the supported NeuroLoom families.
