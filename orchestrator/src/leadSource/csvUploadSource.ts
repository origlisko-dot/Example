import { parsePastedLeads } from "@pelozen/shared";
import type { LeadSource, LoadResult } from "./index.js";

/**
 * The guaranteed-to-work lead source: the operator pastes the 20 numbers (or
 * uploads a CSV) and we parse them. Built first so the pilot never blocks on
 * the fragile scraper. Parsing itself lives in @pelozen/shared so the panel's
 * load-batch action and this source share one implementation.
 */
export class CsvUploadSource implements LeadSource {
  readonly kind = "csv" as const;

  constructor(private readonly rawText: string, private readonly topicRef: string) {}

  async loadBatch(_topicRef: string, count: number): Promise<LoadResult> {
    return parsePastedLeads(this.rawText, this.topicRef, count);
  }
}
