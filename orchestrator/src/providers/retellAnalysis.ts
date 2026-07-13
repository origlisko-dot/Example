import type { Campaign, OutcomeField } from "@pelozen/shared";

/**
 * Retell post-call analysis field shapes (Update Agent API).
 * @see https://docs.retellai.com/api-references/update-agent
 */
export type RetellAnalysisField =
  | {
      type: "boolean";
      name: string;
      description: string;
      required?: boolean;
    }
  | {
      type: "number";
      name: string;
      description: string;
      required?: boolean;
    }
  | {
      type: "string";
      name: string;
      description: string;
      required?: boolean;
      examples?: string[];
    }
  | {
      type: "enum";
      name: string;
      description: string;
      choices: string[];
      required?: boolean;
    };

const DISPOSITION_CHOICES = [
  "qualified_for_human",
  "interested",
  "callback_later",
  "not_relevant",
  "opted_out",
  "wrong_number",
] as const;

/** Map our campaign outcomeSchema → Retell `post_call_analysis_data`. */
export function outcomeSchemaToRetellAnalysis(campaign: Campaign): RetellAnalysisField[] {
  const fields: RetellAnalysisField[] = campaign.outcomeSchema.map((f) =>
    outcomeFieldToRetell(f),
  );

  fields.push({
    type: "enum",
    name: "disposition",
    description: "סיווג סופי של השיחה (חייבים לבחור אחד)",
    choices: [...DISPOSITION_CHOICES],
    required: true,
  });

  return fields;
}

function outcomeFieldToRetell(f: OutcomeField): RetellAnalysisField {
  switch (f.type) {
    case "bool":
      return {
        type: "boolean",
        name: f.key,
        description: f.description,
        required: f.required,
      };
    case "number":
      return {
        type: "number",
        name: f.key,
        description: f.description,
        required: f.required,
      };
    case "choice":
      return {
        type: "enum",
        name: f.key,
        description: f.description,
        choices: f.choices?.length ? f.choices : ["yes", "no"],
        required: f.required,
      };
    case "string":
      return {
        type: "string",
        name: f.key,
        description: f.description,
        required: f.required,
      };
    default: {
      const _exhaustive: never = f.type;
      throw new Error(`Unknown outcome field type: ${_exhaustive}`);
    }
  }
}

export interface RetellCallAnalysisSlice {
  call_summary?: string;
  in_voicemail?: boolean;
  user_sentiment?: string;
  call_successful?: boolean;
  custom_analysis_data?: Record<string, unknown>;
}

/**
 * Prefer custom_analysis_data; fall back to Retell built-ins so classifyDisposition
 * still gets useful structured fields when post-call schema is incomplete.
 */
export function structuredFromRetellAnalysis(
  analysis: RetellCallAnalysisSlice | undefined,
): Record<string, boolean | number | string> {
  const custom = analysis?.custom_analysis_data ?? {};
  const out: Record<string, boolean | number | string> = {};

  for (const [k, v] of Object.entries(custom)) {
    if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") {
      out[k] = v;
    } else if (v != null) {
      out[k] = String(v);
    }
  }

  if (analysis?.in_voicemail === true && out.disposition == null) {
    out.disposition = "callback_later";
  }

  if (out.disposition == null && analysis?.call_successful === false) {
    out.disposition = "not_relevant";
  }

  if (analysis?.call_summary) {
    if (out.notes == null || out.notes === "") out.notes = analysis.call_summary;
  } else if (analysis?.in_voicemail === true && out.notes == null) {
    out.notes = "voicemail";
  }

  if (out.interested == null && analysis?.user_sentiment === "Positive") {
    out.interested = true;
  }
  if (out.interested == null && analysis?.user_sentiment === "Negative") {
    out.interested = false;
  }

  return out;
}

/** Exact Retell disconnection_reason → our CallEndReason. */
export function mapRetellDisconnection(
  reason: string | undefined,
  callStatus: string,
): "answered" | "no_answer" | "busy" | "failed" | "voicemail" {
  const r = reason ?? "";
  switch (r) {
    case "dial_no_answer":
    case "user_declined":
      return "no_answer";
    case "dial_busy":
      return "busy";
    case "voicemail_reached":
      return "voicemail";
    case "dial_failed":
    case "invalid_destination":
    case "telephony_provider_permission_denied":
    case "telephony_provider_unavailable":
    case "sip_routing_error":
    case "marked_as_spam":
    case "error_retell":
    case "error_unknown":
    case "error_asr":
    case "error_no_audio_received":
    case "concurrency_limit_reached":
    case "no_valid_payment":
      return "failed";
    default:
      break;
  }
  if (callStatus === "error") return "failed";
  if (r.includes("voicemail")) return "voicemail";
  if (r.includes("busy")) return "busy";
  if (r.includes("no_answer")) return "no_answer";
  return "answered";
}
