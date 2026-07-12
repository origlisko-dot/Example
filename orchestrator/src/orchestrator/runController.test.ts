import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COMPLIANCE, type Lead, type LeadStatus, type SuppressionReason } from "@pelozen/shared";
import { SequentialRunController, type RunDeps } from "./runController.js";
import { SAMPLE_CAMPAIGN } from "../campaigns/sample.js";
import type { DialResult, TelephonyProvider, DialRequest } from "../providers/telephonyProvider.js";

// ── in-memory fakes ──────────────────────────────────────────────────────────
class FakeRepo {
  suppressed = new Set<string>();
  noConsent = new Set<string>();
  statusUpdates: { leadId: string; status: LeadStatus; reason?: SuppressionReason }[] = [];
  suppressions: string[] = [];
  outcomes: { leadId: string; disposition: string; qualified: boolean }[] = [];
  runState: { state: string; reason?: string }[] = [];
  dbRunState: import("../db/repo.js").RunState = "running";
  private n = 0;

  async getRunState() { return this.dbRunState; }
  async isSuppressed(p: string) { return this.suppressed.has(p); }
  async hasConsent(leadId: string) { return !this.noConsent.has(leadId); }
  async acquireCallAttempt() { return { id: `att-${++this.n}` }; }
  async skipQueuedAttemptForLead() {}
  async skipQueuedAttempt() {}
  async finishCallAttempt() {}
  async recordOutcome(i: { leadId: string; disposition: string; qualified: boolean }) { this.outcomes.push(i); }
  async saveTranscript() {}
  async setLeadStatus(leadId: string, status: LeadStatus, reason?: SuppressionReason) {
    this.statusUpdates.push({ leadId, status, reason });
  }
  async addSuppression(i: { phoneE164: string }) { this.suppressions.push(i.phoneE164); }
  async setRunState(_runId: string, state: string, reason?: string) { this.runState.push({ state, reason }); }
  async audit() {}
}

class FakeTelephony implements TelephonyProvider {
  readonly kind = "asterisk_gsm" as const;
  dialed: string[] = [];
  constructor(private readonly result: (req: DialRequest) => DialResult) {}
  async dial(req: DialRequest): Promise<DialResult> {
    this.dialed.push(req.toE164);
    return this.result(req);
  }
}

function lead(id: string, phone: string): Lead {
  return {
    id, campaignId: SAMPLE_CAMPAIGN.id, phoneE164: phone, phoneHash: `h-${phone}`,
    firstName: "דני", fields: {}, status: "new", source: "csv", createdAt: "2025-01-01T00:00:00Z",
  };
}

const IN_WINDOW = new Date("2025-06-16T10:00:00Z");   // Mon 13:00 Israel
const SHABBAT = new Date("2025-06-14T10:00:00Z");      // Sat 13:00 Israel

function deps(repo: FakeRepo, tel: TelephonyProvider, now: Date): RunDeps {
  return {
    repo: repo as unknown as RunDeps["repo"],
    telephony: tel,
    compliance: DEFAULT_COMPLIANCE,
    clock: { now: () => now },
    controls: { isPaused: () => false, isStopped: () => false },
    phoneHashSecret: "test-secret",
    callerId: "+972545456212",
  };
}

const answered = (structured: Record<string, unknown>, transcript: unknown[] = []): DialResult => ({
  providerCallId: "pc-1", endReason: "answered", durationSec: 90, structured: structured as never, transcript,
});

// ── tests ────────────────────────────────────────────────────────────────────
test("suppressed lead is skipped, never dialed", async () => {
  const repo = new FakeRepo();
  repo.suppressed.add("+972500000001");
  const tel = new FakeTelephony(() => answered({}));
  const ctrl = new SequentialRunController(deps(repo, tel, IN_WINDOW));
  const s = await ctrl.run("run-1", SAMPLE_CAMPAIGN, [lead("L1", "+972500000001")]);
  assert.equal(tel.dialed.length, 0);
  assert.equal(s.suppressed, 1);
  assert.deepEqual(repo.statusUpdates[0], { leadId: "L1", status: "suppressed", reason: "opt_out" });
});

test("lead without consent is skipped when consent required", async () => {
  const repo = new FakeRepo();
  repo.noConsent.add("L2");
  const tel = new FakeTelephony(() => answered({}));
  const ctrl = new SequentialRunController(deps(repo, tel, IN_WINDOW));
  const s = await ctrl.run("run-1", SAMPLE_CAMPAIGN, [lead("L2", "+972500000002")]);
  assert.equal(tel.dialed.length, 0);
  assert.equal(s.skippedNoConsent, 1);
});

test("qualified lead: meets successExpr → status qualified", async () => {
  const repo = new FakeRepo();
  const tel = new FakeTelephony(() =>
    answered({ interested: true, business_active: true, wants_callback: true, disposition: "qualified_for_human" }));
  const ctrl = new SequentialRunController(deps(repo, tel, IN_WINDOW));
  const s = await ctrl.run("run-1", SAMPLE_CAMPAIGN, [lead("L3", "+972500000003")]);
  assert.equal(s.qualified, 1);
  assert.equal(repo.outcomes[0]!.disposition, "qualified_for_human");
  assert.ok(repo.statusUpdates.some((u) => u.status === "qualified"));
});

test("opt-out spoken in call → suppressed + added to suppression list", async () => {
  const repo = new FakeRepo();
  const tel = new FakeTelephony(() =>
    answered({ disposition: "not_relevant" }, [{ speaker: "user", text: "בבקשה תורידו אותי מהרשימה" }]));
  const ctrl = new SequentialRunController(deps(repo, tel, IN_WINDOW));
  const s = await ctrl.run("run-1", SAMPLE_CAMPAIGN, [lead("L4", "+972500000004")]);
  assert.equal(s.suppressed, 1);
  assert.deepEqual(repo.suppressions, ["+972500000004"]);
  assert.equal(repo.outcomes[0]!.disposition, "opted_out");
});

test("outside calling window (Shabbat) → halts, run paused", async () => {
  const repo = new FakeRepo();
  const tel = new FakeTelephony(() => answered({}));
  const ctrl = new SequentialRunController(deps(repo, tel, SHABBAT));
  const s = await ctrl.run("run-1", SAMPLE_CAMPAIGN, [lead("L5", "+972500000005")]);
  assert.equal(tel.dialed.length, 0);
  assert.equal(s.haltedReason, "outside_hours");
  assert.ok(repo.runState.some((r) => r.state === "paused" && r.reason === "outside_calling_window"));
});
