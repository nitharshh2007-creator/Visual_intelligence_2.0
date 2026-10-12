"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  adminAddMember, adminDeleteTeam, adminGetTeams, adminMoveMember, adminRemoveMember,
  adminRenameTeam, adminSetRegistrationDeadline, subscribeAdminRealtime, AdminError,
} from "@/lib/admin";
import { getSupabaseClient } from "@/lib/supabase";
import type { AdminTeamDetail, EventStateRow } from "@/lib/supabase";

export default function AdminTeamsClient() {
  const [teams, setTeams] = useState<AdminTeamDetail[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "incomplete" | "ready" | "full">("all");
  const [deadline, setDeadline] = useState("");
  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: "", regNo: "", email: "", phone: "", section: "", year: "" });
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    const list = await adminGetTeams().catch(() => []);
    setTeams(list);
    const { data: es } = await getSupabaseClient().from("event_state").select("*").eq("id" as never, 1).maybeSingle();
    if (es) setDeadline((es as EventStateRow).registration_deadline.slice(0, 16));
  }

  useEffect(() => {
    function init() {
      refresh();
    }
    init();
    const unsubscribe = subscribeAdminRealtime(refresh);
    return unsubscribe;
  }, []);

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return teams
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.members.some((m) => m.name.toLowerCase().includes(q) || m.reg_no.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, search, statusFilter]);

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRename(team: AdminTeamDetail) {
    const name = prompt("New team name:", team.name);
    if (!name || name === team.name) return;
    try {
      await adminRenameTeam(team.id, name);
      notify("Renamed");
      refresh();
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleDelete(team: AdminTeamDetail) {
    const typed = prompt(`Type "${team.name}" to confirm deletion. This cannot be undone.`);
    if (typed !== team.name) return;
    try {
      await adminDeleteTeam(team.id);
      notify("Team deleted");
      refresh();
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleRemoveMember(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this team?`)) return;
    try {
      await adminRemoveMember(memberId);
      notify("Member removed");
      refresh();
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleMoveMember(memberId: string, name: string) {
    const destCode = prompt(`Move ${name} to which team code?`);
    if (!destCode) return;
    const dest = teams.find((t) => t.code.toUpperCase() === destCode.trim().toUpperCase());
    if (!dest) {
      notify("No team with that code");
      return;
    }
    try {
      await adminMoveMember(memberId, dest.id);
      notify(`Moved to ${dest.name}`);
      refresh();
    } catch (e) {
      notify(e instanceof AdminError && e.code === "TEAM_FULL" ? "Destination team is full" : "Failed");
    }
  }

  async function handleAddMember(teamId: string) {
    if (!newMember.name.trim() || !newMember.regNo.trim() || !newMember.email.trim()) {
      notify("Name, reg no and email are required");
      return;
    }
    try {
      await adminAddMember(
        teamId, newMember.name, newMember.regNo, newMember.email,
        newMember.phone || undefined, newMember.section || undefined,
        newMember.year ? Number(newMember.year) : undefined
      );
      notify("Member added");
      setAddingToTeam(null);
      setNewMember({ name: "", regNo: "", email: "", phone: "", section: "", year: "" });
      refresh();
    } catch (e) {
      notify(e instanceof AdminError && e.code === "TEAM_FULL" ? "Team is full" : e instanceof AdminError ? e.message : "Failed");
    }
  }

  async function handleDeadlineSave() {
    try {
      await adminSetRegistrationDeadline(new Date(deadline).toISOString());
      notify("Deadline updated");
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed");
    }
  }

  function copyInviteLink(code: string) {
    const link = `${window.location.origin}/register/${code}`;
    navigator.clipboard?.writeText(link);
    notify("Invite link copied");
  }

  function exportCsv() {
    const rows: string[] = ["team_name,team_code,status,member_name,reg_no,email,phone,section,year,role"];
    teams.forEach((t) => {
      t.members.forEach((m) => {
        rows.push([t.name, t.code, t.status, m.name, m.reg_no, m.email, m.phone ?? "", m.section ?? "", m.year ?? "", m.role]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teams-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="font-mono space-y-6">
      {toast && (
        <div className="fixed top-20 right-4 z-[60] px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-xs">{toast}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans font-bold uppercase tracking-[0.12em] text-lg text-white/80">Teams</h1>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white"
          />
          <button onClick={handleDeadlineSave} className="px-3 py-1.5 rounded-lg border border-white/15 text-[10px] uppercase tracking-wider hover:bg-white/5">
            Save Deadline
          </button>
          <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 text-[#060912] text-[10px] uppercase font-bold tracking-wider">
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, member or reg no…"
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-white/30 flex-1 min-w-[200px]"
        />
        {(["all", "incomplete", "ready", "full"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-lg text-[10px] uppercase tracking-wider border ${
              statusFilter === s ? "bg-cyan-400/10 border-cyan-400/40 text-cyan-300" : "border-white/15 text-white/50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider text-[10px]">
              <th className="text-left py-2 px-3">Name</th>
              <th className="text-left py-2 px-3">Code</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Members</th>
              <th className="text-left py-2 px-3">Captain</th>
              <th className="text-left py-2 px-3">Created</th>
              <th className="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <Fragment key={t.id}>
                <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2 px-3">
                    <button onClick={() => toggle(t.id)} className="text-white hover:text-cyan-300">
                      {expanded.has(t.id) ? "▾" : "▸"} {t.name}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-white/60">{t.code}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                      t.status === "full" ? "bg-emerald-500/10 text-emerald-300" : t.status === "ready" ? "bg-cyan-500/10 text-cyan-300" : "bg-amber-500/10 text-amber-300"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-white/60">{t.member_count}</td>
                  <td className="py-2 px-3 text-white/60">{t.members.find((m) => m.role === "captain")?.name ?? "—"}</td>
                  <td className="py-2 px-3 text-white/40">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2 text-[10px]">
                      <button onClick={() => copyInviteLink(t.code)} className="text-cyan-300 hover:underline">link</button>
                      <button onClick={() => handleRename(t)} className="text-white/50 hover:underline">rename</button>
                      <button onClick={() => setAddingToTeam(addingToTeam === t.id ? null : t.id)} className="text-white/50 hover:underline">add</button>
                      <button onClick={() => handleDelete(t)} className="text-red-400 hover:underline">delete</button>
                    </div>
                  </td>
                </tr>
                {addingToTeam === t.id && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={7} className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {(["name", "regNo", "email", "phone", "section", "year"] as const).map((field) => (
                          <input
                            key={field}
                            value={newMember[field]}
                            onChange={(e) => setNewMember((m) => ({ ...m, [field]: e.target.value }))}
                            placeholder={field}
                            className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white w-28"
                          />
                        ))}
                        <button onClick={() => handleAddMember(t.id)} className="px-3 py-1.5 rounded bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 text-[#060912] text-[10px] uppercase font-bold">
                          Add Member
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {expanded.has(t.id) && (
                  <tr className="bg-white/[0.015]">
                    <td colSpan={7} className="p-3">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-white/30 uppercase tracking-wider text-[9px]">
                            <th className="text-left py-1">Name</th>
                            <th className="text-left py-1">Reg No</th>
                            <th className="text-left py-1">Email</th>
                            <th className="text-left py-1">Phone</th>
                            <th className="text-left py-1">Role</th>
                            <th className="text-left py-1">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.members.map((m) => (
                            <tr key={m.id} className="border-t border-white/5">
                              <td className="py-1.5 text-white">{m.name}</td>
                              <td className="py-1.5 text-white/60">{m.reg_no}</td>
                              <td className="py-1.5 text-white/60">{m.email}</td>
                              <td className="py-1.5 text-white/60">{m.phone ?? "—"}</td>
                              <td className="py-1.5 text-white/60">{m.role}</td>
                              <td className="py-1.5">
                                <div className="flex gap-2">
                                  <button onClick={() => handleMoveMember(m.id, m.name)} className="text-cyan-300 hover:underline">move</button>
                                  <button onClick={() => handleRemoveMember(m.id, m.name)} className="text-red-400 hover:underline">remove</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-white/30">No teams match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
