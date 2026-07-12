"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { loadBatch, type BatchPreview, type ItemStatus } from "@/app/actions/loadBatch";
import { startRun } from "@/app/actions/run";

const CHIP: Record<ItemStatus, string> = {
  ready: "text-ok",
  suppressed: "text-warn",
  invalid: "text-danger",
};
const CHIP_LABEL: Record<ItemStatus, string> = {
  ready: "מוכן",
  suppressed: "חסום",
  invalid: "לא תקין",
};

export function LoadBatch({ campaignId, interestId }: { campaignId: string; interestId: string }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [pending, startTransition] = useTransition();
  const [scraping, startScrapeTransition] = useTransition();
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [starting, startRunTransition] = useTransition();
  const router = useRouter();

  function onScrape() {
    setScrapeError(null);
    startScrapeTransition(async () => {
      try {
        const base = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL;
        const res = await fetch(`${base}/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, interestId, count: 20 }),
        });
        if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
        const data = await res.json();
        setPreview({
          items: data.items ?? [],
          counts: { ready: data.ready ?? 0, suppressed: data.suppressed ?? 0, invalid: data.invalid ?? 0 },
        });
      } catch (e) {
        setScrapeError(
          `טעינה מ-pelozen נכשלה: ${(e as Error).message}. ודא שה-orchestrator רץ, או הדבק ידנית.`,
        );
      }
    });
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  }

  function onLoad() {
    startTransition(async () => setPreview(await loadBatch(campaignId, text)));
  }

  function onStart() {
    startRunTransition(async () => {
      const { runId } = await startRun(campaignId);
      router.push(`/monitor/${runId}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <label htmlFor="leads" className="block text-sm font-medium text-ink">
          הדבק עד 20 מספרים (אחד בשורה), או העלה קובץ CSV
        </label>
        <textarea
          id="leads"
          dir="ltr"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"054-545-4562\n050-123-4567\n..."}
          className="mt-2 w-full rounded-xl border border-line bg-paper p-3 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <input type="file" accept=".csv,.txt" onChange={onFile} className="text-sm text-muted" />
          <button
            type="button"
            onClick={onLoad}
            disabled={pending || text.trim().length === 0}
            className="rounded-xl bg-accent px-6 py-2.5 font-medium text-accent-ink transition-opacity disabled:opacity-40"
          >
            {pending ? "טוען..." : "טען לידים"}
          </button>
        </div>

        {interestId && (
          <div className="mt-4 border-t border-line pt-4">
            <button
              type="button"
              onClick={onScrape}
              disabled={scraping}
              className="w-full rounded-xl border border-accent px-6 py-2.5 font-medium text-accent transition-colors hover:bg-accent/5 disabled:opacity-40"
            >
              {scraping ? "מושך מ-pelozen..." : "טען 20 לידים מ-pelozen אוטומטית"}
            </button>
            {scrapeError && <p className="mt-2 text-sm text-danger">{scrapeError}</p>}
          </div>
        )}
      </div>

      {preview && (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-ok">מוכנים: {preview.counts.ready}</span>
            <span className="text-warn">חסומים: {preview.counts.suppressed}</span>
            <span className="text-danger">לא תקינים: {preview.counts.invalid}</span>
          </div>
          <ul className="divide-y divide-line">
            {preview.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span dir="ltr" className="font-mono text-ink">{item.label}</span>
                <span className={CHIP[item.status]}>
                  {CHIP_LABEL[item.status]}
                  {item.reason ? ` · ${item.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onStart}
            disabled={starting || preview.counts.ready === 0}
            className="mt-6 w-full rounded-xl bg-accent px-6 py-3 font-medium text-accent-ink transition-opacity disabled:opacity-40"
          >
            {starting ? "מתחיל..." : `התחל חיוג (${preview.counts.ready})`}
          </button>
        </div>
      )}
    </div>
  );
}
