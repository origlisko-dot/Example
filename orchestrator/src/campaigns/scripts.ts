/**
 * First-draft Hebrew qualification scripts per pelozen topic (keyed by
 * interest_id). Qualification-only by design: confirm interest, check
 * relevance, agree to a callback — NO invented offers/prices/terms. The owner
 * refines each via the panel editor.
 */
export type QType = "yesno" | "open" | "number" | "choice";

export interface ScriptDef {
  interestId: string;
  intro: string;
  valueProp: string;
  questions: { text: string; type: QType }[];
  objections: { trigger: string; response: string }[];
  closing: string;
}

const CLOSING =
  "מעולה, אעביר את הפרטים לנציג שלנו והוא יחזור אליך עם כל המידע. תודה רבה {{first_name}}, יום נעים!";
const CLOSING_SOFT =
  "תודה {{first_name}}, אעדכן את הנציג שיחזור אליך בזמן שנוח לך. שיהיה יום טוב!";

export const CAMPAIGN_SCRIPTS: ScriptDef[] = [
  // ── הלוואות ──────────────────────────────────────────────
  {
    interestId: "529",
    intro: "היי {{first_name}}, מה שלומך? השארת פרטים אצלנו בנושא הלוואה לעסק וביקשת שנחזור אליך, יש לך דקה?",
    valueProp: "אנחנו עוזרים לעסקים לקבל מימון בתנאים טובים ובמהירות, בלי בירוקרטיה מיותרת.",
    questions: [
      { text: "העסק פעיל היום ומגלגל מחזור חודשי?", type: "yesno" },
      { text: "איזה סכום הלוואה היה עוזר לך כרגע?", type: "number" },
      { text: "זה רלוונטי עכשיו או בהמשך?", type: "open" },
    ],
    objections: [
      { trigger: "אין זמן עכשיו", response: "אין בעיה, מתי נוח שנחזור אליך, בבוקר או בערב?" },
      { trigger: "כבר יש לי מימון", response: "מצוין, ואם נצליח להציע תנאים טובים יותר, שווה לבדוק?" },
    ],
    closing: CLOSING,
  },
  {
    interestId: "549",
    intro: "היי {{first_name}}, פנית אלינו לגבי מימון לעסק עם מחזורים גבוהים וביקשת שנחזור אליך, נוח לדבר רגע?",
    valueProp: "לעסקים עם מחזורים גבוהים יש לנו פתרונות מימון מותאמים בתנאים מועדפים.",
    questions: [
      { text: "מה המחזור החודשי המשוער של העסק?", type: "number" },
      { text: "לאיזו מטרה המימון, תזרים, השקעה או הרחבה?", type: "open" },
    ],
    objections: [
      { trigger: "כבר עובד עם בנק", response: "ברור, אנחנו לרוב משלימים לבנק ומשפרים תנאים, שווה השוואה." },
    ],
    closing: CLOSING,
  },
  {
    interestId: "566",
    intro: "היי {{first_name}}, השארת פרטים בנושא הלוואה לעסק וביקשת שנחזור אליך, יש לך רגע?",
    valueProp: "אנחנו מלווים עסקים בקבלת מימון מהיר ובתנאים טובים.",
    questions: [
      { text: "העסק פעיל ומגלגל מחזור חודשי?", type: "yesno" },
      { text: "איזה סכום היה עוזר לך?", type: "number" },
    ],
    objections: [
      { trigger: "לא בטוח שאני צריך", response: "בלי התחייבות, נציג פשוט יסביר לך אפשרויות ותחליט בנחת." },
    ],
    closing: CLOSING_SOFT,
  },

  // ── ייעוץ משפטי ──────────────────────────────────────────
  ...["296", "538", "537", "572", "574", "575"].map<ScriptDef>((id) => ({
    interestId: id,
    intro: "היי {{first_name}}, פנית אלינו לקבלת ייעוץ עם עורך דין וביקשת שנחזור אליך, נוח לדבר רגע?",
    valueProp: "אנחנו מחברים אותך לעורך דין מקצועי שמתאים בדיוק לנושא שלך.",
    questions: [
      { text: "באיזה תחום או נושא מדובר?", type: "open" },
      { text: "זה דחוף או שאפשר בימים הקרובים?", type: "open" },
    ],
    objections: [
      { trigger: "כבר יש לי עורך דין", response: "מצוין, נשמח לתת חוות דעת נוספת ללא התחייבות אם תרצה." },
      { trigger: "כמה זה עולה", response: "התנאים נקבעים אישית מול עורך הדין, בדיוק בשביל זה הוא יחזור אליך." },
    ],
    closing: CLOSING,
  })),
  {
    interestId: "561",
    intro: "היי {{first_name}}, השארת פרטים בנושא מגן משפטי וביקשת שנחזור אליך, יש לך דקה?",
    valueProp: "מגן משפטי נותן לך גיבוי של עורך דין זמין לכל שאלה או בעיה, בעלות חודשית קבועה.",
    questions: [
      { text: "זה עבורך באופן אישי או עבור עסק?", type: "open" },
      { text: "יש נושא משפטי שמטריד אותך כרגע?", type: "open" },
    ],
    objections: [
      { trigger: "אין לי צורך כרגע", response: "הרעיון הוא בדיוק להיות מוכן מראש, נציג יסביר ותחליט בנחת." },
    ],
    closing: CLOSING_SOFT,
  },
  {
    interestId: "540",
    intro: "היי {{first_name}}, פנית אלינו בנושא פרסום לעורכי דין וביקשת שנחזור אליך, נוח לדבר?",
    valueProp: "אנחנו מביאים לעורכי דין פניות ולקוחות חדשים דרך פרסום ממוקד.",
    questions: [
      { text: "אתה עורך דין פעיל? באיזה תחום?", type: "open" },
      { text: "מעוניין להגדיל את כמות הפניות מלקוחות?", type: "yesno" },
    ],
    objections: [
      { trigger: "כבר מפרסם", response: "מעולה, נשמח להראות לך ערוץ נוסף שמביא פניות איכותיות." },
    ],
    closing: CLOSING,
  },

  // ── פיצוי ─────────────────────────────────────────────────
  {
    interestId: "432",
    intro: "היי {{first_name}}, פנית אלינו לגבי בדיקת פיצוי כספי וביקשת שנחזור אליך, נוח לדבר רגע?",
    valueProp: "אנחנו בודקים בלי עלות אם מגיע לך פיצוי כספי בעקבות פציעה או תאונה.",
    questions: [
      { text: "מדובר בתאונת דרכים, עבודה או פציעה אחרת?", type: "open" },
      { text: "מתי זה קרה בערך?", type: "open" },
    ],
    objections: [
      { trigger: "כבר טיפלתי בזה", response: "מצוין, לעיתים מגיע פיצוי נוסף, בדיקה נוספת לא מזיקה ובלי עלות." },
    ],
    closing: CLOSING_SOFT,
  },

  // ── כבלים / טריפל ─────────────────────────────────────────
  ...[
    { id: "476", co: "יס (YES)" },
    { id: "532", co: "הוט (HOT)" },
    { id: "563", co: "הוט (HOT)" },
    { id: "576", co: "הוט (HOT)" },
  ].map<ScriptDef>(({ id, co }) => ({
    interestId: id,
    intro: `היי {{first_name}}, השארת פרטים לגבי חבילת ${co} וביקשת שנחזור אליך, יש לך דקה?`,
    valueProp: `נשמח לבדוק עבורך חבילה משתלמת של ${co} שמתאימה לבית שלך.`,
    questions: [
      { text: "עם איזו חברה אתה היום?", type: "open" },
      { text: "מחפש לחסוך או לשדרג את החבילה?", type: "open" },
    ],
    objections: [
      { trigger: "אני בהתחייבות", response: "אין בעיה, נבדוק מתי מסתיימת ההתחייבות ונחזור בהתאם." },
    ],
    closing: CLOSING,
  })),

  // ── גיוס סוכנים ───────────────────────────────────────────
  ...["76", "545"].map<ScriptDef>((id) => ({
    interestId: id,
    intro: "היי {{first_name}}, התעניינת בעבודה כסוכן/ת מהבית וביקשת שנחזור אליך, נוח לדבר רגע?",
    valueProp: "אנחנו מציעים עבודה גמישה מהבית עם פוטנציאל הכנסה נאה, בלי ניסיון קודם.",
    questions: [
      { text: "אתה מחפש עבודה במשרה מלאה או הכנסה נוספת?", type: "open" },
      { text: "כמה שעות ביום פנויות לך בערך?", type: "number" },
    ],
    objections: [
      { trigger: "אין לי ניסיון", response: "לא צריך ניסיון, יש הדרכה וליווי מלא מההתחלה." },
    ],
    closing: CLOSING,
  })),

  // ── כתבות קידום ───────────────────────────────────────────
  {
    interestId: "547",
    intro: "היי {{first_name}}, פנית אלינו לגבי כתבות קידום לעסק וביקשת שנחזור אליך, יש לך רגע?",
    valueProp: "כתבת קידום ממוקדת מביאה לעסק שלך חשיפה ולקוחות חדשים.",
    questions: [
      { text: "איזה עסק יש לך?", type: "open" },
      { text: "מעוניין בעיקר בחשיפה או בפניות מלקוחות?", type: "open" },
    ],
    objections: [
      { trigger: "כמה זה עולה", response: "תלוי בהיקף, נציג יתאים לך חבילה לפי התקציב והמטרה." },
    ],
    closing: CLOSING,
  },

  // ── לימודים ───────────────────────────────────────────────
  ...["555", "559", "568"].map<ScriptDef>((id) => ({
    interestId: id,
    intro: "היי {{first_name}}, השארת פרטים בנושא לימודים וביקשת שנחזור אליך, נוח לדבר רגע?",
    valueProp: "אנחנו מסייעים למצוא את מסלול הלימודים שמתאים לך, מול המוסדות המובילים.",
    questions: [
      { text: "איזה תחום לימודים מעניין אותך?", type: "open" },
      { text: "מתי היית רוצה להתחיל ללמוד?", type: "open" },
    ],
    objections: [
      { trigger: "עדיין מתלבט", response: "בדיוק בשביל זה, נציג ייעץ לך בלי התחייבות ויעזור להחליט." },
    ],
    closing: CLOSING_SOFT,
  })),
];
