"use server";

import { createServerClient } from "@/lib/supabase/server";

export interface QuestionInput {
  id: string;
  text: string;
  type: "yesno" | "open" | "number" | "choice";
}
export interface ObjectionInput {
  trigger: string;
  response: string;
}

export interface CampaignScriptInput {
  id: string;
  status: "draft" | "active";
  introScript: string;
  valueProp: string;
  qualifyingQuestions: QuestionInput[];
  objectionHandlers: ObjectionInput[];
  closingScript: string;
}

/**
 * Persist a campaign's Hebrew script. The owner edits the human-facing parts;
 * the technical outcome schema + success/disqualify expressions get sensible
 * defaults so runs work without the operator touching boolean logic.
 */
export async function saveCampaign(input: CampaignScriptInput): Promise<{ ok: boolean }> {
  const supabase = createServerClient();

  const questions = input.qualifyingQuestions
    .filter((q) => q.text.trim())
    .map((q) => ({ id: q.id, text: q.text.trim(), type: q.type, required: true }));
  const objections = input.objectionHandlers
    .filter((o) => o.trigger.trim() && o.response.trim())
    .map((o) => ({ trigger: o.trigger.trim(), response: o.response.trim() }));

  const { error } = await supabase
    .from("campaigns")
    .update({
      status: input.status,
      intro_script: input.introScript,
      value_prop: input.valueProp,
      qualifying_questions: questions,
      objection_handlers: objections,
      closing_script: input.closingScript,
      // defaults so the agent can qualify without the operator writing logic
      outcome_schema: [
        { key: "interested", type: "bool", description: "האם הלקוח מעוניין", required: true },
        { key: "wants_callback", type: "bool", description: "האם הסכים שנציג יחזור אליו", required: true },
        { key: "best_callback_time", type: "string", description: "זמן מועדף לחזרה", required: false },
        { key: "notes", type: "string", description: "הערות מהשיחה", required: false },
      ],
      success_expr: "interested == true && wants_callback == true",
      disqualify_expr: "interested == false",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  return { ok: !error };
}
