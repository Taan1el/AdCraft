// Supabase singleton. Returns null when env vars are missing so the rest of
// the app can run without auth (heuristic-only, no history).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    cached = null;
    return null;
  }
  cached = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cached;
}

export function isAuthEnabled(): boolean {
  return getSupabase() !== null;
}
