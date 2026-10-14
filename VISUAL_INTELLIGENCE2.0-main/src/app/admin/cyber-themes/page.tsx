"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Sparkles, Shuffle, ShieldAlert, Search, ArrowLeft, RefreshCw, Palette } from "lucide-react";
import { CYBER_THEMES, type CyberThemePaletteColor } from "@/data/cyberThemes";

interface AllocationItem {
  team_id: string;
  team_name: string;
  team_code: string;
  team_status: string;
  theme_id: string | null;
  theme_title: string | null;
  description_line1: string | null;
  description_line2: string | null;
  visual_style: string | null;
  palette: CyberThemePaletteColor[] | null;
  assigned_at: string | null;
}

interface AllocationsResponse {
  total_teams: number;
  assigned_teams: number;
  unassigned_teams: number;
  total_catalogue_themes?: number;
  available_themes?: number;
  round1_status: string;
  can_reassign: boolean;
  allocations: AllocationItem[];
}

export default function AdminCyberThemesPage() {
  const [data, setData] = useState<AllocationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadAllocations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/cyber-style/assignments", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load allocations");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch("/api/cyber-style/assignments", { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load allocations");
        }
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading data");
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAllocate = async (reassign: boolean) => {
    if (reassign) {
      const confirmed = window.confirm(
        "Are you sure you want to REASSIGN themes to ALL teams? Existing assignments will be replaced."
      );
      if (!confirmed) return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/cyber-style/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reassign }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Allocation failed");
      }
      showToast(reassign ? "Themes successfully randomized and reassigned!" : `Allocated themes to ${json.allocated_count ?? 0} team(s)!`);
      await loadAllocations();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const allocationsList = data?.allocations;
  const filteredAllocations = useMemo(() => {
    if (!allocationsList) return [];
    return allocationsList.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.team_name.toLowerCase().includes(search.toLowerCase()) ||
        item.team_code.toLowerCase().includes(search.toLowerCase()) ||
        (item.theme_title && item.theme_title.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "assigned" && item.theme_id !== null) ||
        (statusFilter === "unassigned" && item.theme_id === null);

      return matchesSearch && matchesStatus;
    });
  }, [allocationsList, search, statusFilter]);

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-wine-600 text-white font-mono font-bold text-xs shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-white/50 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2.5">
            <Palette className="w-6 h-6 text-wine-400" />
            Round 1 // Cyber Theme Allocation
          </h1>
          <p className="text-xs text-white/60 mt-1 font-mono">
            Manage the official {data?.total_catalogue_themes ?? CYBER_THEMES.length}-theme catalog and fair randomized team distribution (1 theme per team, zero repetition).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAllocations()}
            disabled={loading || actionLoading}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
            title="Refresh allocations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => handleAllocate(false)}
            disabled={loading || actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-600 hover:bg-wine-500 text-white font-mono font-bold text-xs transition-colors shadow-lg shadow-wine-500/20 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Assign Random Themes to Unassigned Teams
          </button>

          {data?.can_reassign ? (
            <button
              onClick={() => handleAllocate(true)}
              disabled={loading || actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/15 hover:border-red-500/30 text-white hover:text-red-300 font-mono text-xs transition-colors disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" />
              Reassign All
            </button>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono"
              title="Round 1 has already started or ended. Reassignments are locked to protect ongoing competition."
            >
              <ShieldAlert className="w-4 h-4" />
              Reassignment Locked
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md admin-panel">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Total Registered Teams</div>
          <div className="text-3xl font-black text-white font-mono mt-2">{data?.total_teams ?? 0}</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md admin-panel">
          <div className="text-[10px] font-mono uppercase tracking-wider text-wine-300">Themes Assigned</div>
          <div className="text-3xl font-black text-wine-400 font-mono mt-2">{data?.assigned_teams ?? 0}</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md admin-panel">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Pending Assignment</div>
          <div className={`text-3xl font-black font-mono mt-2 ${data?.unassigned_teams ? "text-amber-400" : "text-white/40"}`}>
            {data?.unassigned_teams ?? 0}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md admin-panel">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Themes Available</div>
          <div className="text-3xl font-black text-emerald-400 font-mono mt-2">
            {data?.available_themes ?? (CYBER_THEMES.length - (data?.assigned_teams ?? 0))}
            <span className="text-xs text-white/40 font-normal ml-1">/ {data?.total_catalogue_themes ?? CYBER_THEMES.length}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md admin-panel">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Round 1 State</div>
          <div className="text-lg font-bold text-white font-mono mt-2 uppercase flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                data?.round1_status === "live"
                  ? "bg-emerald-400 animate-pulse"
                  : data?.round1_status === "ended"
                  ? "bg-white"
                  : "bg-wine-400"
              }`}
            />
            {data?.round1_status ?? "loading"}
          </div>
        </div>
      </div>

      {/* Reassignment Safety Notice */}
      {!data?.can_reassign && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-mono flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            <strong>Safety Lock Active:</strong> Round 1 is currently {data?.round1_status}. Reassigning themes is strictly disabled so no teams experience mid-round theme shifts.
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 admin-panel">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team name, code, or theme title…"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-wine-500/50"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === "all" ? "bg-white/15 text-white font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            All ({data?.allocations.length ?? 0})
          </button>
          <button
            onClick={() => setStatusFilter("assigned")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === "assigned" ? "bg-wine-500/20 text-wine-300 font-bold border border-wine-500/30" : "text-white/50 hover:text-white"
            }`}
          >
            Assigned ({data?.assigned_teams ?? 0})
          </button>
          <button
            onClick={() => setStatusFilter("unassigned")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === "unassigned" ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30" : "text-white/50 hover:text-white"
            }`}
          >
            Unassigned ({data?.unassigned_teams ?? 0})
          </button>
        </div>
      </div>

      {/* Allocation List Table */}
      {error ? (
        <div className="p-8 rounded-2xl border border-red-500/30 bg-red-500/10 text-center text-red-300 font-mono text-sm">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.01]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-white/50 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Assigned Theme</th>
                <th className="py-3.5 px-4">Palette</th>
                <th className="py-3.5 px-4">Two-Line Explanation</th>
                <th className="py-3.5 px-4">Assigned At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/40">
                    No teams found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((item, index) => (
                  <tr key={item.team_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 text-white/30">{index + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div>{item.team_name}</div>
                      <span className="text-[10px] text-white/40 uppercase">{item.team_status}</span>
                    </td>
                    <td className="py-3.5 px-4 text-wine-300">{item.team_code}</td>
                    <td className="py-3.5 px-4">
                      {item.theme_title ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-white font-bold text-xs">
                          <Sparkles className="w-3 h-3 text-wine-400" />
                          {item.theme_title}
                        </span>
                      ) : (
                        <span className="text-amber-400 text-[11px] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.palette ? (
                        <div className="flex items-center gap-1.5">
                          {item.palette.map((c) => (
                            <span
                              key={c.hex}
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: c.hex }}
                              title={`${c.name} (${c.hex})`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      {item.description_line1 ? (
                        <div className="space-y-1 font-sans text-[11px] text-white/80">
                          <div>
                            <strong className="text-wine-300 font-mono text-[10px] uppercase">Style: </strong>
                            {item.description_line1.replace(/^Visual Style:\s*/i, "")}
                          </div>
                          <div>
                            <strong className="text-pink-300 font-mono text-[10px] uppercase">Goal: </strong>
                            {item.description_line2?.replace(/^What to Create:\s*/i, "")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/30 italic">No theme assigned yet</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-white/50 text-[11px]">
                      {item.assigned_at
                        ? new Date(item.assigned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
