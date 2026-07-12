import type { Campaign, OutcomeField } from "@pelozen/shared";

/**
 * Compiles a campaign + a single lead's variables into:
 *   1. the Hebrew system prompt that drives the conversation, and
 *   2. the JSON-schema for the `record_outcome` tool the LLM MUST call at the
 *      end of the call.
 *
 * The structured tool result is the source of truth for the outcome — we never
 * parse the free transcript for it.
 */

export interface CompiledPrompt {
  systemPrompt: string;
  recordOutcomeTool: {
    name: "record_outcome";
    description: string;
    input_schema: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
  /** disclosure line to prepend to the opening turn, or null when disabled */
  disclosureLine: string | null;
}

export interface LeadVariables {
  firstName?: string;
  fields: Record<string, string>;
}

/** Replace {{var}} tokens using firstName + arbitrary lead fields. */
export function injectVariables(text: string, vars: LeadVariables): string {
  const map: Record<string, string> = { ...vars.fields };
  if (vars.firstName) map.first_name = vars.firstName;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => map[key] ?? "");
}

function outcomeFieldToJsonSchema(f: OutcomeField): Record<string, unknown> {
  const base: Record<string, unknown> = { description: f.description };
  switch (f.type) {
    case "bool":
      return { ...base, type: "boolean" };
    case "number":
      return { ...base, type: "number" };
    case "choice":
      return { ...base, type: "string", enum: f.choices ?? [] };
    case "string":
    default:
      return { ...base, type: "string" };
  }
}

const MASTER_TEMPLATE = (c: Campaign, blocks: {
  intro: string;
  valueProp: string;
  questions: string;
  objections: string;
  closing: string;
}) => `אתה מנהל שיחת טלפון יוצאת בעברית, בנימה אנושית, חמה וטבעית, מטעם העסק.
מטרת השיחה: לברר אם רלוונטי שנחזור אל הלקוח בנושא "${c.name}", ולסווג את התוצאה.
הלקוח השאיר פרטים וביקש שיחזרו אליו — הוא מצפה לשיחה.

כללי שיחה:
- דבר עברית טבעית ושוטפת, משפטים קצרים, בלי להישמע מוקלט. הקשב ואל תקטע.
- אם הלקוח מבקש לא להמשיך או לא נוח לו עכשיו — כבד זאת מיד.
- אם הלקוח מבקש שלא ניצור איתו קשר ("הסר", "אל תתקשרו") — התנצל בקצרה, סיים בנימוס, וסמן opt_out.
- עבור על שאלות הסינון לפי הסדר, אבל בזרימה טבעית של שיחה, לא כמו שאלון.
- בסיום השיחה אתה חייב לקרוא לכלי record_outcome ולמלא את כל השדות הנדרשים.

— פתיחה —
${blocks.intro}

— ערך / הצעה —
${blocks.valueProp}

— שאלות סינון (לפי הסדר) —
${blocks.questions}

— טיפול בהתנגדויות —
${blocks.objections}

— סגירה —
${blocks.closing}

זכור: בסוף השיחה תמיד record_outcome.`;

export function compilePrompt(campaign: Campaign, vars: LeadVariables, options?: {
  disclosureLine?: string | null;
}): CompiledPrompt {
  const inject = (t: string) => injectVariables(t, vars);

  const questions = campaign.qualifyingQuestions
    .map((q, i) => `${i + 1}. ${inject(q.text)}`)
    .join("\n");

  const objections = campaign.objectionHandlers
    .map((o) => `• אם "${o.trigger}" → ${inject(o.response)}`)
    .join("\n");

  const systemPrompt = MASTER_TEMPLATE(campaign, {
    intro: inject(campaign.introScript),
    valueProp: inject(campaign.valueProp),
    questions: questions || "(אין שאלות סינון מוגדרות)",
    objections: objections || "(אין התנגדויות מוגדרות)",
    closing: inject(campaign.closingScript),
  });

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of campaign.outcomeSchema) {
    properties[f.key] = outcomeFieldToJsonSchema(f);
    if (f.required) required.push(f.key);
  }
  // Always-present disposition hint the LLM fills alongside the campaign fields.
  properties.disposition = {
    type: "string",
    description: "סיווג סופי של השיחה",
    enum: [
      "qualified_for_human", "interested", "callback_later",
      "not_relevant", "opted_out", "wrong_number",
    ],
  };
  required.push("disposition");

  return {
    systemPrompt,
    disclosureLine: options?.disclosureLine ?? null,
    recordOutcomeTool: {
      name: "record_outcome",
      description:
        "תיעוד תוצאת השיחה. יש לקרוא לכלי זה פעם אחת בסיום, עם כל השדות הנדרשים.",
      input_schema: { type: "object", properties, required },
    },
  };
}
