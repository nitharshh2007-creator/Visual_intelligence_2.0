"use client";

import { useEffect, useState } from "react";
import { adminGetTeams, adminListScoreAudit, subscribeAdminRealtime } from "@/lib/admin";
import { getSupabaseClient } from "@/lib/supabase";
import type { AdminTeamDetail, ScoreAuditRow, ActivityRow } from "@/lib/supabase";

export default function AdminLogClient() {
  const [audit, setAudit] = useState<ScoreAuditRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [teams, setTeams] = useState<AdminTeamDetail[]>([]);
  const [teamFilter, setTeamFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<number | null>(null);

  async function refresh() {
    const [a, t] = await Promise.all([
      adminListScoreAudit(teamFilter || undefined, stageFilter ?? undefined).catch(() => []),
      adminGetTeams().catch(() => []),
    ]);
    setAudit(a);
    setTeams(t);
    const { data: act } = await getSupabaseClient().from("activity").select("*").order("created_at", { ascending: false }).limit(50);
    setActivity((act as ActivityRow[]) ?? []);
  }

  useEffect(() => {
    function init() {
      refresh();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, stageFilter]);

  useEffect(() => {
    return subscribeAdminRealtime(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="font-mono space-y-8">
      <h1 className="font-sans font-bold uppercase tracking-[0.12em] text-lg text-white/80">Audit & Activity</h1>

      <div className="flex flex-wrap gap-2">
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white"
        >
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={stageFilter ?? 0}
          onChange={(e) => setStageFilter(Number(e.target.value) || null)}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white"
        >
          <option value={0}>All stages</option>
          {[1, 2, 3, 4].map((s) => <option key={s} value={s}>Stage {s}</option>)}
        </select>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">Score Audit</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 px-3">Team</th>
                <th className="text-left py-2 px-3">Stage</th>
                <th className="text-left py-2 px-3">From → To</th>
                <th className="text-left py-2 px-3">Note</th>
                <th className="text-left py-2 px-3">When</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-b border-white/5">
                  <td className="py-2 px-3 text-white">{a.team_name}</td>
                  <td className="py-2 px-3 text-white/60">{a.stage}</td>
                  <td className="py-2 px-3 text-white/60">{a.old_points ?? "—"} → {a.new_points}</td>
                  <td className="py-2 px-3 text-white/40">{a.note ?? "—"}</td>
                  <td className="py-2 px-3 text-white/40">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-white/30">No audit entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">Public Activity Feed</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {activity.map((a) => (
            <div key={a.id} className="px-4 py-2.5 flex justify-between text-xs">
              <span className="text-white/70">{a.message}</span>
              <span className="text-white/30">{new Date(a.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
          {activity.length === 0 && <div className="px-4 py-6 text-center text-white/30 text-xs">No activity yet.</div>}
        </div>
      </section>
    </div>
  );
}
