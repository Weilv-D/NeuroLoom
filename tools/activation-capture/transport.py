"""
WebSocket streaming of token-step events to the NeuroLoom runner.

Sends events matching the ``QwenLiveEvent`` union type:
  - session_started
  - token_step
  - session_completed
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

import websockets


async def stream_to_runner(
    events: list[dict[str, Any]],
    runner_url: str,
) -> None:
    """Connect to the NeuroLoom runner WebSocket and send a sequence of events.

    The *events* list should already contain the full set of events in order:
    first a ``session_started`` event, then one ``token_step`` per generated
    token, and finally a ``session_completed`` event.

    Args:
        events: Ordered list of QwenLiveEvent dicts.
        runner_url: WebSocket URL, e.g. ``ws://127.0.0.1:3100/live/<sessionId>``.
    """
    async with websockets.connect(runner_url) as ws:
        for event in events:
            payload = json.dumps(event)
            await ws.send(payload)
            # Small delay to let the studio animate each token
            await asyncio.sleep(0.12)


def build_session_started_event(
    session_id: str,
    prompt: str,
    model: str,
    seed: dict[str, Any],
) -> dict[str, Any]:
    """Build a ``session_started`` event matching the NeuroLoom protocol.

    Args:
        session_id: Unique session identifier.
        prompt: User prompt text.
        model: HuggingFace model identifier.
        seed: The bundle seed (manifest, graph, narrative).

    Returns:
        A dict that serializes to a valid ``QwenSessionStartedEvent``.
    """
    return {
        "type": "session_started",
        "sessionId": session_id,
        "prompt": prompt,
        "model": model,
        "startedAt": _now_ms(),
        "layout": {
            "blockCount": 24,
            "headGroupCount": 6,
            "clustersPerLane": 3,
            "tokenWindow": 16,
        },
        "seed": seed,
    }


def build_token_step_event(
    session_id: str,
    token: str,
    token_index: int,
    completion: str,
    frame: dict[str, Any],
    render_payload_id: str,
    render_payload: dict[str, Any],
    inspect_payload_id: str,
    inspect_payload: dict[str, Any],
) -> dict[str, Any]:
    """Build a ``token_step`` event matching the NeuroLoom protocol.

    Args:
        session_id: Session this token belongs to.
        token: The generated token string.
        token_index: Zero-based token position.
        completion: Full completion text up to and including this token.
        frame: The TraceFrame dict.
        render_payload_id: Payload catalog ID for the render payload.
        render_payload: The QwenRenderPayload dict.
        inspect_payload_id: Payload catalog ID for the inspect payload.
        inspect_payload: The QwenFramePayload dict.

    Returns:
        A dict that serializes to a valid ``QwenTokenStepEvent``.
    """
    return {
        "type": "token_step",
        "sessionId": session_id,
        "token": token,
        "tokenIndex": token_index,
        "completion": completion,
        "frame": frame,
        "renderPayloadId": render_payload_id,
        "renderPayload": render_payload,
        "inspectPayloadId": inspect_payload_id,
        "inspectPayload": inspect_payload,
    }


def build_session_completed_event(
    session_id: str,
    token_count: int,
    trace_file_name: str,
) -> dict[str, Any]:
    """Build a ``session_completed`` event matching the NeuroLoom protocol.

    Args:
        session_id: Session that completed.
        token_count: Total number of generated tokens.
        trace_file_name: Filename for the .loomtrace archive.

    Returns:
        A dict that serializes to a valid ``QwenSessionCompletedEvent``.
    """
    return {
        "type": "session_completed",
        "sessionId": session_id,
        "tokenCount": token_count,
        "durationMs": 0,  # will be set by runner
        "traceFileName": trace_file_name,
    }


def generate_session_id() -> str:
    """Create a unique session ID matching the runner's format."""
    return f"capture-{uuid.uuid4().hex[:12]}"


def _now_ms() -> int:
    import time

    return int(time.time() * 1000)
