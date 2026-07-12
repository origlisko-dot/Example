import { createHmac } from "node:crypto";

/**
 * Deterministic HMAC of a phone number, used as the dedup / suppression lookup
 * key so the raw number doesn't have to be exposed everywhere. Server-side only
 * (lives in the orchestrator, not in @pelozen/shared which the web bundle imports).
 */
export function createPhoneHash(phoneE164: string, secret: string): string {
  return createHmac("sha256", secret).update(phoneE164).digest("hex");
}
