// ─────────────────────────────────────────────────────────────
// scripts/simulate-event.ts — dev-only load/rehearsal seeding
// ─────────────────────────────────────────────────────────────
// Creates 20 test teams with members through the REAL create_team/
// join_team RPCs (anon key — same path a real student hits), then
// seeds Stage 1 + Stage 2 submissions and scores directly (service
// role — there's no reason to replay the full admin release/start/end
// cycle just to get believable numbers for a cutoff rehearsal). Lets
// you rehearse admin_preview_cutoff/admin_apply_cutoff, the
// hidden/public leaderboard switch, and /leaderboard under a
// realistic team count — all through the REAL admin UI afterward.
//
// Run (from the repo root):
//   ALLOW_SIMULATE_EVENT=true node --env-file=.env.local scripts/simulate-event.ts
//   ALLOW_SIMULATE_EVENT=true node --env-file=.env.local scripts/simulate-event.ts --cleanup
//
// Requires Node 20.6+ (--env-file) and a Node new enough to run .ts
// directly (type-stripping; this file avoids path aliases, enums and
// anything else that needs a bundler). Needs NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the
// sourced env file — the same service-role key documented in
// .env.example for src/app/api/assets/[id]/route.ts.
//
// Refuses to run at all unless ALLOW_SIMULATE_EVENT=true is set —
// this creates real rows (including a transient registration-deadline
// extension, auto-restored when the script exits) on whatever project
// the env file points at. Never run this against a project with real
// student data unless you mean to.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TEAM_PREFIX = "SIM Team";
const TEAM_COUNT = 20;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Run with: node --env-file=.env.local scripts/simulate-event.ts`);
    process.exit(1);
  }
  return value;
}

async function main() {
  if (process.env.ALLOW_SIMULATE_EVENT !== "true") {
    console.error(
      "Refusing to run: set ALLOW_SIMULATE_EVENT=true to confirm you want to seed test data " +
        "(and transiently extend the registration deadline) on whatever project .env.local points at."
    );
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (process.argv.includes("--cleanup")) {
    await cleanup(service);
    return;
  }

  console.log(`Creating ${TEAM_COUNT} simulated teams via the real create_team/join_team RPCs…`);

  const { data: eventState, error: eventStateError } = await service
    .from("event_state")
    .select("registration_deadline")
    .eq("id", 1)
    .single();
  if (eventStateError || !eventState) {
    console.error("Could not read event_state — is the project reachable and migrated?", eventStateError?.message);
    process.exit(1);
  }
  const originalDeadline = eventState.registration_deadline as string;
  const deadlinePassed = new Date(originalDeadline) < new Date();

  if (deadlinePassed) {
    const extended = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    console.log(`Registration deadline (${originalDeadline}) has passed — extending it to ${extended} for this run only.`);
    await service.from("event_state").update({ registration_deadline: extended }).eq("id", 1);
  }

  type SimTeam = { name: string; code: string; teamId: string; stage1: number; stage2: number };
  const teams: SimTeam[] = [];

  try {
    for (let i = 1; i <= TEAM_COUNT; i++) {
      const n = String(i).padStart(2, "0");
      const teamName = `${TEAM_PREFIX} ${n}`;

      const { data: created, error: createError } = await anon.rpc("create_team", {
        p_team_name: teamName,
        p_captain_name: `Sim Captain ${n}`,
        p_reg_no: `SIM-CAP-${n}`,
        p_email: `sim.captain.${n}@example.com`,
        p_year: 1,
      });
      if (createError || !created) {
        console.error(`  [${teamName}] create_team failed:`, createError?.message);
        continue;
      }

      const memberCount = 3 + Math.floor(Math.random() * 2); // 3 or 4 more -> 4-5 total
      for (let m = 1; m <= memberCount; m++) {
        const { error: joinError } = await anon.rpc("join_team", {
          p_code: created.code,
          p_member_name: `Sim Member ${n}-${m}`,
          p_reg_no: `SIM-MEM-${n}-${m}`,
          p_email: `sim.member.${n}.${m}@example.com`,
          p_year: 1,
        });
        if (joinError) console.error(`  [${teamName}] join_team member ${m} failed:`, joinError.message);
      }

      const stage1 = 40 + Math.floor(Math.random() * 56); // 40-95
      const stage2 = 40 + Math.floor(Math.random() * 56);

      await service.from("submissions").insert([
        { team_id: created.team_id, stage_slug: "cyber-styling", version: 1, kind: "text", text_value: `Simulated submission for ${teamName} (seeded by scripts/simulate-event.ts)` },
        { team_id: created.team_id, stage_slug: "bugx-hacker", version: 1, kind: "text", text_value: `Simulated submission for ${teamName} (seeded by scripts/simulate-event.ts)` },
      ]);
      await service.from("scores").insert([
        { team_id: created.team_id, stage: 1, points: stage1, detail: { note: "seeded by simulate-event.ts" } },
        { team_id: created.team_id, stage: 2, points: stage2, detail: { note: "seeded by simulate-event.ts" } },
      ]);

      teams.push({ name: teamName, code: created.code, teamId: created.team_id, stage1, stage2 });
      console.log(`  [${teamName}] code=${created.code} members=${memberCount + 1} stage1=${stage1} stage2=${stage2}`);
    }
  } finally {
    if (deadlinePassed) {
      console.log(`Restoring registration_deadline to ${originalDeadline}.`);
      await service.from("event_state").update({ registration_deadline: originalDeadline }).eq("id", 1);
    }
  }

  console.log(`\nDone. ${teams.length}/${TEAM_COUNT} teams created.`);
  console.log("Cumulative (stage1+stage2), ranked — this is roughly what admin_preview_cutoff(2) will see:");
  teams
    .map((t) => ({ ...t, total: t.stage1 + t.stage2 }))
    .sort((a, b) => b.total - a.total)
    .forEach((t, i) => console.log(`  ${i + 1}. ${t.name} — ${t.total} pts`));
  console.log(`\nRun with --cleanup to delete every "${TEAM_PREFIX} *" team (cascades to members/scores/submissions).`);
}

async function cleanup(service: SupabaseClient) {
  const { data, error } = await service.from("teams").select("id, name").like("name", `${TEAM_PREFIX}%`);
  const simTeams = data as { id: string; name: string }[] | null;
  if (error) {
    console.error("Could not list simulated teams:", error.message);
    process.exit(1);
  }
  if (!simTeams || simTeams.length === 0) {
    console.log("No simulated teams found — nothing to clean up.");
    return;
  }
  console.log(`Deleting ${simTeams.length} simulated teams (members/scores/submissions cascade)…`);
  const { error: deleteError } = await service
    .from("teams")
    .delete()
    .in("id", simTeams.map((t) => t.id));
  if (deleteError) {
    console.error("Cleanup failed:", deleteError.message);
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error("simulate-event.ts crashed:", e);
  process.exit(1);
});
