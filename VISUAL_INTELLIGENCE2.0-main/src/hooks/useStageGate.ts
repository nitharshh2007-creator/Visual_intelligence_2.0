"use client";

import { useEffect, useState } from "react";
import { loadSession } from "@/lib/registration";
import { getStageAccess, getStageContent } from "@/lib/stageAccess";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { StageAccessEntry, StageContentPayload } from "@/lib/supabase";

const POLL_MS = 10000; // fallback if the Realtime socket drops, same cadence as useLeaderboard

interface StageGate {
  hydrated: boolean;
  entry: StageAccessEntry | null; // null only if the slug doesn't exist at all
  content: StageContentPayload | null; // set only once state is LIVE/COMPLETED
  session: { teamCode: string; regNo: string | null } | null;
  refresh: () => void;
}

// Shared by /stages/[slug], .../challenge, .../submit, .../result — one
// gate check per page load. content stays null (no fetch attempted)
// unless the team's own state for this stage is LIVE or COMPLETED;
// the RPC would refuse anyway, but there's no reason to even ask.
export function useStageGate(slug: string): StageGate {
  const [hydrated, setHydrated] = useState(false);
  const [entry, setEntry] = useState<StageAccessEntry | null>(null);
  const [content, setContent] = useState<StageContentPayload | null>(null);
  const [tick, setTick] = useState(0);
  const session = loadSession();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const access = await getStageAccess(session?.teamCode, session?.regNo);
      const found = access.find((s) => s.slug === slug) ?? null;
      if (cancelled) return;
      setEntry(found);

      if (session && found && (found.state === "LIVE" || found.state === "COMPLETED")) {
        try {
          const c = await getStageContent(session.teamCode, session.regNo ?? "", slug);
          if (!cancelled) setContent(c);
        } catch {
          if (!cancelled) setContent(null);
        }
      } else {
        setContent(null);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tick]);

  // Unlocks (admin_release_stage, admin_set_team_stage_override, a
  // cutoff apply/undo) all bump event_state.leaderboard_rev — see
  // supabase/migrations/0006/0008/0010 — so a single subscription to
  // that one row is a complete "something changed, re-check access"
  // signal, same pattern as useLeaderboard. A manual `tick` bump
  // re-runs the effect above, which re-fetches access (and content,
  // if now LIVE/COMPLETED).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("stage-gate-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, () => {
        setTick((t) => t + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 10s polling fallback, independent of Realtime's own connection state.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return { hydrated, entry, content, session, refresh: () => setTick((t) => t + 1) };
}
