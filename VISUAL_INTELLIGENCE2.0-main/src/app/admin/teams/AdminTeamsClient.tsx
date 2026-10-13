"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  adminAddMember, adminDeleteTeam, adminMoveMember, adminRemoveMember,
  adminRenameTeam, adminSetShortlistDecision, subscribeAdminRealtime, AdminError,
  adminGetMasterTeamDirectory, adminSaveLevel3Shortlist, adminConfirmLevel4Finalists,
  adminRecordScoreEntry, adminUpdateEliminationReason, adminBulkShortlistTeams,
  type MasterTeamRecord, type MasterShortlistResponse
} from "@/lib/admin";
import {
  Users, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  Search, SlidersHorizontal, ArrowUpDown, ChevronDown, ChevronRight,
  Edit2, Trash2, UserPlus, ArrowRightLeft, FileSpreadsheet,
  Award, Clock, Eye, Sparkles, Filter, X, Check,
  Laptop, Bug, Video, UserX
} from "lucide-react";

type ActiveTab = "all" | "l1" | "l2" | "l3" | "l4" | "eliminated";
type SubFilter = "all" | "eligible" | "shortlisted" | "not_shortlisted";
type SortKey = "name" | "total" | "level" | "created_at" | "member_count";

interface EditMemberState {
  memberId: string;
  name: string;
  regNo: string;
  email: string;
  phone: string;
  section: string;
  year: string;
}

