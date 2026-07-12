import type { PipelineConfig } from "../config.js";
import type { DialRequest, DialResult, TelephonyProvider, CallEndReason } from "./telephonyProvider.js";

interface PipelineCall {
  call_id: string;
  status: "dialing" | "ongoing" | "ended" | "error";
  end_reason?: string;
  duration_sec?: number;
  structured?: Record<string, unknown>;
  transcript?: { speaker: string; text: string }[];
}

/**
 * GSM / Pipecat path — delegates dial + voice to the Python pipeline service.
 * SIM mode (dev) or Asterisk+gateway (production) lives in pipeline/dial_server.py.
 */
export class GsmPipelineProvider implements TelephonyProvider {
  readonly kind = "asterisk_gsm" as const;

  constructor(private readonly cfg: PipelineConfig) {}

  async dial(req: DialRequest): Promise<DialResult> {
    const created = await this.api<{ call_id: string }>("/dial", {
      to_e164: req.toE164,
      caller_id: req.callerId,
      compiled: req.compiled,
      max_duration_sec: req.maxDurationSec,
      ai_disclosed: req.aiDisclosed,
    });

    const call = await this.pollUntilEnded(created.call_id);
    return this.toResult(call);
  }

  private async pollUntilEnded(callId: string): Promise<PipelineCall> {
    const deadline = Date.now() + this.cfg.maxPollMs;
    while (Date.now() < deadline) {
      const call = await this.api<PipelineCall>(`/calls/${callId}`, undefined, "GET");
      if (call.status === "ended" || call.status === "error") return call;
      await new Promise((r) => setTimeout(r, this.cfg.pollIntervalMs));
    }
    return { call_id: callId, status: "error", end_reason: "timeout" };
  }

  private toResult(call: PipelineCall): DialResult {
    return {
      providerCallId: call.call_id,
      endReason: mapEndReason(call),
      durationSec: call.duration_sec ?? 0,
      structured: call.structured as DialResult["structured"],
      transcript: call.transcript ?? [],
    };
  }

  private async api<T>(path: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" && body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Pipeline ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }
}

function mapEndReason(call: PipelineCall): CallEndReason {
  const r = call.end_reason ?? "";
  if (r.includes("no_answer")) return "no_answer";
  if (r.includes("busy")) return "busy";
  if (r.includes("voicemail")) return "voicemail";
  if (call.status === "error") return "failed";
  return "answered";
}
