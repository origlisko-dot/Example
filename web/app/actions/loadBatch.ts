"use server";

import { parsePastedLeads, maskPhone } from "@pelozen/shared";
import { createServerClient } from "@/lib/supabase/server";
import { phoneHash } from "@/lib/hash";

export type ItemStatus = "ready" | "suppressed" | "invalid";

export interface PreviewItem {
  label: string; // masked phone, or the raw bad row for invalid
  status: ItemStatus;
  reason?: string;
}

export interface BatchPreview {
  items: PreviewItem[];
  counts: { ready: number; suppressed: number; invalid: number };
}

/**
 * Parse a pasted/uploaded batch (max 20), check each number against the
 * suppression list, and persist the survivors as leads — each with a
 * pelozen-callback consent record (the legal backbone). Returns a preview the
 * operator sees before starting the run.
 */
export async function loadBatch(campaignId: string, text: string): Promise<BatchPreview> {
  const supabase = createServerClient();
  const { leads, rejected } = parsePastedLeads(text, campaignId, 20);

  const items: PreviewItem[] = [];
  let ready = 0;
  let suppressed = 0;

  for (const lead of leads) {
    const { data: sup } = await supabase
      .from("suppression_list")
      .select("phone_e164")
      .eq("phone_e164", lead.phoneE164)
      .maybeSingle();

    if (sup) {
      items.push({ label: maskPhone(lead.phoneE164), status: "suppressed", reason: "ברשימת חסומים" });
      suppressed++;
      continue;
    }

    // Every pelozen lead carries documented callback consent. Reuse the
    // existing consent record if the lead was loaded before, so we don't create
    // duplicates on re-load.
    const { data: existing } = await supabase
      .from("leads")
      .select("consent_record_id")
      .eq("phone_e164", lead.phoneE164)
      .maybeSingle();

    let consentId = (existing?.consent_record_id as string | null) ?? null;
    if (!consentId) {
      const { data: consent } = await supabase
        .from("consent_records")
        .insert({ phone_e164: lead.phoneE164, source: "pelozen_callback" })
        .select("id")
        .single();
      consentId = (consent?.id as string | undefined) ?? null;
    }

    await supabase.from("leads").upsert(
      {
        campaign_id: campaignId,
        phone_e164: lead.phoneE164,
        phone_hash: phoneHash(lead.phoneE164),
        first_name: lead.firstName ?? null,
        fields: lead.fields,
        status: "new",
        source: "csv",
        consent_record_id: consentId,
      },
      { onConflict: "phone_e164" },
    );

    items.push({ label: maskPhone(lead.phoneE164), status: "ready" });
    ready++;
  }

  for (const r of rejected) {
    items.push({ label: r.raw, status: "invalid", reason: r.reason });
  }

  return { items, counts: { ready, suppressed, invalid: rejected.length } };
}
