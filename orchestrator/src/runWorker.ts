import { createClient } from "@supabase/supabase-js";
import type { Campaign, Lead } from "@pelozen/shared";
import type { OrchestratorConfig } from "./config.js";
import { campaignFromRow, leadFromRow } from "./db/campaignMapper.js";
import type { SequentialRunController } from "./orchestrator/runController.js";
import type { RunSummary } from "./orchestrator/runController.js";
import type { RunState } from "./db/repo.js";

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = "RunNotFoundError";
  }
}

export class RunNotRunnableError extends Error {
  constructor(runId: string, state: RunState) {
    super(`Run ${runId} is not runnable (state=${state})`);
    this.name = "RunNotRunnableError";
  }
}

/** Load campaign + queued leads for a run and drive the sequential dial loop. */
export async function executeRun(
  cfg: OrchestratorConfig,
  controller: SequentialRunController,
  runId: string,
): Promise<RunSummary> {
  const db = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, { auth: { persistSession: false } });

  const { data: run } = await db
    .from("runs")
    .select("id, state, campaign_id")
    .eq("id", runId)
    .maybeSingle();

  if (!run) throw new RunNotFoundError(runId);

  const state = run.state as RunState;
  if (state !== "running" && state !== "paused") {
    throw new RunNotRunnableError(runId, state);
  }

  if (state === "paused") {
    await db.from("runs").update({ state: "running", ended_at: null }).eq("id", runId);
  }

  const { data: campaignRow, error: campErr } = await db
    .from("campaigns")
    .select("*")
    .eq("id", run.campaign_id as string)
    .single();
  if (campErr || !campaignRow) throw new Error(`Campaign not found for run ${runId}`);

  const campaign: Campaign = campaignFromRow(campaignRow as Record<string, unknown>);

  const { data: attempts, error: attErr } = await db
    .from("call_attempts")
    .select("lead_id, leads(*)")
    .eq("run_id", runId)
    .eq("state", "queued");
  if (attErr) throw attErr;

  const leads: Lead[] = (attempts ?? [])
    .map((a) => {
      const raw = a.leads as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      return raw as Record<string, unknown>;
    })
    .filter((l): l is Record<string, unknown> => l !== null)
    .map(leadFromRow);

  if (leads.length === 0) {
    await db.from("runs").update({ state: "done", ended_at: new Date().toISOString() }).eq("id", runId);
    return { dialed: 0, qualified: 0, suppressed: 0, skippedNoConsent: 0, haltedReason: "completed" };
  }

  return controller.run(runId, campaign, leads);
}
