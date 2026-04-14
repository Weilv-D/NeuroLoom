#!/usr/bin/env python3
"""
NeuroLoom real-model activation capture.

Loads a HuggingFace causal LM, attaches forward hooks to capture
intermediate activations, runs token-by-token generation, and exports
the result as a NeuroLoom-compatible ``.loomtrace`` zip archive or
streams it live to the NeuroLoom runner via WebSocket.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import sys
import time
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import torch

# ── Local modules ──────────────────────────────────────────────────────
from hooks import activations, register_hooks, reset_activations, clear_hooks
from mapping import (
    BLOCK_COUNT,
    FFN_PER_BLOCK,
    ATTN_PER_BLOCK,
    map_to_neuron_states,
    normalize_activation,
)
from transport import (
    build_session_started_event,
    build_token_step_event,
    build_session_completed_event,
    generate_session_id,
    stream_to_runner,
)


# ── Constants matching the NeuroLoom schema ────────────────────────────
TRACE_VERSION = "1.0.0"
FAMILY = "transformer"
PHASE_SET = ["decode"]
VISUAL_SEMANTICS = {
    "positive": "#2fe5ff",
    "negative": "#ffb85f",
    "focus": "#d7ff63",
    "neutral": "#eef2ff",
    "bloomStrength": 1.9,
    "fogDensity": 0.075,
}

CAMERA_PRESETS = [
    {
        "id": "ingress",
        "label": "Token Ingress",
        "position": {"x": -8.8, "y": 4.6, "z": 23.4},
        "target": {"x": -8.8, "y": 0.2, "z": 0},
        "fov": 31,
    },
    {
        "id": "braid",
        "label": "Residual Braid",
        "position": {"x": 0.2, "y": 2.1, "z": 24.8},
        "target": {"x": 0.8, "y": -0.8, "z": 0},
        "fov": 28,
    },
    {
        "id": "decode",
        "label": "Decode Head",
        "position": {"x": 11.6, "y": 2.8, "z": 18.2},
        "target": {"x": 13.9, "y": -0.4, "z": 0},
        "fov": 26,
    },
]


# ── Graph builder (Python port of graphBuilder.ts) ─────────────────────

def _round3(v: float) -> float:
    return round(v, 3)


def _round4(v: float) -> float:
    return round(v, 4)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _seeded_rng(seed: str, salt: int) -> Any:
    """Simple deterministic RNG matching the JS seeded() helper."""
    value = _hash_string(f"{seed}:{salt}") or 1

    def next_val() -> float:
        nonlocal value
        value = (value * 1664525 + 1013904223) & 0xFFFFFFFF
        return value / 4294967295

    return next_val


def _hash_string(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return abs(h)


def _hash_token(prompt: str, token: str, token_index: int) -> int:
    return _hash_string(f"{prompt}:{token}:{token_index}")


def _wave(seed: float, layer: float, offset: float) -> float:
    return math.sin(seed * 0.0009 + layer * 0.44 + offset)


def _positive_wave(seed: float, layer: float, offset: float) -> float:
    return (_wave(seed, layer, offset) + 1) / 2


def _block_node_id(kind: str, block: int) -> str:
    return f"{kind}-{str(block).zfill(2)}"


def _neuron_arc_position(
    center_x: float, center_y: float, idx: int,
    grid_w: int, grid_h: int, rng: Any,
) -> tuple[float, float, float]:
    col = idx % grid_w
    row = idx // grid_w
    u = col / (grid_w - 1) - 0.5
    v = row / (grid_h - 1) - 0.5
    arc_radius = 0.65 + abs(u) * 0.3
    angle = v * math.pi * 0.85 + u * 0.4
    spread_x = u * 0.48
    spread_y = math.sin(angle) * arc_radius * 0.55
    spread_z = math.cos(angle) * arc_radius * 0.25
    jitter = 0.12
    return (
        _round3(center_x + spread_x + (rng() - 0.5) * jitter),
        _round3(center_y + spread_y + (rng() - 0.5) * jitter * 0.7),
        _round3(spread_z + (rng() - 0.5) * jitter * 0.5),
    )


def build_graph(num_blocks: int = BLOCK_COUNT) -> dict[str, Any]:
    """Build the NeuroLoom trace graph (Python port of graphBuilder.ts).

    Returns the JSON-serializable graph structure with nodes, edges,
    neurons, and neuronPositions.
    """
    grid_w, grid_h = 64, 56
    nodes: list[dict] = [
        _make_node("prompt", "Prompt", "token", 0, 0, -15.2, 0, 0,
                   {"lane": "prompt", "subtype": "prompt"}),
        _make_node("embedding", "Embedding", "embedding", 1, 0, -12.8, 0, 0,
                   {"lane": "embedding", "subtype": "token_embed"}),
    ]
    edges: list[dict] = [
        _make_edge("prompt-embedding", "prompt", "embedding", "token-flow", 1),
    ]
    neurons: list[dict] = []
    neuron_positions: dict[str, list[float]] = {}

    for block in range(num_blocks):
        x = -10.8 + block * 0.98
        wo = math.sin(block * 0.35) * 0.35
        resid_id = _block_node_id("residual", block)
        attn_id = _block_node_id("attention", block)
        delta_id = _block_node_id("delta", block)
        ffn_id = _block_node_id("ffn", block)

        nodes.extend([
            _make_node(resid_id, f"Residual {block+1}", "residual", block+2, 0,
                       x, _round3(0.2 + wo * 0.4), 0,
                       {"lane": "residual", "block": block, "subtype": "residual_stream"}),
            _make_node(attn_id, f"Attention {block+1}", "attention", block+2, 1,
                       _round3(x - 0.04), _round3(3.1 + wo), 0.55,
                       {"lane": "attention", "block": block, "subtype": "grouped_query_attention"}),
            _make_node(delta_id, f"Delta {block+1}", "delta", block+2, 2,
                       _round3(x + 0.08), _round3(-2.4 - wo * 0.5), -0.42,
                       {"lane": "delta", "block": block, "subtype": "gated_deltanet"}),
            _make_node(ffn_id, f"FFN {block+1}", "mlp", block+2, 3,
                       _round3(x + 0.02), _round3(-5.2 + wo * 0.25), 0.72,
                       {"lane": "ffn", "block": block, "subtype": "swiglu_ffn"}),
        ])

        prev_resid = "embedding" if block == 0 else _block_node_id("residual", block - 1)
        next_target = "logits" if block == num_blocks - 1 else _block_node_id("residual", block + 1)
        edges.extend([
            _make_edge(f"embedding-residual-{block}", prev_resid, resid_id, "residual-flow", 1),
            _make_edge(f"residual-attention-{block}", resid_id, attn_id, "attention-branch", 0.82),
            _make_edge(f"residual-delta-{block}", resid_id, delta_id, "delta-branch", 0.74),
            _make_edge(f"residual-ffn-{block}", resid_id, ffn_id, "ffn-branch", 0.78),
            _make_edge(f"attention-return-{block}", attn_id, next_target, "attention-return", 0.84),
            _make_edge(f"delta-return-{block}", delta_id, next_target, "delta-return", 0.72),
            _make_edge(f"ffn-return-{block}", ffn_id, next_target, "ffn-return", 0.88),
        ])

        # FFN neuron positions (arc layout, independent RNG per block)
        ffn_rng = _seeded_rng(f"neurons:{block}", 42)
        ffn_cx = _round3(x + 0.02)
        ffn_cy = _round3(-5.2 + wo * 0.25)
        for idx in range(FFN_PER_BLOCK):
            nid = f"neuron:{block}:{idx}"
            pos = _neuron_arc_position(ffn_cx, ffn_cy, idx, grid_w, grid_h, ffn_rng)
            neurons.append({"id": nid, "block": block, "index": idx, "lane": "ffn"})
            neuron_positions[nid] = list(pos)

        # Attention head positions (satellite layout, independent RNG)
        attn_rng = _seeded_rng(f"attn:{block}", 7)
        attn_cx = _round3(x - 0.04)
        attn_cy = _round3(3.1 + wo)
        for head in range(ATTN_PER_BLOCK):
            nid = f"attn_head:{block}:{head}"
            angle = (head / ATTN_PER_BLOCK) * math.pi * 2 + block * 0.3
            radius = 0.45 + (head % 3) * 0.12
            hx = attn_cx + math.cos(angle) * radius + (attn_rng() - 0.5) * 0.1
            hy = attn_cy + math.sin(angle) * radius * 0.6 + (attn_rng() - 0.5) * 0.08
            hz = 0.55 + math.sin(angle) * radius * 0.3
            neurons.append({"id": nid, "block": block, "index": head, "lane": "attn_head"})
            neuron_positions[nid] = [_round3(hx), _round3(hy), _round3(hz)]

    nodes.extend([
        _make_node("logits", "Logits", "logits", num_blocks + 3, 0, 13.9, -0.25, 0,
                   {"lane": "logits", "subtype": "decode_logits"}),
        _make_node("decode", "Decode", "decode", num_blocks + 4, 0, 16.1, -0.2, 0,
                   {"lane": "decode", "subtype": "token_emit"}),
    ])
    edges.append(_make_edge("logits-decode", "logits", "decode", "decode-flow", 1))

    return {
        "nodes": nodes,
        "edges": edges,
        "rootNodeIds": ["prompt"],
        "neurons": neurons,
        "neuronPositions": neuron_positions,
    }


def _make_node(
    nid: str, label: str, ntype: str, layer: int, order: int,
    x: float, y: float, z: float, metadata: dict,
) -> dict:
    return {
        "id": nid,
        "label": label,
        "type": ntype,
        "layerIndex": layer,
        "order": order,
        "position": {"x": _round3(x), "y": _round3(y), "z": _round3(z)},
        "metadata": metadata,
    }


def _make_edge(eid: str, source: str, target: str, etype: str, weight: float) -> dict:
    return {"id": eid, "source": source, "target": target, "type": etype, "weight": weight}


# ── Payload / frame builders ──────────────────────────────────────────

def _tokenize_completion(text: str) -> list[str]:
    words = text.split()
    if not words:
        return []
    return [words[0]] + [f" {w}" for w in words[1:]]


def _payload_id(seed: str, frame_index: int, kind: str) -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in seed)
    return f"{safe}-frame-{str(frame_index).zfill(4)}-{kind}"


def _catalog_entry(pid: str, kind: str) -> dict:
    return {
        "id": pid,
        "kind": kind,
        "mimeType": "application/json",
        "path": f"payload/{kind}/{pid}.json",
    }


def build_block_digest_from_real(
    ffn_acts: dict[int, Any],
    attn_acts: dict[int, Any],
    token_seed: float,
    focus_block: int,
    num_blocks: int = BLOCK_COUNT,
) -> list[dict]:
    """Build blockDigest using real captured activations.

    For blocks where real data is available, use it. For others,
    fall back to a synthetic estimate so the digest always has 24 entries.
    """
    digest = []
    for block in range(num_blocks):
        distance = abs(block - focus_block)
        focus = math.exp(-distance / 4.2)

        # FFN gate magnitude as the real activation signal
        ffn_gate = ffn_acts.get(block)
        if ffn_gate is not None:
            ffn_val = float(torch.mean(torch.abs(ffn_gate.float())).item())
            ffn_val = _clamp(normalize_activation(ffn_val), 0.04, 1.0)
        else:
            ffn_val = _clamp(
                0.2 + focus * 0.44 + _wave(token_seed, block, 0.91) * 0.2,
                0.04, 1.0,
            )

        # Attention weight intensity
        attn_w = attn_acts.get(block)
        if attn_w is not None:
            attn_val = float(torch.mean(torch.abs(attn_w.float())).item())
            attn_val = _clamp(normalize_activation(attn_val), 0.04, 1.0)
        else:
            attn_val = _clamp(
                0.14 + focus * 0.48 + _wave(token_seed, block, 0.47) * 0.22,
                0.04, 1.0,
            )

        residual = _clamp(
            0.18 + focus * 0.54 + _wave(token_seed, block, 0.18) * 0.18,
            0.04, 1.0,
        )
        delta = _clamp(
            0.16 + focus * 0.41 + _wave(token_seed, block, 0.73) * 0.24,
            0.04, 1.0,
        )

        digest.append({
            "block": block,
            "residual": _round4(residual),
            "attention": _round4(attn_val),
            "delta": _round4(delta),
            "ffn": _round4(ffn_val),
        })
    return digest


def build_inspect_payload(
    prompt: str,
    token: str,
    token_index: int,
    completion: str,
    model_name: str,
    ffn_acts: dict[int, Any],
    attn_acts: dict[int, Any],
    token_seed: int,
) -> dict:
    """Build a QwenFramePayload dict using real activations where available."""
    focus_block = token_index % BLOCK_COUNT
    ts = float(token_seed)
    token_window = _tokenize_completion(completion)[-16:]
    block_digest = build_block_digest_from_real(ffn_acts, attn_acts, ts, focus_block)

    layer_norms = [
        _round4(_clamp(d["residual"] * 0.48 + d["ffn"] * 0.22 + 0.12, 0, 1))
        for d in block_digest
    ]
    residual_bands = [
        _round4(_clamp(d["residual"] * 0.72 + d["delta"] * 0.16 + d["attention"] * 0.12, 0, 1))
        for d in block_digest
    ]

    head_group_count = 6
    head_group_scores = []
    for block in range(BLOCK_COUNT):
        scores = []
        for head in range(head_group_count):
            val = _clamp(
                0.14 + block_digest[block]["attention"] * 0.56
                + _wave(ts + head * 7, block, head * 0.31) * 0.22,
                0, 1,
            )
            scores.append(_round4(val))
        head_group_scores.append(scores)

    # Attention row from token window
    attn_raw = [
        0.08 + math.exp(-(len(token_window) - 1 - i) / 3.4) * 0.78
        + _positive_wave(ts, i, 0.29) * 0.18
        for i in range(len(token_window))
    ]
    total = sum(attn_raw) or 1
    attention_row = [_round4(v / total) for v in attn_raw]

    # Top logits (synthetic placeholders -- real logit extraction happens in
    # the generation loop and gets patched in by build_real_top_logits)
    top_logits = _build_top_logits(token.strip() or "token", ts)

    # Sampled units
    sampled_units = []
    for block in range(BLOCK_COUNT):
        for lane in ("residual", "attention", "delta", "ffn"):
            digest = block_digest[block]
            lane_val = digest.get(lane, 0.14)
            for cluster in range(3):
                local = _clamp(
                    lane_val * (0.76 + cluster * 0.12)
                    + _wave(ts + cluster * 19, block, cluster * 0.22) * 0.16,
                    0, 1,
                )
                sampled_units.append({
                    "id": f"cluster:{lane}:{block}:{cluster}",
                    "label": f"{lane} {block+1}.{cluster+1}",
                    "nodeId": _block_node_id(
                        "ffn" if lane == "ffn" else lane, block
                    ),
                    "block": block,
                    "lane": lane,
                    "cluster": cluster,
                    "intensity": _round4(local),
                    "polarity": _round4(_wave(ts + cluster * 13, block, 0.18)),
                    "tokenAffinity": _round4(
                        _clamp(math.exp(-abs(block - focus_block) / 3.8), 0, 1)
                    ),
                })

    camera_anchor = (
        "ingress" if token_index < 4
        else "braid" if token_index < 12
        else "decode"
    )

    return {
        "kind": "qwen-frame",
        "model": model_name,
        "prompt": prompt,
        "completion": completion,
        "token": token,
        "tokenIndex": token_index,
        "tokenWindow": token_window,
        "layerNorms": layer_norms,
        "residualBands": residual_bands,
        "headGroupScores": head_group_scores,
        "attentionRow": attention_row,
        "sampledUnits": sampled_units,
        "topLogits": top_logits,
        "blockDigest": block_digest,
        "cameraAnchor": camera_anchor,
    }


def build_render_payload(payload: dict) -> dict:
    """Derive a render payload from an inspect payload."""
    token_index = payload["tokenIndex"]
    return {
        "headline": (
            "Ingress: tokens begin threading into the hybrid stack."
            if token_index < 4
            else "Braid: grouped attention and recurrent memory tighten into a residual river."
            if token_index < 12
            else "Decode: the starfield narrows and the next word condenses at the edge."
        ),
        "prompt": payload["prompt"],
        "completion": payload["completion"],
        "token": payload["token"],
        "tokenIndex": token_index,
        "layerSweep": payload["residualBands"],
        "sampledUnits": [
            u for u in payload["sampledUnits"]
            if u["block"] % 3 == token_index % 3 or u["tokenAffinity"] > 0.42
        ],
        "topLogits": payload["topLogits"],
    }


def build_frame(
    session_id: str,
    token_index: int,
    prompt: str,
    token: str,
    inspect_payload: dict,
    graph: dict,
    neuron_states: list[dict],
) -> dict:
    """Build a TraceFrame dict from captured data."""
    current_block = token_index % BLOCK_COUNT

    # Node states
    node_states = []
    for gnode in graph["nodes"]:
        nid = gnode["id"]
        if nid == "prompt":
            node_states.append(_node_state(
                nid, 0.28 + len(inspect_payload["attentionRow"]) * 0.02, 0.55,
            ))
        elif nid == "embedding":
            node_states.append(_node_state(
                nid, 0.42 + inspect_payload["residualBands"][0] * 0.3, 0.72,
            ))
        elif nid == "logits":
            top = inspect_payload["topLogits"][0]["score"] if inspect_payload["topLogits"] else 0.35
            node_states.append(_node_state(nid, top, 0.92))
        elif nid == "decode":
            top = inspect_payload["topLogits"][0]["score"] if inspect_payload["topLogits"] else 0.35
            node_states.append(_node_state(nid, _clamp(0.55 + top * 0.28, 0, 1), 0.96))
        else:
            block = int(gnode["metadata"].get("block", 0))
            digest = (
                inspect_payload["blockDigest"][block]
                if block < len(inspect_payload["blockDigest"])
                else None
            )
            if not digest:
                node_states.append(_node_state(nid, 0.12, 0.3))
                continue
            lane = str(gnode["metadata"].get("lane", ""))
            act = (
                digest["residual"] if lane == "residual"
                else digest["attention"] if lane == "attention"
                else digest["delta"] if lane == "delta"
                else digest["ffn"]
            )
            distance = abs(block - current_block)
            emphasis = _clamp(0.38 + math.exp(-distance / 4) * 0.54, 0, 1)
            node_states.append(_node_state(nid, act, emphasis))

    # Edge states
    ns_map = {s["nodeId"]: s for s in node_states}
    edge_states = []
    for gedge in graph["edges"]:
        src = ns_map.get(gedge["source"])
        tgt = ns_map.get(gedge["target"])
        intensity = _clamp(
            (
                (abs(src["activation"] if src else 0) + abs(tgt["activation"] if tgt else 0))
                / 2
            ) * gedge["weight"] + 0.05,
            0, 1,
        )
        direction = (
            "backward"
            if src and tgt and src["activation"] > tgt["activation"] + 0.08
            else "forward"
        )
        emphasis = _clamp(0.26 + intensity * 0.68, 0, 1)
        edge_states.append({
            "edgeId": gedge["id"],
            "intensity": _round4(intensity),
            "direction": direction,
            "emphasis": _round4(emphasis),
        })

    # Metrics
    avg_resid = sum(inspect_payload["residualBands"]) / max(len(inspect_payload["residualBands"]), 1)
    avg_attn = (
        sum(d["attention"] for d in inspect_payload["blockDigest"])
        / max(len(inspect_payload["blockDigest"]), 1)
    )
    top_logit = (
        inspect_payload["topLogits"][0]["score"]
        if inspect_payload["topLogits"]
        else 0
    )

    rpid = _payload_id(session_id, token_index, "render")
    ipid = _payload_id(session_id, token_index, "inspect")

    return {
        "frame_id": token_index,
        "step": token_index,
        "substep": 0,
        "phase": "decode",
        "camera_anchor": inspect_payload["cameraAnchor"],
        "node_states": node_states,
        "neuron_states": neuron_states,
        "edge_states": edge_states,
        "metric_refs": [
            {"id": "token_index", "label": "Token", "value": _round4(token_index + 1)},
            {"id": "residual", "label": "Residual", "value": _round4(avg_resid)},
            {"id": "attention", "label": "Attention", "value": _round4(avg_attn)},
            {"id": "logit", "label": "Top Logit", "value": _round4(top_logit)},
        ],
        "payload_refs": [rpid, ipid],
        "note": (
            f'Token {token_index+1} "{token.strip()}" ripples through '
            f"grouped attention, DeltaNet memory, and the decode head."
        ),
    }


def _node_state(node_id: str, activation: float, emphasis: float) -> dict:
    return {
        "nodeId": node_id,
        "activation": _round4(_clamp(activation, -1, 1)),
        "emphasis": _round4(_clamp(emphasis, 0, 1)),
    }


def _build_top_logits(token: str, seed: float) -> list[dict]:
    stem = token.lstrip() or "token"
    candidates = [stem, " attention", " residual", " starfield", " memory", " decode"]
    result = []
    for i, c in enumerate(candidates):
        score = _clamp(
            0.22 + _positive_wave(seed + i * 17, i, 0.19) * 0.58
            + (0.16 if i == 0 else 0),
            0.01, 0.99,
        )
        result.append({"token": c, "score": _round4(score)})
    result.sort(key=lambda x: x["score"], reverse=True)
    return result[:5]


def build_real_top_logits(
    logits: torch.Tensor,
    tokenizer: Any,
) -> list[dict]:
    """Extract real top-k logits from the model output."""
    # logits shape: (1, vocab_size) for the last token
    probs = torch.softmax(logits[0], dim=-1)
    top_k = torch.topk(probs, min(5, probs.size(-1)))
    result = []
    for idx, score in zip(top_k.indices.tolist(), top_k.values.tolist()):
        token_text = tokenizer.decode([idx])
        result.append({"token": token_text, "score": _round4(score)})
    return result


# ── Narrative builder ──────────────────────────────────────────────────

def build_narrative(frame_count: int, prompt: str) -> dict:
    if frame_count == 0:
        return {
            "intro": (
                f'Live Qwen session seeded from prompt: "'
                f'{prompt.strip() or "Awaiting input"}".'
            ),
            "chapters": [{
                "id": "awaiting",
                "label": "Awaiting Tokens",
                "frameRange": [0, 0],
                "defaultSelection": "embedding",
                "description": (
                    "The stage is primed but the first decode step "
                    "has not arrived yet."
                ),
            }],
        }

    early_end = min(frame_count - 1, max(0, int(frame_count * 0.25)))
    mid_start = min(frame_count - 1, early_end + 1)
    mid_end = min(frame_count - 1, max(mid_start, int(frame_count * 0.72)))
    final_start = min(frame_count - 1, max(mid_start, mid_end))

    return {
        "intro": (
            "Qwen3.5-0.8B transforms the prompt into a live starfield, "
            "then preserves the whole exchange as a replayable loomtrace."
        ),
        "chapters": [
            {
                "id": "ingress",
                "label": "Ingress",
                "frameRange": [0, early_end],
                "defaultSelection": "embedding",
                "description": (
                    "The opening tokens cross the embedding gate and "
                    "wake the first hybrid blocks."
                ),
            },
            {
                "id": "braid",
                "label": "Braid",
                "frameRange": [mid_start, mid_end],
                "defaultSelection": _block_node_id(
                    "attention", min(8, BLOCK_COUNT - 1)
                ),
                "description": (
                    "Grouped attention and DeltaNet memory braid into "
                    "the residual river at mid-stack."
                ),
            },
            {
                "id": "decode",
                "label": "Decode",
                "frameRange": [final_start, frame_count - 1],
                "defaultSelection": "logits",
                "description": (
                    "The live response narrows into the decode head "
                    "and leaves a replay trail behind it."
                ),
            },
        ],
    }


# ── .loomtrace archive writer ─────────────────────────────────────────

def write_loomtrace(
    path: str,
    manifest: dict,
    graph: dict,
    timeline: list[dict],
    narrative: dict,
    payloads: dict[str, str],
) -> None:
    """Write a NeuroLoom ``.loomtrace`` zip archive.

    The archive layout matches what ``loadLoomTraceArchive`` in
    ``@neuroloom/core`` expects:
      - manifest.json
      - graph.json
      - timeline.ndjson
      - narrative.json
      - payload/render/*.json
      - payload/inspect/*.json
    """
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        zf.writestr("graph.json", json.dumps(graph, indent=2))
        zf.writestr(
            "timeline.ndjson",
            "\n".join(json.dumps(frame) for frame in timeline),
        )
        zf.writestr(
            manifest["narrative_ref"],
            json.dumps(narrative, indent=2),
        )
        for pid, content in payloads.items():
            # Determine path from catalog
            entry = next(
                (e for e in manifest["payload_catalog"] if e["id"] == pid),
                None,
            )
            if entry:
                zf.writestr(entry["path"], content)
            else:
                zf.writestr(f"payload/unknown/{pid}.json", content)


# ── Main generation loop ──────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Capture real model activations and export as "
            "NeuroLoom .loomtrace or stream to runner"
        ),
    )
    parser.add_argument(
        "--prompt", type=str, required=True,
        help="Input prompt for the model",
    )
    parser.add_argument(
        "--model", type=str, default="Qwen/Qwen3.5-0.8B",
        help="HuggingFace model name (default: Qwen/Qwen3.5-0.8B)",
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="Output .loomtrace file path",
    )
    parser.add_argument(
        "--runner-url", type=str, default=None,
        help=(
            "Runner WebSocket URL for live streaming "
            "(e.g. ws://127.0.0.1:3100/live/SESSION_ID)"
        ),
    )
    parser.add_argument(
        "--max-tokens", type=int, default=100,
        help="Max tokens to generate (default: 100)",
    )
    parser.add_argument(
        "--device", type=str, default=None,
        help="Torch device (default: auto-detect)",
    )
    args = parser.parse_args()

    if not args.output and not args.runner_url:
        parser.error("At least one of --output or --runner-url is required.")

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading model {args.model} on {device}...")

    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        torch_dtype=torch.float16 if device != "cpu" else torch.float32,
        device_map=device,
        trust_remote_code=True,
    )
    model.eval()

    # Register hooks
    register_hooks(model)
    print(f"Hooks registered on {len(activations)} blocks.")

    session_id = generate_session_id()
    graph = build_graph()

    # Build the initial manifest (frame_count updated at the end)
    manifest = {
        "trace_version": TRACE_VERSION,
        "family": FAMILY,
        "model_id": args.model.replace("/", "-"),
        "dataset_id": "real-capture",
        "title": f"Real capture: {args.model}",
        "summary": (
            f"Activation capture from {args.model}. "
            f'Prompt seed: "{args.prompt[:72]}".'
        ),
        "phase_set": PHASE_SET,
        "frame_count": 0,
        "camera_presets": CAMERA_PRESETS,
        "visual_semantics": VISUAL_SEMANTICS,
        "payload_catalog": [],
        "narrative_ref": "narrative.json",
        "data_source": "real",
    }

    # Prepare generation
    messages = [{"role": "user", "content": args.prompt}]
    input_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True,
    )
    input_ids = tokenizer.encode(input_text, return_tensors="pt").to(device)

    # Token-by-token generation
    generated_ids = input_ids.clone()
    tokens_text: list[str] = []
    timeline: list[dict] = []
    payloads_map: dict[str, str] = {}
    live_events: list[dict] = []

    print(f"Generating up to {args.max_tokens} tokens...")

    try:
        with torch.no_grad():
            for step in range(args.max_tokens):
                reset_activations()

                outputs = model(
                    generated_ids,
                    output_attentions=True,
                    use_cache=True,
                )

                # Get logits for the last position
                next_token_logits = outputs.logits[:, -1, :]
                next_token_id = torch.argmax(
                    next_token_logits, dim=-1, keepdim=True,
                )

                # Decode the token
                token_text = tokenizer.decode(
                    next_token_id[0], skip_special_tokens=True,
                )

                # Stop on EOS
                if next_token_id.item() == tokenizer.eos_token_id:
                    print(f"  [EOS] at step {step}")
                    break

                tokens_text.append(token_text)
                completion = "".join(tokens_text)

                # Extract captured activations
                ffn_acts = {
                    blk: data["ffn_gate"]
                    for blk, data in activations.items()
                    if data["ffn_gate"] is not None
                }
                attn_acts = {
                    blk: data["attn_weights"]
                    for blk, data in activations.items()
                    if data["attn_weights"] is not None
                }

                token_seed = _hash_token(args.prompt, token_text, step)

                # Map to neuron states
                neuron_states = map_to_neuron_states(ffn_acts, attn_acts)

                # Build payloads
                inspect = build_inspect_payload(
                    prompt=args.prompt,
                    token=token_text,
                    token_index=step,
                    completion=completion,
                    model_name=args.model,
                    ffn_acts=ffn_acts,
                    attn_acts=attn_acts,
                    token_seed=token_seed,
                )

                # Patch in real top logits from the model output
                inspect["topLogits"] = build_real_top_logits(
                    next_token_logits, tokenizer,
                )

                render = build_render_payload(inspect)
                rpid = _payload_id(session_id, step, "render")
                ipid = _payload_id(session_id, step, "inspect")

                frame = build_frame(
                    session_id=session_id,
                    token_index=step,
                    prompt=args.prompt,
                    token=token_text,
                    inspect_payload=inspect,
                    graph=graph,
                    neuron_states=neuron_states,
                )

                timeline.append(frame)
                payloads_map[rpid] = json.dumps(render)
                payloads_map[ipid] = json.dumps(inspect)
                manifest["payload_catalog"].extend([
                    _catalog_entry(rpid, "render"),
                    _catalog_entry(ipid, "inspect"),
                ])

                print(
                    f"  Token {step+1}: {repr(token_text)}  "
                    f"(FFN blocks: {len(ffn_acts)}, Attn blocks: {len(attn_acts)})"
                )

                # Append token for next step (use cache from outputs)
                generated_ids = torch.cat(
                    [generated_ids, next_token_id], dim=-1,
                )

    except KeyboardInterrupt:
        print("\n  [Interrupted]")

    finally:
        clear_hooks()

    # Finalize manifest and narrative
    manifest["frame_count"] = len(timeline)
    narrative = build_narrative(len(timeline), args.prompt)

    # --- File output ---
    if args.output:
        write_loomtrace(
            args.output, manifest, graph, timeline, narrative, payloads_map,
        )
        print(f"\nWrote {args.output} ({len(timeline)} frames)")

    # --- Live streaming ---
    if args.runner_url:
        seed_bundle = {
            "manifest": manifest,
            "graph": graph,
            "narrative": narrative,
        }

        start_event = build_session_started_event(
            session_id=session_id,
            prompt=args.prompt,
            model=args.model,
            seed=seed_bundle,
        )

        token_events = []
        for i, frame in enumerate(timeline):
            rpid = frame["payload_refs"][0]
            ipid = frame["payload_refs"][1]
            render_data = json.loads(payloads_map[rpid])
            inspect_data = json.loads(payloads_map[ipid])
            token_events.append(build_token_step_event(
                session_id=session_id,
                token=tokens_text[i],
                token_index=i,
                completion="".join(tokens_text[: i + 1]),
                frame=frame,
                render_payload_id=rpid,
                render_payload=render_data,
                inspect_payload_id=ipid,
                inspect_payload=inspect_data,
            ))

        complete_event = build_session_completed_event(
            session_id=session_id,
            token_count=len(timeline),
            trace_file_name=f"{session_id}.loomtrace",
        )

        all_events = [start_event] + token_events + [complete_event]
        print(f"\nStreaming {len(all_events)} events to {args.runner_url}...")
        asyncio.run(stream_to_runner(all_events, args.runner_url))
        print("Streaming complete.")

    print("Done.")


if __name__ == "__main__":
    main()
