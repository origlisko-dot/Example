import type { Disposition, LeadStatus, SuppressionReason } from "@pelozen/shared";

/**
 * The data-access contract the run controller needs. Kept as an interface so
 * the controller can be unit-tested with an in-memory fake and the live
 * Supabase implementation stays swappable.
 */
export interface Repo {
  isSuppressed(phoneE164: string): Promise<boolean>;
  hasConsent(leadId: string): Promise<boolean>;

  createCallAttempt(input: {
    runId: string;
    leadId: string;
    campaignVersion: number;
    attemptNo: number;
    aiDisclosed: boolean;
  }): Promise<{ id: string }>;

  finishCallAttempt(id: string, patch: {
    state: string;
    endReason: string;
    durationSec: number;
    providerCallId?: string;
  }): Promise<void>;

  recordOutcome(input: {
    callAttemptId: string;
    leadId: string;
    disposition: Disposition;
    structured: Record<string, unknown>;
    qualified: boolean;
  }): Promise<void>;

  saveTranscript(callAttemptId: string, segments: unknown[]): Promise<void>;

  setLeadStatus(leadId: string, status: LeadStatus, suppressedReason?: SuppressionReason): Promise<void>;

  addSuppression(input: {
    phoneE164: string;
    phoneHash: string;
    reason: SuppressionReason;
    sourceCallId?: string;
  }): Promise<void>;

  setRunState(runId: string, state: "running" | "paused" | "stopped" | "done", reason?: string): Promise<void>;

  audit(action: string, entity: string, entityId: string, after?: unknown): Promise<void>;
}
