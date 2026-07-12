import "server-only";
import { createHmac } from "node:crypto";

/** Must match the orchestrator's createPhoneHash so suppression lookups align. */
export function phoneHash(phoneE164: string): string {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret) throw new Error("Missing PHONE_HASH_SECRET");
  return createHmac("sha256", secret).update(phoneE164).digest("hex");
}
