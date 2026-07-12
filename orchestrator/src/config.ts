/**
 * Environment configuration for the orchestrator. Fails fast and loudly when a
 * required secret is missing — a half-configured dialer is worse than none.
 */
export interface OrchestratorConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  callerId: string;
  phoneHashSecret: string;
  port: number;
  sip: { gatewayHost: string; username: string; password: string };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): OrchestratorConfig {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    callerId: process.env.CALLER_ID ?? "+972545456212",
    phoneHashSecret: required("PHONE_HASH_SECRET"),
    port: Number(process.env.ORCHESTRATOR_PORT ?? "8080"),
    sip: {
      gatewayHost: process.env.SIP_GATEWAY_HOST ?? "",
      username: process.env.SIP_USERNAME ?? "",
      password: process.env.SIP_PASSWORD ?? "",
    },
  };
}
