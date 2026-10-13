A 4-stage live event platform: team registration, a real-time leaderboard, sequential stage release with qualification cutoffs, a judging/scoring console, and a signed-URL file vault for challenge materials. Built with Next.js (App Router) + Supabase. This README is a complete, self-contained guide to running your **own** event on your **own** Supabase project and your **own** domain — nothing below assumes you're using the original organizers' infrastructure.

## 1. What you need before you start

- Node.js 20.6+ (for `--env-file`; check with `node --version`)
- A [Supabase](https://supabase.com) account (free tier is enough) — this is your database, auth, realtime, and file storage, all in one project
- A [Vercel](https://vercel.com) account, if you want to deploy (any Next.js host works, but the steps below use Vercel since it's the simplest)
- A domain name, if you want this on your own URL instead of a `*.vercel.app` one
- `git` and a GitHub (or similar) account, to push the code somewhere Vercel can import from

## 2. Get the code

```bash
git clone <this-repo-url>
cd VISUAL_INTELLIGENCE
npm install
```

## 3. Create your Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Pick any name/region/password (the DB password isn't used by this app directly — Supabase manages that connection for you).
2. Once it's provisioned, go to **Settings → API** and copy three values, you'll need them in the next step:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (click to reveal it — keep this one secret, never share it or commit it)
3. Go to **Storage** and confirm you're on a plan/project that allows storage buckets (the free tier does) — the migrations below create two private buckets for you, you don't need to create them by hand.

## 4. Set your environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the three values from step 3:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_USE_MOCK=false
```

`SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix on purpose — it's only ever read server-side (one Route Handler, for signed file-download URLs) and must never end up in a `NEXT_PUBLIC_*` variable or anywhere the browser can see it.

## 5. Run the database migrations

Open your Supabase project's **SQL Editor** and run every file in `supabase/migrations/`, **in this exact numeric order** (each one builds on the last; running them out of order will fail):

| # | File | What it does |
|---|------|---------------|
| 0001 | `0001_team_registration.sql` | Base schema: teams, members, team-size trigger |
| 0002 | `0002_realtime_backend.sql` | Event state, scores, activity feed, realtime wiring |
| 0003 | `0003_admin_control_room.sql` | Admin RPCs, `admins` table, RLS, audit log |
| 0004 | `0004_stage_pages.sql` | Stage/asset/submission schema **+ seeds the 4 stages' content** — see step 6 below before you run this one |
| 0005 | `0005_team_lookup.sql` | "Join with a code" lookup RPC |
| 0006 | `0006_leaderboard_visibility.sql` | Public/hidden leaderboard switch, projector link |
| 0007 | `0007_stage_release.sql` | Sequential stage release/gating |
| 0008 | `0008_qualification_cutoffs.sql` | Cutoff preview/apply/undo RPCs |
| 0009 | `0009_stage_content.sql` | Gated stage content + submission RPCs |
| 0010 | `0010_stage_override_rev.sql` | Bug fix: per-team overrides now trigger realtime |
| 0011 | `0011_storage_policies.sql` | Lets admin actually upload files to the private buckets |
| 0012 | `0012_submissions_rubric.sql` | `/admin/scoring` viewer + rubric-based judging |
| 0013 | `0013_bugx_vault.sql` | BugX password verification (hash + check, server-side) |
| 0014 | `0014_registration_manual_close.sql` | Manual "close registration now" switch |
| 0015 | `0015_stage_copy_update.sql` | **Event-specific wording for the 4 stages — see step 6, you'll likely want to edit or skip this one** |
| 0016 | `0016_realtime_replica_identity.sql` | Sets `REPLICA IDENTITY FULL` on `teams`/`members` so Realtime UPDATE/DELETE filters work correctly |
| 0017 | `0017_stage_end_cutoff_scoring.sql` | Broadcasts ended-stage state, ranks cutoffs using only scores through that stage, and seeds the Cyber Styling/Prompt Charades rubrics |
| 0018 | `0018_four_member_teams.sql` | Enforces the new four-member team cap and updates team-status logic |
| 0019 | `0019_fix_registration_bugs.sql` | Fixes team registration edge cases |
| 0020 | `0020_shortlisting.sql` | Configurable preliminary cutoff, score validation, and manual Stage 3/4 approval |
| 0021 | `0021_shortlist_enforcement.sql` | Atomic preliminary scoring and admin scoring/assignment enforcement for shortlisted teams |
| 0022 | `0022_cyber_theme_assignments.sql` | Official 38-theme UI catalog and randomized, persistent Cyber Styling team assignments |

Paste each file's full contents into the SQL Editor and run it, then move to the next. If something fails partway through a file, fix the reported error and re-run that **same** file before moving on — don't skip ahead.

## 6. Make it your own event

This template ships with 4 specific games already wired up: **Cyber Styling**, **BugX Hacker** (with a real password-vault mechanic baked into both the database and the UI), **Prompt Rumble**, and **Prompt Charades**. You have two realistic options:

**Option A — keep the same 4 games, change the wording.** This is the easy path: the structure (4 stages, BugX's password gate on stage 2) stays, you just rewrite the text. After running migration 0004 (which seeds the originals) and before — or instead of — running 0015 (which overwrites them with the original organizers' exact copy), run your own version in the SQL Editor:

```sql
update stages set
  name = 'YOUR STAGE NAME',
  hook = 'Your one-line pitch for this stage.',
  tests = array['Skill one', 'Skill two', 'Skill three'],
  duration_min = 25,
  overview_md = 'How this stage works, in your own words.',
  rules_md = 'Your rules.',
  roles_md = 'Role One, Role Two, Role Three'
where slug = 'cyber-styling'; -- repeat for bugx-hacker, prompt-rumble, prompt-charades
```

There's no admin UI for editing this content by design (the spec this was built against treats stage definitions as fixed once decided, not something to tweak live during the event) — SQL is the actual, intended way to set it, once, before you open registration.

**Option B — different games entirely, different number of stages.** This needs real code changes, not just config: the app's logic (cutoff math, the admin stepper, `StageProgressRail`, the `stage between 1 and 4` database constraint, BugX's slug-specific password panel) is written around exactly 4 stages with `bugx-hacker` specifically having the password-vault feature. Reusing the 4-stage shell with your own content (Option A) is almost always less work than rewriting this.

**Rebranding:** event name/tagline/venue/date live in `src/data/event.ts` (`eventDetails`, near the top of the file — also `TEAM_MIN`/`TEAM_MAX` if your team size differs from four, and `REGISTRATION_DEADLINE_ISO`). Logos are plain files in `public/logos/` referenced from `src/components/Navbar.tsx` — swap the files (same filenames, or update the `<img src>` paths) and the favicon at `src/app/favicon.ico`.

## 7. Create your admin account

There's no public sign-up for admin — you create the account directly in Supabase:

1. Supabase dashboard → **Authentication → Users → Add user** — set an email and password.
2. SQL Editor:
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'your-admin-email@example.com';
   ```
3. That's it. Sign in at `/admin/login` with the email/password from step 1. `/admin/*` is protected both server-side (`src/proxy.ts` redirects signed-out visitors before any admin page even loads) and on every single write (every `admin_*` RPC independently checks `is_admin()` server-side — a signed-in non-admin account genuinely cannot do anything, even by calling the RPCs directly).

Repeat step 1-2 for every organizer/judge who needs admin access — there's no role tiering, every admin account can do everything under `/admin`.

## 8. Run it locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a test team, sign in to `/admin` with the account from step 7, release Stage 1, and confirm you can see it unlock on `/stages`.

## 9. Deploy to your own domain

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick your repo. Don't click Deploy yet.
3. Expand **Environment Variables** and add the same four from your `.env.local` (step 4) — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_USE_MOCK=false`.
4. Click **Deploy**. You'll get a working `your-project.vercel.app` URL once the build finishes.
5. **Your own domain:** in the Vercel project → **Settings → Domains** → type your domain → **Add**. Vercel shows you either an A record or a CNAME record to add — go to wherever your domain's DNS is managed (your registrar, or wherever you bought the domain) and add that exact record. Vercel detects it automatically once DNS propagates (usually minutes, sometimes up to a few hours) and issues an SSL certificate for you — no extra step needed for HTTPS.

Every future `git push` to your main branch redeploys automatically.

## 10. Before you open registration — a checklist

- [ ] All migrations through `0022_cyber_theme_assignments.sql` ran without error (step 5).
- [ ] Your admin account can sign in at `/admin/login` (step 7).
- [ ] Stage wording matches your event, not the original organizers' (step 6) — check `/stages` while signed in as admin.
- [ ] `src/data/event.ts`'s `REGISTRATION_DEADLINE_ISO` is set to your real deadline.
- [ ] Challenge materials are uploaded: `/admin/stages` → each stage → Upload Asset.
- [ ] If you're keeping the BugX mechanic: `/admin/stages/bugx-hacker` → Secrets tab → set the real password (it's hashed server-side, never stored as typed) and the Google Form URL.
- [ ] `event_state.status` is `upcoming` (not `live` or `finished`) until you're actually ready to start — check via the SQL Editor: `select status from event_state;`.
- [ ] Leaderboard visibility is `hidden` until you want it public (it defaults to hidden — this is intentional, not a bug).
- [ ] Registration is open (`registration_closed = false` — it defaults to open).

## 11. Running the event (admin day-of flow)

From `/admin`, per stage: **Release** (teams can see it's coming) → **Start** (it goes live) → teams play → **End** (closes it, unlocks the next one for teams who finished). Apply a qualification cutoff between stages if your event has one (`src/data/event.ts`'s `CUTOFFS`). Score submissions from `/admin/scoring`. Toggle the leaderboard public when you want it on the venue screen (the "Copy Projector Link" button gives you a link that shows the real leaderboard even while it's set to hidden for everyone else — use that for the projector/venue screen specifically). Close registration from the same Event Flow panel if you need to cut it off early.

## 12. Rehearsing without real participants

```bash
ALLOW_SIMULATE_EVENT=true node --env-file=.env.local scripts/simulate-event.ts
```

Creates 20 test teams through the real registration RPCs with seeded scores, so you can rehearse cutoffs, the visibility toggle, and the leaderboard under load. Refuses to run without that env var (it's a safety gate, not a toggle to leave on). Clean up afterward with the same command plus `--cleanup`.

---

## Supabase backend (Phase 1 + 2) — dev notes and verification checklists

Setup and admin-account creation are covered in full above (sections 1-7). The rest of this file is the original build-out's dev notes and QA checklists, kept for reference. One setup gotcha that's easy to hit and isn't mentioned above:

**Realtime:** the migrations add `teams`/`members`/`scores`/`event_state`/`activity` to the `supabase_realtime` publication via `alter publication`, but double-check Database → Replication in the dashboard — some Supabase projects need Realtime toggled on per-table in the UI too, on top of what the migration does.

### ⚠️ Before running 0003: clean up rows missing reg_no/email

Migration `0003` makes `members.reg_no` and `members.email` `NOT NULL`. Any member row created before the richer registration form (Phase 2) collected those — e.g. anything made while only `/register` existed, or test rows created directly via `create_team`/`join_team` without those params — will **block the migration** from applying. Find them first:

```sql
select m.id, m.name, m.team_id, t.name as team_name
from members m
join teams t on t.id = m.team_id
where m.reg_no is null or m.email is null;
```

Either delete those teams (`delete from teams where id = '<team_id>';` — cascades to members/scores/activity) or backfill `reg_no`/`email` by hand, then run `0003`.

### Rate limiting note

`lib/registration.ts` has a client-side debounce (`debounceGuard`) on `createTeam`/`joinTeam` — it's a UX nicety against accidental double-submits, **not** real rate limiting. A determined client can bypass it entirely (it's just a `setTimeout`-gated check in browser JS). Real abuse protection (e.g. capping join attempts per IP) needs a Supabase Edge Function sitting in front of the RPCs, which isn't built here.

### Phase 1 verification

- [ ] Create a team on phone A (`/register`), join from phones B and C (`/register/<code>`), confirm the lobby updates live on all three without refreshing.
- [ ] A 6th joiner on a full team gets "Team is full" (`TEAM_FULL`).
- [ ] A duplicate `reg_no` on a second team gets "already on a team" (`ALREADY_REGISTERED`).
- [ ] Two browsers submit the 5th member of the same team at the same instant — exactly one succeeds, the other gets `TEAM_FULL`. (Verified locally with a real concurrency test against Postgres — see commit history; two simultaneous `join_team` calls, only one lets the member in.)
- [ ] Insert a row into `scores` via the SQL editor and confirm `/leaderboard` updates on two devices within ~10s (Realtime) without a manual refresh.
- [ ] Turn off wifi on one device, confirm the leaderboard shows "Reconnecting", turn wifi back on, confirm it recovers and catches up (10s polling fallback covers the gap even if the Realtime socket doesn't reconnect cleanly).
- [ ] With only the anon key (e.g. `curl` with `apikey`/`Authorization` headers, no session), confirm `select * from members` and `select * from teams` return `[]`/403 — never phone or email.

### Phase 2 verification

- [ ] Create an admin user (section 7, above), sign in at `/admin/login`.
- [ ] A second, non-admin Supabase user (or the anon key directly) calling any `admin_*` RPC gets `NOT_ADMIN` (`VI010`), and can't read `members.email`/`phone` or `score_audit`.
- [ ] Start Stage 1 from the dashboard; confirm the countdown moves in sync on two other devices (`/leaderboard`, open in an incognito window = unauthenticated view).
- [ ] Pause — confirm the public timer **freezes** (doesn't drift to 00:00) on another device; Resume — confirm it picks up from the frozen value, not from the original end time.
- [ ] Extend +30s/+1m/+5m while live; confirm the public countdown updates.
- [ ] Enter a score in the grid or Judge Quick Mode; confirm `/leaderboard` moves within ~10s on another device.
- [ ] Lock a stage; confirm a normal (non-forced) score save on that stage is rejected (`STAGE_LOCKED`), and a forced save still goes through.
- [ ] Undo a score; confirm the reverted value appears on the leaderboard and a new row appears in `/admin/log`'s audit table.
- [ ] On the Teams page, try to move a member into a team that's already at 5 — confirm it's rejected (`TEAM_FULL`), not silently overfilled.
- [ ] Concurrency: two admin sessions call `admin_add_member` (or `admin_move_member`) targeting the same team's 5th slot at the same instant — exactly one succeeds (verified locally the same way as the Phase 1 join race, via the same `FOR UPDATE` row lock).
- [ ] Disconnect the network while a score save is in flight; confirm it shows up in the "unsaved" queue on the dashboard, and that it actually saves (and the queue clears) once the connection returns — it should never just silently disappear.

### Phase 3, Section A — Join by code

Adds `supabase/migrations/0005_team_lookup.sql` on top of 0001-0004 (not edited). Run it in the SQL editor like the earlier migrations before testing on a real project. No new env vars.

- [ ] On `/register`, pick "Join With a Code", type a real code with the dash missing, lowercase, and with stray spaces (e.g. `dum 1234` for `DUM-1234`) — "Find Team" still resolves it.
- [ ] The preview card shows only the team name, `n/5` slots, and the captain's first name — never a full roster, reg no., email, or phone (check the Network tab, not just the UI).
- [ ] An invalid code shows "No team found for that code" with a "Register a new team instead" link; a code for a full team shows "This team is already full" and never shows the member form.
- [ ] Join with a reg. no. already used by another team → "That registration number is already on a team" (`ALREADY_REGISTERED`).
- [ ] Join after `event_state.registration_deadline` has passed → "Registration has closed" (`REGISTRATION_CLOSED`).
- [ ] Tapping "Find Team" or "Join Team" repeatedly within ~700ms shows "Please wait a moment before trying again" (`RATE_LIMITED`) instead of double-submitting.
- [ ] Go offline (airplane mode / devtools "Offline") and try "Find Team" or "Join Team" → "Network error. Please check your connection and try again." (`NETWORK_ERROR`), not a raw exception or a blank error.
- [ ] Opening an existing invite link (`/register/DUM-XXXX`) still prefills the code and auto-looks it up — no change for people arriving via the QR/link instead of typing.
- [ ] Opening your own invite link in the same browser you joined/created from resolves straight to the lobby (correct captain/member view) instead of showing the join form again.

### Phase 3, Section E — Leaderboard visibility switch

Adds `supabase/migrations/0006_leaderboard_visibility.sql` on top of 0001-0005 (not edited — the spec's own text calls this "Migration 0005", written before Section A turned out to need a migration of its own; numbers shifted, nothing about the design did). Run it in the SQL editor before testing. No new env vars.

**Heads up:** `event_state.leaderboard_visibility` defaults to `'hidden'`. The moment this runs on a real project, the public `/leaderboard` shows the "hidden" card until an admin flips it to public from the dashboard's new Leaderboard Visibility section — this is intentional (fail-closed), not a bug.

- [ ] With visibility `hidden` and no admin session, call `get_leaderboard()` with the anon key (e.g. via the browser's Network tab on `/leaderboard`) → `teams: []`, `activity: []`, `total_teams: 0`, `shown_teams: 0`. No team or activity data in the payload, full stop.
- [ ] As the anon key, `select * from leaderboard_view`, `select * from activity`, and `select * from scores` all fail with "permission denied" — there is no direct path left, only `get_leaderboard()`.
- [ ] From `/admin`, click "Show to Everyone" (confirmation dialog appears) → `/leaderboard` in another (signed-out) browser updates to show teams within ~10s, even without a manual refresh (Realtime on `event_state`, 10s poll as the fallback).
- [ ] Click "Copy Projector Link", open it in an incognito window while visibility is still `hidden` → the real leaderboard shows (the token bypasses `hidden`), with no sign-in.
- [ ] Click "Rotate Projector Link", then reload the *old* projector link → it now behaves like any other unauthorized visitor (hidden card, no data). The new link works.
- [ ] Signed in as a non-admin Supabase user (or just the anon key), call `admin_set_leaderboard_visibility`/`admin_rotate_projector_token` directly → rejected (`NOT_ADMIN` / `VI010`), never reaches the point of changing anything.
- [ ] Every visibility toggle and token rotation adds a row to `admin_audit_log` (`action`, `from`/`to` or the new token in `detail`, `admin_id`, `created_at`) — there is no admin action here that doesn't leave a trail.
- [ ] Mock mode (`NEXT_PUBLIC_USE_MOCK=true` or no Supabase env vars) is unaffected — visibility is always `"public"` there, so local/demo work isn't gated by a feature that only exists against the real backend.
- [ ] Signed in as admin on `/leaderboard`, click "Show Eliminated Teams" → `get_leaderboard` is called with `p_show_eliminated: true` and the full (unfiltered) team list returns, even after a cutoff has been applied. Toggling it off (or opening `/leaderboard` signed out) goes back to the qualifiers-only view. The button itself never renders for a non-admin session.

### Phase 3, Section C — Sequential stage release

Adds `supabase/migrations/0007_stage_release.sql` and `0010_stage_override_rev.sql` on top of 0001-0009 (not edited). Run both in the SQL editor, in order, before testing. No new env vars.

- [ ] With `released_stage = 0`, every stage shows `LOCKED` for every team via `get_stage_access`, regardless of completion state.
- [ ] Admin clicks "Release" on Stage 2 in the Event Flow stepper → a team that completed Stage 1 flips to `RELEASED` for Stage 2 within ~10s on an already-open `/stages` tab, with no manual refresh (Realtime on `event_state`, 10s poll fallback — see `useStageGate`). A team that has *not* completed Stage 1 stays `LOCKED` after the same release.
- [ ] Admin grants a per-team override (`admin_set_team_stage_override`) for a team stuck on `LOCKED` → that team's `/stages` page updates to `RELEASED`/`LIVE` within the same ~10s window, without the team reloading. (This is what `0010_stage_override_rev.sql` fixes — overrides didn't bump `leaderboard_rev` before, so this update only reached the 10s poll on `/leaderboard`, never the stage-gate hook at all.)
- [ ] Admin ends Stage 1 (`admin_end_stage`) before a team has submitted → every open student stage page shows "Stage Ended" and closed submissions; the team's state becomes `COMPLETED` (ended-by-host), not stuck on `LIVE` forever.
- [ ] `get_stage_content`/`submit_stage_result` for a `LOCKED` or `RELEASED` (not yet `LIVE`) stage both refuse server-side (`VI021`/`VI022`) even if called directly with a valid team code/reg no. — never just a client-side gate.
- [ ] A signed-out visitor calling `get_stage_access()` with no code sees only released stage numbers; names stay hidden unless `admin_set_reveal_stage_names(true)` has been called (default `false`).
- [ ] Two admins pressing "Release" on the same stage at the same instant don't corrupt `stage_progress` — the second call is a no-op (`status = 'released'` already), not a duplicate row or an error.

### Phase 3, Section D — Qualification cutoffs

Adds `supabase/migrations/0008_qualification_cutoffs.sql` on top of 0001-0007, 0010 (not edited). Run it in the SQL editor before testing. No new env vars; `CUTOFFS`/`ADVANCE_RULE`/`TIE_AT_CUTOFF` live in `src/data/event.ts`.

- [ ] With 11 `ready` teams and `{ afterStage: 2, keep: 'half' }`, `admin_preview_cutoff(2)` returns `keep = 6` (`ceil(11 / 2)`), the ranked list, and the cut line between rank 6 and 7.
- [ ] Give teams scores in later stages, then preview the cutoff after Stage 2 → the preview totals/ranks include only Stage 1 and Stage 2 scores.
- [ ] Create a tie at rank 6/7 (equal cumulative scores) → the preview's `tie_warning` is `true` and tied teams default to checked; the judge can select/deselect each team, and only checked teams advance when applied.
- [ ] `admin_apply_cutoff` is disabled (button greyed out) until Stage 2 has actually ended; once applied, it's audited and snapshots `qualifiers` — a later `admin_set_score` correction does not silently change who qualified.
- [ ] After applying, the public `/leaderboard` (`get_leaderboard`, non-admin) shows only the checked qualifiers and the round badge includes the stage, configured target, and actual advancing count; an eliminated team's own `/stages` page shows "You finished #N of 11" with its score breakdown, not the stage list.
- [ ] With `ADVANCE_RULE = 'eliminate'` (default), an eliminated team's `get_stage_content` call for Stage 3 is refused (`VI020` / `ELIMINATED`) even with a valid session. With `'display_only'`, the same team can still open Stage 3 content but stays off the public leaderboard.
- [ ] `admin_undo_cutoff(2)` removes the Stage-2 qualifier snapshot and any later one (e.g. a Stage-3 cutoff applied on top of it) — all 11 teams reappear on the public leaderboard and eliminated teams regain access.
- [ ] Admin's Event Flow "Per-Team Access" table always lists every team (including `ELIMINATED` ones) regardless of the cutoff filter — organizers never lose visibility, even without the `/leaderboard` "Show Eliminated Teams" toggle.
- [ ] On `/admin/scoring`, Cyber Styling displays its five 100-point criteria and Prompt Charades displays both rounds; each round is scored out of 100 and the saved Prompt Charades leaderboard score is their average.

### Phase 3, Section B — Admin stage pages simplified + anti-leak

`AdminStageClient` keeps Details/Phases/Rubric as **read-only** (stage definitions are fixed, seeded data — see `0004_stage_pages.sql`/`0009_stage_content.sql`); only Assets, Assignments, and Secrets remain editable. No migration of its own beyond `0009_stage_content.sql` (content/submission RPCs).

- [ ] `/admin/stages/[slug]` has no input, textarea, or save button anywhere under the Details, Phases, or Rubric tabs — viewing them only.
- [ ] View-source and the Network tab on a locked stage's `/stages/[slug]` page contain none of that stage's `hook`, `rules_md`, `roles_md`, or asset text — `useStageGate` never calls `getStageContent` unless the team's own state for that stage is already `LIVE` or `COMPLETED`, and `get_stage_content` refuses server-side regardless (see Section C checks above). There is no client-imported `/data` module containing stage content — it's DB-only, read through the gated RPC.
- [ ] The stage system has no mock-mode fallback (unlike registration/leaderboard) — `getStageAccess`/`getStageContent` against a backend with no Supabase env vars return all-`LOCKED` rather than throwing.

### Phase 3, Section F — Stage completion in the team experience

Covered by `StageProgressRail`/`StageLockCard` (`src/components/stages/`), rendered at the top of `/stages` (`StagesIndexClient`) — the spec's `/play/[code]` is this app's `/stages`, there's no separate route.

- [ ] `/stages` shows all 4 stages as a progress rail; a team's own node reflects `locked`/`released`/`live`/`completed`/`eliminated` per `get_stage_access`, not just a flat list.
- [ ] After submitting, a team sees "Stage N completed" with its submission summary and "Waiting for the host to release Stage N+1" — not a bare locked card indistinguishable from a stage it hasn't reached yet.
- [ ] A stage ended by the host before a team submitted still shows that team's node as `completed` (ended), matching the Section C check above — lateness never blocks progression.

### Stage 1/2 scoring and manual shortlisting

Apply `supabase/migrations/0020_shortlisting.sql` followed by `supabase/migrations/0021_shortlist_enforcement.sql` to the Supabase project, after the preceding migrations. The first migration adds the 60/100 default cutoff, optional per-stage minimums, decision/audit fields, and the Stage 3/4 access gate. The second adds atomic preliminary-score saves and enforces shortlist approval for later-stage scoring and assignments. These SQL files are source migrations; do not assume they have run on an existing Supabase project.

At `/admin/scoring`, Stage 1 and Stage 2 scores are persisted in the existing unique `(team_id, stage)` score rows. Combined score is derived only after both marks exist. Shortlisting is a separate admin decision: eligible teams do not gain later-stage access until explicitly approved. A below-cutoff approval requires a confirmation and is recorded as an override. Changing the cutoff recalculates eligibility without changing saved decisions. Stage 3/4 content, submission, scoring, and assignment operations check the current shortlist decision on the backend.

### Cyber Styling team themes

Run `supabase/migrations/0022_cyber_theme_assignments.sql` after migration 0021. The existing Cyber Styling showcase is available at `/cyber-styling.html`. Its official catalog contains the 38 requested UI themes and practical build instructions. It reads eligible team IDs and names using the existing registration rule (`ready`/`full`) and displays the theme catalog and assignments without exposing participant contact details. Theme pairing is randomized and committed atomically in Supabase by an admin-only RPC; refreshes and different devices read the saved mapping. Assignment requires exactly 38 eligible teams. If there are more than 38 eligible teams, the current event rules do not specify which 38 to select, so the operation is blocked rather than inventing a selection rule. An explicit admin-only reassign action requires confirmation and uses an assignment version to reject stale concurrent requests.

- [ ] Verify a score of zero is retained as a completed mark, blank fields do not clear existing marks, and the combined score remains pending until both marks exist.
- [ ] Verify below/equal/above-cutoff eligibility and optional stage minimums; update the cutoff and confirm saved decisions remain unchanged and conflicts are flagged for review.
- [ ] Approve an eligible team and verify it can enter Stage 3/4 when released; reject or hold a team and verify stage content, submissions, and scoring are denied.
- [ ] Confirm a below-cutoff override requires an explicit admin confirmation and sets the override indicator; a pending-score team cannot be approved.
- [ ] Refresh `/admin/scoring` and verify marks and decisions persist; test score edits by an authenticated non-admin and direct RPC calls, which must be rejected.
