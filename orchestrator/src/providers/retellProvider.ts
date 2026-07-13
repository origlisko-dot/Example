import type { TelephonyProvider, DialRequest, DialResult, CallEndReason } from "./telephonyProvider.js";
import {
  mapRetellDisconnection,
  structuredFromRetellAnalysis,
  type RetellCallAnalysisSlice,
} from "./retellAnalysis.js";

/**
 * Retell AI voice provider (managed real-time pipeline). Retell handles
 * STT+LLM+TTS+barge-in+call; we place an outbound call with the compiled
 * Hebrew prompt + per-lead dynamic variables, then poll until it ends and map
 * the result back to our DialResult.
 *
 * Telephony = BYOC: `fromNumber` is the Twilio/Telnyx number imported into Retell.
 *
 * Agent prompt should include `{{system_prompt}}`. Post-call analysis fields
 * should match campaign outcomeSchema — sync via `npm run retell:sync-analysis`.
 *
 * @see https://docs.retellai.com/api-references/create-phone-call
 * @see https://docs.retellai.com/api-references/get-call
 */
const BASE = "https://api.retellai.com";

export interface RetellConfig {
  apiKey: string;
  fromNumber: string;
  agentId: string;
  pollIntervalMs?: number;
  maxPollMs?: number;
  /** Extra wait after call ends for post-call analysis (default 45s). */
  analysisWaitMs?: number;
}

interface RetellCall {
  call_id: string;
  call_status: "registered" | "ongoing" | "ended" | "error";
  disconnection_reason?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  transcript_object?: { role: string; content: string }[];
  call_analysis?: RetellCallAnalysisSlice;
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
        ...(req.compiled.disclosureLine
          ? { disclosure_line: req.compiled.disclosureLine }
          : {}),
        ...(req.dynamicVariables ?? {}),
      },
      metadata: {
        ai_disclosed: req.aiDisclosed,
        max_duration_sec: req.maxDurationSec,
      },
    });

    const call = await this.pollUntilEnded(created.call_id);
    return this.toResult(call);
  }

  private async pollUntilEnded(callId: string): Promise<RetellCall> {
    const interval = this.cfg.pollIntervalMs ?? 3000;
    const deadline = Date.now() + (this.cfg.maxPollMs ?? 10 * 60 * 1000);
    const analysisWaitMs = this.cfg.analysisWaitMs ?? 45_000;
    let endedAt: number | null = null;
    let last: RetellCall | null = null;

    while (Date.now() < deadline) {
      const call = await this.api<RetellCall>(`/v2/get-call/${callId}`, undefined, "GET");
      last = call;

      if (call.call_status === "error") return call;

      if (call.call_status === "ended") {
        endedAt ??= Date.now();
        const hasCustom = Boolean(
          call.call_analysis?.custom_analysis_data &&
            Object.keys(call.call_analysis.custom_analysis_data).length > 0,
        );
        if (hasCustom) return call;
        // Analysis often arrives shortly after "ended" (call_analyzed webhook).
        if (Date.now() - endedAt >= analysisWaitMs) return call;
      }

      await new Promise((r) => setTimeout(r, interval));
    }

    return last ?? {
      call_id: callId,
      call_status: "error",
      disconnection_reason: "error_unknown",
    };
  }

  private toResult(call: RetellCall): DialResult {
    const durationSec =
      call.start_timestamp && call.end_timestamp
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
      structured: structuredFromRetellAnalysis(call.call_analysis),
      transcript,
    };
  }

  private async api<T>(path: string, body?: unknown, method: "POST" | "GET" | "PATCH" = "POST"): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: method !== "GET" && body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Retell ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }
}

function mapEndReason(call: RetellCall): CallEndReason {
  return mapRetellDisconnection(call.disconnection_reason, call.call_status);
}
