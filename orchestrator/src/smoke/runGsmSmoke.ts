import { DEFAULT_COMPLIANCE, type Lead } from "@pelozen/shared";
import { SAMPLE_CAMPAIGN } from "../campaigns/sample.js";
import { SequentialRunController } from "../orchestrator/runController.js";
import type { TelephonyProvider } from "../providers/telephonyProvider.js";
import { MemoryRepo } from "./memoryRepo.js";

/** Monday 13:00 Israel — inside DEFAULT_COMPLIANCE calling window. */
const IN_WINDOW = new Date("2025-06-16T10:00:00Z");

export interface GsmSmokeResult {
  ok: true;
  runId: string;
  summary: Awaited<ReturnType<SequentialRunController["run"]>>;
  outcomes: MemoryRepo["outcomes"];
  statusUpdates: MemoryRepo["statusUpdates"];
  telephonyKind: TelephonyProvider["kind"];
}

/**
 * Closed-env end-to-end: real GsmPipelineProvider + MemoryRepo + sample campaign.
 * Does not touch Supabase.
 */
export async function runGsmSmoke(
  telephony: TelephonyProvider,
  opts: { callerId: string; phoneHashSecret: string; leadCount?: number } = {
    callerId: "+972501234567",
    phoneHashSecret: "smoke-secret",
  },
): Promise<GsmSmokeResult> {
  const repo = new MemoryRepo();
  const controller = new SequentialRunController({
    repo,
    telephony,
    compliance: DEFAULT_COMPLIANCE,
    clock: { now: () => IN_WINDOW },
    controls: { isPaused: () => false, isStopped: () => false },
    phoneHashSecret: opts.phoneHashSecret,
    callerId: opts.callerId,
  });

  const n = opts.leadCount ?? 2;
  const leads: Lead[] = Array.from({ length: n }, (_, i) => ({
    id: `smoke-lead-${i + 1}`,
    campaignId: SAMPLE_CAMPAIGN.id,
    phoneE164: `+97250000000${i + 1}`,
    phoneHash: `h-smoke-${i + 1}`,
    firstName: i === 0 ? "דני" : "מיכל",
    fields: {},
    status: "new",
    source: "csv",
    createdAt: "2025-01-01T00:00:00Z",
  }));

  const runId = `smoke-gsm-${Date.now()}`;
  const summary = await controller.run(runId, SAMPLE_CAMPAIGN, leads);

  return {
    ok: true,
    runId,
    summary,
    outcomes: repo.outcomes,
    statusUpdates: repo.statusUpdates,
    telephonyKind: telephony.kind,
  };
}
