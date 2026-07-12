import { maskPhone, type RawLead } from "@pelozen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPhoneHash } from "./util/hash.js";

/**
 * Persist scraped/raw leads for a campaign: skip suppressed numbers, attach a
 * pelozen-callback consent record (reusing an existing one), and upsert. Mirrors
 * the panel's CSV load path so both sources land identically.
 */
export interface IngestResult {
  ready: number;
  suppressed: number;
  items: { label: string; status: "ready" | "suppressed" }[];
}

export async function ingestLeads(
  db: SupabaseClient,
  campaignId: string,
  leads: RawLead[],
  phoneHashSecret: string,
): Promise<IngestResult> {
  const items: IngestResult["items"] = [];
  let ready = 0;
  let suppressed = 0;

  for (const lead of leads) {
    const { data: sup } = await db
      .from("suppression_list").select("phone_e164").eq("phone_e164", lead.phoneE164).maybeSingle();
    if (sup) {
      items.push({ label: maskPhone(lead.phoneE164), status: "suppressed" });
      suppressed++;
      continue;
    }

    const { data: existing } = await db
      .from("leads").select("consent_record_id").eq("phone_e164", lead.phoneE164).maybeSingle();
    let consentId = (existing?.consent_record_id as string | null) ?? null;
    if (!consentId) {
      const { data: c } = await db
        .from("consent_records").insert({ phone_e164: lead.phoneE164, source: "pelozen_callback" }).select("id").single();
      consentId = (c?.id as string | undefined) ?? null;
    }

    await db.from("leads").upsert(
      {
        campaign_id: campaignId,
        phone_e164: lead.phoneE164,
        phone_hash: createPhoneHash(lead.phoneE164, phoneHashSecret),
        first_name: lead.firstName ?? null,
        fields: lead.fields,
        status: "new",
        source: "scraper",
        consent_record_id: consentId,
      },
      { onConflict: "phone_e164" },
    );
    items.push({ label: maskPhone(lead.phoneE164), status: "ready" });
    ready++;
  }

  return { ready, suppressed, items };
}
