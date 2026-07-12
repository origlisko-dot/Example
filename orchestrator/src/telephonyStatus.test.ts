import { test } from "node:test";
import assert from "node:assert/strict";
import type { OrchestratorConfig } from "./config.js";
import { getTelephonyStatus, resolveTelephonyMode } from "./telephonyStatus.js";

const base: OrchestratorConfig = {
  supabaseUrl: "https://x.supabase.co",
  supabaseServiceRoleKey: "key",
  callerId: "+972501234567",
  phoneHashSecret: "secret",
  port: 8080,
  telephonyMode: "auto",
  sip: { gatewayHost: "", username: "", password: "" },
  pipeline: { baseUrl: "http://127.0.0.1:8090", pollIntervalMs: 3000, maxPollMs: 600000 },
  asterisk: { ariUrl: "", ariUser: "p", ariPassword: "", stasisApp: "pelozen", gatewayEndpoint: "gsm" },
};

test("auto prefers retell when RETELL_* set", () => {
  const cfg: OrchestratorConfig = {
    ...base,
    retell: { apiKey: "k", agentId: "a", fromNumber: "+972501234567" },
  };
  assert.equal(resolveTelephonyMode(cfg), "retell");
  assert.equal(getTelephonyStatus(cfg).ready, true);
});

test("auto falls back to gsm when only pipeline configured", () => {
  const cfg: OrchestratorConfig = { ...base, telephonyMode: "auto" };
  assert.equal(resolveTelephonyMode(cfg), "gsm");
  assert.equal(getTelephonyStatus(cfg).mode, "gsm");
  assert.equal(getTelephonyStatus(cfg).ready, true);
});

test("explicit gsm mode even if retell also configured", () => {
  const cfg: OrchestratorConfig = {
    ...base,
    telephonyMode: "gsm",
    retell: { apiKey: "k", agentId: "a", fromNumber: "+972501234567" },
  };
  assert.equal(resolveTelephonyMode(cfg), "gsm");
});

test("retell mode not ready without env", () => {
  const cfg: OrchestratorConfig = { ...base, telephonyMode: "retell" };
  const s = getTelephonyStatus(cfg);
  assert.equal(s.ready, false);
  assert.match(s.hint ?? "", /RETELL/);
});
