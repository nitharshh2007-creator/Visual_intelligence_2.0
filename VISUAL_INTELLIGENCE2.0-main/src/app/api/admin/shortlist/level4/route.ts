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
    finalist_team_ids: string[];
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { finalist_team_ids, notes } = body;

  if (!Array.isArray(finalist_team_ids)) {
    return NextResponse.json({ error: "finalist_team_ids array is required." }, { status: 400 });
  }

  try {
    const serviceClient: any = getServiceRoleClient();

    // 1. Ineligible-team protection: verify every finalist was approved in qualifiers after_stage = 3
    const { data: l3Qualifiers, error: qErr } = await serviceClient
      .from("qualifiers")
      .select("team_id")
      .eq("after_stage", 3);

    if (qErr) {
      throw new Error(`Failed to query qualifiers: ${qErr.message}`);
    }

    const qualifiedSet = new Set(((l3Qualifiers ?? []) as any[]).map((q: any) => q.team_id as string));
    const illegalTeam = finalist_team_ids.find((id) => !qualifiedSet.has(id));

    if (illegalTeam) {
      return NextResponse.json(
        { error: "Security violation: Only teams shortlisted from Level 3 can be approved for Level 4." },
        { status: 403 }
      );
    }

    // 2. Update team overrides for Prompt Charades finalists
    for (const teamId of finalist_team_ids) {
      await serviceClient.from("team_stage_overrides").upsert({
        team_id: teamId,
        stage: 4,
        allowed: true,
        note: notes || "Approved Level 4 Finalist for Prompt Charades",
      }, { onConflict: "team_id,stage" });
    }

    // 3. Record audit log
    await serviceClient.from("admin_audit_log").insert({
      action: "level4_finalists_confirmed",
      detail: {
        finalist_count: finalist_team_ids.length,
        finalist_teams: finalist_team_ids,
        notes: notes ?? null,
      },
      admin_id: user.id,
    });

    return NextResponse.json({
      ok: true,
      confirmed_count: finalist_team_ids.length,
      finalist_teams: finalist_team_ids,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
