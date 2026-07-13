"""
Pelozen pipeline dial service — GSM / Pipecat path.

Modes (PIPELINE_MODE env):
  sim       — no hardware; simulates answered calls (dev + integration tests)
  asterisk  — ARI originate via GSM gateway (voice bridge = next step)

Endpoints:
  GET  /health
  POST /dial
  GET  /calls/{call_id}
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Pelozen Pipeline Dial Service")

SIM_CYCLE = [
    # Matches SAMPLE_CAMPAIGN successExpr (interested && business_active && wants_callback)
    {
        "disposition": "qualified_for_human",
        "interested": True,
        "business_active": True,
        "wants_callback": True,
    },
    {
        "disposition": "interested",
        "interested": True,
        "business_active": True,
        "wants_callback": False,
    },
    {
        "disposition": "not_relevant",
        "interested": False,
        "business_active": False,
        "wants_callback": False,
    },
    {
        "disposition": "callback_later",
        "interested": True,
        "business_active": True,
        "wants_callback": True,
        "best_callback_time": "בערב",
    },
    {"disposition": "no_answer"},
    {"disposition": "opted_out", "interested": False, "opt_out": True},
]

_sim_counter = 0


class DialBody(BaseModel):
    to_e164: str
    caller_id: str
    compiled: dict[str, Any]
    max_duration_sec: int = 300
    ai_disclosed: bool = False


@dataclass
class CallRecord:
    call_id: str
    to_e164: str
    caller_id: str
    compiled: dict[str, Any]
    status: str = "dialing"
    end_reason: str | None = None
    duration_sec: int = 0
    structured: dict[str, Any] = field(default_factory=dict)
    transcript: list[dict[str, str]] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    channel_id: str | None = None


_calls: dict[str, CallRecord] = {}


def pipeline_mode() -> str:
    return os.environ.get("PIPELINE_MODE", "sim").lower()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "mode": pipeline_mode(),
        "asterisk_configured": bool(os.environ.get("ASTERISK_ARI_URL")),
    }


@app.post("/dial")
async def dial(body: DialBody) -> dict[str, str]:
    call_id = str(uuid.uuid4())
    record = CallRecord(
        call_id=call_id,
        to_e164=body.to_e164,
        caller_id=body.caller_id,
        compiled=body.compiled,
    )
    _calls[call_id] = record

    mode = pipeline_mode()
    if mode == "asterisk":
        asyncio.create_task(_run_asterisk_call(record, body.max_duration_sec))
    else:
        asyncio.create_task(_run_sim_call(record))

    return {"call_id": call_id}


@app.get("/calls/{call_id}")
def get_call(call_id: str) -> dict[str, Any]:
    record = _calls.get(call_id)
    if not record:
        raise HTTPException(status_code=404, detail="call not found")
    return _serialize(record)


def _serialize(r: CallRecord) -> dict[str, Any]:
    status = r.status
    if status == "dialing":
        mapped = "dialing"
    elif status == "ongoing":
        mapped = "ongoing"
    elif status == "error":
        mapped = "error"
    else:
        mapped = "ended"
    return {
        "call_id": r.call_id,
        "status": mapped,
        "end_reason": r.end_reason,
        "duration_sec": r.duration_sec,
        "structured": r.structured,
        "transcript": r.transcript,
    }


async def _run_sim_call(record: CallRecord) -> None:
    global _sim_counter
    await asyncio.sleep(2)
    idx = _sim_counter % len(SIM_CYCLE)
    _sim_counter += 1
    payload = SIM_CYCLE[idx]

    if payload.get("disposition") == "no_answer":
        record.status = "ended"
        record.end_reason = "no_answer"
        record.duration_sec = 0
        return

    record.status = "ongoing"
    await asyncio.sleep(3)
    record.status = "ended"
    record.end_reason = "answered"
    record.duration_sec = 95
    record.structured = {**payload, "simulated": True}
    record.transcript = [
        {"speaker": "bot", "text": "שלום, פנית אלינו וביקשת שנחזור אליך."},
        {"speaker": "user", "text": "כן, נכון."},
    ]


async def _run_asterisk_call(record: CallRecord, max_duration_sec: int) -> None:
    ari_url = os.environ.get("ASTERISK_ARI_URL", "").rstrip("/")
    if not ari_url:
        record.status = "error"
        record.end_reason = "asterisk_not_configured"
        return

    user = os.environ.get("ASTERISK_ARI_USER", "pelozen")
    password = os.environ.get("ASTERISK_ARI_PASSWORD", "")
    app_name = os.environ.get("ASTERISK_STASIS_APP", "pelozen")
    gateway = os.environ.get("GSM_GATEWAY_ENDPOINT", os.environ.get("SIP_USERNAME", "gsm"))

    # Dial through GSM gateway PJSIP endpoint — number without + for many gateways
    dest = record.to_e164.lstrip("+")
    endpoint = f"PJSIP/{gateway}/{dest}"
    auth = base64.b64encode(f"{user}:{password}".encode()).decode()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"{ari_url}/channels",
                params={"endpoint": endpoint, "app": app_name, "appArgs": record.call_id},
                headers={"Authorization": f"Basic {auth}"},
            )
            if res.status_code >= 300:
                record.status = "error"
                record.end_reason = f"ari_error_{res.status_code}"
                return
            data = res.json()
            record.channel_id = data.get("id")
            record.status = "ongoing"

            deadline = asyncio.get_event_loop().time() + max_duration_sec
            while asyncio.get_event_loop().time() < deadline:
                ch = await client.get(
                    f"{ari_url}/channels/{record.channel_id}",
                    headers={"Authorization": f"Basic {auth}"},
                )
                if ch.status_code != 200:
                    break
                state = ch.json().get("state")
                if state in ("Down", "Rsrvd"):
                    break
                if state == "Up":
                    record.end_reason = "answered"
                await asyncio.sleep(2)

            if record.channel_id:
                await client.delete(
                    f"{ari_url}/channels/{record.channel_id}",
                    headers={"Authorization": f"Basic {auth}"},
                )

            record.status = "ended"
            if not record.end_reason:
                record.end_reason = "no_answer"
            record.duration_sec = int(
                (datetime.now(timezone.utc) - record.started_at).total_seconds()
            )
            # Pipecat audio bridge (Stasis → agent.py) is wired separately.
            record.structured = record.structured or {"note": "asterisk_originate_only"}
    except httpx.HTTPError as e:
        record.status = "error"
        record.end_reason = f"ari_failed:{e}"


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PIPELINE_PORT", "8090"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
