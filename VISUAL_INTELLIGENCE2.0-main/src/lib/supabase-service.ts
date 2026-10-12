// ─────────────────────────────────────────────────────────────
// Service-role Supabase client — Route Handlers ONLY
// ─────────────────────────────────────────────────────────────
// Never import this from a Client Component or anything in
// src/app/**/page.tsx|layout.tsx that runs during render — it reads
// SUPABASE_SERVICE_ROLE_KEY, which has no NEXT_PUBLIC_ prefix and must
// never reach the browser. Route Handlers (route.ts) run server-only
// and are the one place this key's full RLS bypass is appropriate:
// student requests have no Supabase Auth session to grant a storage
// policy to (team identity is a localStorage code+reg_no pair), so
// the only way to mint a signed URL for a private bucket on their
// behalf is to re-check authorization in application code first
// (the same get_stage_content()/stage_completion gate everything
// else uses) and only then reach for this client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, type Database } from "./supabase";

let client: SupabaseClient<Database> | null = null;

export function getServiceRoleClient(): SupabaseClient<Database> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (server-only env var, not NEXT_PUBLIC_).");
  }
  if (!client) {
    client = createClient<Database>(SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
