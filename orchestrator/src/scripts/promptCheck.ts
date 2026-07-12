/**
 * Verify a seeded campaign compiles into the real Hebrew system prompt + the
 * record_outcome tool. Run: node --env-file=.env --import tsx orchestrator/src/scripts/promptCheck.ts [interestId]
 */
import { createClient } from "@supabase/supabase-js";
import type { Campaign } from "@pelozen/shared";
import { loadConfig } from "../config.js";
import { compilePrompt } from "../campaigns/promptCompiler.js";

const interestId = process.argv[2] ?? "529";
const cfg = loadConfig();
const db = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, { auth: { persistSession: false } });

const { data: c } = await db.from("campaigns").select("*").eq("pelozen_topic_ref", interestId).maybeSingle();
if (!c) { console.error("campaign not found"); process.exit(1); }

const campaign: Campaign = {
  id: c.id, name: c.name, status: c.status, locale: "he-IL",
  introScript: c.intro_script, valueProp: c.value_prop,
  qualifyingQuestions: c.qualifying_questions, objectionHandlers: c.objection_handlers,
  closingScript: c.closing_script, outcomeSchema: c.outcome_schema,
  successExpr: c.success_expr, disqualifyExpr: c.disqualify_expr,
  voice: c.voice, dynamicVariables: c.dynamic_variables ?? [],
  maxCallDurationSec: c.max_call_duration_sec, aiDisclosureOn: c.ai_disclosure_on,
  callingWindowId: "", retryPolicyId: "", version: c.version,
};

const compiled = compilePrompt(campaign, { firstName: "דני", fields: {} }, { disclosureLine: null });
console.log("===== SYSTEM PROMPT =====\n");
console.log(compiled.systemPrompt);
console.log("\n===== record_outcome required fields =====");
console.log(compiled.recordOutcomeTool.input_schema.required.join(", "));
