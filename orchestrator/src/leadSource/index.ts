import type { RawLead } from "@pelozen/shared";

/**
 * One internal contract so the rest of the system never knows where leads came
 * from. Swapping CSV ↔ scraper ↔ (future) pelozen API is a config flip, not a
 * rewrite.
 */
export interface LeadSource {
  readonly kind: "csv" | "scraper" | "api";
  /** Fetch up to `count` leads for a topic, normalized and deduped. */
  loadBatch(topicRef: string, count: number): Promise<LoadResult>;
}

export interface LoadResult {
  leads: RawLead[];
  /** raw rows that could not be normalized to a valid phone — surfaced, not hidden */
  rejected: { raw: string; reason: string }[];
}

export { CsvUploadSource } from "./csvUploadSource.js";
export { PelozenScraperSource } from "./pelozenScraperSource.js";
