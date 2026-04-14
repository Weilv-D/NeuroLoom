// Barrel re-export — all public API preserved, zero breaking changes.

export {
  qwenOfficialTraceId,
  officialTraceIds,
  qwenRunnerModelId,
  qwenBlockCount,
  qwenHeadGroupCount,
  qwenClustersPerLane,
  qwenFfnNeuronsPerBlock,
  qwenAttnHeadsPerBlock,
  type OfficialTraceId,
} from "./constants";

export { buildSyntheticQwenResponse, tokenizeCompletion } from "./helpers";

export {
  createOfficialTraceBundles,
  createOfficialTraceBundle,
  createQwenOfficialTraceBundle,
  createQwenReplayBundle,
  hydrateBundleFromLiveStart,
  applyLiveTokenStep,
  QwenSessionRecorder,
} from "./recorder";

export type {
  QwenLane,
  QwenTopLogit,
  QwenBlockDigest,
  QwenSampleUnit,
  QwenFramePayload,
  QwenRenderPayload,
  QwenLayoutMeta,
  QwenSessionSeed,
  QwenSessionStartedEvent,
  QwenTokenStepEvent,
  QwenSessionCompletedEvent,
  QwenLiveEvent,
} from "./types";
