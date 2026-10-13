"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  adminEndStage, adminRestartEvent,
  adminRotateProjectorToken, adminSetAnnouncement, adminSetEventStatus, adminSetLeaderboardVisibility,
  adminSetRegistrationClosed, adminSetStage, subscribeAdminRealtime, AdminError,
} from "@/lib/admin";
import { getSupabaseClient } from "@/lib/supabase";
import type { EventStateRow } from "@/lib/supabase";
import { AlertTriangle } from "lucide-react";
import EventFlowPanel from "./EventFlowPanel";

// Stages are started/ended purely by admin action — no fixed duration
// or live countdown anywhere in the UI. admin_set_stage's RPC
// signature still requires a duration (stage_ends_at is stored but
// nothing reads it for gating — see stage_completion/_team_stage_state,
// which key off stage_progress.status, not this clock), so this is
// just a generous value that satisfies the RPC without ever being
// shown or meaning anything to an admin.
const UNTIMED_STAGE_DURATION_SECONDS = 4 * 60 * 60;

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

export default function AdminDashboard() {
  const [eventState, setEventState] = useState<EventStateRow | null>(null);
  const [connection, setConnection] = useState<"connected" | "reconnecting">("reconnecting");
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const eventStateReadRef = useRef(0);
  const eventStatusActionRef = useRef(false);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const fetchAll = useCallback(async () => {
    const requestId = ++eventStateReadRef.current;
    const supabase = getSupabaseClient();
    const { data: es, error } = await supabase.from("event_state").select("*").eq("id" as never, 1).maybeSingle();
    if (error) {
      pushToast("error", `Failed to load event status: ${error.message}`);
      return;
    }
    if (!es) {
      pushToast("error", "The event status row was not found.");
      return;
    }
    if (requestId === eventStateReadRef.current) setEventState(es as EventStateRow);
  }, [pushToast]);

  useEffect(() => {
    function init() {
      fetchAll();
    }
    init();
  }, [fetchAll]);

  useEffect(() => {
    const unsubscribe = subscribeAdminRealtime(fetchAll);
    const supabase = getSupabaseClient();
    const channel = supabase.channel("admin-conn-status").subscribe((status) => {
      if (status === "SUBSCRIBED") setConnection("connected");
      else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("reconnecting");
    });
    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  async function handleStartStage(stage: number): Promise<boolean> {
    if (!confirm(`Start Stage ${stage}? This is live immediately for all teams.`)) return false;
    try {
      await adminSetStage(stage, UNTIMED_STAGE_DURATION_SECONDS);
      pushToast("success", `Stage ${stage} started`);
      fetchAll();
      return true;
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed to start stage");
      return false;
    }
  }

  async function handleEndStage(): Promise<boolean> {
    if (!confirm("End the current stage now for everyone?")) return false;
    try {
      await adminEndStage();
      pushToast("success", "Stage ended");
      fetchAll();
      return true;
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed to end stage");
      return false;
    }
  }

  async function handleSetEventStatus(status: "live" | "finished"): Promise<boolean> {
    if (eventStatusActionRef.current) return false;
    eventStatusActionRef.current = true;
    try {
      const savedState = await adminSetEventStatus(status);
      eventStateReadRef.current += 1;
      setEventState(savedState);
      pushToast(
        "success",
        status === "finished" ? "Event finished" : "Event status is live",
      );
      return true;
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed to update event status");
      return false;
    } finally {
      eventStatusActionRef.current = false;
    }
  }

  async function handleRestartEvent(): Promise<boolean> {
    if (eventStatusActionRef.current) return false;
    eventStatusActionRef.current = true;
    try {
      const savedState = await adminRestartEvent();
      eventStateReadRef.current += 1;
      setEventState(savedState);
      pushToast("success", "Event restarted from Stage 1");
      return true;
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed to restart the event");
      return false;
    } finally {
      eventStatusActionRef.current = false;
    }
  }

  async function handlePublishAnnouncement() {
    try {
      await adminSetAnnouncement(announcementDraft);
      pushToast("success", announcementDraft ? "Announcement published" : "Announcement cleared");
      fetchAll();
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleToggleVisibility() {
    const next = eventState?.leaderboard_visibility === "public" ? "hidden" : "public";
    const verb = next === "public" ? "SHOW the leaderboard to everyone" : "HIDE the leaderboard from everyone";
    if (!confirm(`${verb}? This takes effect immediately for all visitors.`)) return;
    try {
      await adminSetLeaderboardVisibility(next);
      pushToast("success", next === "public" ? "Leaderboard is now public" : "Leaderboard is now hidden");
      fetchAll();
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleToggleRegistration() {
    const next = !eventState?.registration_closed;
    const verb = next ? "CLOSE registration now" : "REOPEN registration";
    if (!confirm(`${verb}? This takes effect immediately for every visitor to /register.`)) return;
    try {
      await adminSetRegistrationClosed(next);
      pushToast("success", next ? "Registration closed" : "Registration reopened");
      fetchAll();
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleCopyProjectorLink() {
    if (!eventState?.projector_token) return;
    const link = `${window.location.origin}/leaderboard?pt=${eventState.projector_token}`;
    await navigator.clipboard?.writeText(link);
    pushToast("success", "Projector link copied");
  }

  async function handleRotateProjectorLink() {
    if (!confirm("Rotate the projector link? The old link stops working immediately — update any screens using it.")) return;
    try {
      await adminRotateProjectorToken();
      pushToast("success", "Projector link rotated");
      fetchAll();
    } catch (e) {
      pushToast("error", e instanceof AdminError ? e.message : "Failed");
    }
  }

  const currentStage = eventState?.current_stage ?? 0;
  const locked = eventState?.scores_locked_stage ?? [];

  return (
    <div className="space-y-8">
      {/* Toasts */}
      <div className="fixed top-20 right-4 z-[60] space-y-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg text-xs font-mono border backdrop-blur-md shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] ${
              t.kind === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {connection === "reconnecting" && (
        <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Connection lost — reconnecting…</span>
          </span>
          <button onClick={fetchAll} className="underline hover:text-amber-200">Refresh</button>
        </div>
      )}

      {/* Top bar — read-only status; every control lives in Event Flow below */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md admin-panel">
        <div className="flex items-center gap-4 flex-wrap">
          <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border ${
            connection === "connected" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connection === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            {connection === "connected" ? "Live" : "Reconnecting"}
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-white/15 text-white/60">
            Event: {eventState?.status ?? "—"}
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-white/15 text-white/60">
            Registration: {eventState ? (eventState.registration_closed ? "closed" : "open") : "—"}
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-white/15 text-white/60">
            Leaderboard: {eventState?.leaderboard_visibility ?? "—"}
          </span>
          <button onClick={fetchAll} className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white underline">
            Refresh
          </button>
        </div>
        <div className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-white/15 text-white/60">
          Stage {currentStage || "—"} {locked.includes(currentStage) && <span className="text-red-400">· LOCKED</span>}
        </div>
      </div>

      <EventFlowPanel
        eventState={eventState}
        onStart={handleStartStage}
        onEnd={handleEndStage}
        onToggleVisibility={handleToggleVisibility}
        onSetEventStatus={handleSetEventStatus}
        onRestartEvent={handleRestartEvent}
        onEventStateChanged={fetchAll}
        onCopyProjectorLink={handleCopyProjectorLink}
        onRotateProjectorLink={handleRotateProjectorLink}
        onToggleRegistration={handleToggleRegistration}
      />

      {/* Announcement */}
      <section className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md admin-panel">
        <h2 className="font-sans font-bold uppercase tracking-[0.12em] text-sm text-white/80 mb-4">Announcement</h2>
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <input
            aria-label="Announcement"
            value={announcementDraft}
            onChange={(e) => setAnnouncementDraft(e.target.value)}
            placeholder={eventState?.announcement || "Message shown as a banner on the public leaderboard"}
            className="flex-1 basis-full sm:basis-auto px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30"
          />
          <button onClick={handlePublishAnnouncement} className="px-4 py-2 rounded-lg bg-[linear-gradient(180deg,#8a1a2b,#6b0f1a_55%,#4a0a12)] border border-[#4a0a12] text-[#faf8f3] text-[10px] uppercase font-bold tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_18px_-10px_rgba(138,26,43,0.9)] hover:brightness-110 transition-[filter]">
            Publish
          </button>
          <button onClick={() => { setAnnouncementDraft(""); handlePublishAnnouncement(); }} className="px-4 py-2 rounded-lg border border-white/15 text-[10px] uppercase tracking-wider hover:bg-white/5">
            Clear
          </button>
        </div>
      </section>

      {/* Team Directory & Shortlisting Hub Quick Links */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-[#800020]/20 via-black to-black border border-[#800020]/40 space-y-3 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span>Team Management &amp; Progression Hub</span>
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              Access the master team directory, execute Level 3 shortlisting, manage Level 4 finalists, and review eliminated teams.
            </p>
          </div>
          <Link
            href="/admin/teams?tab=all"
            className="px-4 py-2 rounded-xl bg-white text-black font-bold uppercase text-[11px] tracking-wider hover:bg-white/90 transition-all shrink-0 text-center"
          >
            Open Directory →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <Link
            href="/admin/teams?tab=all"
            className="p-3 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all group"
          >
            <span className="text-[10px] uppercase text-white/50 block group-hover:text-white">Master Directory</span>
            <span className="text-white font-bold text-xs mt-1 block">All Teams →</span>
          </Link>
          <Link
            href="/admin/teams?tab=l3"
            className="p-3 rounded-lg bg-wine-950/20 border border-wine-500/20 hover:bg-wine-950/40 hover:border-wine-500/40 transition-all group"
          >
            <span className="text-[10px] uppercase text-wine-400/60 block group-hover:text-wine-300">Level 3 Cutoff</span>
            <span className="text-wine-300 font-bold text-xs mt-1 block">Shortlist 10 →</span>
          </Link>
          <Link
            href="/admin/teams?tab=l4"
            className="p-3 rounded-lg bg-champagne-950/20 border border-champagne-500/20 hover:bg-champagne-950/40 hover:border-champagne-500/40 transition-all group"
          >
            <span className="text-[10px] uppercase text-champagne-400/60 block group-hover:text-champagne-300">Finalists</span>
            <span className="text-champagne-300 font-bold text-xs mt-1 block">Prompt Charades →</span>
          </Link>
          <Link
            href="/admin/teams?tab=eliminated"
            className="p-3 rounded-lg bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 hover:border-red-500/40 transition-all group"
          >
            <span className="text-[10px] uppercase text-red-400/60 block group-hover:text-red-300">Cut Teams</span>
            <span className="text-red-300 font-bold text-xs mt-1 block">Eliminated →</span>
          </Link>
        </div>
      </div>

      {/* Quick Link to Stages & Assets */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono admin-panel">
        <div>
          <h3 className="text-xs font-semibold text-white tracking-wide">Stage Readiness &amp; Asset Vault</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage challenge files, set BugX passwords, and verify readiness across all 4 stages.
          </p>
        </div>
        <Link
          href="/admin/stages"
          className="px-3.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white text-xs transition-colors shrink-0"
        >
          Manage Stages →
        </Link>
      </div>
    </div>
  );
}
