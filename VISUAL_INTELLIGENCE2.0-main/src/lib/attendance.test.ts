import { describe, expect, it } from "vitest";
import { buildAttendance, paginate, type AttendanceMemberRow, type AttendanceTeamRow } from "./attendance";
import { pdfSafe, renderAttendancePdf } from "./attendancePdf";

const T = (id: string, name: string, code = `DUM-${id.toUpperCase().padEnd(4, "X").slice(0, 4)}`): AttendanceTeamRow => ({ id, name, code });
const M = (id: string, team_id: string, name: string, reg_no: string | null, role = "member", created_at = "2026-10-14T08:00:00Z"): AttendanceMemberRow =>
  ({ id, team_id, name, reg_no, role, created_at });

describe("buildAttendance", () => {
  it("groups members under teams, teams A→Z, captain first then join order, continuous S. No.", () => {
    const data = buildAttendance(
      [T("t2", "zeta"), T("t1", "Alpha")],
      [
        M("m3", "t1", "Bea", "24CS002", "member", "2026-10-14T08:02:00Z"),
        M("m1", "t1", "Cap", "24CS001", "captain", "2026-10-14T08:05:00Z"),
        M("m2", "t1", "Ann", "24CS003", "member", "2026-10-14T08:01:00Z"),
        M("m9", "t2", "Zed", "24CS009", "captain"),
      ]
    );
    expect(data.teams.map((t) => t.name)).toEqual(["Alpha", "zeta"]);
    expect(data.teams[0].members).toEqual([
      { serial: 1, name: "Cap", regNo: "24CS001" },
      { serial: 2, name: "Ann", regNo: "24CS003" },
      { serial: 3, name: "Bea", regNo: "24CS002" },
    ]);
    expect(data.teams[1].members[0].serial).toBe(4);
    expect([data.totalTeams, data.totalMembers]).toEqual([2, 4]);
  });

  it("preserves registration numbers exactly: leading zeros and letter case", () => {
    const data = buildAttendance([T("t", "T")], [M("a", "t", "A", "007ab", "captain"), M("b", "t", "B", "URK25cs0001")]);
    expect(data.teams[0].members.map((m) => m.regNo)).toEqual(["007ab", "URK25cs0001"]);
  });

  it("drops duplicate member rows and members of teams that no longer exist", () => {
    const data = buildAttendance([T("t", "T")], [M("a", "t", "A", "1"), M("a", "t", "A", "1"), M("x", "gone", "Ghost", "9")]);
    expect(data.totalMembers).toBe(1);
    expect(JSON.stringify(data)).not.toContain("Ghost");
  });

  it("handles an empty registration", () => {
    expect(buildAttendance([], [])).toEqual({ teams: [], totalTeams: 0, totalMembers: 0 });
  });
});

describe("paginate", () => {
  it("keeps a team's rows on one page by moving the whole team to the next page", () => {
    const pages = paginate([[10, 10, 10], [10, 10, 10, 10]], 50, 100);
    expect(pages.map((p) => p.map((r) => r.teamIndex))).toEqual([[0, 0, 0], [1, 1, 1, 1]]);
  });

  it("splits a team only when it is taller than a full page, and never drops rows", () => {
    const pages = paginate([[40, 40, 40]], 100, 100);
    expect(pages.flat()).toHaveLength(3);
    expect(pages.map((p) => p.length)).toEqual([2, 1]);
  });
});

// Uncompressed PDF so the text operators can be inspected.
const pdfText = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
const pageCount = (s: string) => (s.match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe("renderAttendancePdf", () => {
  const at = new Date("2026-10-14T04:30:00Z");

  it("renders the header, totals, all columns and every member of a four-member team", () => {
    const data = buildAttendance(
      [T("t1", "Prompt Engineers", "DUM-AB12")],
      ["Aarav", "Bea", "Chen", "Dev"].map((n, i) => M(`m${i}`, "t1", n, `00${i}CS`, i ? "member" : "captain"))
    );
    const s = pdfText(renderAttendancePdf(data, { generatedAt: at, compress: false }));
    for (const text of ["VISUAL INTELLIGENCE 2.0", "IEEE event attendance sheet",
      "Date: 14 Oct \\(Wednesday\\)", "Session / Round: 2:00 PM - 4:00 PM",
      "Total teams: 1", "Total registered members: 4", "S. No.", "Team Name", "Team Code", "Member Name", "Registration",
      "Prompt Engineers", "DUM-AB12", "Aarav", "Dev", "000CS", "003CS", "Page 1 of 1", "Generated on 14 Oct 2026"]) {
      expect(s, text).toContain(`(${text}`);
    }
    expect(s).not.toMatch(/\((Remarks|Attendance)/);
    expect(pageCount(s)).toBe(1);
  });

  it("spans multiple pages for a large registration, repeating the table header and numbering pages", () => {
    const teams = Array.from({ length: 150 }, (_, i) => T(`t${String(i).padStart(3, "0")}`, `Team ${String(i).padStart(3, "0")}`));
    const members = teams.flatMap((t, i) => [0, 1, 2, 3].map((j) => M(`${t.id}-${j}`, t.id, `Member ${i}-${j}`, `0${i}${j}`, j ? "member" : "captain")));
    const data = buildAttendance(teams, members);
    const s = pdfText(renderAttendancePdf(data, { generatedAt: at, compress: false }));
    const pages = pageCount(s);
    expect(pages).toBeGreaterThan(10);
    expect((s.match(/\(S\. No\.\)/g) ?? []).length).toBe(pages); // header on every page
    expect(s).toContain(`(Page ${pages} of ${pages})`);
    expect(s).toContain("(600)"); // last S. No.
    expect(s).toContain("(Total registered members: 600)");
    for (const m of [members[0], members[299], members[599]]) expect(s).toContain(`(${m.reg_no})`);
  });

  it("renders a placeholder row for a team without members instead of omitting it", () => {
    const s = pdfText(renderAttendancePdf(buildAttendance([T("t", "Lonely")], []), { generatedAt: at, compress: false }));
    expect(s).toContain("(Lonely)");
    expect(s).toContain("no registered members");
  });

  it("keeps Latin-1 names exact and never garbles a row over an unsupported character", () => {
    expect(pdfSafe("José Ñandú")).toBe("José Ñandú");
    expect(pdfSafe("O’Neil – “Ace”…")).toBe(`O'Neil - "Ace"...`);
    expect(pdfSafe("Kavi தமிழ்")).toBe("Kavi " + "?".repeat([..."தமிழ்"].length));
    expect(pdfSafe("007ab")).toBe("007ab");
    const s = pdfText(renderAttendancePdf(buildAttendance([T("t", "Café Crew")], [M("a", "t", "O’Neil தமிழ்", "0042", "captain")]), { generatedAt: at, compress: false }));
    expect(s).toContain("(Café Crew)");
    expect(s).toMatch(/\(O'Neil \?+\)/);
    expect(s).toContain("(0042)");
  });
});
