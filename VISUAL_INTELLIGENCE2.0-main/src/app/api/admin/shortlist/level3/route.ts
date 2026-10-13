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
    selected_team_ids: string[];
    target_quota?: number;
    unselected_reasons?: Record<string, string>;
    confirmed_warning?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { selected_team_ids, target_quota = 10, unselected_reasons = {}, confirmed_warning = false } = body;

  if (!Array.isArray(selected_team_ids)) {
    return NextResponse.json({ error: "selected_team_ids array is required." }, { status: 400 });
  }

  // Warning check if selected count doesn't match target
  if (selected_team_ids.length !== target_quota && !confirmed_warning) {
    return NextResponse.json(
      {
        warning: true,
        message: `Selected ${selected_team_ids.length} team(s), but target is ${target_quota}. Explicit confirmation required.`,
        selected_count: selected_team_ids.length,
        target_quota,
      },
      { status: 422 }
    );
  }

  try {
    const serviceClient: any = getServiceRoleClient();

    // 1. Verify that all selected teams are eligible for Level 3
    // Level 3 eligible teams must be in shortlist with decision = 'shortlisted'
    const [eligibleRes, scoresRes] = await Promise.all([
      serviceClient
        .from("shortlist")
        .select("team_id, decision")
        .eq("decision", "shortlisted"),
      serviceClient
        .from("scores")
        .select("team_id, stage, points"),
    ]);

    const eligibleSet = new Set(((eligibleRes.data ?? []) as any[]).map((row: any) => row.team_id as string));
    const invalidSelection = selected_team_ids.find((id) => !eligibleSet.has(id));

    if (invalidSelection) {
      return NextResponse.json(
        { error: "One or more selected teams are not eligible for Level 3 shortlisting." },
        { status: 400 }
      );
    }

    // Calculate score rankings for qualifiers record
    const teamTotalScores = new Map<string, number>();
    for (const sc of ((scoresRes.data ?? []) as any[])) {
      const prev = teamTotalScores.get(sc.team_id) ?? 0;
      teamTotalScores.set(sc.team_id, prev + Number(sc.points));
    }

    // Sort selected teams by total score descending to assign rank
    const sortedSelected = [...selected_team_ids].sort((a, b) => {
      const scoreA = teamTotalScores.get(a) ?? 0;
      const scoreB = teamTotalScores.get(b) ?? 0;
      return scoreB - scoreA;
    });

    // 2. Clear existing qualifiers for after_stage = 3
    await serviceClient.from("qualifiers").delete().eq("after_stage", 3);

    // 3. Insert newly qualified teams into qualifiers
    const qualifierRows = sortedSelected.map((teamId, idx) => ({
      team_id: teamId,
      after_stage: 3,
      rank_at_cut: idx + 1,
      total_at_cut: teamTotalScores.get(teamId) ?? 0,
      applied_by: user.id,
      applied_at: new Date().toISOString(),
    }));

    if (qualifierRows.length > 0) {
      const { error: insErr } = await serviceClient.from("qualifiers").insert(qualifierRows);
      if (insErr) {
        throw new Error(`Failed to save qualifiers: ${insErr.message}`);
      }
    }

    // 4. Update event_state
    const advanceLabel = `AFTER STAGE 3 · TOP ${selected_team_ids.length} ADVANCE`;
    await serviceClient
      .from("event_state")
      .update({
        current_round: 3,
        current_round_label: advanceLabel,
        current_advance_rule: "eliminate",
        updated_at: new Date().toISOString(),
      })
      .eq("id" as never, 1);

    // 5. Update team_stage_overrides for selected & unselected eligible teams
    const selectedSet = new Set(selected_team_ids);
    const unselectedEligible = Array.from(eligibleSet).filter((id) => !selectedSet.has(id));

    // Record selected overrides for stage 4
    for (const teamId of selected_team_ids) {
      await serviceClient.from("team_stage_overrides").upsert({
        team_id: teamId,
        stage: 4,
        allowed: true,
        note: `Level 3 Shortlist Approved (Rank ${sortedSelected.indexOf(teamId) + 1})`,
      }, { onConflict: "team_id,stage" });
    }

    // Record unselected overrides for stage 4 with reasons
    for (const teamId of unselectedEligible) {
      const reason = unselected_reasons[teamId] || "Not selected in Level 3 shortlist";
      await serviceClient.from("team_stage_overrides").upsert({
        team_id: teamId,
        stage: 4,
        allowed: false,
        note: reason,
      }, { onConflict: "team_id,stage" });
    }

    // 6. Record in admin_audit_log
    await serviceClient.from("admin_audit_log").insert({
      action: "level3_shortlist_confirmed",
      detail: {
        selected_count: selected_team_ids.length,
        target_quota,
        selected_teams: sortedSelected,
        unselected_count: unselectedEligible.length,
      },
      admin_id: user.id,
    });

    return NextResponse.json({
      ok: true,
      selected_count: selected_team_ids.length,
      unselected_count: unselectedEligible.length,
      target_quota,
      round_label: advanceLabel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
