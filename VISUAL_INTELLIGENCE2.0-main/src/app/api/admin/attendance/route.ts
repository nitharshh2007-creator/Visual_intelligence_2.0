import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getServiceRoleClient } from "@/lib/supabase-service";
import { buildAttendance, type AttendanceMemberRow, type AttendanceTeamRow } from "@/lib/attendance";
import { ATTENDANCE_FILENAME, renderAttendancePdf } from "@/lib/attendancePdf";

const PAGE_SIZE = 1000; // PostgREST returns at most 1000 rows per request

// Reads every row (paged, stable order) so large registrations are never cut off.
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
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

  let teams: AttendanceTeamRow[];
  let members: AttendanceMemberRow[];
  try {
    const db = getServiceRoleClient();
    [teams, members] = await Promise.all([
      fetchAll<AttendanceTeamRow>((from, to) => db.from("teams").select("id, name, code").order("id").range(from, to)),
      fetchAll<AttendanceMemberRow>((from, to) =>
        db.from("members").select("id, team_id, name, reg_no, role, created_at").order("id").range(from, to)
      ),
    ]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Could not load registrations: ${message}` }, { status: 500 });
  }

  const data = buildAttendance(teams, members);
  if (data.totalTeams === 0) {
    return NextResponse.json({ error: "No teams have registered yet — there is nothing to export." }, { status: 404 });
  }

  try {
    const pdf = renderAttendancePdf(data, { generatedAt: new Date() });
    return new NextResponse(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${ATTENDANCE_FILENAME}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Could not generate the PDF: ${message}` }, { status: 500 });
  }
}
