import { DEFAULT_COMPLIANCE, type Campaign, type Lead } from "@pelozen/shared";
import { loadConfig, type OrchestratorConfig } from "./config.js";
import { SupabaseRepo } from "./db/supabaseRepo.js";
import { SequentialRunController, type RunControls } from "./orchestrator/runController.js";
import { createTelephonyProvider, isRetellConfigured } from "./telephonyFactory.js";
import type { TelephonyProvider } from "./providers/telephonyProvider.js";

export interface OrchestratorBundle {
  cfg: OrchestratorConfig;
  repo: SupabaseRepo;
  controller: SequentialRunController;
  controlsState: { paused: boolean; stopped: boolean };
  telephony: TelephonyProvider;
  retellReady: boolean;
  runCampaign: (runId: string, campaign: Campaign, leads: Lead[]) => ReturnType<SequentialRunController["run"]>;
}

/** Wires repo + telephony + run controller from env. */
export function buildOrchestrator(): OrchestratorBundle {
  const cfg = loadConfig();
  const repo = new SupabaseRepo(cfg.supabaseUrl, cfg.supabaseServiceRoleKey);
  const telephony = createTelephonyProvider(cfg);

  const controlsState = { paused: false, stopped: false };
  const controls: RunControls = {
    isPaused: () => controlsState.paused,
    isStopped: () => controlsState.stopped,
  };

  const controller = new SequentialRunController({
    repo, telephony, compliance: DEFAULT_COMPLIANCE,
    clock: { now: () => new Date() },
    controls, phoneHashSecret: cfg.phoneHashSecret, callerId: cfg.callerId,
  });

  return {
    cfg, repo, controller, controlsState, telephony,
    retellReady: isRetellConfigured(cfg),
    runCampaign: (runId, campaign, leads) => controller.run(runId, campaign, leads),
  };
}
