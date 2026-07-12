import { normalizeIsraeliPhone, InvalidPhoneError } from "./phone.js";
import type { RawLead } from "./types/lead.js";

/**
 * Pure parser for pasted / uploaded lead lists. Shared by the orchestrator's
 * CsvUploadSource and the panel's load-batch action so there is ONE parsing
 * implementation. Accepts a CSV with a phone column (phone/טלפון/נייד/…) and
 * optional name/extra fields, OR a bare list of numbers.
 */
export interface ParseResult {
  leads: RawLead[];
  rejected: { raw: string; reason: string }[];
}

export function parsePastedLeads(rawText: string, topicRef: string, max = Infinity): ParseResult {
  const leads: RawLead[] = [];
  const rejected: ParseResult["rejected"] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { leads, rejected };

  const { header, dataLines } = detectHeader(lines);

  for (const line of dataLines) {
    if (leads.length >= max) break;
    const cells = splitRow(line);

    let phoneRaw: string | undefined;
    let firstName: string | undefined;
    const fields: Record<string, string> = {};

    if (header) {
      for (let i = 0; i < header.length; i++) {
        const col = header[i]!;
        const val = (cells[i] ?? "").trim();
        if (isPhoneColumn(col)) phoneRaw = val;
        else if (isNameColumn(col)) firstName = val || undefined;
        else if (val) fields[col] = val;
      }
    } else {
      phoneRaw = cells.find((c) => /\d{7,}/.test(c)) ?? cells[0];
    }

    if (!phoneRaw) { rejected.push({ raw: line, reason: "no phone cell" }); continue; }

    try {
      const phoneE164 = normalizeIsraeliPhone(phoneRaw);
      if (seen.has(phoneE164)) continue;
      seen.add(phoneE164);
      leads.push({ phoneE164, firstName, fields, topicRef, sourceRef: undefined, fetchedAt: now });
    } catch (e) {
      rejected.push({ raw: line, reason: e instanceof InvalidPhoneError ? "invalid phone" : "parse error" });
    }
  }

  return { leads, rejected };
}

function splitRow(line: string): string[] {
  return line.split(/[,;\t]/).map((c) => c.trim());
}

function detectHeader(lines: string[]): { header: string[] | null; dataLines: string[] } {
  const first = splitRow(lines[0]!);
  const looksLikeHeader = first.some((c) => isPhoneColumn(c) || isNameColumn(c));
  return looksLikeHeader
    ? { header: first.map((c) => c.toLowerCase()), dataLines: lines.slice(1) }
    : { header: null, dataLines: lines };
}

function isPhoneColumn(c: string): boolean {
  return /phone|tel|mobile|טלפון|נייד|פלאפון|מספר/i.test(c);
}
function isNameColumn(c: string): boolean {
  return /name|שם|לקוח/i.test(c);
}
