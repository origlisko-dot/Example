/**
 * Load the first-draft campaign scripts into Supabase (matched by interest_id).
 * Run: node --env-file=.env --import tsx orchestrator/src/scripts/seedScripts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "../config.js";
import { CAMPAIGN_SCRIPTS } from "../campaigns/scripts.js";

const OUTCOME_SCHEMA = [
  { key: "interested", type: "bool", description: "האם הלקוח מעוניין", required: true },
  { key: "wants_callback", type: "bool", description: "האם הסכים שנציג יחזור אליו", required: true },
  { key: "best_callback_time", type: "string", description: "זמן מועדף לחזרה", required: false },
  { key: "notes", type: "string", description: "הערות מהשיחה", required: false },
];

const cfg = loadConfig();
const db = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, { auth: { persistSession: false } });

let updated = 0;
const missing: string[] = [];

for (const s of CAMPAIGN_SCRIPTS) {
  const questions = s.questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text, type: q.type, required: true }));
  const { data, error } = await db
    .from("campaigns")
    .update({
      intro_script: s.intro,
      value_prop: s.valueProp,
      qualifying_questions: questions,
      objection_handlers: s.objections,
      closing_script: s.closing,
      outcome_schema: OUTCOME_SCHEMA,
      success_expr: "interested == true && wants_callback == true",
      disqualify_expr: "interested == false",
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("pelozen_topic_ref", s.interestId)
    .select("id");

  if (error) console.error(`✗ ${s.interestId}: ${error.message}`);
  else if (!data?.length) missing.push(s.interestId);
  else updated++;
}

console.log(`updated ${updated} campaigns; missing interest_ids: ${JSON.stringify(missing)}`);
