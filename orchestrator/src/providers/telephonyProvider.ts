import type { CompiledPrompt } from "../campaigns/promptCompiler.js";

/**
 * Swappable telephony layer. Primary: the owner's SIM in a GSM gateway,
 * registered to Asterisk/FreeSWITCH (originate via ARI). Fallback: a VoIP SIP
 * trunk. The orchestrator only knows this interface, so switching gateway ↔
 * VoIP is one adapter, not a rewrite.
 */
export interface DialRequest {
  toE164: string;
  callerId: string;
  compiled: CompiledPrompt;
  /** snapshot of the disclosure toggle for this call (audit) */
  aiDisclosed: boolean;
  maxDurationSec: number;
}

export type CallEndReason =
  | "answered"
  | "no_answer"
  | "busy"
  | "failed"
  | "voicemail";

export interface DialResult {
  providerCallId: string;
  endReason: CallEndReason;
  durationSec: number;
  /** structured outcome from the LLM's record_outcome tool (answered calls) */
  structured?: Record<string, boolean | number | string>;
  /** [{speaker, text, t_start, t_end}] — short text transcript */
  transcript?: unknown[];
}

export interface TelephonyProvider {
  readonly kind: "asterisk_gsm" | "voip_sip";
  dial(req: DialRequest): Promise<DialResult>;
}
