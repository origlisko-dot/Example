/**
 * Environment configuration for the orchestrator. Fails fast and loudly when a
 * required secret is missing — a half-configured dialer is worse than none.
 */
export type TelephonyModeSetting = "auto" | "retell" | "gsm";

export interface RetellConfig {
  apiKey: string;
  agentId: string;
  fromNumber: string;
  pollIntervalMs?: number;
  maxPollMs?: number;
}

export interface PipelineConfig {
  baseUrl: string;
  pollIntervalMs: number;
  maxPollMs: number;
}

export interface AsteriskConfig {
  ariUrl: string;
  ariUser: string;
  ariPassword: string;
  stasisApp: string;
  gatewayEndpoint: string;
}

export interface OrchestratorConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  callerId: string;
  phoneHashSecret: string;
  port: number;
  telephonyMode: TelephonyModeSetting;
  sip: { gatewayHost: string; username: string; password: string };
  retell?: RetellConfig;
  pipeline: PipelineConfig;
  asterisk: AsteriskConfig;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseTelephonyMode(): TelephonyModeSetting {
  const m = (process.env.TELEPHONY_MODE ?? "auto").toLowerCase();
  if (m === "retell" || m === "gsm" || m === "auto") return m;
  throw new Error(`Invalid TELEPHONY_MODE: ${m} (use auto | retell | gsm)`);
}

export function loadConfig(): OrchestratorConfig {
  const retellKey = process.env.RETELL_API_KEY;
  const retellAgent = process.env.RETELL_AGENT_ID;
  const retellFrom = process.env.RETELL_FROM_NUMBER ?? process.env.CALLER_ID;

  const retell =
    retellKey && retellAgent && retellFrom
      ? {
          apiKey: retellKey,
          agentId: retellAgent,
          fromNumber: retellFrom,
          pollIntervalMs: process.env.RETELL_POLL_INTERVAL_MS
            ? Number(process.env.RETELL_POLL_INTERVAL_MS)
            : undefined,
          maxPollMs: process.env.RETELL_MAX_POLL_MS
            ? Number(process.env.RETELL_MAX_POLL_MS)
            : undefined,
        }
      : undefined;

  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    callerId: process.env.CALLER_ID ?? retellFrom ?? "+972545456212",
    phoneHashSecret: required("PHONE_HASH_SECRET"),
    port: Number(process.env.ORCHESTRATOR_PORT ?? "8080"),
    telephonyMode: parseTelephonyMode(),
    sip: {
      gatewayHost: process.env.SIP_GATEWAY_HOST ?? "",
      username: process.env.SIP_USERNAME ?? "",
      password: process.env.SIP_PASSWORD ?? "",
    },
    retell,
    pipeline: {
      baseUrl: (process.env.PIPELINE_URL ?? "http://127.0.0.1:8090").replace(/\/$/, ""),
      pollIntervalMs: Number(process.env.PIPELINE_POLL_INTERVAL_MS ?? "3000"),
      maxPollMs: Number(process.env.PIPELINE_MAX_POLL_MS ?? "600000"),
    },
    asterisk: {
      ariUrl: (process.env.ASTERISK_ARI_URL ?? "").replace(/\/$/, ""),
      ariUser: process.env.ASTERISK_ARI_USER ?? "pelozen",
      ariPassword: process.env.ASTERISK_ARI_PASSWORD ?? "",
      stasisApp: process.env.ASTERISK_STASIS_APP ?? "pelozen",
      gatewayEndpoint: process.env.GSM_GATEWAY_ENDPOINT ?? process.env.SIP_USERNAME ?? "gsm",
    },
  };
}
