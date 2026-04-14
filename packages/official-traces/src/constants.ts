import type { TraceBundle } from "@neuroloom/core";

export const qwenOfficialTraceId = "qwen3.5-0.8b-sample";
export const officialTraceIds = [qwenOfficialTraceId] as const;
export const qwenRunnerModelId = "Qwen/Qwen3.5-0.8B";
export const qwenBlockCount = 24;
export const qwenHeadGroupCount = 6;
export const qwenClustersPerLane = 3;
export const qwenFfnNeuronsPerBlock = 3584;
export const qwenAttnHeadsPerBlock = 16;
export const ffnGridWidth = 64;
export const ffnGridHeight = 56;

export type OfficialTraceId = (typeof officialTraceIds)[number];

export const qwenVisualSemantics = {
  positive: "#2fe5ff",
  negative: "#ffb85f",
  focus: "#d7ff63",
  neutral: "#eef2ff",
  bloomStrength: 1.9,
  fogDensity: 0.075,
} satisfies TraceBundle["manifest"]["visual_semantics"];

export const qwenSamplePrompt = "Describe how NeuroLoom turns a Qwen conversation into a starfield in one vivid paragraph.";
export const qwenSampleResponse =
  "NeuroLoom turns each new Qwen token into a pulse that crosses a layered starfield, where attention flares, recurrent memory glides under the surface, and the reply condenses into a visible river of light you can replay frame by frame.";
