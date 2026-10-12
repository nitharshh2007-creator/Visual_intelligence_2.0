// Gates /admin/* on having a signed-in Supabase session. This is the
// first line of defense (keeps a logged-out browser from even loading
// admin page JS); the real authorization is is_admin() on every RPC
// (supabase/migrations/0003_admin_control_room.sql) — a signed-in but
// non-admin user still can't do anything, this proxy just saves them
// the redirect-after-mount round trip.
//
// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`
// (same behavior, new name/export) — see node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/proxy.md.
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase-server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(request, response);

  // No Supabase configured at all (e.g. local dev on the mock) — let
  // the admin layout's own client-side check handle messaging instead
  // of redirecting into a login page that can't work anyway.
  if (!supabase) return response;

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
