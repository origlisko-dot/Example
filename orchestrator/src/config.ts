/**
 * Environment configuration for the orchestrator. Fails fast and loudly when a
 * required secret is missing — a half-configured dialer is worse than none.
 */
export interface RetellConfig {
  apiKey: string;
  agentId: string;
  fromNumber: string;
  pollIntervalMs?: number;
  maxPollMs?: number;
}

export interface OrchestratorConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  callerId: string;
  phoneHashSecret: string;
  port: number;
  sip: { gatewayHost: string; username: string; password: string };
  /** Present when RETELL_API_KEY + RETELL_AGENT_ID + RETELL_FROM_NUMBER are set. */
  retell?: RetellConfig;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
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
    sip: {
      gatewayHost: process.env.SIP_GATEWAY_HOST ?? "",
      username: process.env.SIP_USERNAME ?? "",
      password: process.env.SIP_PASSWORD ?? "",
    },
    retell,
  };
}
