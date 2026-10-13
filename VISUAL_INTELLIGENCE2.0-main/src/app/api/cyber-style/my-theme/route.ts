import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceRoleClient } from "@/lib/supabase-service";
import { CYBER_THEMES, allocateThemesWithoutRepetition } from "@/data/cyberThemes";
import { isMissingThemeRpc, mapThemeRpcError } from "@/lib/cyberThemeErrors";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code")?.trim().toUpperCase();
  // reg_no is matched exactly (members.reg_no = p_reg_no) — never
  // change its case, or students who typed it in lowercase can't load.
  const regNo = searchParams.get("reg_no")?.trim();

  if (!code || !regNo) {
    return NextResponse.json({ error: "Team code and registration number are required." }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Secure RPC — the database allocator (advisory-locked, no theme
  //    handed out twice). Its errors are final; only a missing RPC
  //    (migration 0030 not applied) may use the legacy path below.
  try {
    const { data, error } = await supabase.rpc("get_my_team_cyber_theme", {
      p_code: code,
      p_reg_no: regNo,
    });

    if (!error && data?.theme) {
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      });
    }
    if (error && !isMissingThemeRpc(error)) {
      const { status, error: message } = mapThemeRpcError(error);
      return NextResponse.json({ error: message }, { status });
    }
    if (!error) {
      return NextResponse.json({ error: "Could not load your theme assignment. Please try again." }, { status: 500 });
    }
  } catch {
    // Transport failure — fall back to server-side service client
  }

  // 2. Service role execution (legacy fallback)
  try {
    const serviceClient = getServiceRoleClient();

    // Verify team
    const { data: team, error: teamErr } = await serviceClient
      .from("teams")
      .select("id, name, code, status")
      .eq("code", code)
      .single();

    if (teamErr || !team) {
      return NextResponse.json({ error: "Invalid team code." }, { status: 404 });
    }

    // Verify member registration on this team
    const { data: member, error: memberErr } = await serviceClient
      .from("members")
      .select("id")
      .eq("team_id", team.id)
      .eq("reg_no", regNo)
      .single();

    if (memberErr || !member) {
      return NextResponse.json({ error: "Member registration number not found on this team." }, { status: 403 });
    }

    // Check if team already has a saved assignment in the database
    let existingThemeId: string | null = null;
    let assignmentTime: string | null = null;

    const { data: existingAsgn } = await serviceClient
      .from("cyber_theme_assignments")
      .select("theme_id, assigned_at")
      .eq("team_id", team.id)
      .maybeSingle();

    if (existingAsgn) {
      existingThemeId = existingAsgn.theme_id;
      assignmentTime = existingAsgn.assigned_at;
    }

    if (existingThemeId) {
      const matchedTheme = CYBER_THEMES.find((t) => t.theme_id === existingThemeId);
      if (matchedTheme) {
        return NextResponse.json({
          team_id: team.id,
          team_name: team.name,
          theme: matchedTheme,
          assigned_at: assignmentTime,
        });
      }
    }

    // 1. Check if an assignment was already saved in DB or other teams
    const { data: allAssignments } = await serviceClient
      .from("cyber_theme_assignments")
      .select("team_id, theme_id");

    const assignedMap = new Map((allAssignments ?? []).map((a) => [a.team_id, a.theme_id]));
    let chosenTheme: (typeof CYBER_THEMES)[number];

    if (assignedMap.has(team.id)) {
      const savedThemeId = assignedMap.get(team.id);
      chosenTheme = CYBER_THEMES.find((t) => t.theme_id === savedThemeId) || CYBER_THEMES[0];
    } else {
      // Fetch all registered teams ordered by team name/code
      const { data: allTeams } = await serviceClient.from("teams").select("id").order("name");
      const teamIds = (allTeams ?? [{ id: team.id }]).map((t) => t.id);
      const allocations = allocateThemesWithoutRepetition(teamIds);
      const myAlloc = allocations.get(team.id);
      chosenTheme = myAlloc?.theme || CYBER_THEMES[0];
    }

    // Persist to Supabase cyber_theme_assignments table
    try {
      await serviceClient.from("cyber_theme_assignments").upsert(
        {
          team_id: team.id,
          theme_id: chosenTheme.theme_id,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: "team_id" }
      );
    } catch {
      // Safe fallback if table migration is pending
    }

    return NextResponse.json({
      team_id: team.id,
      team_name: team.name,
      theme: chosenTheme,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
