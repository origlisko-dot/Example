/**
 * Direction-1 readiness check (no live dial unless RETELL_SMOKE_TO is set).
 *
 *   npm run smoke:retell
 *
 * Checks: env, agent fetch, post_call_analysis fields vs SAMPLE_CAMPAIGN.
 * Optional live dial: RETELL_SMOKE_TO=+972...
 */
import { SAMPLE_CAMPAIGN } from "../campaigns/sample.js";
import { loadConfig } from "../config.js";
import { outcomeSchemaToRetellAnalysis } from "../providers/retellAnalysis.js";
import { RetellProvider } from "../providers/retellProvider.js";
import { getTelephonyStatus } from "../telephonyStatus.js";
import { compilePrompt } from "../campaigns/promptCompiler.js";

interface RetellAgent {
  agent_id: string;
  agent_name?: string;
  post_call_analysis_data?: { name?: string; type?: string }[];
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const status = getTelephonyStatus(cfg);

  console.log("telephony:", status);

  if (!cfg.retell?.apiKey || !cfg.retell.agentId || !cfg.retell.fromNumber) {
    console.error("FAIL — set RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER");
    process.exit(1);
  }

  const res = await fetch(`https://api.retellai.com/get-agent/${cfg.retell.agentId}`, {
    headers: { Authorization: `Bearer ${cfg.retell.apiKey}` },
  });
  if (!res.ok) {
    console.error(`FAIL — get-agent: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const agent = (await res.json()) as RetellAgent;
  const expected = outcomeSchemaToRetellAnalysis(SAMPLE_CAMPAIGN).map((f) => f.name);
  const present = new Set(
    (agent.post_call_analysis_data ?? [])
      .map((f) => f.name)
      .filter((n): n is string => Boolean(n)),
  );
  const missing = expected.filter((n) => !present.has(n));

  console.log(`agent: ${agent.agent_id} (${agent.agent_name ?? "?"})`);
  console.log(`from_number: ${cfg.retell.fromNumber}`);
  console.log(`analysis fields on agent: ${[...present].join(", ") || "(none)"}`);

  if (missing.length) {
    console.warn(
      `WARN — missing post-call fields: ${missing.join(", ")}\n` +
        `  → run: npm run retell:sync-analysis`,
    );
  } else {
    console.log("OK — SAMPLE_CAMPAIGN analysis fields present on agent");
  }

  const to = process.env.RETELL_SMOKE_TO?.trim();
  if (!to) {
    console.log("Skip live dial (set RETELL_SMOKE_TO=+972... to place one test call)");
    process.exit(missing.length ? 2 : 0);
  }

  console.log(`Live dial → ${to} …`);
  const provider = new RetellProvider({
    apiKey: cfg.retell.apiKey,
    agentId: cfg.retell.agentId,
    fromNumber: cfg.retell.fromNumber,
    pollIntervalMs: cfg.retell.pollIntervalMs,
    maxPollMs: cfg.retell.maxPollMs,
    analysisWaitMs: 60_000,
  });
  const compiled = compilePrompt(SAMPLE_CAMPAIGN, { firstName: "בדיקה", fields: {} });
  const result = await provider.dial({
    toE164: to,
    callerId: cfg.callerId,
    compiled,
    aiDisclosed: false,
    maxDurationSec: 90,
    dynamicVariables: { first_name: "בדיקה" },
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(`OK — endReason=${result.endReason} duration=${result.durationSec}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
