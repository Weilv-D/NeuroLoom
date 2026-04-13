export const officialTraces = [
  {
    id: "spiral-2d-mlp",
    family: "mlp",
    label: "Spiral MLP",
    summary: "Forward fan-out, loss anchor, backward pulse, and decision-boundary drift.",
    accent: "electric",
    path: "/traces/spiral-2d-mlp.loomtrace"
  },
  {
    id: "fashion-mnist-cnn",
    family: "cnn",
    label: "Fashion CNN",
    summary: "Stage-by-stage feature compression with feature-map mosaics and classifier lift.",
    accent: "amber",
    path: "/traces/fashion-mnist-cnn.loomtrace"
  },
  {
    id: "tiny-gpt-style-transformer",
    family: "transformer",
    label: "Tiny GPT Transformer",
    summary: "Token rail, attention ribbons, residual stream, and decode stabilization.",
    accent: "lime",
    path: "/traces/tiny-gpt-style-transformer.loomtrace"
  }
] as const;
