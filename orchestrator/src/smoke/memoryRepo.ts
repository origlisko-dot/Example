import type { Disposition, LeadStatus, SuppressionReason } from "@pelozen/shared";
import type { Repo, RunState } from "../db/repo.js";

/** In-memory Repo for closed-env smoke runs (no Supabase). */
export class MemoryRepo implements Repo {
  suppressed = new Set<string>();
  noConsent = new Set<string>();
  statusUpdates: { leadId: string; status: LeadStatus; reason?: SuppressionReason }[] = [];
  suppressions: string[] = [];
  outcomes: { leadId: string; disposition: string; qualified: boolean }[] = [];
  runStates: { state: string; reason?: string }[] = [];
  dbRunState: RunState = "running";
  private n = 0;

  async getRunState(_runId: string): Promise<RunState> {
    return this.dbRunState;
  }

  async isSuppressed(phoneE164: string): Promise<boolean> {
    return this.suppressed.has(phoneE164);
  }

  async hasConsent(leadId: string): Promise<boolean> {
    return !this.noConsent.has(leadId);
  }

  async acquireCallAttempt(_input: {
    runId: string;
    leadId: string;
    campaignVersion: number;
    attemptNo: number;
    aiDisclosed: boolean;
  }): Promise<{ id: string }> {
    return { id: `smoke-att-${++this.n}` };
  }

  async skipQueuedAttempt(_id: string, _endReason: string): Promise<void> {}

  async skipQueuedAttemptForLead(
    _runId: string,
    _leadId: string,
    _endReason: string,
  ): Promise<void> {}

  async finishCallAttempt(
    _id: string,
    _patch: {
      state: string;
      endReason: string;
      durationSec: number;
      providerCallId?: string;
    },
  ): Promise<void> {}

  async recordOutcome(input: {
    callAttemptId: string;
    leadId: string;
    disposition: Disposition;
    structured: Record<string, unknown>;
    qualified: boolean;
  }): Promise<void> {
    this.outcomes.push({
      leadId: input.leadId,
      disposition: input.disposition,
      qualified: input.qualified,
    });
  }

  async saveTranscript(_callAttemptId: string, _segments: unknown[]): Promise<void> {}

  async setLeadStatus(
    leadId: string,
    status: LeadStatus,
    reason?: SuppressionReason,
  ): Promise<void> {
    this.statusUpdates.push({ leadId, status, reason });
  }

  async addSuppression(input: {
    phoneE164: string;
    phoneHash: string;
    reason: SuppressionReason;
    sourceCallId?: string;
  }): Promise<void> {
    this.suppressions.push(input.phoneE164);
  }

  async setRunState(
    _runId: string,
    state: "running" | "paused" | "stopped" | "done",
    reason?: string,
  ): Promise<void> {
    this.runStates.push({ state, reason });
  }

  async audit(
    _action: string,
    _entity: string,
    _entityId: string,
    _after?: unknown,
  ): Promise<void> {}
}
