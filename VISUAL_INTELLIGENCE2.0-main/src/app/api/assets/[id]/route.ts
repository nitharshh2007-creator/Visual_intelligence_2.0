// ─────────────────────────────────────────────────────────────
// GET /api/assets/[id]?code=...&reg_no=...&slug=...&download=1
// ─────────────────────────────────────────────────────────────
// Same URL serves both "View" (default — inline, so a browser renders
// images/PDFs directly instead of saving them) and "Download"
// (?download=1 — Content-Disposition: attachment, forces a save).
// Signed-URL handoff for a private `stage-assets` file. Students have
// no Supabase Auth session (team identity is a localStorage
// code+reg_no pair — see stageAccess.ts), so there's no storage RLS
// policy that could ever grant them direct bucket access. Instead
// this re-runs the EXACT same gate the challenge tab's own data fetch
// already passed (get_stage_content — LOCKED/NOT_LIVE/ELIMINATED all
// refuse server-side, same as everywhere else) using the plain anon
// key, and only reaches for the service-role client (server-only,
// see supabase-service.ts) to mint a 60s signed URL once that
// check has independently confirmed the asset is really in this
// team's authorized list for this stage right now.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, type Database, type StageContentPayload } from "@/lib/supabase";
import { getServiceRoleClient } from "@/lib/supabase-service";

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const code = request.nextUrl.searchParams.get("code");
  const regNo = request.nextUrl.searchParams.get("reg_no");
  const slug = request.nextUrl.searchParams.get("slug");
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (!code || !regNo || !slug) {
    return NextResponse.json({ error: "Missing code, reg_no or slug" }, { status: 400 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const anon = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.rpc("get_stage_content", { p_code: code, p_reg_no: regNo, p_slug: slug });
  if (error || !data) {
    const code2 = (error as { code?: string } | null)?.code;
    const status = code2 === "VI021" || code2 === "VI022" || code2 === "VI020" ? 403 : 400;
    return NextResponse.json({ error: error?.message ?? "Could not load stage content" }, { status });
  }

  const payload = data as StageContentPayload;
  const asset = payload.assets.find((a) => a.id === assetId);
  if (!asset) {
    // Either the asset doesn't exist, or it isn't assigned to this
    // team — get_stage_content already filtered on assign_mode, so
    // "not in the list" and "doesn't exist" are indistinguishable on
    // purpose (never leak which one it was).
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  if (!asset.storage_path) {
    return NextResponse.json({ error: "This asset has no file to download" }, { status: 400 });
  }

  const service = getServiceRoleClient();
  const filename = asset.storage_path.split("/").pop() || "download";
  const { data: signed, error: signError } = await service.storage
    .from("stage-assets")
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS, download ? { download: filename } : undefined);

  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
