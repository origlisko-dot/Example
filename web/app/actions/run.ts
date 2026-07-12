"use server";

import { maskPhone } from "@pelozen/shared";
import { createServerClient } from "@/lib/supabase/server";
import { phoneHash } from "@/lib/hash";

export type RunState = "running" | "paused" | "stopped" | "done";

export interface RunSnapshot {
  state: RunState;
  counts: { queued: number; done: number; total: number };
  dispositions: Record<string, number>;
  feed: { phone: string; disposition: string }[];
}

/** Create a run for the campaign's freshly-loaded leads and queue an attempt each. */
export async function startRun(campaignId: string): Promise<{ runId: string; queued: number }> {
  const supabase = createServerClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "new");

  const leadIds = (leads ?? []).map((l) => l.id as string);

  const { data: run } = await supabase
    .from("runs")
    .insert({ campaign_id: campaignId, state: "running" })
    .select("id")
    .single();

  const runId = run!.id as string;

  if (leadIds.length > 0) {
    await supabase.from("call_attempts").insert(
      leadIds.map((lead_id) => ({ run_id: runId, lead_id, state: "queued" })),
    );
    await supabase.from("leads").update({ status: "queued" }).in("id", leadIds);
  }

  return { runId, queued: leadIds.length };
}

export async function setRunState(runId: string, state: RunState): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("runs")
    .update({ state, ended_at: state === "done" || state === "stopped" ? new Date().toISOString() : null })
    .eq("id", runId);
}

export async function getRunSnapshot(runId: string): Promise<RunSnapshot> {
  const supabase = createServerClient();

  const { data: run } = await supabase.from("runs").select("state").eq("id", runId).maybeSingle();

  const { data: attempts } = await supabase
    .from("call_attempts")
    .select("id, state")
    .eq("run_id", runId);

  const total = attempts?.length ?? 0;
  const queued = (attempts ?? []).filter((a) => a.state === "queued").length;

  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("disposition, created_at, leads(phone_e164)")
    .in("call_attempt_id", (attempts ?? []).map((a) => a.id as string))
    .order("created_at", { ascending: false });

  const dispositions: Record<string, number> = {};
  const feed: RunSnapshot["feed"] = [];
  for (const o of outcomes ?? []) {
    const d = o.disposition as string;
    dispositions[d] = (dispositions[d] ?? 0) + 1;
    const phone = (o.leads as { phone_e164?: string } | null)?.phone_e164;
    if (feed.length < 12 && phone) feed.push({ phone: maskPhone(phone), disposition: d });
  }

  return {
    state: (run?.state as RunState) ?? "stopped",
    counts: { queued, done: total - queued, total },
    dispositions,
    feed,
  };
}

/**
 * DEV/TEST ONLY — simulate the next queued call so the monitor + results can be
 * exercised before the telephony pipeline is wired. Drives the SAME tables the
 * orchestrator will (call_attempts → outcome → transcript → lead status →
 * suppression on opt-out), so this validates the data pipeline end-to-end.
 */
const SIM_CYCLE = [
  "qualified_for_human", "interested", "not_relevant",
  "callback_later", "no_answer", "opted_out",
] as const;

export async function simulateNextCall(runId: string): Promise<RunSnapshot> {
  const supabase = createServerClient();

  const { data: attempt } = await supabase
    .from("call_attempts")
    .select("id, lead_id")
    .eq("run_id", runId)
    .eq("state", "queued")
    .limit(1)
    .maybeSingle();

  if (attempt) {
    const attemptId = attempt.id as string;
    const leadId = attempt.lead_id as string;

    const { count } = await supabase
      .from("call_attempts")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId)
      .neq("state", "queued");
    const disposition = SIM_CYCLE[(count ?? 0) % SIM_CYCLE.length]!;
    const answered = disposition !== "no_answer";

    await supabase
      .from("call_attempts")
      .update({
        state: answered ? "completed" : "no_answer",
        end_reason: answered ? "answered" : "no_answer",
        duration_sec: answered ? 95 : 0,
        ended_at: new Date().toISOString(),
      })
      .eq("id", attemptId);

    if (answered) {
      await supabase.from("outcomes").insert({
        call_attempt_id: attemptId,
        lead_id: leadId,
        disposition,
        qualified: disposition === "qualified_for_human",
        structured: { simulated: true },
      });
      await supabase.from("transcripts").insert({
        call_attempt_id: attemptId,
        language: "he",
        segments: [
          { speaker: "bot", text: "שלום, פנית אלינו וביקשת שנחזור אליך." },
          { speaker: "user", text: "כן, נכון." },
        ],
      });

      if (disposition === "opted_out") {
        const { data: lead } = await supabase.from("leads").select("phone_e164").eq("id", leadId).maybeSingle();
        const phone = lead?.phone_e164 as string | undefined;
        if (phone) {
          await supabase.from("suppression_list").upsert(
            { phone_e164: phone, phone_hash: phoneHash(phone), reason: "opt_out", source_call_id: attemptId },
            { onConflict: "phone_e164" },
          );
        }
        await supabase.from("leads").update({ status: "suppressed", suppressed_reason: "opt_out" }).eq("id", leadId);
      } else {
        await supabase
          .from("leads")
          .update({ status: disposition === "qualified_for_human" ? "qualified" : "contacted" })
          .eq("id", leadId);
      }
    } else {
      await supabase.from("leads").update({ status: "queued" }).eq("id", leadId);
    }
  }

  return getRunSnapshot(runId);
}
