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
    points: number;
    note?: string;
    criteria?: Record<string, number>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { team_id, stage, points, note, criteria } = body;

  if (!team_id || stage < 1 || stage > 4 || points == null || points < 0) {
    return NextResponse.json({ error: "Invalid team_id, stage (1-4), or points." }, { status: 400 });
  }

  try {
    const serviceClient: any = getServiceRoleClient();

    // 1. Upsert score row
    await serviceClient.from("scores").upsert({
      team_id,
      stage,
      points,
      detail: criteria ? { criteria, note: note || null } : (note ? { note } : null),
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,stage" });

    // 2. Insert into score_audit
    await serviceClient.from("score_audit").insert({
      team_id,
      stage,
      new_points: points,
      note: note || (criteria ? JSON.stringify(criteria) : null),
      admin_id: user.id,
    });

    return NextResponse.json({ ok: true, team_id, stage, points });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
