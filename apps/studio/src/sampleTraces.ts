export const officialTraces = [
  {
    id: "tiny-mlp-mixer",
    family: "mlp",
    label: "Tiny MLP-Mixer",
    summary: "HuggingFace Google MLP-Mixer SOTA architecture replacing conventional pure MLPs.",
    accent: "electric",
    path: "/traces/tiny-mlp-mixer.loomtrace",
    storyTitle: "Explore Token Mixing and Channel Mixing without convolutions.",
    watchFor: [
      "Token mixing transverses across sequence tokens.",
      "Channel mixing processes each token's depth independently."
    ],
    studioTips: ["Select mixing blocks to see parameter independence."]
  },
  {
    id: "tiny-convnext",
    family: "cnn",
    label: "Tiny ConvNeXt",
    summary: "HuggingFace Facebook ConvNeXt SOTA vision architecture replacing classic CNNs.",
    accent: "amber",
    path: "/traces/tiny-convnext.loomtrace",
    storyTitle: "Watch depthwise convolutions modernize visual processing.",
    watchFor: [
      "Large 7x7 depthwise convolution kernels acting on single channels.",
      "Inverted bottlenecks expanding dimensionality."
    ],
    studioTips: ["Isolate the bottleneck features in stage-3."]
  },
  {
    id: "tiny-llama",
    family: "transformer",
    label: "Tiny Llama",
    summary: "TinyLlama architecture featuring RoPE, GQA, and SwiGLU.",
    accent: "lime",
    path: "/traces/tiny-llama.loomtrace",
    storyTitle: "Dive into Grouped-Query Attention and Rotary Positional Embeddings.",
    watchFor: [
      "RoPE embeddings avoiding absolute positional addition.",
      "SwiGLU activation expanding the MLP layer.",
      "GQA sharing key/value heads for memory efficiency."
    ],
    studioTips: ["Focus on GQA matrices to count shared attention heads."]
  }
] as const;
