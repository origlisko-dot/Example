import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
}

export default async function TopicPicker() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  const campaigns = (data ?? []) as CampaignRow[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-wide text-muted">חייגן פלוזן</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">באיזה תחום מתחילים היום?</h1>
        <p className="mt-2 max-w-prose text-muted">
          בחר תחום, ואז נטען מנה של 20 לידים ונתחיל לחייג אחד-אחד.
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-danger">
          שגיאה בטעינת התחומים: {error.message}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/run/${c.id}`}
              className="group flex h-full items-start gap-4 bg-paper px-5 py-6 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="mt-0.5 text-lg font-semibold tabular-nums text-muted transition-colors group-hover:text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-medium leading-snug text-ink">{c.name}</span>
                <span className="mt-1 text-sm text-muted">
                  {c.status === "active" ? "מוכן להרצה" : "טיוטה — חסר תסריט"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
