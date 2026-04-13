import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, QuadraticBezierLine, RoundedBox, Text } from "@react-three/drei";
import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import type { SelectionState } from "./state";
import * as THREE from "three";

type SceneCanvasProps = {
  bundle: TraceBundle;
  frame: TraceFrame;
  selection: SelectionState;
  onSelect(selection: SelectionState): void;
};

export function SceneCanvas({ bundle, frame, selection, onSelect }: SceneCanvasProps) {
  const camera = bundle.manifest.camera_presets.find((entry) => entry.id === frame.camera_anchor) ?? bundle.manifest.camera_presets[0]!;

  return (
    <div className="scene-stage">
      <Canvas
        gl={{ antialias: true }}
        dpr={[1, 1.8]}
        onCreated={({ gl }) => {
          gl.setClearColor("#050710");
          gl.toneMappingExposure = 1.04;
        }}
      >
        <SceneRoot bundle={bundle} frame={frame} camera={camera} selection={selection} onSelect={onSelect} />
      </Canvas>
    </div>
  );
}

function SceneRoot({
  bundle,
  frame,
  camera,
  selection,
  onSelect
}: {
  bundle: TraceBundle;
  frame: TraceFrame;
  camera: TraceBundle["manifest"]["camera_presets"][number];
  selection: SelectionState;
  onSelect(selection: SelectionState): void;
}) {
  const nodeMap = new Map(bundle.graph.nodes.map((node) => [node.id, node]));
  const nodeStateMap = new Map(frame.node_states.map((state) => [state.nodeId, state]));
  const edgeStateMap = new Map(frame.edge_states.map((state) => [state.edgeId, state]));
  const renderPayloadId =
    bundle.manifest.payload_catalog.find((entry) => entry.kind === "render" && frame.payload_refs.includes(entry.id))?.id ?? null;
  const renderPayload = renderPayloadId ? safeParsePayload(bundle.payloads.get(renderPayloadId)) : null;

  return (
    <>
      <CameraRig position={camera.position} target={camera.target} />
      <color attach="background" args={["#050710"]} />
      <fog attach="fog" args={["#050710", 13, 30]} />
      <ambientLight intensity={0.7} color="#b8d3ff" />
      <directionalLight position={[8, 10, 12]} intensity={2.1} color="#d7f6ff" />
      <pointLight position={[-7, 4, 7]} intensity={1.6} color="#15f0ff" />
      <pointLight position={[8, -2, 6]} intensity={1.1} color="#ffb45b" />
      <StageBackdrop family={bundle.manifest.family} />
      {bundle.graph.edges.map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        const state = edgeStateMap.get(edge.id);
        if (!source || !target || !state) {
          return null;
        }
        return (
          <EdgeFlow
            key={edge.id}
            family={bundle.manifest.family}
            from={vectorToTuple(source.position)}
            to={vectorToTuple(target.position)}
            state={state}
            selected={selection?.id === edge.id}
          />
        );
      })}
      {bundle.graph.nodes.map((node) => (
        <NodeGlyph
          key={node.id}
          family={bundle.manifest.family}
          label={node.label}
          type={node.type}
          position={vectorToTuple(node.position)}
          state={nodeStateMap.get(node.id)}
          selected={selection?.id === node.id}
          onClick={() => onSelect({ id: node.id, kind: "node" })}
        />
      ))}
      {bundle.manifest.family === "transformer" ? (
        <AttentionRibbonLayer bundle={bundle} payload={renderPayload} />
      ) : null}
      <EffectComposer>
        <Bloom luminanceThreshold={0.08} intensity={1.05} mipmapBlur />
        <Noise opacity={0.04} />
        <Vignette offset={0.2} darkness={0.65} />
      </EffectComposer>
    </>
  );
}

function CameraRig({
  position,
  target
}: {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}) {
  const { camera } = useThree();
  const targetVector = new THREE.Vector3(target.x, target.y, target.z);

  useFrame(() => {
    camera.position.lerp(new THREE.Vector3(position.x, position.y, position.z), 0.08);
    const lookTarget = new THREE.Vector3().copy(targetVector);
    camera.lookAt(lookTarget);
  });

  return null;
}

