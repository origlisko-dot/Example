import type { TelephonyProvider, DialRequest, DialResult, CallEndReason } from "./telephonyProvider.js";

/**
 * Retell AI voice provider (managed real-time pipeline). Retell handles
 * STT+LLM+TTS+barge-in+call; we just place an outbound call with the compiled
 * Hebrew prompt + per-lead dynamic variables, then poll until it ends and map
 * the result back to our DialResult.
 *
 * Telephony = BYOC: `fromNumber` is the owner's SIM/gateway registered in Retell
 * as a SIP trunk number.
 *
 * The campaign's system prompt is injected via a dynamic variable so a single
 * Retell agent can serve every campaign — set the agent's general prompt to
 * "{{system_prompt}}". Per-lead vars (first_name, …) are passed alongside.
 *
 * BUILD-DAY TODO: verify exact field names against Retell's current API for
 * create-phone-call, get-call, and post-call-analysis (custom_analysis_data),
 * and set the agent's post-call analysis fields to match our outcome schema.
 */
const BASE = "https://api.retellai.com";

export interface RetellConfig {
  apiKey: string;
  fromNumber: string; // BYOC number (the owner's SIM/gateway trunk)
  agentId: string; // default agent; later map per-campaign
  pollIntervalMs?: number;
  maxPollMs?: number;
}

interface RetellCall {
  call_id: string;
  call_status: "registered" | "ongoing" | "ended" | "error";
  disconnection_reason?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  transcript_object?: { role: string; content: string }[];
  call_analysis?: { custom_analysis_data?: Record<string, unknown> };
}

export class RetellProvider implements TelephonyProvider {
  readonly kind = "voip_sip" as const;

  constructor(private readonly cfg: RetellConfig) {}

  async dial(req: DialRequest): Promise<DialResult> {
    const created = await this.api<{ call_id: string }>("/v2/create-phone-call", {
      from_number: this.cfg.fromNumber,
      to_number: req.toE164,
      override_agent_id: this.cfg.agentId,
      retell_llm_dynamic_variables: {
        system_prompt: req.compiled.systemPrompt,
        ...(req.compiled.disclosureLine ? { disclosure_line: req.compiled.disclosureLine } : {}),
      },
      metadata: { ai_disclosed: req.aiDisclosed },
    });

    const call = await this.pollUntilEnded(created.call_id);
    return this.toResult(call);
  }

  private async pollUntilEnded(callId: string): Promise<RetellCall> {
    const interval = this.cfg.pollIntervalMs ?? 3000;
    const deadline = Date.now() + (this.cfg.maxPollMs ?? 10 * 60 * 1000);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const call = await this.api<RetellCall>(`/v2/get-call/${callId}`, undefined, "GET");
      if (call.call_status === "ended" || call.call_status === "error") return call;
      if (Date.now() > deadline) return call;
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  private toResult(call: RetellCall): DialResult {
    const durationSec = call.start_timestamp && call.end_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : 0;

    const transcript = (call.transcript_object ?? []).map((t) => ({
      speaker: t.role === "agent" ? "bot" : "user",
      text: t.content,
    }));

    return {
      providerCallId: call.call_id,
      endReason: mapEndReason(call),
      durationSec,
      structured: call.call_analysis?.custom_analysis_data as DialResult["structured"],
      transcript,
    };
  }

  private async api<T>(path: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: method === "POST" && body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Retell ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }
}

function mapEndReason(call: RetellCall): CallEndReason {
  const r = call.disconnection_reason ?? "";
  if (r.includes("no_answer") || r === "dial_no_answer") return "no_answer";
  if (r.includes("busy")) return "busy";
  if (r.includes("voicemail")) return "voicemail";
  if (call.call_status === "error") return "failed";
  return "answered";
}
