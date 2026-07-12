import {
  isWithinCallingWindow, detectOptOut,
  type Campaign, type Lead, type ComplianceConfig,
} from "@pelozen/shared";
import { compilePrompt } from "../campaigns/promptCompiler.js";
import { classifyDisposition } from "../campaigns/outcomeEval.js";
import { createPhoneHash } from "../util/hash.js";
import type { Repo } from "../db/repo.js";
import type { TelephonyProvider, DialResult } from "../providers/telephonyProvider.js";

/**
 * The sequential dial loop — the spine of the system. One SIM line = one call
 * at a time, so this is a plain `for…await` over the batch, with the compliance
 * gates evaluated immediately before every dial.
 *
 * Gate order (fail safe, every iteration):
 *   stop/pause → calling-window → suppression → consent → dial → classify →
 *   opt-out sweep → persist.
 */

export interface RunControls {
  isPaused(): boolean;
  isStopped(): boolean;
}

export interface Clock {
  now(): Date;
}

export interface RunDeps {
  repo: Repo;
  telephony: TelephonyProvider;
  compliance: ComplianceConfig;
  clock: Clock;
  controls: RunControls;
  phoneHashSecret: string;
  /** the owner's SIM number, shown as caller ID */
  callerId: string;
}

export interface RunSummary {
  dialed: number;
  qualified: number;
  suppressed: number;
  skippedNoConsent: number;
  haltedReason?: "stopped" | "paused" | "outside_hours" | "completed";
}

export class SequentialRunController {
  constructor(private readonly deps: RunDeps) {}

  async run(runId: string, campaign: Campaign, leads: Lead[]): Promise<RunSummary> {
    const { repo, telephony, compliance, clock, controls } = this.deps;
    const summary: RunSummary = { dialed: 0, qualified: 0, suppressed: 0, skippedNoConsent: 0 };

    const disclose = campaign.aiDisclosureOn || compliance.disclosure.enabled;
    const disclosureLine = disclose ? compliance.disclosure.text : null;

    for (const lead of leads) {
      if (controls.isStopped()) { summary.haltedReason = "stopped"; break; }
      if (controls.isPaused()) { summary.haltedReason = "paused"; break; }
      if (!isWithinCallingWindow(clock.now(), compliance.callingWindow)) {
        summary.haltedReason = "outside_hours";
        await repo.setRunState(runId, "paused", "outside_calling_window");
        break;
      }

      // ── gates ──
      if (await repo.isSuppressed(lead.phoneE164)) {
        await repo.setLeadStatus(lead.id, "suppressed", "opt_out");
        summary.suppressed++;
        continue;
      }
      if (compliance.requireConsentRecord && !(await repo.hasConsent(lead.id))) {
        await repo.setLeadStatus(lead.id, "new");
        await repo.audit("skip_no_consent", "lead", lead.id);
        summary.skippedNoConsent++;
        continue;
      }

      // ── dial ──
      const attempt = await repo.createCallAttempt({
        runId, leadId: lead.id, campaignVersion: campaign.version,
        attemptNo: 1, aiDisclosed: disclose,
      });

      const compiled = compilePrompt(
        campaign,
        { firstName: lead.firstName, fields: lead.fields },
        { disclosureLine },
      );

      let result: DialResult;
      try {
        result = await telephony.dial({
          toE164: lead.phoneE164,
          callerId: this.deps.callerId,
          compiled,
          aiDisclosed: disclose,
          maxDurationSec: campaign.maxCallDurationSec,
        });
      } catch {
        await repo.finishCallAttempt(attempt.id, { state: "failed", endReason: "failed", durationSec: 0 });
        await repo.setLeadStatus(lead.id, "new");
        continue;
      }
      summary.dialed++;

      await repo.finishCallAttempt(attempt.id, {
        state: result.endReason === "answered" ? "completed" : result.endReason,
        endReason: result.endReason,
        durationSec: result.durationSec,
        providerCallId: result.providerCallId,
      });

      if (result.endReason !== "answered") {
        // no_answer / busy / failed / voicemail → leave for a later retry pass
        await repo.setLeadStatus(lead.id, "queued");
        continue;
      }

      // ── answered: classify + opt-out sweep + persist ──
      const structured = result.structured ?? {};
      const transcriptText = transcriptToText(result.transcript ?? []);
      let disposition = classifyDisposition(campaign, structured);

      if (disposition === "opted_out" || detectOptOut(transcriptText, compliance.optOutPhrases)) {
        disposition = "opted_out";
        await repo.addSuppression({
          phoneE164: lead.phoneE164,
          phoneHash: createPhoneHash(lead.phoneE164, this.deps.phoneHashSecret),
          reason: "opt_out",
          sourceCallId: attempt.id,
        });
        await repo.setLeadStatus(lead.id, "suppressed", "opt_out");
        summary.suppressed++;
      } else {
        const qualified = disposition === "qualified_for_human";
        if (qualified) summary.qualified++;
        await repo.setLeadStatus(lead.id, qualified ? "qualified" : "contacted");
      }

      await repo.recordOutcome({
        callAttemptId: attempt.id,
        leadId: lead.id,
        disposition,
        structured,
        qualified: disposition === "qualified_for_human",
      });
      // Recording is OFF by default — we persist only the short text transcript.
      await repo.saveTranscript(attempt.id, result.transcript ?? []);
    }

    if (!summary.haltedReason) {
      summary.haltedReason = "completed";
      await repo.setRunState(runId, "done");
    }
    return summary;
  }
}

function transcriptToText(segments: unknown[]): string {
  return segments
    .map((s) => (typeof s === "object" && s && "text" in s ? String((s as { text: unknown }).text) : ""))
    .join(" ");
}
