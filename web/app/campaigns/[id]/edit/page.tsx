import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CampaignEditor } from "./CampaignEditor";
import type { CampaignScriptInput, QuestionInput, ObjectionInput } from "@/app/actions/saveCampaign";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = createServerClient();
  const { data: c } = await supabase
    .from("campaigns")
    .select("id, name, status, intro_script, value_prop, qualifying_questions, objection_handlers, closing_script")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const initial: CampaignScriptInput = {
    id: c.id as string,
    status: c.status === "active" ? "active" : "draft",
    introScript: (c.intro_script as string) ?? "",
    valueProp: (c.value_prop as string) ?? "",
    qualifyingQuestions: ((c.qualifying_questions as QuestionInput[]) ?? []).map((q, i) => ({
      id: q.id ?? `q${i}`,
      text: q.text ?? "",
      type: q.type ?? "yesno",
    })),
    objectionHandlers: ((c.objection_handlers as ObjectionInput[]) ?? []).map((o) => ({
      trigger: o.trigger ?? "",
      response: o.response ?? "",
    })),
    closingScript: (c.closing_script as string) ?? "",
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/run/${c.id}`} className="text-sm text-muted hover:text-accent">← חזרה לתחום</Link>
      <header className="mt-6 mb-8">
        <p className="text-sm font-medium tracking-wide text-muted">עריכת תסריט</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">{c.name as string}</h1>
      </header>
      <CampaignEditor initial={initial} />
    </main>
  );
}
