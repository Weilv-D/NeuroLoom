import { createContext, useContext } from "react";

import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import type { QwenFramePayload } from "@neuroloom/official-traces";

import type { SelectionState } from "../types";

export type StudioState = {
  bundle: TraceBundle | null;
  frame: TraceFrame | null;
  payload: QwenFramePayload | null;
  selection: SelectionState;
  live: boolean;
};

export const StudioContext = createContext<StudioState>({
  bundle: null,
  frame: null,
  payload: null,
  selection: null,
  live: false,
});

export function useStudio() {
  return useContext(StudioContext);
}
