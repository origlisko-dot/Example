# pipeline/ — Hebrew voice agent (Pipecat)

Runs the live conversation for a single call: Deepgram STT (he) → LLM
(Gemini/Claude) → Cartesia TTS (owner's cloned voice), with Silero VAD for
natural barge-in.

## How it fits
1. Orchestrator (TS) picks the next lead, compiles the Hebrew prompt +
   `record_outcome` tool (`promptCompiler.ts`), writes it to a JSON file.
2. Telephony (Asterisk + the owner's SIM gateway) places the call and bridges
   the answered audio into this pipeline.
3. The LLM drives the conversation and calls `record_outcome` at the end.
4. We POST the structured outcome + short text transcript back to the
   orchestrator webhook. No audio is stored (recording OFF by default).

## Setup
```bash
python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env   # fill keys + the owner's CARTESIA_VOICE_ID
```

## Build-day TODOs (marked in agent.py)
- Choose + wire the transport: Asterisk external-media/AudioSocket websocket, or
  LiveKit/Daily SIP. Everything above the transport is provider-agnostic.
- Pull the short text transcript from the context aggregator into the outcome POST.
- A/B the owner's cloned voice in Hebrew (Cartesia instant clone vs ElevenLabs).
