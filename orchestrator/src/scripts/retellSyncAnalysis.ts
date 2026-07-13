/**
 * Sync SAMPLE_CAMPAIGN (or a campaign from argv JSON) post-call analysis
 * fields onto the Retell agent so custom_analysis_data matches outcomeSchema.
 *
 *   npm run retell:sync-analysis
 *   npm run retell:sync-analysis -- --dry-run
 *
 * Requires RETELL_API_KEY + RETELL_AGENT_ID.
 */
import { SAMPLE_CAMPAIGN } from "../campaigns/sample.js";
import { loadConfig } from "../config.js";
import { outcomeSchemaToRetellAnalysis } from "../providers/retellAnalysis.js";

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.retell?.apiKey || !cfg.retell.agentId) {
    console.error("Need RETELL_API_KEY and RETELL_AGENT_ID");
    process.exit(1);
  }

  const fields = outcomeSchemaToRetellAnalysis(SAMPLE_CAMPAIGN);
  // Keep Retell built-in presets + our campaign fields
  const post_call_analysis_data = [
    { type: "system-presets", name: "call_summary" },
    { type: "system-presets", name: "call_successful" },
    { type: "system-presets", name: "user_sentiment" },
    ...fields,
  ];

  console.log(`Agent: ${cfg.retell.agentId}`);
  console.log(`Fields (${fields.length}):`, fields.map((f) => f.name).join(", "));

  if (dryRun) {
    console.log(JSON.stringify(post_call_analysis_data, null, 2));
    console.log("dry-run — no PATCH sent");
    return;
  }

  const res = await fetch(`https://api.retellai.com/update-agent/${cfg.retell.agentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${cfg.retell.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ post_call_analysis_data }),
  });

  if (!res.ok) {
    console.error(`update-agent failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const body = (await res.json()) as { agent_id?: string; post_call_analysis_data?: unknown[] };
  console.log(
    `OK — agent ${body.agent_id ?? cfg.retell.agentId} now has ${
      Array.isArray(body.post_call_analysis_data) ? body.post_call_analysis_data.length : "?"
    } analysis fields`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
