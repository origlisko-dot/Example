"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  getRunSnapshot, setRunState, simulateNextCall,
  type RunSnapshot, type RunState,
} from "@/app/actions/run";

const DISPO: Record<string, { label: string; tone: string }> = {
  qualified_for_human: { label: "מתאים לנציג", tone: "text-ok" },
  interested: { label: "מעוניין", tone: "text-ok" },
  callback_later: { label: "לחזור מאוחר יותר", tone: "text-warn" },
  not_relevant: { label: "לא רלוונטי", tone: "text-muted" },
  no_answer: { label: "אין מענה", tone: "text-muted" },
  opted_out: { label: "ביקש הסרה", tone: "text-danger" },
  wrong_number: { label: "מספר שגוי", tone: "text-muted" },
  failed: { label: "נכשל", tone: "text-danger" },
};

const STATE_LABEL: Record<RunState, string> = {
  running: "פעיל", paused: "מושהה", stopped: "נעצר", done: "הסתיים",
};

export function Monitor({
  runId, campaignId, initial,
}: {
  runId: string;
  campaignId: string;
  initial: RunSnapshot;
}) {
  const [snap, setSnap] = useState<RunSnapshot>(initial);
  const [pending, startTransition] = useTransition();

  // Poll for updates (Supabase Realtime is the upgrade once auth lands).
  useEffect(() => {
    const id = setInterval(async () => {
      if (snap.state === "running") setSnap(await getRunSnapshot(runId));
    }, 3000);
    return () => clearInterval(id);
  }, [runId, snap.state]);

  function changeState(state: RunState) {
    startTransition(async () => {
      await setRunState(runId, state);
      setSnap(await getRunSnapshot(runId));
    });
  }
  function simulate() {
    startTransition(async () => setSnap(await simulateNextCall(runId)));
  }

  const { counts, dispositions, feed, state } = snap;
  const progress = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* controls */}
      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-6 py-4">
        <span className="text-sm text-muted">
          מצב: <span className="font-medium text-ink">{STATE_LABEL[state]}</span>
        </span>
        <div className="flex gap-2">
          <button
            type="button" onClick={() => changeState("running")} disabled={pending || state === "running"}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-paper disabled:opacity-40"
          >המשך</button>
          <button
            type="button" onClick={() => changeState("paused")} disabled={pending || state !== "running"}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-paper disabled:opacity-40"
          >השהה</button>
          <button
            type="button" onClick={() => changeState("stopped")} disabled={pending || state === "stopped"}
            className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/5 disabled:opacity-40"
          >עצור</button>
        </div>
      </div>

      {/* progress */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">התקדמות</span>
          <span className="text-sm text-ink">{counts.done} מתוך {counts.total}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">{counts.queued} בתור</p>
      </div>

      {/* dispositions tally */}
      {Object.keys(dispositions).length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border border-line bg-surface px-6 py-4 text-sm">
          {Object.entries(dispositions).map(([d, n]) => (
            <span key={d} className={DISPO[d]?.tone ?? "text-muted"}>
              {DISPO[d]?.label ?? d}: {n}
            </span>
          ))}
        </div>
      )}

      {/* live feed */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">תוצאות אחרונות</span>
          <Link href={`/results/${campaignId}`} className="text-sm text-accent hover:underline">
            כל התוצאות ←
          </Link>
        </div>
        {feed.length === 0 ? (
          <p className="text-sm text-muted">עדיין אין שיחות שהושלמו.</p>
        ) : (
          <ul className="divide-y divide-line">
            {feed.map((f, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span dir="ltr" className="font-mono text-ink">{f.phone}</span>
                <span className={DISPO[f.disposition]?.tone ?? "text-muted"}>
                  {DISPO[f.disposition]?.label ?? f.disposition}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* dev-only simulation (until telephony is wired) */}
      <div className="rounded-2xl border border-dashed border-line bg-paper p-4 text-center">
        <p className="mb-2 text-xs text-muted">בדיקה (עד חיווט טלפוניה): הדמיית השיחה הבאה</p>
        <button
          type="button" onClick={simulate} disabled={pending || counts.queued === 0}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-40"
        >סמלץ שיחה ({counts.queued})</button>
      </div>
    </div>
  );
}
