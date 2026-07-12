/**
 * Lead and call-related types shared between the orchestrator and the panel.
 */

export type LeadStatus =
  | "new"
  | "queued"
  | "contacted"
  | "qualified"
  | "disqualified"
  | "suppressed" // on the opt-out / DNC list — never dial
  | "dead"; // exhausted retries

export type SuppressionReason = "opt_out" | "dnc_registry" | "manual";

export interface Lead {
  id: string;
  campaignId: string;
  /** canonical E.164, +972… — the dedup + suppression key */
  phoneE164: string;
  /** HMAC of phoneE164 for lookups without exposing the raw number everywhere */
  phoneHash: string;
  firstName?: string;
  /** arbitrary extra fields from pelozen, used as dynamic variables */
  fields: Record<string, string>;
  status: LeadStatus;
  source: "csv" | "scraper" | "api";
  /** links to the documented callback consent — the legal backbone */
  consentRecordId?: string;
  createdAt: string;
}

/** A normalized lead as produced by a LeadSource, before it is persisted. */
export interface RawLead {
  phoneE164: string;
  firstName?: string;
  fields: Record<string, string>;
  topicRef: string;
  sourceRef?: string;
  fetchedAt: string;
}
