import type { OrchestratorConfig } from "./config.js";

export type ResolvedTelephonyMode = "retell" | "gsm";

export interface TelephonyStatus {
  mode: ResolvedTelephonyMode;
  ready: boolean;
  kind: "voip_sip" | "asterisk_gsm";
  retellConfigured: boolean;
  gsmConfigured: boolean;
  pipelineUrl?: string;
  hint?: string;
}

export function isRetellConfigured(cfg: OrchestratorConfig): boolean {
  const r = cfg.retell;
  return Boolean(r?.apiKey && r.agentId && r.fromNumber);
}

export function isGsmConfigured(cfg: OrchestratorConfig): boolean {
  return Boolean(cfg.pipeline.baseUrl);
}

/** Resolve explicit/auto mode to the active provider. */
export function resolveTelephonyMode(cfg: OrchestratorConfig): ResolvedTelephonyMode {
  switch (cfg.telephonyMode) {
    case "retell":
      return "retell";
    case "gsm":
      return "gsm";
    case "auto":
    default:
      if (isRetellConfigured(cfg)) return "retell";
      if (isGsmConfigured(cfg)) return "gsm";
      return "retell";
  }
}

export function getTelephonyStatus(cfg: OrchestratorConfig): TelephonyStatus {
  const mode = resolveTelephonyMode(cfg);
  const retellConfigured = isRetellConfigured(cfg);
  const gsmConfigured = isGsmConfigured(cfg);

  if (mode === "retell") {
    const ready = retellConfigured;
    return {
      mode,
      ready,
      kind: "voip_sip",
      retellConfigured,
      gsmConfigured,
      hint: ready
        ? undefined
        : "Set RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER (Port/Twilio path)",
    };
  }

  const ready = gsmConfigured;
  return {
    mode,
    ready,
    kind: "asterisk_gsm",
    retellConfigured,
    gsmConfigured,
    pipelineUrl: cfg.pipeline.baseUrl,
    hint: ready
      ? undefined
      : "Set PIPELINE_URL and run pipeline/dial_server.py (GSM/SIM path)",
  };
}
