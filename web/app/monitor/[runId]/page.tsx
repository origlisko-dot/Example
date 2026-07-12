import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getRunSnapshot } from "@/app/actions/run";
import { Monitor } from "./Monitor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID.test(runId)) notFound();

  const supabase = createServerClient();
  const { data: run } = await supabase
    .from("runs")
    .select("id, campaign_id, campaigns(name)")
    .eq("id", runId)
    .maybeSingle();

  if (!run) notFound();

  const campaignName = (run.campaigns as { name?: string } | null)?.name ?? "";
  const initial = await getRunSnapshot(runId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← לכל התחומים
      </Link>
      <header className="mt-6 mb-8">
        <p className="text-sm font-medium tracking-wide text-muted">הרצה חיה</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">{campaignName}</h1>
      </header>

      <Monitor runId={runId} campaignId={run.campaign_id as string} initial={initial} />
    </main>
  );
}
