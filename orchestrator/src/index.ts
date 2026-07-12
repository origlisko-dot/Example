import { DEFAULT_COMPLIANCE, type Campaign, type Lead } from "@pelozen/shared";
import { loadConfig } from "./config.js";
import { SupabaseRepo } from "./db/supabaseRepo.js";
import { AsteriskGsmProvider } from "./providers/telephonyProvider.js";
import { SequentialRunController, type RunControls } from "./orchestrator/runController.js";
import { startServer } from "./server.js";

/**
 * Wires the orchestrator from env config and returns a controller plus a
 * mutable controls handle the panel can flip (pause/stop). Telephony is the
 * GSM/Asterisk provider — its `dial` is stubbed until build-day wiring.
 */
export function buildOrchestrator() {
  const cfg = loadConfig();
  const repo = new SupabaseRepo(cfg.supabaseUrl, cfg.supabaseServiceRoleKey);
  const telephony = new AsteriskGsmProvider({
    ariUrl: cfg.sip.gatewayHost,
    gatewayEndpoint: cfg.sip.username,
  });

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
    cfg, controller, controlsState,
    runCampaign: (runId: string, campaign: Campaign, leads: Lead[]) =>
      controller.run(runId, campaign, leads),
  };
}

// Entry point: start the HTTP server (scrape endpoint; dialer joins later).
// index.ts is only ever run directly, never imported, so this runs on start.
try {
  startServer();
} catch (e) {
  console.error(`orchestrator config error: ${(e as Error).message}`);
  process.exit(1);
}
