import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_CAMPAIGN } from "../campaigns/sample.js";
import {
  mapRetellDisconnection,
  outcomeSchemaToRetellAnalysis,
  structuredFromRetellAnalysis,
} from "./retellAnalysis.js";

test("outcomeSchemaToRetellAnalysis includes disposition enum + bool fields", () => {
  const fields = outcomeSchemaToRetellAnalysis(SAMPLE_CAMPAIGN);
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  assert.equal(byName.interested?.type, "boolean");
  assert.equal(byName.wants_callback?.type, "boolean");
  assert.equal(byName.disposition?.type, "enum");
  if (byName.disposition?.type === "enum") {
    assert.ok(byName.disposition.choices.includes("qualified_for_human"));
    assert.ok(byName.disposition.choices.includes("opted_out"));
  }
});

test("structuredFromRetellAnalysis prefers custom_analysis_data", () => {
  const s = structuredFromRetellAnalysis({
    call_summary: "summary",
    call_successful: true,
    custom_analysis_data: {
      interested: true,
      wants_callback: true,
      business_active: true,
      disposition: "qualified_for_human",
    },
  });
  assert.equal(s.disposition, "qualified_for_human");
  assert.equal(s.interested, true);
  assert.equal(s.notes, "summary");
});

test("structuredFromRetellAnalysis falls back when custom empty", () => {
  const s = structuredFromRetellAnalysis({
    in_voicemail: true,
    user_sentiment: "Negative",
    call_successful: false,
    call_summary: "left voicemail",
  });
  assert.equal(s.disposition, "callback_later");
  assert.equal(s.interested, false);
  assert.equal(s.notes, "left voicemail");
});

test("mapRetellDisconnection covers dial_* reasons", () => {
  assert.equal(mapRetellDisconnection("dial_no_answer", "ended"), "no_answer");
  assert.equal(mapRetellDisconnection("dial_busy", "ended"), "busy");
  assert.equal(mapRetellDisconnection("voicemail_reached", "ended"), "voicemail");
  assert.equal(mapRetellDisconnection("dial_failed", "ended"), "failed");
  assert.equal(mapRetellDisconnection("agent_hangup", "ended"), "answered");
  assert.equal(mapRetellDisconnection(undefined, "error"), "failed");
});
