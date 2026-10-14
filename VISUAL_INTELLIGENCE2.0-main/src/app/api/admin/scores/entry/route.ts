import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceRoleClient } from "@/lib/supabase-service";
import { saveScoreEntry, supabaseScoreStore, type ScoreEntryRequest } from "@/lib/scoreEntry";

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

  let body: ScoreEntryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    // Validates every criterion and the total (0–25), checks Level 3/4
    // eligibility, verifies each database write and keeps score_audit in step.
    const result = await saveScoreEntry(supabaseScoreStore(getServiceRoleClient()), body, user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
