import type { Campaign } from "@pelozen/shared";

/** Map a Supabase `campaigns` row to the shared Campaign type. */
export function campaignFromRow(c: Record<string, unknown>): Campaign {
  return {
    id: c.id as string,
    name: c.name as string,
    pelozenTopicRef: (c.pelozen_topic_ref as string | null) ?? undefined,
    status: c.status as Campaign["status"],
    locale: (c.locale as Campaign["locale"]) ?? "he-IL",
    introScript: (c.intro_script as string) ?? "",
    valueProp: (c.value_prop as string) ?? "",
    qualifyingQuestions: (c.qualifying_questions as Campaign["qualifyingQuestions"]) ?? [],
    objectionHandlers: (c.objection_handlers as Campaign["objectionHandlers"]) ?? [],
    closingScript: (c.closing_script as string) ?? "",
    outcomeSchema: (c.outcome_schema as Campaign["outcomeSchema"]) ?? [],
    successExpr: (c.success_expr as string) ?? "false",
    disqualifyExpr: (c.disqualify_expr as string) ?? "false",
    voice: (c.voice as Campaign["voice"]) ?? { provider: "cartesia", voiceId: "" },
    dynamicVariables: (c.dynamic_variables as string[]) ?? [],
    maxCallDurationSec: (c.max_call_duration_sec as number) ?? 300,
    aiDisclosureOn: Boolean(c.ai_disclosure_on),
    callingWindowId: (c.calling_window_id as string) ?? "",
    retryPolicyId: (c.retry_policy_id as string) ?? "",
    version: (c.version as number) ?? 1,
  };
}

/** Map a Supabase `leads` row to the shared Lead type. */
export function leadFromRow(c: Record<string, unknown>): import("@pelozen/shared").Lead {
  return {
    id: c.id as string,
    campaignId: (c.campaign_id as string) ?? "",
    phoneE164: c.phone_e164 as string,
    phoneHash: c.phone_hash as string,
    firstName: (c.first_name as string | null) ?? undefined,
    fields: (c.fields as Record<string, string>) ?? {},
    status: c.status as import("@pelozen/shared").LeadStatus,
    source: c.source as import("@pelozen/shared").Lead["source"],
    consentRecordId: (c.consent_record_id as string | null) ?? undefined,
    createdAt: (c.created_at as string) ?? new Date().toISOString(),
  };
}
