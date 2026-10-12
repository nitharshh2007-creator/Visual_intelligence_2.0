// ─────────────────────────────────────────────────────────────
// Supabase server client (middleware / server components only)
// ─────────────────────────────────────────────────────────────
// Still the anon key — never the service_role key. This exists only
// so middleware.ts can read the auth cookie @supabase/ssr's browser
// client writes, to redirect signed-out users before any admin page
// code runs. The actual is_admin() check still happens via the normal
// RPC (RLS/SECURITY DEFINER do the real enforcement either way).

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, type Database } from "./supabase";

export async function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase env vars");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

export function createMiddlewareSupabaseClient(request: NextRequest, response: NextResponse) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
