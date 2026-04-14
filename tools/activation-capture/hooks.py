"""
Forward-hook registration for transformer model activation capture.

Attaches hooks to each transformer block's MLP (SwiGLU gate_proj) and
attention layers, storing intermediate activations per block.
"""

from __future__ import annotations

from typing import Any, Callable

import torch
from torch import nn


# Per-block activation storage populated by hooks during a forward pass.
# Keys are block indices (int), values are dicts with:
#   "ffn_gate":  Tensor  — gate_proj output after SiLU
#   "attn_weights": Tensor — attention weight matrix (optional, may be None)
activations: dict[int, dict[str, torch.Tensor | None]] = {}

_hook_handles: list[Any] = []


def _make_ffn_hook(block_idx: int) -> Callable:
    """Return a forward hook that captures the gate_proj SiLU output for *block_idx*."""

    def hook(_module: nn.Module, _input: tuple, output: torch.Tensor) -> None:
        # gate_proj output shape: (batch, seq_len, intermediate_size)
        if block_idx not in activations:
            activations[block_idx] = {"ffn_gate": None, "attn_weights": None}
        activations[block_idx]["ffn_gate"] = output.detach().cpu()

    return hook


def _make_attn_hook(block_idx: int) -> Callable:
    """Return a forward hook that captures attention weight matrices for *block_idx*.

    Works with the HuggingFace Qwen2-style attention implementation, which
    returns ``(attn_output, attn_weights, past_key_value)`` when
    ``output_attentions=True``.
    """

    def hook(_module: nn.Module, _input: tuple, output: tuple | torch.Tensor) -> None:
        # HuggingFace attention returns a tuple when output_attentions=True:
        #   (hidden_states, attn_weights, past_kv)
        if block_idx not in activations:
            activations[block_idx] = {"ffn_gate": None, "attn_weights": None}
        if isinstance(output, tuple) and len(output) >= 2 and output[1] is not None:
            activations[block_idx]["attn_weights"] = output[1].detach().cpu()
        else:
            activations[block_idx]["attn_weights"] = None

    return hook


def register_hooks(model: nn.Module) -> None:
    """Attach forward hooks to each transformer block's MLP and attention layers.

    Expects a HuggingFace ``AutoModelForCausalLM`` model whose inner
    architecture follows the Qwen2 / Qwen3 convention:

    * ``model.model.layers[i].mlp.gate_proj`` — SwiGLU gate projection
    * ``model.model.layers[i].self_attn`` — grouped-query attention

    Any previously registered hooks are removed first.
    """
    clear_hooks()

    # Navigate to the transformer layers list.
    # Works for Qwen2/Qwen3, Llama, Mistral, and similar architectures.
    layers = _get_transformer_layers(model)
    if layers is None:
        raise ValueError(
            "Could not locate transformer layers in the model. "
            "Expected model.model.layers or model.transformer.h."
        )

    for block_idx, layer in enumerate(layers):
        # --- MLP / FFN hook (gate_proj) ---
        gate_proj = _find_submodule(layer, "mlp.gate_proj")
        if gate_proj is not None:
            handle = gate_proj.register_forward_hook(_make_ffn_hook(block_idx))
            _hook_handles.append(handle)

        # --- Attention hook ---
        attn = _find_submodule(layer, "self_attn")
        if attn is not None:
            handle = attn.register_forward_hook(_make_attn_hook(block_idx))
            _hook_handles.append(handle)


def clear_hooks() -> None:
    """Remove all previously registered hooks and clear stored activations."""
    for handle in _hook_handles:
        handle.remove()
    _hook_handles.clear()
    activations.clear()


def reset_activations() -> None:
    """Clear stored activations without removing hooks (call between tokens)."""
    for block_data in activations.values():
        block_data["ffn_gate"] = None
        block_data["attn_weights"] = None


def _get_transformer_layers(model: nn.Module) -> list[nn.Module] | None:
    """Return the list of transformer block modules, or None if not found."""
    # Qwen2 / Qwen3 / Llama / Mistral style
    layers = _attr(model, "model", "layers")
    if layers is not None and isinstance(layers, nn.ModuleList):
        return list(layers)

    # GPT-2 style
    layers = _attr(model, "transformer", "h")
    if layers is not None and isinstance(layers, nn.ModuleList):
        return list(layers)

    # Fallback: search for a ModuleList child whose children look like blocks
    for child in model.children():
        for sub in child.children():
            if isinstance(sub, nn.ModuleList) and len(sub) > 0:
                return list(sub)

    return None


def _find_submodule(module: nn.Module, dotted_path: str) -> nn.Module | None:
    """Resolve a dotted attribute path like ``mlp.gate_proj`` to a submodule."""
    parts = dotted_path.split(".")
    current: nn.Module | None = module
    for part in parts:
        current = getattr(current, part, None)
        if not isinstance(current, nn.Module):
            return None
    return current


def _attr(obj: Any, *names: str) -> Any:
    """Chain of getattr calls, returning None if any step fails."""
    current = obj
    for name in names:
        current = getattr(current, name, None)
        if current is None:
            return None
    return current
