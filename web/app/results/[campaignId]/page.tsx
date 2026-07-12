import Link from "next/link";
import { notFound } from "next/navigation";
import { maskPhone } from "@pelozen/shared";
import { createServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

interface OutcomeRow {
  disposition: string;
  created_at: string;
  leads: { phone_e164: string; first_name: string | null } | null;
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  if (!UUID.test(campaignId)) notFound();

  const supabase = createServerClient();
  const { data: campaign } = await supabase.from("campaigns").select("name").eq("id", campaignId).maybeSingle();
  if (!campaign) notFound();

  const { data } = await supabase
    .from("outcomes")
    .select("disposition, created_at, leads!inner(phone_e164, first_name, campaign_id)")
    .eq("leads.campaign_id", campaignId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as OutcomeRow[];
  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.disposition] = (tally[r.disposition] ?? 0) + 1;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-accent">← לכל התחומים</Link>

      <header className="mt-6 mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-wide text-muted">תוצאות</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{campaign.name as string}</h1>
        </div>
        {rows.length > 0 && (
          <a
            href={`/api/export/${campaignId}`}
            className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink"
          >ייצוא CSV</a>
        )}
      </header>

      {Object.keys(tally).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border border-line bg-surface px-6 py-4 text-sm">
          {Object.entries(tally).map(([d, n]) => (
            <span key={d} className={DISPO[d]?.tone ?? "text-muted"}>{DISPO[d]?.label ?? d}: {n}</span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted">עדיין אין תוצאות לתחום הזה.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">טלפון</th>
                <th className="px-5 py-3 font-medium">שם</th>
                <th className="px-5 py-3 font-medium">תוצאה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-paper">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td dir="ltr" className="px-5 py-3 text-right font-mono text-ink">
                    {r.leads ? maskPhone(r.leads.phone_e164) : "—"}
                  </td>
                  <td className="px-5 py-3 text-ink">{r.leads?.first_name ?? "—"}</td>
                  <td className={`px-5 py-3 ${DISPO[r.disposition]?.tone ?? "text-muted"}`}>
                    {DISPO[r.disposition]?.label ?? r.disposition}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
