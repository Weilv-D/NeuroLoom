import { Canvas } from "@react-three/fiber";

import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import type { QwenFramePayload } from "@neuroloom/official-traces";

import type { SelectionState } from "./types";
import { SceneRoot } from "./scene/sceneParts";
import { SceneOverlay } from "./scene/SceneOverlay";

type SceneCanvasProps = {
  bundle: TraceBundle;
  frame: TraceFrame | null;
  payload: QwenFramePayload | null;
  selection: SelectionState;
  onSelect(selection: SelectionState): void;
  live: boolean;
};

export function SceneCanvas({ bundle, frame, payload, selection, onSelect, live }: SceneCanvasProps) {
  const cameraPreset =
    bundle.manifest.camera_presets.find((entry) => entry.id === frame?.camera_anchor) ?? bundle.manifest.camera_presets[0]!;

  return (
    <div className="scene-stage scene-shell">
      <Canvas
        camera={{
          position: [cameraPreset.position.x, cameraPreset.position.y, cameraPreset.position.z],
          fov: cameraPreset.fov,
          near: 0.1,
          far: 120,
        }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={[1, 1.8]}
        onCreated={({ gl }) => {
          gl.setClearColor("#04070d");
          gl.toneMappingExposure = 1.08;
        }}
      >
        <SceneRoot
          bundle={bundle}
          frame={frame}
          payload={payload}
          selection={selection}
          onSelect={onSelect}
          live={live}
          cameraPreset={cameraPreset}
        />
      </Canvas>
      <SceneOverlay bundle={bundle} frame={frame} payload={payload} selection={selection} onSelect={onSelect} live={live} />
    </div>
  );
}
