"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveCampaign,
  type CampaignScriptInput,
  type QuestionInput,
  type ObjectionInput,
} from "@/app/actions/saveCampaign";

const QUESTION_TYPES: { value: QuestionInput["type"]; label: string }[] = [
  { value: "yesno", label: "כן / לא" },
  { value: "open", label: "פתוחה" },
  { value: "number", label: "מספר" },
];

const fieldClass =
  "mt-1 w-full rounded-xl border border-line bg-paper p-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function CampaignEditor({ initial }: { initial: CampaignScriptInput }) {
  const [v, setV] = useState<CampaignScriptInput>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = <K extends keyof CampaignScriptInput>(k: K, val: CampaignScriptInput[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setSaved(false);
  };

  function addQuestion() {
    set("qualifyingQuestions", [
      ...v.qualifyingQuestions,
      { id: `q${Date.now()}`, text: "", type: "yesno" },
    ]);
  }
  function addObjection() {
    set("objectionHandlers", [...v.objectionHandlers, { trigger: "", response: "" }]);
  }
  function onSave() {
    start(async () => {
      const { ok } = await saveCampaign(v);
      setSaved(ok);
      if (ok) router.refresh();
    });
  }

  return (
    <div className="space-y-8 pb-24">
      <Section title="פתיחה" hint="המשפט הראשון שהבוט אומר. אפשר {{first_name}} לשם הלקוח.">
        <textarea rows={2} className={fieldClass} value={v.introScript}
          onChange={(e) => set("introScript", e.target.value)} />
      </Section>

      <Section title="הצעת ערך" hint="מה אנחנו מציעים, במשפט-שניים.">
        <textarea rows={2} className={fieldClass} value={v.valueProp}
          onChange={(e) => set("valueProp", e.target.value)} />
      </Section>

      <Section title="שאלות סינון" hint="השאלות שהבוט שואל כדי להבין אם הליד רלוונטי, לפי הסדר.">
        <div className="space-y-3">
          {v.qualifyingQuestions.map((q, i) => (
            <div key={q.id} className="flex gap-2">
              <input className={`${fieldClass} mt-0 flex-1`} placeholder="טקסט השאלה" value={q.text}
                onChange={(e) => {
                  const next = [...v.qualifyingQuestions];
                  next[i] = { ...q, text: e.target.value };
                  set("qualifyingQuestions", next);
                }} />
              <select className={`${fieldClass} mt-0 w-32`} value={q.type}
                onChange={(e) => {
                  const next = [...v.qualifyingQuestions];
                  next[i] = { ...q, type: e.target.value as QuestionInput["type"] };
                  set("qualifyingQuestions", next);
                }}>
                {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="button" aria-label="מחק" className="px-3 text-danger hover:opacity-70"
                onClick={() => set("qualifyingQuestions", v.qualifyingQuestions.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addQuestion} className="text-sm font-medium text-accent hover:underline">
            + הוסף שאלה
          </button>
        </div>
      </Section>

      <Section title="התנגדויות ותשובות" hint="אם הלקוח אומר X — הבוט עונה Y.">
        <div className="space-y-3">
          {v.objectionHandlers.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${fieldClass} mt-0 w-1/3`} placeholder="ההתנגדות" value={o.trigger}
                onChange={(e) => {
                  const next = [...v.objectionHandlers];
                  next[i] = { ...o, trigger: e.target.value };
                  set("objectionHandlers", next);
                }} />
              <input className={`${fieldClass} mt-0 flex-1`} placeholder="התשובה" value={o.response}
                onChange={(e) => {
                  const next = [...v.objectionHandlers];
                  next[i] = { ...o, response: e.target.value };
                  set("objectionHandlers", next);
                }} />
              <button type="button" aria-label="מחק" className="px-3 text-danger hover:opacity-70"
                onClick={() => set("objectionHandlers", v.objectionHandlers.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addObjection} className="text-sm font-medium text-accent hover:underline">
            + הוסף התנגדות
          </button>
        </div>
      </Section>

      <Section title="סגירה" hint="איך הבוט מסיים את השיחה.">
        <textarea rows={2} className={fieldClass} value={v.closingScript}
          onChange={(e) => set("closingScript", e.target.value)} />
      </Section>

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={v.status === "active"}
              onChange={(e) => set("status", e.target.checked ? "active" : "draft")} />
            מסומן כמוכן להרצה
          </label>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-ok">נשמר ✓</span>}
            <button type="button" onClick={onSave} disabled={pending}
              className="rounded-xl bg-accent px-8 py-2.5 font-medium text-accent-ink transition-opacity disabled:opacity-40">
              {pending ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mb-2 text-sm text-muted">{hint}</p>
      {children}
    </section>
  );
}
