// Attendance sheet data shaping + page layout (pure; no I/O).
// Source rows come straight from public.teams / public.members.

export interface AttendanceTeamRow {
  id: string;
  name: string;
  code: string;
}

export interface AttendanceMemberRow {
  id: string;
  team_id: string;
  name: string;
  reg_no: string | null;
  role: string | null;
  created_at: string | null;
}

export interface AttendanceMember {
  serial: number;
  name: string;
  regNo: string; // exactly as stored
}

export interface AttendanceTeam {
  name: string;
  code: string;
  members: AttendanceMember[];
}

export interface AttendanceData {
  teams: AttendanceTeam[];
  totalTeams: number;
  totalMembers: number;
}

/**
 * Groups members under their team. Teams sort alphabetically by name (then
 * code); members follow the lobby order — captain first, then by join time,
 * then id for stability. Duplicate member ids are dropped, and members whose
 * team no longer exists are ignored. reg_no is never trimmed or re-cased.
 */
export function buildAttendance(teams: AttendanceTeamRow[], members: AttendanceMemberRow[]): AttendanceData {
  const byTeam = new Map<string, AttendanceMemberRow[]>();
  const seen = new Set<string>();
  for (const m of members) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const list = byTeam.get(m.team_id) ?? [];
    list.push(m);
    byTeam.set(m.team_id, list);
  }

  const sortedTeams = [...new Map(teams.map((t) => [t.id, t])).values()].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.code.localeCompare(b.code)
  );

  let serial = 0;
  const out: AttendanceTeam[] = sortedTeams.map((t) => {
    const roster = (byTeam.get(t.id) ?? []).sort(
      (a, b) =>
        Number(b.role === "captain") - Number(a.role === "captain") ||
        (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
        a.id.localeCompare(b.id)
    );
    return {
      name: t.name,
      code: t.code,
      members: roster.map((m) => ({ serial: ++serial, name: m.name, regNo: m.reg_no ?? "" })),
    };
  });

  return { teams: out, totalTeams: out.length, totalMembers: serial };
}

export interface PlacedRow {
  teamIndex: number;
  memberIndex: number; // index into that team's rows (a team with no members gets one placeholder row)
  height: number;
}

/**
 * Assigns rows to pages. A team's rows stay on one page whenever the whole
 * team fits on a fresh page; a team taller than a full page is split row by
 * row (never dropped). `rowHeights[t]` lists the height of each row of team t.
 */
export function paginate(rowHeights: number[][], firstPageSpace: number, pageSpace: number): PlacedRow[][] {
  const pages: PlacedRow[][] = [[]];
  let remaining = firstPageSpace;
  const newPage = () => {
    pages.push([]);
    remaining = pageSpace;
  };

  rowHeights.forEach((heights, teamIndex) => {
    const rows: PlacedRow[] = heights.map((height, memberIndex) => ({ teamIndex, memberIndex, height }));
    const groupHeight = heights.reduce((a, h) => a + h, 0);
    const pageHasRows = pages[pages.length - 1].length > 0;
    if (groupHeight > remaining && pageHasRows && groupHeight <= pageSpace) newPage();
    for (const row of rows) {
      if (row.height > remaining && pages[pages.length - 1].length > 0) newPage();
      pages[pages.length - 1].push(row);
      remaining -= row.height;
    }
  });
  return pages;
}
