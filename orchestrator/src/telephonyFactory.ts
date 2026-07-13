import type { OrchestratorConfig } from "./config.js";
import { GsmPipelineProvider } from "./providers/gsmPipelineProvider.js";
import { RetellProvider } from "./providers/retellProvider.js";
import type { TelephonyProvider } from "./providers/telephonyProvider.js";
import { isRetellConfigured, resolveTelephonyMode } from "./telephonyStatus.js";

/** Pick provider from TELEPHONY_MODE (auto | retell | gsm). */
export function createTelephonyProvider(cfg: OrchestratorConfig): TelephonyProvider {
  const mode = resolveTelephonyMode(cfg);

  if (mode === "retell") {
    if (!isRetellConfigured(cfg)) {
      throw new Error(
        "TELEPHONY_MODE=retell but RETELL_API_KEY / RETELL_AGENT_ID / RETELL_FROM_NUMBER missing",
      );
    }
    const r = cfg.retell!;
    return new RetellProvider({
      apiKey: r.apiKey,
      fromNumber: r.fromNumber,
      agentId: r.agentId,
      pollIntervalMs: r.pollIntervalMs,
      maxPollMs: r.maxPollMs,
      analysisWaitMs: r.analysisWaitMs,
    });
  }

  return new GsmPipelineProvider(cfg.pipeline);
}