function StageBackdrop({ family }: { family: TraceBundle["manifest"]["family"] }) {
  if (family === "mlp") {
    return (
      <group>
        {[-5, -2, 1.4, 4.8].map((x, index) => (
          <mesh key={x} position={[x, 0, -1.4]}>
            <planeGeometry args={[2.4, 7.4]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#0d1830" : "#101726"} transparent opacity={0.3} />
          </mesh>
        ))}
        <mesh position={[1.3, -3.4, -0.8]} rotation={[-0.24, 0.1, 0]}>
          <planeGeometry args={[5.5, 2.1]} />
          <meshBasicMaterial color="#12203a" transparent opacity={0.34} />
        </mesh>
      </group>
    );
  }

  if (family === "cnn") {
    return (
      <group>
        {[-6, -3.8, 0.8, 5.6].map((x, index) => (
          <mesh key={x} position={[x, 0, -1.8]}>
            <planeGeometry args={[2.2, 6.2]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#0f1626" : "#101a30"} transparent opacity={0.28} />
          </mesh>
        ))}
        {[-0.45, -0.15, 0.15, 0.45].map((offset) => (
          <mesh key={offset} position={[-1.8 + offset, 2.9 - offset * 2, -0.4]}>
            <planeGeometry args={[1.2, 1.2]} />
            <meshBasicMaterial color="#17365b" transparent opacity={0.16} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group>
      <mesh position={[-5.2, 0, -1.5]}>
        <planeGeometry args={[1.7, 7.2]} />
        <meshBasicMaterial color="#11192e" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0.2, 0, -1.6]}>
        <planeGeometry args={[2.3, 5.2]} />
        <meshBasicMaterial color="#112339" transparent opacity={0.26} />
      </mesh>
      <mesh position={[8.8, -0.2, -1.2]}>
        <planeGeometry args={[2, 3.8]} />
        <meshBasicMaterial color="#18223a" transparent opacity={0.32} />
      </mesh>
    </group>
  );
}

function EdgeFlow({
  family,
  from,
  to,
  state,
  selected
}: {
  family: TraceBundle["manifest"]["family"];
  from: [number, number, number];
  to: [number, number, number];
  state: TraceFrame["edge_states"][number];
  selected: boolean;
}) {
  const color = state.direction === "backward" ? "#ffb45b" : "#15f0ff";
  const width = 1.2 + state.emphasis * 1.3 + (selected ? 0.8 : 0);

  if (family === "transformer" && Math.abs(from[1] - to[1]) > 1.2) {
    const mid = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 1.5, (from[2] + to[2]) / 2] as [number, number, number];
    return (
      <QuadraticBezierLine
        start={from}
        end={to}
        mid={mid}
        color={color}
        lineWidth={width}
        transparent
        opacity={0.14 + state.intensity * 0.4}
      />
    );
  }

  return <Line points={[from, to]} color={color} lineWidth={width} transparent opacity={0.14 + state.intensity * 0.42} />;
}

function NodeGlyph({
  family,
  label,
  type,
  position,
  state,
  selected,
  onClick
}: {
  family: TraceBundle["manifest"]["family"];
  label: string;
  type: string;
  position: [number, number, number];
  state: TraceFrame["node_states"][number] | undefined;
  selected: boolean;
  onClick(): void;
}) {
  const activation = state?.activation ?? 0;
  const emphasis = state?.emphasis ?? 0.3;
  const baseColor = activation >= 0 ? "#15f0ff" : "#ffb45b";
  const highlightColor = selected ? "#d8ff66" : baseColor;
  const scale = 0.95 + emphasis * 0.55;
  const size =
    family === "mlp"
      ? [0.66 * scale, 0.66 * scale, 0.66 * scale]
      : family === "cnn"
        ? [1.05 * scale, 0.42 * scale, 0.28 + emphasis * 0.42]
        : [1.22 * scale, type === "token" ? 0.36 : 0.48, 0.18 + emphasis * 0.26];

  return (
    <group position={position}>
      {family === "mlp" ? (
        <mesh onClick={onClick}>
          <sphereGeometry args={[0.34 * scale, 32, 32]} />
          <meshStandardMaterial
            color="#081520"
            emissive={new THREE.Color(highlightColor)}
            emissiveIntensity={1.6 + emphasis * 1.4}
            roughness={0.1}
            metalness={0.08}
            transparent
            opacity={0.92}
          />
        </mesh>
      ) : (
        <RoundedBox args={size} radius={0.1} smoothness={4} onClick={onClick}>
          <meshStandardMaterial
            color="#07101b"
            emissive={new THREE.Color(highlightColor)}
            emissiveIntensity={1.2 + emphasis * 1.2}
            roughness={0.16}
            metalness={0.1}
            transparent
            opacity={0.92}
          />
        </RoundedBox>
      )}
      {selected ? (
        <mesh position={[0, 0, -0.2]}>
          <ringGeometry args={[0.45, 0.52, 48]} />
          <meshBasicMaterial color="#d8ff66" transparent opacity={0.66} />
        </mesh>
      ) : null}
      <Text position={[0, family === "transformer" ? -0.62 : -0.74, 0]} fontSize={0.18} color="#eef2ff">
        {label}
      </Text>
    </group>
  );
}

function AttentionRibbonLayer({ bundle, payload }: { bundle: TraceBundle; payload: unknown }) {
  if (!payload || typeof payload !== "object" || !("matrix" in payload)) {
    return null;
  }

  const matrix = Array.isArray(payload.matrix) ? payload.matrix : null;
  if (!matrix) return null;

  const tokens = bundle.graph.nodes
    .filter((node) => node.type === "token")
    .sort((left, right) => left.order - right.order);

  return (
    <group>
      {tokens.flatMap((sourceNode, sourceIndex) =>
        tokens.map((targetNode, targetIndex) => {
          const weight = matrix[sourceIndex]?.[targetIndex];
          if (typeof weight !== "number" || weight < 0.32) {
            return null;
          }
          const start = vectorToTuple(sourceNode.position);
          const end = vectorToTuple(targetNode.position);
          const arcHeight = 1.4 + Math.abs(sourceIndex - targetIndex) * 0.55;
          return (
            <QuadraticBezierLine
              key={`${sourceNode.id}-${targetNode.id}`}
              start={start}
              end={end}
              mid={[(start[0] + end[0]) / 2, arcHeight, 0]}
              color="#15f0ff"
              lineWidth={0.6 + weight * 1.1}
              transparent
              opacity={0.08 + weight * 0.28}
            />
          );
        })
      )}
    </group>
  );
}

function safeParsePayload(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function vectorToTuple(vector: { x: number; y: number; z: number }): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}
