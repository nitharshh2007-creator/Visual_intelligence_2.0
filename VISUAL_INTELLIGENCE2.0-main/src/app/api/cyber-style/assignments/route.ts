import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceRoleClient } from "@/lib/supabase-service";
import { CYBER_THEMES, allocateThemesWithoutRepetition } from "@/data/cyberThemes";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", {});
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  // 1. Try admin RPC first
  try {
    const { data, error } = await supabase.rpc("admin_get_cyber_theme_allocations", {});
    if (!error && data) {
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Fall back to service role client
  }

  // 2. Service role execution
  try {
    const serviceClient = getServiceRoleClient();
    const [teamsRes, asgnRes, stageRes] = await Promise.all([
      serviceClient.from("teams").select("id, name, code, status").order("name"),
      serviceClient.from("cyber_theme_assignments").select("team_id, theme_id, assigned_at"),
      serviceClient.from("stage_progress").select("status").eq("stage", 1).maybeSingle(),
    ]);

    const stage1Status = stageRes.data?.status ?? "not_released";
    const teams = teamsRes.data ?? [];
    const dbAssignments = asgnRes.data ?? [];

    // Build assignment map from database
    const asgnMap = new Map(dbAssignments.map((a) => [a.team_id, a]));

    // If table doesn't exist or has 0 assignments, use the deterministic fallback allocator
    // so the admin sees the exact same persistent assignments
    let deterministicAllocations: Map<string, { theme: typeof CYBER_THEMES[0] }> | null = null;
    if (dbAssignments.length === 0 && teams.length > 0) {
      const allIds = teams.map((t) => t.id);
      deterministicAllocations = allocateThemesWithoutRepetition(allIds);
    }

    const allocations = teams.map((t) => {
      const dbAsgn = asgnMap.get(t.id);
      let themeId = dbAsgn?.theme_id ?? null;
      let assignedAt = dbAsgn?.assigned_at ?? null;

      if (!themeId && deterministicAllocations) {
        const det = deterministicAllocations.get(t.id);
        if (det) {
          themeId = det.theme.theme_id;
          assignedAt = new Date().toISOString();
        }
      }

      const theme = themeId ? CYBER_THEMES.find((th) => th.theme_id === themeId) : null;

      return {
        team_id: t.id,
        team_name: t.name,
        team_code: t.code,
        team_status: t.status,
        theme_id: theme?.theme_id ?? null,
        theme_title: theme?.title ?? null,
        description_line1: theme?.description_line1 ?? null,
        description_line2: theme?.description_line2 ?? null,
        visual_style: theme?.visual_style ?? null,
        palette: theme?.palette ?? null,
        assigned_at: assignedAt,
      };
    });

    const totalTeams = teams.length;
    const assignedTeams = allocations.filter((a) => a.theme_id !== null).length;

    // Track used themes count
    const uniqueAssignedThemes = new Set(allocations.map((a) => a.theme_id).filter(Boolean));
    const availableThemesCount = Math.max(0, CYBER_THEMES.length - uniqueAssignedThemes.size);

    return NextResponse.json(
      {
        total_teams: totalTeams,
        assigned_teams: assignedTeams,
        unassigned_teams: Math.max(0, totalTeams - assignedTeams),
        total_catalogue_themes: CYBER_THEMES.length,
        available_themes: availableThemesCount,
        round1_status: stage1Status,
        can_reassign: !["live", "ended"].includes(stage1Status),
        allocations,
        themes: CYBER_THEMES,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

  let body: { reassign?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // 1. Try RPC first
  try {
    const { data, error } = await supabase.rpc("admin_allocate_all_cyber_themes", {
      p_reassign: Boolean(body.reassign),
    });
    if (!error && data) {
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    }
    if (error && error.message.includes("Cannot reassign")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } catch {
    // Fall back to service role client
  }

  // 2. Service role execution
  try {
    const serviceClient = getServiceRoleClient();

    // Check round 1 status before reassigning
    const { data: sp } = await serviceClient.from("stage_progress").select("status").eq("stage", 1).maybeSingle();
    const stage1Status = sp?.status ?? "not_released";
    if (body.reassign && ["live", "ended"].includes(stage1Status)) {
      return NextResponse.json({ error: "Cannot reassign themes after Round 1 has started or ended." }, { status: 400 });
    }

    if (body.reassign) {
      await serviceClient.from("cyber_theme_assignments").delete().neq("team_id", "00000000-0000-0000-0000-000000000000");
    }

    const [teamsRes, existingAsgnRes] = await Promise.all([
      serviceClient.from("teams").select("id").order("created_at"),
      serviceClient.from("cyber_theme_assignments").select("team_id, theme_id"),
    ]);

    const assignedTeamIds = new Set((existingAsgnRes.data ?? []).map((a) => a.team_id));
    const unassignedTeams = (teamsRes.data ?? []).filter((t) => !assignedTeamIds.has(t.id));

    // Track themes already taken
    const usedThemes = new Set<string>();
    for (const a of existingAsgnRes.data ?? []) {
      if (a.theme_id) usedThemes.add(a.theme_id);
    }

    // Remaining unused themes in catalog
    const availableThemes = CYBER_THEMES.filter((th) => !usedThemes.has(th.theme_id));

    // Shuffle available themes
    const shuffledThemes = [...availableThemes].sort(() => Math.random() - 0.5);

    const newRows: { team_id: string; theme_id: string; assigned_at: string }[] = [];

    // Shuffle unassigned teams
    const shuffledTeams = [...unassignedTeams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledTeams.length; i++) {
      if (i < shuffledThemes.length) {
        const team = shuffledTeams[i];
        const chosen = shuffledThemes[i];
        newRows.push({
          team_id: team.id,
          theme_id: chosen.theme_id,
          assigned_at: new Date().toISOString(),
        });
      } else {
        // More teams than available themes: leave remaining teams unassigned safely
        break;
      }
    }

    if (newRows.length > 0) {
      await serviceClient.from("cyber_theme_assignments").upsert(newRows, { onConflict: "team_id" });
    }

    return NextResponse.json({
      ok: true,
      allocated_count: newRows.length,
      unassigned_remaining: Math.max(0, shuffledTeams.length - newRows.length),
      reassigned: Boolean(body.reassign),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
