"""
Pelozen voice agent — the live Hebrew conversation for ONE call.

Pipeline:  audio-in → Deepgram STT (he) → LLM (Gemini/Claude) → Cartesia TTS
           (owner's cloned voice) → audio-out, with Silero VAD for barge-in.

Per-call context (the compiled Hebrew system prompt + the record_outcome tool
schema + call metadata) is produced by the TypeScript orchestrator
(`promptCompiler.ts`) and handed to this process as a JSON file path in
PELOZEN_CALL_CONTEXT. At end of call the LLM calls `record_outcome`; we POST the
structured result + short transcript back to the orchestrator.

NOTE: the transport (how audio arrives from Asterisk + the owner's SIM gateway)
is decided on build-day — Asterisk external-media/AudioSocket websocket, or a
LiveKit/Daily SIP transport. Everything above the transport is provider-agnostic
and stays as-is. TODOs mark the build-day seams.
"""

from __future__ import annotations

import asyncio
import json
import os

import httpx
from dotenv import load_dotenv

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.adapters.schemas.function_schema import FunctionSchema, ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

load_dotenv()


def load_call_context() -> dict:
    """The compiled prompt + tool schema + call metadata for THIS call."""
    path = os.environ["PELOZEN_CALL_CONTEXT"]
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_llm():
    """Pick the dialogue brain. Gemini Flash by default (cheapest capable Hebrew)."""
    provider = os.environ.get("LLM_PROVIDER", "gemini")
    if provider == "anthropic":
        from pipecat.services.anthropic.llm import AnthropicLLMService
        return AnthropicLLMService(api_key=os.environ["ANTHROPIC_API_KEY"], model="claude-haiku-4-5-20251001")
    from pipecat.services.google.llm import GoogleLLMService
    return GoogleLLMService(api_key=os.environ["GOOGLE_API_KEY"], model="gemini-2.0-flash")


def outcome_tool(schema: dict) -> ToolsSchema:
    """Turn the orchestrator's record_outcome JSON-schema into a Pipecat tool."""
    fn = FunctionSchema(
        name=schema["name"],
        description=schema["description"],
        properties=schema["input_schema"]["properties"],
        required=schema["input_schema"]["required"],
    )
    return ToolsSchema(standard_tools=[fn])


async def run_call(transport) -> None:
    ctx = load_call_context()

    stt = DeepgramSTTService(api_key=os.environ["DEEPGRAM_API_KEY"], language="he", model="nova-3")
    tts = CartesiaTTSService(
        api_key=os.environ["CARTESIA_API_KEY"],
        voice_id=os.environ["CARTESIA_VOICE_ID"],   # the owner's cloned voice
        model=ctx.get("voice", {}).get("model", "sonic-2"),
    )
    llm = build_llm()

    captured: dict = {}

    async def record_outcome(params: FunctionCallParams) -> None:
        # The structured result is the source of truth for the call outcome.
        captured.update(params.arguments)
        await params.result_callback({"ok": True})

    llm.register_function("record_outcome", record_outcome)

    tools = outcome_tool(ctx["recordOutcomeTool"])
    messages = [{"role": "system", "content": ctx["systemPrompt"]}]

    from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
    context = OpenAILLMContext(messages, tools)
    context_agg = llm.create_context_aggregator(context)

    pipeline = Pipeline([
        transport.input(),
        stt,
        context_agg.user(),
        llm,
        tts,
        transport.output(),
        context_agg.assistant(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

    # The disclosure line (if enabled) is spoken first; otherwise the bot opens
    # straight into the campaign intro.
    if ctx.get("disclosureLine"):
        messages.append({"role": "system", "content": f"פתח את השיחה במשפט: {ctx['disclosureLine']}"})

    @transport.event_handler("on_client_disconnected")
    async def _on_end(_transport, _client):
        await report_outcome(ctx, captured, task)
        await task.cancel()

    await PipelineRunner().run(task)


async def report_outcome(ctx: dict, captured: dict, task: PipelineTask) -> None:
    """POST the structured outcome + short transcript back to the orchestrator."""
    webhook = os.environ.get("ORCHESTRATOR_WEBHOOK")
    if not webhook:
        return
    payload = {
        "callId": ctx.get("callId"),
        "structured": captured,
        # TODO(build-day): pull the short text transcript from the context
        # aggregator's message history and include it here (text only, no audio).
        "transcript": [],
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(webhook, json=payload)
        except httpx.HTTPError:
            pass  # outcome is also recoverable from logs; never crash the call


def main() -> None:
    # TODO(build-day): construct the real transport (Asterisk websocket bridge or
    # LiveKit/Daily SIP) and pass it to run_call. Until then this is the shape.
    raise SystemExit(
        "Configure the telephony transport (build-day) before running agent.py. "
        "See file header."
    )


if __name__ == "__main__":
    main()
