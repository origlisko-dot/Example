"""
Pipecat ↔ Asterisk bridge seams.

Modes (PIPECAT_TRANSPORT):
  none          — write call context only; no voice (default)
  bridge_sim    — no audio; fill structured outcome as if agent finished
  external_media — ARI ExternalMedia + bridge channels (needs Asterisk + agent host)

When a GSM channel answers, dial_server calls `on_call_answered`.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from pathlib import Path
from typing import Any, Protocol

import httpx

from call_context import write_call_context

log = logging.getLogger("pelozen.bridge")


class CallLike(Protocol):
    call_id: str
    channel_id: str | None
    end_reason: str | None
    structured: dict[str, Any]
    transcript: list[dict[str, str]]


def transport_mode() -> str:
    return os.environ.get("PIPECAT_TRANSPORT", "none").lower()


async def on_call_answered(
    record: CallLike,
    compiled: dict[str, Any],
    *,
    ari_client: httpx.AsyncClient | None = None,
    ari_auth: str | None = None,
    ari_url: str | None = None,
) -> None:
    """Attach voice agent (or sim) after the callee answers."""
    ctx_path = write_call_context(compiled, record.call_id)
    record.structured = {
        **(record.structured or {}),
        "call_context_path": str(ctx_path),
        "pipecat_transport": transport_mode(),
    }
    os.environ["PELOZEN_CALL_CONTEXT"] = str(ctx_path)

    mode = transport_mode()
    if mode == "none":
        log.info("call %s answered — context written, transport=none", record.call_id)
        return

    if mode == "bridge_sim":
        await _run_bridge_sim(record, ctx_path)
        return

    if mode == "external_media":
        if not (ari_client and ari_auth and ari_url and record.channel_id):
            record.structured["bridge_error"] = "external_media_missing_ari"
            return
        await _attach_external_media(
            record, ctx_path, ari_client=ari_client, ari_auth=ari_auth, ari_url=ari_url
        )
        return

    record.structured["bridge_error"] = f"unknown_transport:{mode}"


async def _run_bridge_sim(record: CallLike, ctx_path: Path) -> None:
    """Dev stand-in for a finished Pipecat call — proves context → outcome path."""
    await asyncio.sleep(1)
    ctx = json.loads(ctx_path.read_text(encoding="utf-8"))
    record.end_reason = "answered"
    record.structured = {
        **(record.structured or {}),
        "disposition": "qualified_for_human",
        "interested": True,
        "business_active": True,
        "wants_callback": True,
        "bridge_sim": True,
        "system_prompt_len": len(ctx.get("systemPrompt") or ""),
    }
    record.transcript = [
        {"speaker": "bot", "text": "שלום, פנית אלינו וביקשת שנחזור אליך."},
        {"speaker": "user", "text": "כן, העסק פעיל ואשמח שנחזור."},
    ]


async def _attach_external_media(
    record: CallLike,
    ctx_path: Path,
    *,
    ari_client: httpx.AsyncClient,
    ari_auth: str,
    ari_url: str,
) -> None:
    """
    ARI ExternalMedia → host that runs Pipecat RTP/AudioSocket consumer.

    Set PIPECAT_EXTERNAL_HOST=host:port (e.g. 127.0.0.1:4000), then run agent.py
    with a transport listening on that host.
    """
    host = os.environ.get("PIPECAT_EXTERNAL_HOST", "127.0.0.1:4000")
    app_name = os.environ.get("ASTERISK_STASIS_APP", "pelozen")
    headers = {"Authorization": f"Basic {ari_auth}"}

    em = await ari_client.post(
        f"{ari_url}/channels/externalMedia",
        params={
            "app": app_name,
            "external_host": host,
            "format": os.environ.get("PIPECAT_MEDIA_FORMAT", "slin16"),
            "transport": "udp",
            "encapsulation": "rtp",
            "connection_type": "client",
            "direction": "both",
        },
        headers=headers,
    )
    if em.status_code >= 300:
        record.structured["bridge_error"] = f"external_media_{em.status_code}"
        return

    em_data = em.json()
    em_id = em_data.get("id")
    record.structured["external_media_channel"] = em_id

    br = await ari_client.post(
        f"{ari_url}/bridges",
        params={"type": "mixing"},
        headers=headers,
    )
    if br.status_code >= 300:
        record.structured["bridge_error"] = f"bridge_create_{br.status_code}"
        return
    bridge_id = br.json().get("id")
    record.structured["bridge_id"] = bridge_id

    for ch in (record.channel_id, em_id):
        add = await ari_client.post(
            f"{ari_url}/bridges/{bridge_id}/addChannel",
            params={"channel": ch},
            headers=headers,
        )
        if add.status_code >= 300:
            record.structured["bridge_error"] = f"bridge_add_{add.status_code}"
            return

    agent_cmd = os.environ.get(
        "PIPECAT_AGENT_CMD",
        f"python3 agent.py --context {ctx_path}",
    )
    log.info("call %s externalMedia ready; starting: %s", record.call_id, agent_cmd)
    try:
        proc = await asyncio.create_subprocess_shell(
            agent_cmd,
            cwd=str(Path(__file__).resolve().parent),
            env={**os.environ, "PELOZEN_CALL_CONTEXT": str(ctx_path)},
        )
        record.structured["agent_pid"] = proc.pid
    except OSError as e:
        record.structured["bridge_error"] = f"agent_spawn:{e}"


def ari_basic_auth(user: str, password: str) -> str:
    return base64.b64encode(f"{user}:{password}".encode()).decode()
