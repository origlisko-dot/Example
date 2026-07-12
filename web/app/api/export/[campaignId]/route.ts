import { createServerClient } from "@/lib/supabase/server";

interface ExportRow {
  disposition: string;
  created_at: string;
  callback_at: string | null;
  leads: { phone_e164: string; first_name: string | null } | null;
}

const HEBREW_DISPO: Record<string, string> = {
  qualified_for_human: "מתאים לנציג",
  interested: "מעוניין",
  callback_later: "לחזור מאוחר יותר",
  not_relevant: "לא רלוונטי",
  no_answer: "אין מענה",
  opted_out: "ביקש הסרה",
  wrong_number: "מספר שגוי",
  failed: "נכשל",
};

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Export the campaign's outcomes as CSV — full phone numbers, for handing the
 *  qualified leads to human reps. */
export async function GET(_req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const supabase = createServerClient();

  const { data } = await supabase
    .from("outcomes")
    .select("disposition, created_at, callback_at, leads!inner(phone_e164, first_name, campaign_id)")
    .eq("leads.campaign_id", campaignId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as ExportRow[];

  const header = ["טלפון", "שם", "תוצאה", "זמן חזרה", "תאריך"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.leads?.phone_e164 ?? ""),
      csvCell(r.leads?.first_name ?? ""),
      csvCell(HEBREW_DISPO[r.disposition] ?? r.disposition),
      csvCell(r.callback_at ?? ""),
      csvCell(r.created_at),
    ].join(","));
  }
  // BOM so Excel reads Hebrew/UTF-8 correctly.
  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-${campaignId}.csv"`,
    },
  });
}
