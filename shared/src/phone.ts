/**
 * Israeli phone-number normalization to E.164 (+972…).
 *
 * Leads arrive from pelozen in local Israeli format (e.g. "054-545-4562",
 * "0545454562", "972545454562"). Everything downstream — dialing, dedup,
 * suppression lookups — keys on a single canonical form, so normalize once at
 * ingestion and never store anything else.
 */

const IL_COUNTRY_CODE = "972";

export class InvalidPhoneError extends Error {
  constructor(public readonly raw: string) {
    super(`Cannot normalize phone number to E.164: "${raw}"`);
    this.name = "InvalidPhoneError";
  }
}

/**
 * Normalize a raw Israeli number to E.164. Throws InvalidPhoneError when the
 * input cannot be confidently mapped — callers should treat that as "do not
 * dial" rather than guessing.
 */
export function normalizeIsraeliPhone(raw: string): string {
  if (!raw) throw new InvalidPhoneError(raw);

  // Keep a leading '+', drop every other non-digit (spaces, dashes, parens).
  let digits = raw.trim().replace(/(?!^\+)[^\d]/g, "");

  // Strip international prefixes: "+972…", "00972…", "972…".
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith(IL_COUNTRY_CODE)) {
    digits = digits.slice(IL_COUNTRY_CODE.length);
  } else if (digits.startsWith("0")) {
    // Local format: drop the trunk '0'.
    digits = digits.slice(1);
  }

  // After stripping, an Israeli subscriber number is 8–9 digits
  // (mobile 5XXXXXXXX = 9, most landlines = 8).
  if (!/^\d{8,9}$/.test(digits)) throw new InvalidPhoneError(raw);

  return `+${IL_COUNTRY_CODE}${digits}`;
}

/** True for Israeli mobile numbers (subscriber part starts with 5). */
export function isIsraeliMobile(e164: string): boolean {
  return /^\+9725\d{8}$/.test(e164);
}

/** Safe variant: returns null instead of throwing. */
export function tryNormalizeIsraeliPhone(raw: string): string | null {
  try {
    return normalizeIsraeliPhone(raw);
  } catch {
    return null;
  }
}

/** Mask to last 4 digits for UI display (privacy by default). */
export function maskPhone(e164: string): string {
  if (e164.length < 4) return "****";
  return `${"*".repeat(e164.length - 4)}${e164.slice(-4)}`;
}
