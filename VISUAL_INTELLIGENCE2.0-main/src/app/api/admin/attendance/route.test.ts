import { beforeEach, describe, expect, it, vi } from "vitest";

// Auth client (cookie session) and service client are both faked — no network.
const auth = { user: null as { id: string } | null, isAdmin: false };
const db = { teams: [] as unknown[], members: [] as unknown[], error: null as { message: string } | null, calls: 0 };

vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: auth.user }, error: null }) },
    rpc: async () => ({ data: auth.isAdmin, error: null }),
  }),
}));
vi.mock("@/lib/supabase-service", () => ({
  getServiceRoleClient: () => ({
    from: (table: "teams" | "members") => ({
      select: () => ({
        order: () => ({
          range: async (from: number, to: number) => {
            db.calls++;
            if (db.error) return { data: null, error: db.error };
            return { data: db[table].slice(from, to + 1), error: null };
          },
        }),
      }),
    }),
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  auth.user = null;
  auth.isAdmin = false;
  db.teams = [];
  db.members = [];
  db.error = null;
  db.calls = 0;
});

describe("GET /api/admin/attendance", () => {
  it("rejects anonymous requests without touching the database", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(db.calls).toBe(0);
  });

  it("rejects signed-in non-admins", async () => {
    auth.user = { id: "u1" };
    const res = await GET();
    expect(res.status).toBe(403);
    expect(db.calls).toBe(0);
  });

  it("explains an empty registration", async () => {
    auth.user = { id: "a" };
    auth.isAdmin = true;
    const res = await GET();
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/No teams have registered/);
  });

  it("reports database errors clearly", async () => {
    auth.user = { id: "a" };
    auth.isAdmin = true;
    db.error = { message: "connection reset" };
    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Could not load registrations: connection reset");
  });

  it("returns a downloadable PDF and reads past the 1000-row page limit", async () => {
    auth.user = { id: "a" };
    auth.isAdmin = true;
    db.teams = Array.from({ length: 300 }, (_, i) => ({ id: `t${String(i).padStart(4, "0")}`, name: `Team ${i}`, code: `DUM-${i}` }));
    db.members = db.teams.flatMap((t, i) =>
      [0, 1, 2, 3].map((j) => ({ id: `${(t as { id: string }).id}-${j}`, team_id: (t as { id: string }).id, name: `M${i}-${j}`, reg_no: `0${i}${j}`, role: j ? "member" : "captain", created_at: null }))
    ); // 1200 members → two pages of results
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Visual_Intelligence_2.0_Attendance_Sheet.pdf"');
    expect(res.headers.get("cache-control")).toContain("no-store");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(db.calls).toBe(3); // teams: 1 page; members: 1000 + 200
  });
});
