/**
 * Closed-env CLI: dial 2 sample leads through the live GSM pipeline (sim mode).
 *
 *   npm run smoke:gsm
 *
 * Requires: pipeline on PIPELINE_URL (default :8090), TELEPHONY_MODE=gsm.
 */
import { loadConfig } from "../config.js";
import { createTelephonyProvider } from "../telephonyFactory.js";
import { getTelephonyStatus } from "../telephonyStatus.js";
import { runGsmSmoke } from "./runGsmSmoke.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const status = getTelephonyStatus(cfg);
  if (status.mode !== "gsm" || !status.ready) {
    console.error("Need TELEPHONY_MODE=gsm and PIPELINE_URL. Status:", status);
    process.exit(1);
  }

  console.log(`smoke:gsm → ${status.pipelineUrl} (${status.kind})`);
  const telephony = createTelephonyProvider(cfg);
  const result = await runGsmSmoke(telephony, {
    callerId: cfg.callerId,
    phoneHashSecret: cfg.phoneHashSecret,
    leadCount: 2,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.summary.dialed < 1) {
    console.error("smoke failed: no dials");
    process.exit(1);
  }
  console.log(`OK — dialed=${result.summary.dialed} qualified=${result.summary.qualified}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
