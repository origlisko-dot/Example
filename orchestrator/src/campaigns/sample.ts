import type { Campaign } from "@pelozen/shared";

/**
 * Reference campaign — "הלוואות לעסקים". One fully-worked topic that shows the
 * shape every other topic follows. The owner supplies the real Hebrew wording
 * per topic; this is the editable template.
 */
export const SAMPLE_CAMPAIGN: Campaign = {
  id: "sample-business-loans",
  name: "הלוואות לעסקים",
  pelozenTopicRef: "הלוואות לעסקים - מחזורים גבוהים",
  status: "draft",
  locale: "he-IL",

  introScript:
    "היי {{first_name}}, מה שלומך? השארת פרטים אצלנו בנושא הלוואה לעסק וביקשת שנחזור אליך — יש לך דקה?",
  valueProp:
    "אנחנו עוזרים לעסקים עם מחזורים גבוהים לקבל מימון בתנאים טובים ובמהירות, בלי בירוקרטיה מיותרת.",

  qualifyingQuestions: [
    { id: "active", text: "העסק פעיל היום ומגלגל מחזור חודשי?", type: "yesno", required: true },
    { id: "amount", text: "איזה סכום הלוואה היה עוזר לך כרגע?", type: "number", required: false },
    { id: "timing", text: "זה משהו שרלוונטי עכשיו או בהמשך?", type: "open", required: false },
  ],

  objectionHandlers: [
    { trigger: "אין זמן עכשיו", response: "אין בעיה, מתי נוח שנחזור אליך — בבוקר או בערב?" },
    { trigger: "כבר יש לי מימון", response: "מצוין, ואם נצליח להציע תנאים טובים יותר — שווה לבדוק?" },
    { trigger: "כמה ריבית", response: "התנאים נקבעים אישית לפי העסק; בדיוק בשביל זה נציג מומחה יחזור אליך." },
  ],

  closingScript:
    "מעולה, אעביר את הפרטים לנציג שלנו והוא יחזור אליך עם הצעה מותאמת. תודה רבה {{first_name}}, יום נעים!",

  outcomeSchema: [
    { key: "interested", type: "bool", description: "האם הלקוח מעוניין להמשיך", required: true },
    { key: "business_active", type: "bool", description: "האם העסק פעיל ומגלגל מחזור", required: false },
    { key: "wants_callback", type: "bool", description: "האם הסכים שנציג יחזור אליו", required: true },
    { key: "loan_amount", type: "number", description: "סכום הלוואה רצוי אם נמסר", required: false },
    { key: "best_callback_time", type: "string", description: "זמן מועדף לחזרה", required: false },
    { key: "notes", type: "string", description: "הערות חופשיות מהשיחה", required: false },
  ],

  // A lead is "qualified for a human rep" only if interested AND business is
  // active AND they agreed to a callback.
  successExpr: "interested == true && business_active == true && wants_callback == true",
  disqualifyExpr: "interested == false || business_active == false",

  voice: { provider: "cartesia", voiceId: "${CARTESIA_VOICE_ID}", speed: 1, model: "sonic-2" },
  dynamicVariables: ["first_name"],
  maxCallDurationSec: 240,

  // Owner's choice: disclosure OFF (built, one flag from ON). See README.
  aiDisclosureOn: false,

  callingWindowId: "default",
  retryPolicyId: "default",
  version: 1,
};
