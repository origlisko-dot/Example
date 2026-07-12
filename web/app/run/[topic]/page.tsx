import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { LoadBatch } from "./LoadBatch";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RunPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: campaignId } = await params;
  if (!UUID.test(campaignId)) notFound();

  const supabase = createServerClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, status, pelozen_topic_ref")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← לכל התחומים
      </Link>

      <header className="mt-6 mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-wide text-muted">תחום נבחר</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{campaign.name as string}</h1>
          {campaign.status !== "active" && (
            <p className="mt-2 text-sm text-warn">טיוטה — מומלץ להשלים תסריט לפני הרצה אמיתית.</p>
          )}
        </div>
        <Link
          href={`/campaigns/${campaign.id}/edit`}
          className="shrink-0 rounded-xl border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface"
        >
          ערוך תסריט
        </Link>
      </header>

      <LoadBatch
        campaignId={campaign.id as string}
        interestId={(campaign.pelozen_topic_ref as string | null) ?? ""}
      />
    </main>
  );
}
