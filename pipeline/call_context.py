"""Write per-call context JSON for agent.py (PELOZEN_CALL_CONTEXT)."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def normalize_compiled(compiled: dict[str, Any], call_id: str) -> dict[str, Any]:
    """Map orchestrator DialBody.compiled → agent load_call_context() shape."""
    system = (
        compiled.get("systemPrompt")
        or compiled.get("system_prompt")
        or compiled.get("system")
        or ""
    )
    tool = compiled.get("recordOutcomeTool") or compiled.get("record_outcome_tool")
    if not tool:
        tool = {
            "name": "record_outcome",
            "description": "Record the structured call outcome",
            "input_schema": {
                "type": "object",
                "properties": {
                    "interested": {"type": "boolean"},
                    "wants_callback": {"type": "boolean"},
                    "disposition": {"type": "string"},
                },
                "required": ["interested", "wants_callback", "disposition"],
            },
        }

    return {
        "callId": call_id,
        "systemPrompt": system,
        "recordOutcomeTool": tool,
        "disclosureLine": compiled.get("disclosureLine") or compiled.get("disclosure_line"),
        "voice": compiled.get("voice") or {},
    }


def write_call_context(compiled: dict[str, Any], call_id: str) -> Path:
    ctx = normalize_compiled(compiled, call_id)
    root = Path(os.environ.get("PELOZEN_CALL_CONTEXT_DIR", tempfile.gettempdir())) / "pelozen-calls"
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{call_id}.json"
    path.write_text(json.dumps(ctx, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
