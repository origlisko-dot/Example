import type { OrchestratorConfig } from "./config.js";
import { AsteriskGsmProvider, type TelephonyProvider } from "./providers/telephonyProvider.js";
import { RetellProvider } from "./providers/retellProvider.js";

/** Pick Retell when configured; otherwise fall back to the Asterisk GSM stub. */
export function createTelephonyProvider(cfg: OrchestratorConfig): TelephonyProvider {
  const r = cfg.retell;
  if (r?.apiKey && r.agentId && r.fromNumber) {
    return new RetellProvider({
      apiKey: r.apiKey,
      fromNumber: r.fromNumber,
      agentId: r.agentId,
      pollIntervalMs: r.pollIntervalMs,
      maxPollMs: r.maxPollMs,
    });
  }

  if (!r?.apiKey) {
    console.warn("orchestrator: RETELL_API_KEY not set — telephony dial will fail until Retell is configured");
  }
  return new AsteriskGsmProvider({
    ariUrl: cfg.sip.gatewayHost,
    gatewayEndpoint: cfg.sip.username,
  });
}

export function isRetellConfigured(cfg: OrchestratorConfig): boolean {
  const r = cfg.retell;
  return Boolean(r?.apiKey && r.agentId && r.fromNumber);
}
