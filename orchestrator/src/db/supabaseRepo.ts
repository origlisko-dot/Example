import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Disposition, LeadStatus, SuppressionReason } from "@pelozen/shared";
import type { Repo, RunState } from "./repo.js";

/**
 * Live Repo backed by Supabase. Uses the SERVICE-ROLE key (bypasses RLS) and
 * must only ever run in the orchestrator — never the browser.
 */
export class SupabaseRepo implements Repo {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async getRunState(runId: string): Promise<RunState> {
    const { data } = await this.db.from("runs").select("state").eq("id", runId).maybeSingle();
    return (data?.state as RunState) ?? "stopped";
  }

  async isSuppressed(phoneE164: string): Promise<boolean> {
    const { data } = await this.db
      .from("suppression_list").select("phone_e164").eq("phone_e164", phoneE164).maybeSingle();
    return Boolean(data);
  }

  async hasConsent(leadId: string): Promise<boolean> {
    const { data } = await this.db
      .from("leads").select("consent_record_id").eq("id", leadId).maybeSingle();
    return Boolean(data?.consent_record_id);
  }

  async acquireCallAttempt(input: {
    runId: string; leadId: string; campaignVersion: number; attemptNo: number; aiDisclosed: boolean;
  }): Promise<{ id: string }> {
    const { data: existing } = await this.db
      .from("call_attempts")
      .select("id")
      .eq("run_id", input.runId)
      .eq("lead_id", input.leadId)
      .eq("state", "queued")
      .maybeSingle();

    if (existing?.id) {
      await this.db.from("call_attempts").update({
        campaign_version: input.campaignVersion,
        attempt_no: input.attemptNo,
        ai_disclosed: input.aiDisclosed,
        state: "dialing",
        dialed_at: new Date().toISOString(),
      }).eq("id", existing.id);
      return { id: existing.id as string };
    }

    const { data, error } = await this.db.from("call_attempts").insert({
      run_id: input.runId, lead_id: input.leadId, campaign_version: input.campaignVersion,
      attempt_no: input.attemptNo, ai_disclosed: input.aiDisclosed, state: "dialing", dialed_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    return { id: data.id as string };
  }

  async skipQueuedAttempt(id: string, endReason: string): Promise<void> {
    await this.db.from("call_attempts").update({
      state: "failed",
      end_reason: endReason,
      ended_at: new Date().toISOString(),
    }).eq("id", id);
  }

  async skipQueuedAttemptForLead(runId: string, leadId: string, endReason: string): Promise<void> {
    const { data } = await this.db
      .from("call_attempts")
      .select("id")
      .eq("run_id", runId)
      .eq("lead_id", leadId)
      .eq("state", "queued")
      .maybeSingle();
    if (data?.id) await this.skipQueuedAttempt(data.id as string, endReason);
  }

  async finishCallAttempt(id: string, patch: {
    state: string; endReason: string; durationSec: number; providerCallId?: string;
  }): Promise<void> {
    await this.db.from("call_attempts").update({
      state: patch.state, end_reason: patch.endReason, duration_sec: patch.durationSec,
      provider_call_id: patch.providerCallId, ended_at: new Date().toISOString(),
    }).eq("id", id);
  }

  async recordOutcome(input: {
    callAttemptId: string; leadId: string; disposition: Disposition;
    structured: Record<string, unknown>; qualified: boolean;
  }): Promise<void> {
    await this.db.from("outcomes").insert({
      call_attempt_id: input.callAttemptId, lead_id: input.leadId, disposition: input.disposition,
      structured: input.structured, qualified: input.qualified, outcome_set_by: "ai",
    });
  }

  async saveTranscript(callAttemptId: string, segments: unknown[]): Promise<void> {
    await this.db.from("transcripts").insert({ call_attempt_id: callAttemptId, segments, language: "he" });
  }

  async setLeadStatus(leadId: string, status: LeadStatus, suppressedReason?: SuppressionReason): Promise<void> {
    await this.db.from("leads").update({
      status, suppressed_reason: suppressedReason ?? null, last_called_at: new Date().toISOString(),
    }).eq("id", leadId);
  }

  async addSuppression(input: {
    phoneE164: string; phoneHash: string; reason: SuppressionReason; sourceCallId?: string;
  }): Promise<void> {
    await this.db.from("suppression_list").upsert({
      phone_e164: input.phoneE164, phone_hash: input.phoneHash,
      reason: input.reason, source_call_id: input.sourceCallId ?? null,
    });
  }

  async setRunState(runId: string, state: "running" | "paused" | "stopped" | "done", reason?: string): Promise<void> {
    await this.db.from("runs").update({
      state, ended_at: state === "done" || state === "stopped" ? new Date().toISOString() : null,
      stats: reason ? { halt_reason: reason } : {},
    }).eq("id", runId);
  }

  async audit(action: string, entity: string, entityId: string, after?: unknown): Promise<void> {
    await this.db.from("audit_log").insert({ actor: "orchestrator", action, entity, entity_id: entityId, after: after ?? null });
  }
}
