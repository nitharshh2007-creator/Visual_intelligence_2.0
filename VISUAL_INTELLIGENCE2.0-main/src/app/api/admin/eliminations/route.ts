import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceRoleClient } from "@/lib/supabase-service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", {});
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: {
    team_id: string;
    stage: number;
    reason: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { team_id, stage, reason } = body;

  if (!team_id || !stage || !reason) {
    return NextResponse.json({ error: "team_id, stage, and reason are required." }, { status: 400 });
  }

  try {
    const serviceClient: any = getServiceRoleClient();

    // 1. Update override note
    await serviceClient.from("team_stage_overrides").upsert({
      team_id,
      stage,
      allowed: false,
      note: reason.trim(),
    }, { onConflict: "team_id,stage" });

    // 2. If stage 2 or 3, also update shortlist note if present
    if (stage <= 2) {
      await serviceClient
        .from("shortlist")
        .update({ note: reason.trim() })
        .eq("team_id", team_id);
    }

    // 3. Log into admin_audit_log
    await serviceClient.from("admin_audit_log").insert({
      action: "elimination_reason_updated",
      detail: { team_id, stage, reason },
      admin_id: user.id,
    });

    return NextResponse.json({ ok: true, team_id, stage, reason });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