export default function AdminTeamsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab State synced with URL query ?tab=
  const initialTab = (searchParams.get("tab") as ActiveTab) || "all";
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    ["all", "l1", "l2", "l3", "l4", "eliminated"].includes(initialTab) ? initialTab : "all"
  );

  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [data, setData] = useState<MasterShortlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  // Selection states for Shortlisting (Level 2 -> Level 3)
  const [selectedForL3, setSelectedForL3] = useState<Set<string>>(new Set());
  const [l2TargetQuota, setL2TargetQuota] = useState<number>(10);
  const [showL2ConfirmModal, setShowL2ConfirmModal] = useState(false);
  const [l2WarningAcknowledged, setL2WarningAcknowledged] = useState(false);
  const [isSavingL2Shortlist, setIsSavingL2Shortlist] = useState(false);

  // Selection states for Shortlisting (Level 3 -> Level 4)
  const [selectedForL4, setSelectedForL4] = useState<Set<string>>(new Set());
  const [l3TargetQuota, setL3TargetQuota] = useState<number>(10);
  const [unselectedReasons, setUnselectedReasons] = useState<Record<string, string>>({});
  const [showL3ConfirmModal, setShowL3ConfirmModal] = useState(false);
  const [l3WarningAcknowledged, setL3WarningAcknowledged] = useState(false);
  const [isSavingShortlist, setIsSavingShortlist] = useState(false);

  // Finalist confirmation (Level 4)
  const [finalistNotes, setFinalistNotes] = useState("");
  const [showL4ConfirmModal, setShowL4ConfirmModal] = useState(false);

  // Score Entry Modal
  const [scoreModalTeam, setScoreModalTeam] = useState<{ team: MasterTeamRecord; stage: number } | null>(null);
  const [scoreInput, setScoreInput] = useState<string>("");
  const [scoreNote, setScoreNote] = useState<string>("");
  const [cyberRubric, setCyberRubric] = useState<{ creativity: number; responsiveness: number; themeMatch: number }>({
    creativity: 10,
    responsiveness: 5,
    themeMatch: 10,
  });

  // Team Details Modal / Drawer
  const [detailTeam, setDetailTeam] = useState<MasterTeamRecord | null>(null);

  // Member Management Modals (preserving existing admin features)
  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: "", regNo: "", email: "", phone: "", section: "", year: "" });
  const [editMember, setEditMember] = useState<EditMemberState | null>(null);

  // Elimination Reason Editing
  const [editingReasonTeamId, setEditingReasonTeamId] = useState<string | null>(null);
  const [reasonInput, setReasonInput] = useState<string>("");

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3800);
  }

  const loadData = useCallback(async () => {
    try {
      const res = await adminGetMasterTeamDirectory();
      setData(res);
      // Pre-populate Level 3 selection with already shortlisted teams
      const currentL3 = new Set(res.teams.filter((t) => t.shortlist_l3.decision === "shortlisted").map((t) => t.id));
      if (currentL3.size > 0 && selectedForL3.size === 0) {
        setSelectedForL3(currentL3);
      }
      // Pre-populate Level 4 selection with already qualified teams if in Level 3 tab
      const currentQual = new Set(res.teams.filter((t) => t.shortlist_l4.qualified).map((t) => t.id));
      if (currentQual.size > 0 && selectedForL4.size === 0) {
        setSelectedForL4(currentQual);
      }
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to load directory", "err");
    } finally {
      setLoading(false);
    }
  }, [selectedForL3.size, selectedForL4.size]);

  useEffect(() => {
    loadData();
    const unsub = subscribeAdminRealtime(() => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(loadData, 400);
    });
    return unsub;
  }, [loadData]);

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSubFilter("all");
    router.replace(`/admin/teams?tab=${tab}`, { scroll: false });
  };

  // ── Teams Filter & Sort ──
  const filteredTeams = useMemo(() => {
    if (!data) return [];
    let list = [...data.teams];

    // Filter by Active Tab
    if (activeTab === "l1") {
      // All teams are in Level 1
    } else if (activeTab === "l2") {
      // Teams that completed L1 or are participating in L2
      list = list.filter((t) => t.current_level >= 2 || t.scores.s1 !== null);
    } else if (activeTab === "l3") {
      // Teams eligible for Level 3 (shortlisted from L2)
      list = list.filter((t) => t.shortlist_l3.decision === "shortlisted");
    } else if (activeTab === "l4") {
      // Teams qualified for Level 4
      list = list.filter((t) => t.shortlist_l4.qualified);
    } else if (activeTab === "eliminated") {
      // Teams not shortlisted or eliminated at any level
      list = list.filter(
        (t) =>
          t.overall_status === "eliminated" ||
          t.overall_status === "not_shortlisted" ||
          t.shortlist_l3.decision === "rejected"
      );
    }

    // Filter by SubFilter
    if (subFilter === "eligible") {
      if (activeTab === "l2") {
        list = list.filter((t) => t.current_level >= 2 || t.scores.s1 !== null || t.scores.s2 !== null);
      } else if (activeTab === "l3") {
        list = list.filter((t) => t.shortlist_l3.decision === "shortlisted");
      } else if (activeTab === "l4") {
        list = list.filter((t) => t.shortlist_l4.qualified);
      } else {
        list = list.filter((t) => t.overall_status !== "eliminated" && t.overall_status !== "not_shortlisted");
      }
    } else if (subFilter === "shortlisted") {
      if (activeTab === "l2") {
        list = list.filter((t) => selectedForL3.has(t.id) || t.shortlist_l3.decision === "shortlisted");
      } else if (activeTab === "l3") {
        list = list.filter((t) => selectedForL4.has(t.id));
      } else if (activeTab === "l4") {
        list = list.filter((t) => t.shortlist_l4.qualified);
      } else {
        list = list.filter((t) => t.shortlist_l3.decision === "shortlisted");
      }
    } else if (subFilter === "not_shortlisted") {
      if (activeTab === "l2") {
        list = list.filter((t) => !selectedForL3.has(t.id) && t.shortlist_l3.decision !== "shortlisted");
      } else if (activeTab === "l3") {
        list = list.filter((t) => !selectedForL4.has(t.id));
      } else {
        list = list.filter(
          (t) => t.overall_status === "not_shortlisted" || t.overall_status === "eliminated"
        );
      }
    }

    // Search query
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.members.some(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              m.reg_no.toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q)
          )
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "total") cmp = a.scores.total - b.scores.total;
      else if (sortKey === "level") cmp = a.current_level - b.current_level;
      else if (sortKey === "member_count") cmp = a.member_count - b.member_count;
      else if (sortKey === "created_at") cmp = a.created_at.localeCompare(b.created_at);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [data, activeTab, subFilter, search, sortKey, sortAsc, selectedForL3, selectedForL4]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  // ── Level 2 Shortlist Actions ──
  const toggleSelectTeamForL3 = (teamId: string) => {
    setSelectedForL3((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const selectTopNForL3 = (n: number) => {
    if (!data) return;
    const l2Eligible = data.teams
      .filter((t) => t.current_level >= 2 || t.scores.s1 !== null || t.scores.s2 !== null)
      .sort((a, b) => {
        const aCombined = (a.scores.s1 ?? 0) + (a.scores.s2 ?? 0);
        const bCombined = (b.scores.s1 ?? 0) + (b.scores.s2 ?? 0);
        return bCombined - aCombined || b.scores.total - a.scores.total;
      });
    const topIds = l2Eligible.slice(0, n).map((t) => t.id);
    setSelectedForL3(new Set(topIds));
    notify(`Selected top ${topIds.length} teams based on Level 1 + Level 2 combined score.`);
  };

  const handleSaveL2Shortlist = async () => {
    if (selectedForL3.size === 0) {
      notify("Please select at least one team for Level 3.", "err");
      return;
    }
    setIsSavingL2Shortlist(true);
    try {
      const teamIds = Array.from(selectedForL3);
      const res = await adminBulkShortlistTeams(teamIds);
      notify(`Successfully shortlisted ${res?.shortlisted_count ?? teamIds.length} team(s) for Level 3!`);
      setShowL2ConfirmModal(false);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save Level 3 shortlist", "err");
    } finally {
      setIsSavingL2Shortlist(false);
    }
  };

  // ── Quick Advance Single-Click Handlers for L2 Onwards ──
  const handleQuickAdvanceToL3 = async (team: MasterTeamRecord) => {
    if (!confirm(`Shortlist ${team.name} for Level 3?`)) return;
    try {
      await adminSetShortlistDecision(team.id, "shortlisted", undefined, true);
      notify(`${team.name} shortlisted for Level 3!`);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to advance team", "err");
    }
  };

  const handleQuickAdvanceToL4 = async (team: MasterTeamRecord) => {
    if (!confirm(`Advance ${team.name} to Level 4 Finalists?`)) return;
    try {
      await adminSaveLevel3Shortlist([team.id], 1, {}, true);
      notify(`${team.name} advanced to Level 4 Finalists!`);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to advance team", "err");
    }
  };

  // ── Level 3 Shortlist Actions ──
  const toggleSelectTeamForL4 = (teamId: string) => {
    setSelectedForL4((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const selectTopNForL4 = (n: number) => {
    if (!data) return;
    const l3Eligible = data.teams
      .filter((t) => t.shortlist_l3.decision === "shortlisted")
      .sort((a, b) => (b.scores.s3 ?? 0) - (a.scores.s3 ?? 0) || b.scores.total - a.scores.total);
    const topIds = l3Eligible.slice(0, n).map((t) => t.id);
    setSelectedForL4(new Set(topIds));
    notify(`Selected top ${topIds.length} teams based on scores.`);
  };

  const handleOpenL3ConfirmModal = () => {
    if (selectedForL4.size === 0) {
      notify("Please select at least one team for Level 4 shortlist.", "err");
      return;
    }
    setL3WarningAcknowledged(false);
    setShowL3ConfirmModal(true);
  };

  const handleSaveL3Shortlist = async () => {
    setIsSavingShortlist(true);
    try {
      const res = await adminSaveLevel3Shortlist(
        Array.from(selectedForL4),
        l3TargetQuota,
        unselectedReasons,
        true
      );
      if (res && res.warning) {
        notify(res.message, "err");
        setIsSavingShortlist(false);
        return;
      }
      notify(`Successfully shortlisted ${selectedForL4.size} teams for Level 4!`);
      setShowL3ConfirmModal(false);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save shortlist", "err");
    } finally {
      setIsSavingShortlist(false);
    }
  };

  // ── Level 4 Finalist Confirmation ──
  const handleConfirmL4Finalists = async () => {
    if (!data) return;
    const qualifiedIds = data.teams.filter((t) => t.shortlist_l4.qualified).map((t) => t.id);
    if (qualifiedIds.length === 0) {
      notify("No qualified teams found from Level 3.", "err");
      return;
    }
    try {
      await adminConfirmLevel4Finalists(qualifiedIds, finalistNotes);
      notify(`Level 4 finalist roster (${qualifiedIds.length} teams) confirmed & published!`);
      setShowL4ConfirmModal(false);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to confirm finalists", "err");
    }
  };

  // ── Score Entry Action ──
  const handleOpenScoreModal = (team: MasterTeamRecord, stage: number) => {
    setScoreModalTeam({ team, stage });
    const existing = stage === 1 ? team.scores.s1 : stage === 2 ? team.scores.s2 : stage === 3 ? team.scores.s3 : team.scores.s4;
    setScoreInput(existing !== null ? String(existing) : "");
    setScoreNote("");
    if (stage === 1) {
      // 25-mark Cyber Styling scoring prefill
      setCyberRubric({ creativity: 10, responsiveness: 5, themeMatch: 10 });
    }
  };

  const handleSaveScore = async () => {
    if (!scoreModalTeam) return;
    const pts = parseFloat(scoreInput);
    if (isNaN(pts) || pts < 0) {
      notify("Please enter a valid non-negative score.", "err");
      return;
    }
    const maxPoints = scoreModalTeam.stage === 1 ? 50 : scoreModalTeam.stage === 2 ? 50 : 100;
    if (pts > maxPoints) {
      notify(`Score cannot exceed maximum of ${maxPoints} for stage ${scoreModalTeam.stage}.`, "err");
      return;
    }
    try {
      await adminRecordScoreEntry(
        scoreModalTeam.team.id,
        scoreModalTeam.stage,
        pts,
        scoreNote || `Level ${scoreModalTeam.stage} score entry`,
        scoreModalTeam.stage === 1 ? cyberRubric : undefined
      );
      notify(`Score of ${pts} saved for ${scoreModalTeam.team.name} in Stage ${scoreModalTeam.stage}!`);
      setScoreModalTeam(null);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save score", "err");
    }
  };

  // ── Elimination Reason Action ──
  const handleSaveReason = async (teamId: string, stage: number) => {
    if (!reasonInput.trim()) return;
    try {
      await adminUpdateEliminationReason(teamId, stage, reasonInput.trim());
      notify("Elimination reason updated successfully.");
      setEditingReasonTeamId(null);
      setReasonInput("");
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to update reason", "err");
    }
  };

  // ── Existing Team & Member Management ──
  async function handleRename(team: MasterTeamRecord) {
    const name = prompt("New team name:", team.name);
    if (!name || name.trim() === team.name) return;
    try {
      await adminRenameTeam(team.id, name.trim());
      notify("Team renamed");
      loadData();
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed", "err");
    }
  }

  async function handleDelete(team: MasterTeamRecord) {
    const typed = prompt(
      `Type "${team.name}" to confirm deletion.\n\nThis will permanently delete the team and all members. Note: It is recommended to keep eliminated teams in the directory rather than deleting them.`
    );
    if (typed !== team.name) return;
    try {
      await adminDeleteTeam(team.id);
      notify("Team deleted");
      loadData();
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed", "err");
    }
  }

  async function handleRemoveMember(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this team?`)) return;
    try {
      await adminRemoveMember(memberId);
      notify("Member removed");
      loadData();
    } catch (e) {
      notify(e instanceof AdminError ? e.message : "Failed", "err");
    }
  }

  async function handleMoveMember(memberId: string, name: string) {
    const destCode = prompt(`Move ${name} to which team code?`);
    if (!destCode || !data) return;
    const dest = data.teams.find((t) => t.code.toUpperCase() === destCode.trim().toUpperCase());
    if (!dest) {
      notify("No team found with that code", "err");
      return;
    }
    try {
      await adminMoveMember(memberId, dest.id);
      notify(`Moved ${name} to ${dest.name}`);
      loadData();
    } catch (e) {
      notify(e instanceof AdminError && e.code === "TEAM_FULL" ? "Destination team is full" : "Failed", "err");
    }
  }

  // ── Status Badge Renderer ──
  const renderStatusBadge = (team: MasterTeamRecord) => {
    if (team.shortlist_l4.qualified) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300">
          <Award className="w-3 h-3 text-purple-400" /> FINALIST (L4)
        </span>
      );
    }
    if (team.shortlist_l3.decision === "shortlisted") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
          <CheckCircle2 className="w-3 h-3 text-cyan-400" /> SHORTLISTED (L3)
        </span>
      );
    }
    if (team.overall_status === "eliminated" || team.shortlist_l3.decision === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/15 border border-red-500/30 text-red-300">
          <XCircle className="w-3 h-3 text-red-400" /> ELIMINATED
        </span>
      );
    }
    if (team.overall_status === "not_shortlisted") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
          <AlertTriangle className="w-3 h-3 text-amber-400" /> NOT SHORTLISTED
        </span>
      );
    }
    if (team.shortlist_l3.decision === "on_hold") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-yellow-500/15 border border-yellow-500/30 text-yellow-300">
          <Clock className="w-3 h-3 text-yellow-400" /> ON HOLD
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
        <Sparkles className="w-3 h-3 text-emerald-400" /> LEVEL 0{team.current_level}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border font-mono text-xs shadow-2xl flex items-center gap-2.5 ${
            toast.kind === "ok"
              ? "bg-[#0b1f14] border-emerald-500/40 text-emerald-200"
              : "bg-[#250d11] border-red-500/40 text-red-200"
          }`}
        >
          {toast.kind === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-[#800020] to-[#191818] border border-white/10 text-white">
              <Users className="w-5 h-5" />
            </span>
            <span>Master Team Directory & Shortlisting Hub</span>
          </h1>
          <p className="text-xs text-white/50 mt-1 font-mono">
            Full event progression control, persistent team records, Level 3 shortlisting & Level 4 finalist management.
          </p>
        </div>

        {/* Global Summary Stats */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-white/40 block text-[9px] uppercase">Registered</span>
            <span className="text-white font-bold text-sm">{data?.stats.total ?? 0}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-cyan-400/60 block text-[9px] uppercase">L3 Shortlisted</span>
            <span className="text-cyan-300 font-bold text-sm">{data?.stats.level3_shortlisted ?? 0}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-purple-400/60 block text-[9px] uppercase">L4 Finalists</span>
            <span className="text-purple-300 font-bold text-sm">{data?.stats.level4_finalists ?? 0}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-red-400/60 block text-[9px] uppercase">Eliminated</span>
            <span className="text-red-400 font-bold text-sm">{data?.stats.eliminated ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (All Teams, Level 1, Level 2, Level 3, Level 4, Eliminated) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10 scrollbar-none">
        <button
          onClick={() => switchTab("all")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "all"
              ? "bg-white text-black shadow-lg"
              : "bg-white/[0.03] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>All Teams</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "all" ? "bg-black/20 text-black" : "bg-white/10 text-white/60"}`}>
            {data?.stats.total ?? 0}
          </span>
        </button>

        <button
          onClick={() => switchTab("l1")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "l1"
              ? "bg-[#800020] text-white border border-red-500/40 shadow-lg"
              : "bg-white/[0.03] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>Level 1: Cyber Styling</span>
        </button>

        <button
          onClick={() => switchTab("l2")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "l2"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-white/[0.03] border border-white/10 text-emerald-300 hover:text-white hover:bg-emerald-500/10"
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Level 2: BugX Hacker</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "l2" ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-300"}`}>
            Target: {l2TargetQuota}
          </span>
        </button>

        <button
          onClick={() => switchTab("l3")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "l3"
              ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
              : "bg-white/[0.03] border border-white/10 text-cyan-300 hover:text-white hover:bg-cyan-500/10"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Level 3 Shortlist</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "l3" ? "bg-black/20 text-black" : "bg-cyan-500/20 text-cyan-300"}`}>
            Target: {l3TargetQuota}
          </span>
        </button>

        <button
          onClick={() => switchTab("l4")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "l4"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
              : "bg-white/[0.03] border border-white/10 text-purple-300 hover:text-white hover:bg-purple-500/10"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Level 4 Finalists</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "l4" ? "bg-white/20 text-white" : "bg-purple-500/20 text-purple-300"}`}>
            {data?.stats.level4_finalists ?? 0}
          </span>
        </button>

        <button
          onClick={() => switchTab("eliminated")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "eliminated"
              ? "bg-red-600 text-white shadow-lg"
              : "bg-white/[0.03] border border-white/10 text-red-300 hover:text-white hover:bg-red-500/10"
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Eliminated Teams</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "eliminated" ? "bg-white/20 text-white" : "bg-red-500/20 text-red-300"}`}>
            {data?.stats.eliminated ?? 0}
          </span>
        </button>
      </div>

      {/* Level Specific Controls Banner */}
      {activeTab === "l2" && (
        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Level 2 to Level 3 — Organizer Shortlist Selection
                </h2>
              </div>
              <p className="text-xs text-white/60 mt-1">
                Tick teams with top scores in Level 1 & Level 2 to advance to Level 3 Prompt Rumble. Target quota is configurable.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-mono text-white/70">
                <span>Target Shortlist:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={l2TargetQuota}
                  onChange={(e) => setL2TargetQuota(parseInt(e.target.value) || 10)}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-emerald-300"
                />
              </label>

              <button
                onClick={() => selectTopNForL3(l2TargetQuota)}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase transition-colors"
              >
                Auto-Select Top {l2TargetQuota}
              </button>

              <button
                onClick={() => {
                  if (selectedForL3.size === 0) {
                    notify("Please tick at least one team for Level 3.", "err");
                    return;
                  }
                  setShowL2ConfirmModal(true);
                }}
                disabled={selectedForL3.size === 0}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40"
              >
                Review & Confirm Shortlist ({selectedForL3.size})
              </button>
            </div>
          </div>

          {/* Shortlist Selection Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-white/40 block text-[10px]">Participating in L2</span>
              <span className="text-white font-bold text-base">
                {filteredTeams.length}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-emerald-400/60 block text-[10px]">Ticked to Advance</span>
              <span className="text-emerald-300 font-bold text-base">{selectedForL3.size}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-amber-400/60 block text-[10px]">Unselected (Cut)</span>
              <span className="text-amber-300 font-bold text-base">
                {Math.max(0, filteredTeams.length - selectedForL3.size)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs flex items-center justify-between">
              <div>
                <span className="text-white/40 block text-[10px]">Quota Match</span>
                <span
                  className={`font-bold text-xs uppercase ${
                    selectedForL3.size === l2TargetQuota ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {selectedForL3.size === l2TargetQuota ? `Exact Target (${l2TargetQuota})` : `${selectedForL3.size} / ${l2TargetQuota}`}
                </span>
              </div>
              {selectedForL3.size !== l2TargetQuota && (
                <span className="text-[10px] text-amber-400 font-sans inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Discrepancy</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "l3" && (
        <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Level 3 to Level 4 — Organizer Shortlist Selection
                </h2>
              </div>
              <p className="text-xs text-white/60 mt-1">
                Select eligible teams from Level 3 to advance to the Level 4 Prompt Charades finale. Target quota is configurable.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-mono text-white/70">
                <span>Target Finalists:</span>
                <input
                  type="number"
                  min={1}
                  max={38}
                  value={l3TargetQuota}
                  onChange={(e) => setL3TargetQuota(parseInt(e.target.value) || 10)}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-cyan-300"
                />
              </label>

              <button
                onClick={() => selectTopNForL4(l3TargetQuota)}
                className="px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold uppercase transition-colors"
              >
                Auto-Select Top {l3TargetQuota}
              </button>

              <button
                onClick={handleOpenL3ConfirmModal}
                disabled={selectedForL4.size === 0}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40"
              >
                Review & Confirm Shortlist ({selectedForL4.size})
              </button>
            </div>
          </div>

          {/* Shortlist Selection Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-white/40 block text-[10px]">Eligible in L3</span>
              <span className="text-white font-bold text-base">
                {data?.teams.filter((t) => t.shortlist_l3.decision === "shortlisted").length ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-cyan-400/60 block text-[10px]">Selected to Advance</span>
              <span className="text-cyan-300 font-bold text-base">{selectedForL4.size}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-amber-400/60 block text-[10px]">Unselected (Cut)</span>
              <span className="text-amber-300 font-bold text-base">
                {Math.max(
                  0,
                  (data?.teams.filter((t) => t.shortlist_l3.decision === "shortlisted").length ?? 0) - selectedForL4.size
                )}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs flex items-center justify-between">
              <div>
                <span className="text-white/40 block text-[10px]">Quota Match</span>
                <span
                  className={`font-bold text-xs uppercase ${
                    selectedForL4.size === l3TargetQuota ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {selectedForL4.size === l3TargetQuota ? "Exact Target (10)" : `${selectedForL4.size} / ${l3TargetQuota}`}
                </span>
              </div>
              {selectedForL4.size !== l3TargetQuota && (
                <span className="text-[10px] text-amber-400 font-sans inline-flex items-center gap-1" title="Warning will require confirmation">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Discrepancy</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "l4" && (
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Level 4: Prompt Charades Finalists
              </h2>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Finalists approved from Level 3. Only these teams are permitted to participate in the image recreation finale.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowL4ConfirmModal(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20"
            >
              Publish & Lock Finalist List
            </button>
          </div>
        </div>
      )}

      {activeTab === "eliminated" && (
        <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Persistent Eliminated Teams Directory
            </h2>
          </div>
          <p className="text-xs text-white/60 mt-1">
            All teams that did not advance through cutoffs remain accessible here with their complete score history, reasons, and timestamps. Records are never deleted.
          </p>
        </div>
      )}

      {/* Search, SubFilters, and Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team name, code, ID, or student reg no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-category Filter Buttons */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-white/30 text-[10px] uppercase mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <button
            onClick={() => setSubFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              subFilter === "all" ? "bg-white/15 text-white font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            All ({filteredTeams.length})
          </button>
          <button
            onClick={() => setSubFilter("eligible")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              subFilter === "eligible" ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            Eligible
          </button>
          <button
            onClick={() => setSubFilter("shortlisted")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              subFilter === "shortlisted" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            Shortlisted
          </button>
          <button
            onClick={() => setSubFilter("not_shortlisted")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              subFilter === "not_shortlisted" ? "bg-red-500/20 text-red-300 font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            Cut / Eliminated
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="py-24 text-center text-white/40 font-mono text-sm">
          Loading master team directory…
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-white/10 bg-white/[0.02] text-white/50 font-mono text-xs">
          No teams match your current filter or search criteria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] shadow-xl">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-[10px] uppercase text-white/40 tracking-wider">
                {(activeTab === "l2" || activeTab === "l3" || activeTab === "all") && (
                  <th className="py-3 px-3 text-center w-12" title="Tick box column">
                    <input
                      type="checkbox"
                      checked={
                        filteredTeams.length > 0 &&
                        filteredTeams.every((t) =>
                          activeTab === "l2"
                            ? selectedForL3.has(t.id)
                            : activeTab === "l3"
                            ? selectedForL4.has(t.id)
                            : (selectedForL3.has(t.id) || selectedForL4.has(t.id))
                        )
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (activeTab === "l2") {
                            setSelectedForL3(new Set(filteredTeams.map((t) => t.id)));
                          } else if (activeTab === "l3") {
                            setSelectedForL4(new Set(filteredTeams.map((t) => t.id)));
                          } else {
                            const l2Plus = filteredTeams.filter((t) => t.current_level >= 2);
                            setSelectedForL3(new Set(l2Plus.map((t) => t.id)));
                          }
                        } else {
                          if (activeTab === "l2") {
                            setSelectedForL3(new Set());
                          } else if (activeTab === "l3") {
                            setSelectedForL4(new Set());
                          } else {
                            setSelectedForL3(new Set());
                            setSelectedForL4(new Set());
                          }
                        }
                      }}
                      className="accent-emerald-400 h-4 w-4 rounded cursor-pointer"
                      title="Tick to select all visible teams"
                    />
                  </th>
                )}
                <th
                  onClick={() => toggleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Team & Details</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("level")}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Current Level</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-2 text-center">S1 (25/50)</th>
                <th className="py-3 px-2 text-center">S2 (50)</th>
                <th className="py-3 px-2 text-center">S3</th>
                <th className="py-3 px-2 text-center">S4</th>
                <th
                  onClick={() => toggleSort("total")}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Total Score</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTeams.map((team) => {
                const isSelectedInL2 = selectedForL3.has(team.id);
                const isSelectedInL3 = selectedForL4.has(team.id);
                const isChecked =
                  activeTab === "l2"
                    ? isSelectedInL2
                    : activeTab === "l3"
                    ? isSelectedInL3
                    : (isSelectedInL2 || isSelectedInL3);

                return (
                  <tr
                    key={team.id}
                    className={`hover:bg-white/[0.03] transition-colors ${
                      isSelectedInL2 && activeTab === "l2"
                        ? "bg-emerald-950/20"
                        : isSelectedInL3 && activeTab === "l3"
                        ? "bg-cyan-950/20"
                        : ""
                    }`}
                  >
                    {(activeTab === "l2" || activeTab === "l3" || activeTab === "all") && (
                      <td className="py-3 px-3 text-center">
                        {(team.current_level >= 2 || activeTab === "l2" || activeTab === "l3") ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (activeTab === "l2" || team.current_level === 2) {
                                toggleSelectTeamForL3(team.id);
                              } else {
                                toggleSelectTeamForL4(team.id);
                              }
                            }}
                            className={`${activeTab === "l2" || team.current_level === 2 ? "accent-emerald-400" : "accent-cyan-400"} h-4 w-4 rounded cursor-pointer`}
                            title={`Tick ${team.name} for progression`}
                          />
                        ) : (
                          <span className="text-white/10 select-none">—</span>
                        )}
                      </td>
                    )}

                    {/* Team Name, ID & Members Preview */}
                    <td className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm hover:text-white transition-colors">
                              {team.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-[10px]">
                              {team.code}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/40 mt-0.5">
                            ID: <span className="text-white/60 select-all">{team.id.slice(0, 8)}…</span> · {team.member_count} members
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Current Level */}
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xs">
                        L0{team.current_level}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center">
                      {renderStatusBadge(team)}
                    </td>

                    {/* Stage 1 Score */}
                    <td className="py-3 px-2 text-center font-bold">
                      <button
                        onClick={() => handleOpenScoreModal(team, 1)}
                        className="hover:underline text-white/90 hover:text-white"
                        title="Click to record/edit Level 1 Cyber Styling score"
                      >
                        {team.scores.s1 !== null ? team.scores.s1 : <span className="text-white/20">—</span>}
                      </button>
                    </td>

                    {/* Stage 2 Score */}
                    <td className="py-3 px-2 text-center font-bold">
                      <button
                        onClick={() => handleOpenScoreModal(team, 2)}
                        className="hover:underline text-white/90 hover:text-white"
                        title="Click to record/edit Level 2 BugX Hacker score"
                      >
                        {team.scores.s2 !== null ? team.scores.s2 : <span className="text-white/20">—</span>}
                      </button>
                    </td>

                    {/* Stage 3 Score */}
                    <td className="py-3 px-2 text-center font-bold">
                      <button
                        onClick={() => handleOpenScoreModal(team, 3)}
                        className="hover:underline text-white/90 hover:text-white"
                        title="Click to record/edit Level 3 Prompt Rumble score"
                      >
                        {team.scores.s3 !== null ? team.scores.s3 : <span className="text-white/20">—</span>}
                      </button>
                    </td>

                    {/* Stage 4 Score */}
                    <td className="py-3 px-2 text-center font-bold">
                      <button
                        onClick={() => handleOpenScoreModal(team, 4)}
                        className="hover:underline text-white/90 hover:text-white"
                        title="Click to record/edit Level 4 Prompt Charades score"
                      >
                        {team.scores.s4 !== null ? team.scores.s4 : <span className="text-white/20">—</span>}
                      </button>
                    </td>

                    {/* Total Score */}
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-1 rounded bg-[#800020]/40 border border-red-500/30 text-white font-bold text-xs">
                        {team.scores.total}
                      </span>
                    </td>

                    {/* Row Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetailTeam(team)}
                          className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-[11px] transition-colors"
                          title="View team roster, members & progression history"
                        >
                          Details
                        </button>

                        {/* Level 2 Onwards Quick Progression Tick Buttons */}
                        {/* Level 2: Tick button to shortlist/advance to Level 3 */}
                        {(team.current_level === 2 || (activeTab === "l2" && team.shortlist_l3.decision !== "shortlisted")) && (
                          team.shortlist_l3.decision === "shortlisted" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                              <span>L3 Shortlisted</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleQuickAdvanceToL3(team)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/30 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                              title={`Tick / Shortlist ${team.name} for Level 3`}
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                              <span>Advance L3</span>
                            </button>
                          )
                        )}

                        {/* Level 3: Tick button to advance to Level 4 Finalist */}
                        {(team.current_level === 3 || activeTab === "l3") && (
                          team.shortlist_l4.qualified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-bold">
                              <Check className="w-3.5 h-3.5 text-purple-400 stroke-[2.5]" />
                              <span>L4 Finalist</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleQuickAdvanceToL4(team)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/30 transition-all shadow-sm shadow-cyan-500/10 cursor-pointer"
                              title={`Tick / Advance ${team.name} to Level 4 Finalists`}
                            >
                              <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[2.5]" />
                              <span>Advance L4</span>
                            </button>
                          )
                        )}

                        {/* Level 4: Finalist Badge */}
                        {(team.current_level === 4 || activeTab === "l4") && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-bold">
                            <Award className="w-3.5 h-3.5 text-purple-400" />
                            <span>Finalist</span>
                          </span>
                        )}

                        {/* Eliminated or cut teams in L2+: allow re-advancing with Tick Button */}
                        {(team.overall_status === "eliminated" || team.overall_status === "not_shortlisted" || team.shortlist_l3.decision === "rejected") && team.current_level >= 2 && (
                          <button
                            onClick={() => handleQuickAdvanceToL3(team)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[10px] font-bold cursor-pointer"
                            title={`Tick to re-advance ${team.name} to Level 3`}
                          >
                            <Check className="w-3 h-3 text-emerald-400" /> Re-Advance L3
                          </button>
                        )}

                        {activeTab === "eliminated" && (
                          <button
                            onClick={() => {
                              setEditingReasonTeamId(team.id);
                              setReasonInput(team.elimination_info?.reason || "");
                            }}
                            className="px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[11px]"
                          >
                            Edit Reason
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal: Level 2 Shortlist -> Level 3 */}
      {showL2ConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121111] border border-emerald-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Confirm Level 2 Shortlist</span>
              </h3>
              <button onClick={() => setShowL2ConfirmModal(false)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex justify-between text-white/70">
                  <span>Eligible Teams in Level 2:</span>
                  <span className="text-white font-bold">{filteredTeams.length}</span>
                </div>
                <div className="flex justify-between text-emerald-300">
                  <span>Teams Ticked to Advance:</span>
                  <span className="font-bold text-emerald-200">{selectedForL3.size}</span>
                </div>
                <div className="flex justify-between text-amber-300">
                  <span>Teams Not Shortlisted (Cut):</span>
                  <span className="font-bold">
                    {Math.max(0, filteredTeams.length - selectedForL3.size)}
                  </span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Configured Target Quota:</span>
                  <span className="font-bold text-white">{l2TargetQuota}</span>
                </div>
              </div>

              {/* Warning if selected count differs from target quota */}
              {selectedForL3.size !== l2TargetQuota && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-300 font-bold">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p>Target Quota Warning</p>
                      <p className="text-[11px] font-normal text-amber-200/80 mt-1">
                        You have selected <strong>{selectedForL3.size}</strong> teams, but the event target is <strong>{l2TargetQuota}</strong>. Please explicitly confirm you wish to proceed with this count.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/90 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={l2WarningAcknowledged}
                      onChange={(e) => setL2WarningAcknowledged(e.target.checked)}
                      className="accent-amber-400 h-4 w-4"
                    />
                    <span>I confirm proceeding with {selectedForL3.size} shortlisted teams.</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowL2ConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveL2Shortlist}
                disabled={isSavingL2Shortlist || (selectedForL3.size !== l2TargetQuota && !l2WarningAcknowledged)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40"
              >
                {isSavingL2Shortlist ? "Saving to Database…" : "Confirm & Save Shortlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Level 3 Shortlist -> Level 4 */}
      {showL3ConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121111] border border-cyan-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <span>Confirm Level 3 Shortlist</span>
              </h3>
              <button onClick={() => setShowL3ConfirmModal(false)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex justify-between text-white/70">
                  <span>Eligible Teams:</span>
                  <span className="text-white font-bold">
                    {data?.teams.filter((t) => t.shortlist_l3.decision === "shortlisted").length ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-cyan-300">
                  <span>Teams Selected to Advance:</span>
                  <span className="font-bold text-cyan-200">{selectedForL4.size}</span>
                </div>
                <div className="flex justify-between text-amber-300">
                  <span>Teams Not Shortlisted (Cut):</span>
                  <span className="font-bold">
                    {Math.max(
                      0,
                      (data?.teams.filter((t) => t.shortlist_l3.decision === "shortlisted").length ?? 0) - selectedForL4.size
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Configured Target Quota:</span>
                  <span className="font-bold text-white">{l3TargetQuota}</span>
                </div>
              </div>

              {/* Warning if selected count differs from target quota (10) */}
              {selectedForL4.size !== l3TargetQuota && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-300 font-bold">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p>Target Quota Warning</p>
                      <p className="text-[11px] font-normal text-amber-200/80 mt-1">
                        You have selected <strong>{selectedForL4.size}</strong> teams, but the event target is <strong>{l3TargetQuota}</strong>. Please explicitly confirm you wish to proceed with this count.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/90 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={l3WarningAcknowledged}
                      onChange={(e) => setL3WarningAcknowledged(e.target.checked)}
                      className="accent-amber-400 h-4 w-4"
                    />
                    <span>I confirm proceeding with {selectedForL4.size} shortlisted teams.</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowL3ConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveL3Shortlist}
                disabled={isSavingShortlist || (selectedForL4.size !== l3TargetQuota && !l3WarningAcknowledged)}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20 disabled:opacity-40"
              >
                {isSavingShortlist ? "Saving to Database…" : "Confirm & Save Shortlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Level 4 Finalist Publication */}
      {showL4ConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121111] border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                <span>Confirm Finalist Publication</span>
              </h3>
              <button onClick={() => setShowL4ConfirmModal(false)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-white/80">
              This confirms the final finalist list of <strong>{data?.stats.level4_finalists ?? 0}</strong> teams for Level 4 (Prompt Charades). Only approved teams may enter.
            </p>

            <div className="space-y-1.5">
              <label className="text-white/50 block text-[10px] uppercase">Organizer Notes (Optional):</label>
              <textarea
                value={finalistNotes}
                onChange={(e) => setFinalistNotes(e.target.value)}
                placeholder="Add any instructions or notes for judges and finalists…"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setShowL4ConfirmModal(false)} className="px-4 py-2 rounded-xl border border-white/20 text-white/60">
                Cancel
              </button>
              <button
                onClick={handleConfirmL4Finalists}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider"
              >
                Confirm & Lock Finalists
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      {scoreModalTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121111] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  Record Score — Level 0{scoreModalTeam.stage}
                </h3>
                <p className="text-white/50 text-xs mt-0.5">{scoreModalTeam.team.name} ({scoreModalTeam.team.code})</p>
              </div>
              <button onClick={() => setScoreModalTeam(null)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stage 1 Cyber Styling 25-mark Rubric Assistant */}
            {scoreModalTeam.stage === 1 && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-[#e9adb5] font-bold block">
                  Cyber Styling 25-Mark Scoring Rubric
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded bg-black/40">
                    <span className="text-[9px] text-white/40 block">Creativity (/10)</span>
                    <input
                      type="number"
                      max={10}
                      min={0}
                      value={cyberRubric.creativity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCyberRubric((p) => ({ ...p, creativity: val }));
                        setScoreInput(String(val + cyberRubric.responsiveness + cyberRubric.themeMatch));
                      }}
                      className="w-full text-center bg-transparent font-bold text-white mt-1 border-b border-white/20"
                    />
                  </div>
                  <div className="p-2 rounded bg-black/40">
                    <span className="text-[9px] text-white/40 block">Design/Code (/5)</span>
                    <input
                      type="number"
                      max={5}
                      min={0}
                      value={cyberRubric.responsiveness}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCyberRubric((p) => ({ ...p, responsiveness: val }));
                        setScoreInput(String(cyberRubric.creativity + val + cyberRubric.themeMatch));
                      }}
                      className="w-full text-center bg-transparent font-bold text-white mt-1 border-b border-white/20"
                    />
                  </div>
                  <div className="p-2 rounded bg-black/40">
                    <span className="text-[9px] text-white/40 block">Theme Match (/10)</span>
                    <input
                      type="number"
                      max={10}
                      min={0}
                      value={cyberRubric.themeMatch}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCyberRubric((p) => ({ ...p, themeMatch: val }));
                        setScoreInput(String(cyberRubric.creativity + cyberRubric.responsiveness + val));
                      }}
                      className="w-full text-center bg-transparent font-bold text-white mt-1 border-b border-white/20"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-white/60 block text-[10px] uppercase">
                Score Points (Max {scoreModalTeam.stage <= 2 ? "50" : "100"}):
              </label>
              <input
                type="number"
                step="any"
                min={0}
                max={scoreModalTeam.stage <= 2 ? 50 : 100}
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                placeholder="Enter points…"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white font-bold text-sm focus:border-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/60 block text-[10px] uppercase">Evaluation Note (Optional):</label>
              <input
                type="text"
                value={scoreNote}
                onChange={(e) => setScoreNote(e.target.value)}
                placeholder="Comments or rubric remarks…"
                className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setScoreModalTeam(null)} className="px-4 py-2 rounded-xl border border-white/15 text-white/60">
                Cancel
              </button>
              <button
                onClick={handleSaveScore}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider"
              >
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Reason Edit Modal */}
      {editingReasonTeamId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121111] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <h3 className="text-base font-bold text-white uppercase">Edit Elimination Reason</h3>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Enter reason for not advancing (e.g. Below cutoff mark, Did not submit in time, etc.)"
              rows={4}
              className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white text-xs"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingReasonTeamId(null)} className="px-4 py-2 rounded-xl border border-white/15 text-white/60">
                Cancel
              </button>
              <button
                onClick={() => handleSaveReason(editingReasonTeamId, 3)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase"
              >
                Save Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Details Modal (Roster, Scores & Progression History) */}
      {detailTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121111] border border-white/20 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl font-mono text-xs">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{detailTeam.name}</h3>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-xs">{detailTeam.code}</span>
                  {renderStatusBadge(detailTeam)}
                </div>
                <p className="text-white/40 text-[10px] mt-1">
                  Team ID: <span className="select-all text-white/70">{detailTeam.id}</span> · Created: {new Date(detailTeam.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setDetailTeam(null)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions (Rename / Delete) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleRename(detailTeam);
                  setDetailTeam(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 text-white/80 text-xs flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" /> Rename Team
              </button>
              <button
                onClick={() => {
                  handleDelete(detailTeam);
                  setDetailTeam(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-300 text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Team
              </button>
            </div>

            {/* Scores Overview */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase font-bold text-white/60 tracking-wider">Score Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <span className="text-[10px] text-white/40 block">Level 1</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s1 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <span className="text-[10px] text-white/40 block">Level 2</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s2 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <span className="text-[10px] text-white/40 block">Level 3</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s3 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <span className="text-[10px] text-white/40 block">Level 4</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s4 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#800020]/30 border border-red-500/30">
                  <span className="text-[10px] text-white/60 block">Total</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.total}</span>
                </div>
              </div>
            </div>

            {/* Progression & Shortlisting History */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase font-bold text-white/60 tracking-wider">Progression Timeline & History</h4>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Level 3 Shortlist Status:</span>
                  <span className="font-bold text-white uppercase">{detailTeam.shortlist_l3.decision}</span>
                </div>
                {detailTeam.shortlist_l3.decided_at && (
                  <div className="flex justify-between text-white/40 text-[11px]">
                    <span>L3 Decided At:</span>
                    <span>{new Date(detailTeam.shortlist_l3.decided_at).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-white/60">Level 4 Finalist Status:</span>
                  <span className={`font-bold uppercase ${detailTeam.shortlist_l4.qualified ? "text-purple-300" : "text-white/40"}`}>
                    {detailTeam.shortlist_l4.qualified ? "Qualified Finalist" : "Not Qualified"}
                  </span>
                </div>
                {detailTeam.elimination_info?.reason && (
                  <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/20 text-red-200 mt-2">
                    <span className="font-bold block text-[10px] uppercase text-red-400">Elimination / Cutoff Reason:</span>
                    <span className="mt-1 block text-xs">{detailTeam.elimination_info.reason}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Team Members Roster */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase font-bold text-white/60 tracking-wider">
                  Roster ({detailTeam.member_count} members)
                </h4>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {detailTeam.members.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{m.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 uppercase text-white/60">{m.role}</span>
                      </div>
                      <p className="text-white/60 text-[11px] mt-1">{m.reg_no} · {m.email}</p>
                      {m.phone && <p className="text-white/40 text-[10px]">{m.phone}</p>}
                      <p className="text-white/40 text-[10px]">{m.section || "No section"} · {m.year ? `Year ${m.year}` : "Year unspecified"}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleMoveMember(m.id, m.name)}
                        className="text-[10px] text-white/60 hover:text-white flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" /> Move
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name)}
                        className="text-[10px] text-red-400 hover:text-red-300 ml-auto flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
