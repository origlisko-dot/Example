import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the SERVICE-ROLE key. Bypasses RLS, so it
 * must NEVER be imported into a client component — the `server-only` guard above
 * makes that a build error. Auth (Supabase Auth) will gate the panel before it
 * is exposed; until then this is the single data path for server components and
 * server actions.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env");
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}
