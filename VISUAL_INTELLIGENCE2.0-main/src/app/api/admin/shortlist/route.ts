import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceRoleClient } from "@/lib/supabase-service";

export interface MasterTeamRecord {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  member_count: number;
  members: Array<{
    id: string;
    name: string;
    reg_no: string;
    email: string;
    phone: string | null;
    section: string | null;
    year: number | null;
    role: string;
  }>;
  scores: {
    s1: number | null;
    s2: number | null;
    combined_prelim: number | null;
    s3: number | null;
    s4: number | null;
    total: number;
  };
  level1_status: "participating" | "completed";
  level2_status: "eligible" | "pending" | "completed";
  shortlist_l3: {
    decision: "shortlisted" | "rejected" | "on_hold" | "undecided";
    is_override: boolean;
    note: string | null;
    decided_at: string | null;
    decided_by: string | null;
  };
  shortlist_l4: {
    qualified: boolean;
    rank_at_cut: number | null;
    total_at_cut: number | null;
    reason: string | null;
    decided_at: string | null;
  };
  current_level: 1 | 2 | 3 | 4;
  overall_status: "participating" | "qualified" | "not_shortlisted" | "eliminated" | "completed" | "pending";
  elimination_info: {
    level: number | null;
    reason: string | null;
    decided_at: string | null;
  } | null;
}

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

  try {
    const serviceClient: any = getServiceRoleClient();

    const [teamsRes, membersRes, scoresRes, shortlistRes, qualifiersRes, overridesRes, eventStateRes, configRes] =
      await Promise.all([
        serviceClient.from("teams").select("id, name, code, status, created_at").order("name"),
        serviceClient.from("members").select("id, team_id, name, reg_no, email, phone, section, year, role"),
        serviceClient.from("scores").select("team_id, stage, points, detail, updated_at"),
        serviceClient.from("shortlist").select("team_id, decision, is_override, note, decided_at, decided_by"),
        serviceClient.from("qualifiers").select("team_id, after_stage, rank_at_cut, total_at_cut, applied_at"),
        serviceClient.from("team_stage_overrides").select("team_id, stage, allowed, note, created_at"),
        serviceClient.from("event_state").select("*").eq("id" as never, 1).maybeSingle(),
        serviceClient.from("shortlist_config").select("*").eq("id" as never, 1).maybeSingle(),
      ]);

    const teams = (teamsRes.data ?? []) as any[];
    const members = (membersRes.data ?? []) as any[];
    const scores = (scoresRes.data ?? []) as any[];
    const shortlist = (shortlistRes.data ?? []) as any[];
    const qualifiers = (qualifiersRes.data ?? []) as any[];
    const overrides = (overridesRes.data ?? []) as any[];
    const eventState = eventStateRes.data as any;
    const config = configRes.data as any;

    // Index mappings
    const membersByTeam = new Map<string, typeof members>();
    for (const m of members) {
      const list = membersByTeam.get(m.team_id) ?? [];
      list.push(m);
      membersByTeam.set(m.team_id, list);
    }

    const scoresByTeam = new Map<string, Map<number, number>>();
    for (const s of scores) {
      let teamMap = scoresByTeam.get(s.team_id);
      if (!teamMap) {
        teamMap = new Map();
        scoresByTeam.set(s.team_id, teamMap);
      }
      teamMap.set(s.stage, Number(s.points));
    }

    const shortlistByTeam = new Map(shortlist.map((sl: any) => [sl.team_id, sl]));
    const qualifiersL4ByTeam = new Map(
      qualifiers.filter((q: any) => q.after_stage === 3).map((q: any) => [q.team_id, q])
    );
    const overridesByTeam = new Map<string, Map<number, typeof overrides[0]>>();
    for (const ov of overrides) {
      let map = overridesByTeam.get(ov.team_id);
      if (!map) {
        map = new Map();
        overridesByTeam.set(ov.team_id, map);
      }
      map.set(ov.stage, ov);
    }

    const masterTeams: MasterTeamRecord[] = teams.map((t: any) => {
      const tMembers = membersByTeam.get(t.id) ?? [];
      const tScores = scoresByTeam.get(t.id) ?? new Map();
      const s1 = tScores.has(1) ? tScores.get(1)! : null;
      const s2 = tScores.has(2) ? tScores.get(2)! : null;
      const s3 = tScores.has(3) ? tScores.get(3)! : null;
      const s4 = tScores.has(4) ? tScores.get(4)! : null;

      const combinedPrelim = s1 !== null && s2 !== null ? s1 + s2 : null;
      const total = (s1 ?? 0) + (s2 ?? 0) + (s3 ?? 0) + (s4 ?? 0);

      const slL3 = shortlistByTeam.get(t.id);
      const qualL4 = qualifiersL4ByTeam.get(t.id);
      const ovL4 = overridesByTeam.get(t.id)?.get(4);
      const ovL3 = overridesByTeam.get(t.id)?.get(3);

      const l3Decision = slL3?.decision as MasterTeamRecord["shortlist_l3"]["decision"] ?? "undecided";
      const isL4Qualified = Boolean(qualL4);

      // Determine current level and status
      let currentLevel: 1 | 2 | 3 | 4 = 1;
      let overallStatus: MasterTeamRecord["overall_status"] = "participating";
      let eliminationInfo: MasterTeamRecord["elimination_info"] = null;

      if (l3Decision === "rejected") {
        currentLevel = 2;
        overallStatus = "eliminated";
        eliminationInfo = {
          level: 2,
          reason: slL3?.note ?? ovL3?.note ?? "Not shortlisted after Level 2",
          decided_at: slL3?.decided_at ?? null,
        };
      } else if (l3Decision === "shortlisted") {
        // Advanced to Level 3
        if (eventState?.current_round && eventState.current_round >= 3) {
          // Level 3 cutoff has taken place
          if (isL4Qualified) {
            currentLevel = 4;
            overallStatus = s4 !== null ? "completed" : "qualified";
          } else {
            currentLevel = 3;
            overallStatus = "not_shortlisted";
            eliminationInfo = {
              level: 3,
              reason: ovL4?.note ?? "Not selected in Level 3 shortlist",
              decided_at: qualL4 ? qualL4.created_at : ovL4?.updated_at ?? null,
            };
          }
        } else {
          currentLevel = 3;
          overallStatus = "participating";
        }
      } else {
        // Pending Level 2 decision or starting Level 1
        currentLevel = s1 !== null ? 2 : 1;
        overallStatus = l3Decision === "on_hold" ? "pending" : "participating";
      }

      return {
        id: t.id,
        name: t.name,
        code: t.code,
        status: t.status,
        created_at: t.created_at,
        member_count: tMembers.length,
        members: tMembers.map((m: any) => ({
          id: m.id,
          name: m.name,
          reg_no: m.reg_no,
          email: m.email,
          phone: m.phone,
          section: m.section,
          year: m.year,
          role: m.role,
        })),
        scores: {
          s1,
          s2,
          combined_prelim: combinedPrelim,
          s3,
          s4,
          total,
        },
        level1_status: s1 !== null ? "completed" : "participating",
        level2_status: s2 !== null ? "completed" : "eligible",
        shortlist_l3: {
          decision: l3Decision,
          is_override: Boolean(slL3?.is_override),
          note: slL3?.note ?? null,
          decided_at: slL3?.decided_at ?? null,
          decided_by: slL3?.decided_by ?? null,
        },
        shortlist_l4: {
          qualified: isL4Qualified,
          rank_at_cut: qualL4?.rank_at_cut ?? null,
          total_at_cut: qualL4?.total_at_cut ?? null,
          reason: ovL4?.note ?? null,
          decided_at: qualL4?.applied_at ?? null,
        },
        current_level: currentLevel,
        overall_status: overallStatus,
        elimination_info: eliminationInfo,
      };
    });

    return NextResponse.json(
      {
        teams: masterTeams,
        stats: {
          total: masterTeams.length,
          level1: masterTeams.filter((t) => t.current_level === 1).length,
          level2: masterTeams.filter((t) => t.current_level === 2).length,
          level3_shortlisted: masterTeams.filter((t) => t.shortlist_l3.decision === "shortlisted").length,
          level4_finalists: masterTeams.filter((t) => t.shortlist_l4.qualified).length,
          eliminated: masterTeams.filter((t) => t.overall_status === "eliminated" || t.overall_status === "not_shortlisted").length,
        },
        event_state: eventState,
        config: config ?? { combined_cutoff: 60, stage1_min: 0, stage2_min: 0 },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
