import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";

import type { TraceBundle, TraceFrame } from "@neuroloom/core";
import * as THREE from "three";

import type { SelectionState } from "../types";

import { neuronVertexShader, neuronFragmentShader } from "./shaders";

export function NeuronField({
  graph,
  frame,
  selection,
  onSelect,
  live: _live,
}: {
  graph: TraceBundle["graph"];
  frame: TraceFrame | null;
  selection: SelectionState;
  onSelect(selection: SelectionState): void;
  live: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  // Build geometry once when graph changes
  const { geometry, neuronIds } = useMemo(() => {
    const neurons = graph.neurons ?? [];
    const positions = graph.neuronPositions ?? {};
    const count = neurons.length;

    const posArr = new Float32Array(count * 3);
    const ids: string[] = [];
    const attnArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const neuron = neurons[i]!;
      ids.push(neuron.id);
      const pos = positions[neuron.id] ?? [0, 0, 0];
      posArr[i * 3] = pos[0];
      posArr[i * 3 + 1] = pos[1];
      posArr[i * 3 + 2] = pos[2];
      attnArr[i] = neuron.lane === "attn_head" ? 1.0 : 0.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute("aActivation", new THREE.BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute("aIsAttn", new THREE.BufferAttribute(attnArr, 1));
    geo.setAttribute("aSelected", new THREE.BufferAttribute(new Float32Array(count), 1));

    return { geometry: geo, neuronIds: ids };
  }, [graph]);

  // Build neuron state lookup
  const neuronStateMap = useMemo(() => {
    const map = new Map<string, number>();
    if (frame?.neuron_states) {
      for (const ns of frame.neuron_states) {
        map.set(ns.id, ns.activation);
      }
    }
    return map;
  }, [frame?.neuron_states]);

  // Update selection buffer only when selection changes
  const selectedId = selection?.kind === "neuron" ? selection.id : null;
  useMemo(() => {
    const count = neuronIds.length;
    const selAttr = geometry.getAttribute("aSelected") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      selAttr.setX(i, neuronIds[i] === selectedId ? 1.0 : 0.0);
    }
    selAttr.needsUpdate = true;
  }, [geometry, neuronIds, selectedId]);

  // Per-frame update of size and activation buffers (dynamic)
  useFrame((state) => {
    const count = neuronIds.length;
    const sizeAttr = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const actAttr = geometry.getAttribute("aActivation") as THREE.BufferAttribute;

    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const id = neuronIds[i]!;
      let activation = neuronStateMap.get(id) ?? 0;

      // Pulse effect: add time-based shimmer for active neurons
      const act = Math.abs(activation);
      if (act > 0.1) {
        const shimmer = Math.sin(time * 3.0 + i * 0.007) * 0.06 * act;
        activation = activation + shimmer;
      }

      const absAct = Math.abs(activation);
      const baseSize = 0.006;
      const size = baseSize + absAct * absAct * 0.03;

      sizeAttr.setX(i, size);
      actAttr.setX(i, activation);
    }

    sizeAttr.needsUpdate = true;
    actAttr.needsUpdate = true;
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: neuronVertexShader,
        fragmentShader: neuronFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      onClick={(event) => {
        event.stopPropagation();

        // R3F raycasts Points objects and stores the hit index on event.index
        const idx = (event as unknown as { index?: number }).index;
        if (idx !== undefined && idx >= 0 && idx < neuronIds.length) {
          onSelect({ kind: "neuron", id: neuronIds[idx]! });
        }
      }}
      onPointerMissed={() => {
        // Don't clear selection on miss — keep the current selection
      }}
    />
  );
}
