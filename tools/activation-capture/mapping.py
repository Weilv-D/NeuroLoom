"""
Maps PyTorch tensor activations to NeuroLoom neuron_states format.

NeuroLoom expects a flat list of ``{id, activation}`` dicts for the
neuron-level point cloud, with 86 400 total neurons:
  24 blocks * 3 584 FFN  +  24 blocks * 16 attention heads
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import torch

# Canonical NeuroLoom layout constants (must match graphBuilder.ts)
BLOCK_COUNT = 24
FFN_PER_BLOCK = 3584
ATTN_PER_BLOCK = 16


def normalize_activation(value: float) -> float:
    """Normalize an activation value to the range [-1, 1].

    Uses ``tanh`` for smooth saturation rather than hard clipping, so
    outlier values are compressed rather than truncated.
    """
    return float(np.tanh(value))


def _sparsify_ffn(
    activations: np.ndarray,
    keep_ratio: float = 0.12,
) -> np.ndarray:
    """Zero out all but the top *keep_ratio* activations by magnitude.

    Args:
        activations: 1-D array of FFN gate_proj activation values.
        keep_ratio: Fraction of neurons to keep active (default 12%).

    Returns:
        Array of same shape with low-magnitude entries set to zero.
    """
    n = len(activations)
    if n == 0:
        return activations
    k = max(1, int(n * keep_ratio))
    magnitudes = np.abs(activations)
    # Find the k-th largest magnitude threshold
    threshold = float(np.partition(magnitudes, -k)[-k])
    mask = magnitudes >= threshold
    # Only keep exactly the top-k (break ties deterministically by index)
    if mask.sum() > k:
        indices = np.where(mask)[0]
        mask[indices[k:]] = False
    result = np.where(mask, activations, 0.0)
    return result


def _head_attention_intensity(
    attn_weights: torch.Tensor | None,
    num_heads: int,
    head_dim: int | None = None,
) -> list[float]:
    """Compute per-head attention intensity from weight matrices.

    If ``attn_weights`` is available (shape ``(batch, num_heads, seq, seq)``),
    intensity is the mean absolute attention weight per head.

    Otherwise returns a uniform fallback.
    """
    if attn_weights is None:
        return [0.14] * num_heads

    # attn_weights: (batch, heads, query_len, key_len)
    aw = attn_weights.float().numpy()
    if aw.ndim == 4:
        # Average over batch and both sequence dims
        per_head = np.mean(np.abs(aw), axis=(0, 2, 3))
    elif aw.ndim == 3:
        per_head = np.mean(np.abs(aw), axis=(0, 2))
    else:
        per_head = np.full(num_heads, np.mean(np.abs(aw)))

    # Ensure we have exactly num_heads entries
    if len(per_head) < num_heads:
        per_head = np.concatenate(
            [per_head, np.full(num_heads - len(per_head), per_head.mean())]
        )
    elif len(per_head) > num_heads:
        # Group heads (e.g. GQA with fewer KV heads)
        per_head = _redistribute_heads(per_head, num_heads)

    return [normalize_activation(float(v)) for v in per_head[:num_heads]]


def _redistribute_heads(values: np.ndarray, target_count: int) -> np.ndarray:
    """Redistribute source values to fill *target_count* slots by repetition."""
    if len(values) == 0:
        return np.full(target_count, 0.14)
    reps = math.ceil(target_count / len(values))
    return np.tile(values, reps)[:target_count]


def _ffn_block_activations(
    ffn_gate: torch.Tensor | None,
    num_neurons: int,
) -> np.ndarray:
    """Extract and sparsify FFN activations from gate_proj output.

    The gate_proj tensor has shape ``(batch, seq_len, intermediate_size)``.
    We take the last token position and reduce to *num_neurons* entries.
    """
    if ffn_gate is None:
        return np.zeros(num_neurons, dtype=np.float32)

    # Shape: (batch, seq, intermediate_size) -> take last token
    gate = ffn_gate.float()
    if gate.ndim == 3:
        gate = gate[0, -1, :]  # first batch, last token
    elif gate.ndim == 2:
        gate = gate[-1, :]
    else:
        gate = gate.flatten()

    values = gate.numpy()

    # Downsample or upsample to match num_neurons
    if len(values) > num_neurons:
        # Average pool in chunks
        chunk = len(values) / num_neurons
        result = np.array(
            [
                np.mean(values[int(i * chunk) : int((i + 1) * chunk)])
                for i in range(num_neurons)
            ]
        )
    elif len(values) < num_neurons:
        # Repeat with slight variation
        reps = math.ceil(num_neurons / len(values))
        result = np.tile(values, reps)[:num_neurons]
    else:
        result = values.copy()

    # Normalize to [-1, 1]
    result = np.array([normalize_activation(v) for v in result])

    # Sparsify: keep only top 12%
    result = _sparsify_ffn(result, keep_ratio=0.12)

    return result


def map_to_neuron_states(
    ffn_activations: dict[int, torch.Tensor | None],
    attn_activations: dict[int, torch.Tensor | None],
    num_blocks: int = BLOCK_COUNT,
    ffn_per_block: int = FFN_PER_BLOCK,
    attn_per_block: int = ATTN_PER_BLOCK,
) -> list[dict[str, Any]]:
    """Map captured activations to NeuroLoom ``neuron_states`` format.

    Args:
        ffn_activations: Per-block gate_proj tensors (or None).
        attn_activations: Per-block attention weight tensors (or None).
        num_blocks: Number of transformer blocks (default 24).
        ffn_per_block: FFN neurons per block (default 3584).
        attn_per_block: Attention heads per block (default 16).

    Returns:
        List of ``{"id": str, "activation": float}`` dicts matching the
        NeuroLoom ``neuronStateSchema``.
    """
    neuron_states: list[dict[str, Any]] = []

    for block_idx in range(num_blocks):
        # --- FFN neurons ---
        ffn_tensor = ffn_activations.get(block_idx)
        ffn_vals = _ffn_block_activations(ffn_tensor, ffn_per_block)
        for neuron_idx in range(ffn_per_block):
            neuron_id = f"neuron:{block_idx}:{neuron_idx}"
            activation = round(float(ffn_vals[neuron_idx]), 4)
            neuron_states.append({"id": neuron_id, "activation": activation})

        # --- Attention heads ---
        attn_tensor = attn_activations.get(block_idx)
        head_intensities = _head_attention_intensity(attn_tensor, attn_per_block)
        for head_idx in range(attn_per_block):
            neuron_id = f"attn_head:{block_idx}:{head_idx}"
            activation = round(head_intensities[head_idx], 4)
            neuron_states.append({"id": neuron_id, "activation": activation})

    return neuron_states
