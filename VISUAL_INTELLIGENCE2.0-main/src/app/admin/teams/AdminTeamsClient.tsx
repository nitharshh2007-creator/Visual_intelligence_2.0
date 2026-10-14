"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  adminAddMember, adminDeleteTeam, adminMoveMember, adminRemoveMember,
  adminRenameTeam, adminSetShortlistDecision, subscribeAdminRealtime, AdminError,
  adminGetMasterTeamDirectory, adminSaveLevel3Shortlist, adminConfirmLevel4Finalists,
  adminRecordScoreEntry, adminUpdateEliminationReason, adminSetShortlistConfig,
  type MasterTeamRecord, type MasterShortlistResponse
} from "@/lib/admin";
import { RUBRICS, STAGE_MAX, speedMarksForMinutes, validateScoreEntry } from "@/lib/scoring";
import {
  recommendAfterRound2, recommendAfterRound3, planRound3Decisions,
  DEFAULT_TOP_AFTER_ROUND_2, DEFAULT_TOP_AFTER_ROUND_3, type RankableTeam
} from "@/lib/shortlistRanking";
import ShortlistRecommendation from "./ShortlistRecommendation";
import {
  Users, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  Search, SlidersHorizontal, ArrowUpDown, ChevronDown, ChevronRight,
  Edit2, Trash2, UserPlus, ArrowRightLeft, FileSpreadsheet,
  Award, Clock, Eye, Sparkles, Filter, X,
  Laptop, Bug, Video, UserX, Download
} from "lucide-react";

type ActiveTab = "all" | "l1" | "l2" | "l3" | "l4" | "eliminated";
type SubFilter = "all" | "eligible" | "shortlisted" | "not_shortlisted";
type SortKey = "name" | "total" | "level" | "created_at" | "member_count";

// Judge guide (VI2_Judge_Marks_Sheets.xlsx): every round is marked out of 25 — see src/lib/scoring.ts.
const STAGE_NAMES: Record<number, string> = { 1: "Cyber Styling", 2: "BugX Hacker", 3: "Prompt Rumble", 4: "Prompt Charades" };

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
  const [l2Cutoff, setL2Cutoff] = useState<number | null>(null);
  const [showL2ConfirmModal, setShowL2ConfirmModal] = useState(false);
  const [isSavingL2Shortlist, setIsSavingL2Shortlist] = useState(false);

  // Selection states for Shortlisting (Level 3 -> Level 4)
  const [selectedForL4, setSelectedForL4] = useState<Set<string>>(new Set());
  const [l3Cutoff, setL3Cutoff] = useState<number>(15);
  const [showL3ConfirmModal, setShowL3ConfirmModal] = useState(false);
  const [isSavingShortlist, setIsSavingShortlist] = useState(false);

  // Finalist confirmation (Level 4)
  const [finalistNotes, setFinalistNotes] = useState("");
  const [showL4ConfirmModal, setShowL4ConfirmModal] = useState(false);

  // Score Entry Modal
  const [scoreModalTeam, setScoreModalTeam] = useState<{ team: MasterTeamRecord; stage: number } | null>(null);
  const [scoreInput, setScoreInput] = useState<string>("");
  const [scoreNote, setScoreNote] = useState<string>("");
  const [rubric, setRubric] = useState<Record<string, string>>({});

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
      setL2Cutoff((prev) => prev ?? Math.min(Number(res.config?.combined_cutoff ?? 25), STAGE_MAX * 2));
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
      // No selection after Level 1 — every registered team plays Level 2
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
        list = list.filter((t) => t.scores.s1 !== null && t.scores.s2 !== null);
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

  // ── Level 2 Shortlist Actions (cutoff on L1 + L2 combined) ──
  const combinedL12 = (t: MasterTeamRecord) =>
    t.scores.s1 !== null && t.scores.s2 !== null ? t.scores.s1 + t.scores.s2 : null;

  const toggleSelectTeamForL3 = (teamId: string) => {
    setSelectedForL3((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const selectAboveL2Cutoff = () => {
    if (!data || l2Cutoff === null) return;
    const ids = data.teams.filter((t) => (combinedL12(t) ?? -1) >= l2Cutoff).map((t) => t.id);
    setSelectedForL3(new Set(ids));
    notify(`${ids.length} team(s) scored ${l2Cutoff}+ in Level 1 + Level 2 and are ticked.`);
  };

  const l2MissingScores = useMemo(
    () => (data?.teams ?? []).filter((t) => selectedForL3.has(t.id) && combinedL12(t) === null),
    [data, selectedForL3]
  );

  // ── Ranking recommendations (read-only; they only tick boxes locally) ──
  const [topAfterR2, setTopAfterR2] = useState(DEFAULT_TOP_AFTER_ROUND_2);
  const [topAfterR3, setTopAfterR3] = useState(DEFAULT_TOP_AFTER_ROUND_3);
  const rankable = useMemo<RankableTeam[]>(
    () =>
      (data?.teams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        scores: { s1: t.scores.s1, s2: t.scores.s2, s3: t.scores.s3 },
        l3Decision: t.shortlist_l3.decision,
      })),
    [data]
  );
  const recAfterR2 = useMemo(() => recommendAfterRound2(rankable, topAfterR2), [rankable, topAfterR2]);
  const recAfterR3 = useMemo(() => recommendAfterRound3(rankable, topAfterR3), [rankable, topAfterR3]);

  const applyRecommendation = (round: 2 | 3) => {
    const rec = round === 2 ? recAfterR2 : recAfterR3;
    (round === 2 ? setSelectedForL3 : setSelectedForL4)(new Set(rec.recommendedIds));
    const tieNote = rec.tiedAtCutoffIds.length
      ? ` ${rec.tiedAtCutoffIds.length} team(s) are tied at the cutoff for ${rec.openSlots} remaining slot(s) — tick them yourself.`
      : "";
    notify(`${rec.recommendedIds.length} recommended team(s) ticked. Nothing is saved until you confirm.${tieNote}`);
  };

  const handleSaveL2Shortlist = async () => {
    if (!data) return;
    if (selectedForL3.size === 0) {
      notify("Tick at least one team for Level 3.", "err");
      return;
    }
    if (l2MissingScores.length > 0) {
      notify(`Enter Level 1 and Level 2 marks first for: ${l2MissingScores.map((t) => t.name).join(", ")}`, "err");
      return;
    }
    setIsSavingL2Shortlist(true);
    try {
      if (l2Cutoff !== null) await adminSetShortlistConfig(l2Cutoff, 0, 0);
      const plan = planRound3Decisions(
        data.teams.map((t) => ({ id: t.id, l3Decision: t.shortlist_l3.decision })),
        selectedForL3,
        `Below Level 2 cutoff${l2Cutoff !== null ? ` (${l2Cutoff})` : ""}`
      );
      const writes = plan.map((w) => adminSetShortlistDecision(w.teamId, w.decision, w.note, w.override));
      const results = await Promise.allSettled(writes);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) notify(`${failed} update(s) failed — check the list and save again.`, "err");
      else notify(`${selectedForL3.size} team(s) shortlisted for Level 3. Only they can open Level 3.`);
      setShowL2ConfirmModal(false);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save Level 3 shortlist", "err");
    } finally {
      setIsSavingL2Shortlist(false);
    }
  };

  // ── Level 3 → Level 4 Selection (cutoff on L3 marks) ──
  const toggleSelectTeamForL4 = (teamId: string) => {
    setSelectedForL4((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const l3Pool = useMemo(() => (data?.teams ?? []).filter((t) => t.shortlist_l3.decision === "shortlisted"), [data]);

  const selectAboveL3Cutoff = () => {
    const ids = l3Pool.filter((t) => (t.scores.s3 ?? -1) >= l3Cutoff).map((t) => t.id);
    setSelectedForL4(new Set(ids));
    notify(`${ids.length} team(s) scored ${l3Cutoff}+ in Level 3 and are ticked.`);
  };

  const handleSaveL3Shortlist = async () => {
    const ids = Array.from(selectedForL4).filter((id) => l3Pool.some((t) => t.id === id));
    if (ids.length === 0) {
      notify("Tick at least one Level 3 team for Level 4.", "err");
      return;
    }
    setIsSavingShortlist(true);
    try {
      await adminSaveLevel3Shortlist(ids, ids.length, {}, true);
      notify(`${ids.length} team(s) qualified for Level 4. Only they can open Level 4.`);
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

  // ── Marks Entry (all four stages) ──
  const canScore = (team: MasterTeamRecord, stage: number) =>
    stage <= 2 || (stage === 3 ? team.shortlist_l3.decision === "shortlisted" : team.shortlist_l4.qualified);

  const stageScore = (team: MasterTeamRecord, stage: number) =>
    stage === 1 ? team.scores.s1 : stage === 2 ? team.scores.s2 : stage === 3 ? team.scores.s3 : team.scores.s4;

  const handleOpenScoreModal = (team: MasterTeamRecord, stage: number) => {
    if (!canScore(team, stage)) {
      notify(`${team.name} is not in Level ${stage}, so it can't get Level ${stage} marks.`, "err");
      return;
    }
    setScoreModalTeam({ team, stage });
    const existing = stageScore(team, stage);
    setScoreInput(existing !== null ? String(existing) : "");
    setScoreNote("");
    setRubric({});
  };

  const updateRubric = (key: string, value: string) => {
    if (!scoreModalTeam) return;
    const next = { ...rubric, [key]: value };
    setRubric(next);
    const filled = RUBRICS[scoreModalTeam.stage].filter((c) => next[c.key] !== undefined && next[c.key] !== "");
    if (filled.length) setScoreInput(String(filled.reduce((sum, c) => sum + (parseFloat(next[c.key]) || 0), 0)));
  };

  // Round 2 speed from the Form solve time (judge sheet rule).
  const applySolveTime = (raw: string) => {
    const minutes = parseFloat(raw);
    if (raw.trim() === "" || isNaN(minutes)) return;
    const marks = speedMarksForMinutes(minutes);
    if (marks === null) {
      notify("The judge sheet has no speed rule beyond 20 minutes — enter Speed by hand.", "err");
      return;
    }
    updateRubric("speed", String(marks));
  };

  const handleSaveScore = async () => {
    if (!scoreModalTeam) return;
    const { team, stage } = scoreModalTeam;
    const filled = RUBRICS[stage].filter((c) => rubric[c.key] !== undefined && rubric[c.key].trim() !== "");
    const criteria = filled.length ? Object.fromEntries(filled.map((c) => [c.key, Number(rubric[c.key])])) : undefined;
    // Same validator the server runs: every criterion 0..max, total 0..25 and equal to the rubric sum.
    const checked = validateScoreEntry({ stage, points: scoreInput.trim() === "" ? NaN : Number(scoreInput), criteria });
    if (!checked.ok) {
      notify(checked.error, "err");
      return;
    }
    const pts = checked.value.points;
    try {
      await adminRecordScoreEntry(
        team.id,
        stage,
        pts,
        scoreNote || `Level ${stage} marks`,
        checked.value.criteria
      );
      notify(`${pts}/${STAGE_MAX} saved for ${team.name} in Level ${stage}.`);
      setScoreModalTeam(null);
      loadData();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save score", "err");
    }
  };

  // ── Attendance sheet export (server-generated PDF, admin-only route) ──
  const [downloadingAttendance, setDownloadingAttendance] = useState(false);
  const handleDownloadAttendance = async () => {
    setDownloadingAttendance(true);
    try {
      const res = await fetch("/api/admin/attendance", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notify(body.error || `Could not download the attendance sheet (HTTP ${res.status}).`, "err");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "Visual_Intelligence_2.0_Attendance_Sheet.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      notify("Attendance sheet downloaded.");
    } catch {
      notify("Network error — could not download the attendance sheet.", "err");
    } finally {
      setDownloadingAttendance(false);
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-champagne-500/15 border border-champagne-500/30 text-champagne-300">
          <Award className="w-3 h-3 text-champagne-400" /> FINALIST (L4)
        </span>
      );
    }
    if (team.shortlist_l3.decision === "shortlisted") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-wine-500/15 border border-wine-500/30 text-wine-300">
          <CheckCircle2 className="w-3 h-3 text-wine-400" /> SHORTLISTED (L3)
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
            <span>Teams, Marks & Shortlisting</span>
          </h1>
          <p className="text-xs text-white/50 mt-1 font-mono">
            Live list of every registered team. Enter marks for all four levels here, shortlist after Level 2, and pick Level 4 teams after Level 3.
          </p>
          <button
            onClick={handleDownloadAttendance}
            disabled={downloadingAttendance}
            aria-busy={downloadingAttendance}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloadingAttendance ? "Preparing PDF…" : "Download Attendance Sheet (PDF)"}
          </button>
        </div>

        {/* Global Summary Stats */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
            <span className="text-white/40 block text-[9px] uppercase">Registered</span>
            <span className="text-white font-bold text-sm">{data?.stats.total ?? 0}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
            <span className="text-wine-400/60 block text-[9px] uppercase">L3 Shortlisted</span>
            <span className="text-wine-300 font-bold text-sm">{data?.stats.level3_shortlisted ?? 0}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
            <span className="text-champagne-400/60 block text-[9px] uppercase">L4 Finalists</span>
            <span className="text-champagne-300 font-bold text-sm">{data?.stats.level4_finalists ?? 0}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
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
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "l1" ? "bg-white/20 text-white" : "bg-white/10 text-white/60"}`}>
            {data?.stats.total ?? 0}
          </span>
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
            {data?.stats.total ?? 0}
          </span>
        </button>

        <button
          onClick={() => switchTab("l3")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "l3"
              ? "bg-wine-600 text-white shadow-lg shadow-wine-600/30"
              : "bg-white/[0.03] border border-white/10 text-wine-300 hover:text-white hover:bg-wine-500/10"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Level 3: Prompt Rumble</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "l3" ? "bg-white/20 text-white" : "bg-wine-500/20 text-wine-300"}`}>
            {data?.stats.level3_shortlisted ?? 0}
          </span>
        </button>

        <button
          onClick={() => switchTab("l4")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "l4"
              ? "bg-champagne-300 text-[#1a1a1a] shadow-lg shadow-champagne-500/20"
              : "bg-white/[0.03] border border-white/10 text-champagne-300 hover:text-white hover:bg-champagne-500/10"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Level 4: Prompt Charades</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "l4" ? "bg-black/15 text-[#1a1a1a]" : "bg-champagne-500/20 text-champagne-300"}`}>
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
      {activeTab === "l1" && (
        <div className="p-5 rounded-2xl bg-[#800020]/10 border border-red-500/25">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Level 1: Cyber Styling — All Registered Teams</h2>
          </div>
          <p className="text-xs text-white/60 mt-1">
            No selection after Level 1. Every registered team appears here live and plays Level 2. Click a team&apos;s L1 mark (or Marks) to score it out of {STAGE_MAX}.
          </p>
        </div>
      )}

      {activeTab === "l2" && (
        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Level 2 Shortlist — Cutoff for Level 3
                </h2>
              </div>
              <p className="text-xs text-white/60 mt-1">
                Set a cutoff on Level 1 + Level 2 marks (out of {STAGE_MAX * 2}), tick the teams that pass, then confirm. Only ticked teams can open Level 3.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-mono text-white/70">
                <span>Cutoff (L1+L2):</span>
                <input
                  type="number"
                  min={0}
                  max={STAGE_MAX * 2}
                  value={l2Cutoff ?? ""}
                  onChange={(e) => setL2Cutoff(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-emerald-300"
                />
                <span className="text-white/40">/ {STAGE_MAX * 2}</span>
              </label>

              <button
                onClick={selectAboveL2Cutoff}
                disabled={l2Cutoff === null}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase transition-colors disabled:opacity-40"
              >
                Tick teams ≥ {l2Cutoff ?? "—"}
              </button>

              <button
                onClick={() => setShowL2ConfirmModal(true)}
                disabled={selectedForL3.size === 0}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40"
              >
                Confirm Level 3 List ({selectedForL3.size})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-white/40 block text-[10px]">Teams in Level 2</span>
              <span className="text-white font-bold text-base">{data?.teams.length ?? 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-white/40 block text-[10px]">Fully marked (L1 + L2)</span>
              <span className="text-white font-bold text-base">{data?.teams.filter((t) => combinedL12(t) !== null).length ?? 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-emerald-400/60 block text-[10px]">Ticked for Level 3</span>
              <span className="text-emerald-300 font-bold text-base">{selectedForL3.size}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-amber-400/60 block text-[10px]">Cut after Level 2</span>
              <span className="text-amber-300 font-bold text-base">{Math.max(0, (data?.teams.length ?? 0) - selectedForL3.size)}</span>
            </div>
          </div>

          <ShortlistRecommendation
            title={`Recommended top ${topAfterR2} for Level 3`}
            basis={`Level 1 + Level 2 marks (out of ${STAGE_MAX * 2}), registered teams only`}
            partColumns={[{ key: "r1", label: "L1 /25" }, { key: "r2", label: "L2 /25" }]}
            totalLabel="L1+L2 /50"
            rec={recAfterR2}
            topN={topAfterR2}
            onTopNChange={setTopAfterR2}
            onApply={() => applyRecommendation(2)}
            selectedIds={selectedForL3}
            onToggle={toggleSelectTeamForL3}
            accent="emerald"
          />
        </div>
      )}

      {activeTab === "l3" && (
        <div className="p-5 rounded-2xl bg-wine-950/20 border border-wine-500/30 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-wine-400 animate-pulse" />
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Level 3 Selection — Who Plays Level 4
                </h2>
              </div>
              <p className="text-xs text-white/60 mt-1">
                Only teams shortlisted after Level 2 are listed. Set a cutoff on Level 3 marks, tick the teams that pass, then confirm. Only ticked teams can open Level 4.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-mono text-white/70">
                <span>Cutoff (L3):</span>
                <input
                  type="number"
                  min={0}
                  max={STAGE_MAX}
                  value={l3Cutoff}
                  onChange={(e) => setL3Cutoff(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-wine-300"
                />
                <span className="text-white/40">/ {STAGE_MAX}</span>
              </label>

              <button
                onClick={selectAboveL3Cutoff}
                className="px-3 py-1.5 rounded-lg border border-wine-500/40 bg-wine-500/10 hover:bg-wine-500/20 text-wine-300 text-xs font-mono font-bold uppercase transition-colors"
              >
                Tick teams ≥ {l3Cutoff}
              </button>

              <button
                onClick={() => setShowL3ConfirmModal(true)}
                disabled={selectedForL4.size === 0}
                className="px-4 py-2 rounded-xl bg-wine-600 hover:bg-wine-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-wine-500/20 disabled:opacity-40"
              >
                Confirm Level 4 List ({selectedForL4.size})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-white/40 block text-[10px]">Teams in Level 3</span>
              <span className="text-white font-bold text-base">{l3Pool.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-white/40 block text-[10px]">Marked in Level 3</span>
              <span className="text-white font-bold text-base">{l3Pool.filter((t) => t.scores.s3 !== null).length}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-wine-400/60 block text-[10px]">Ticked for Level 4</span>
              <span className="text-wine-300 font-bold text-base">{selectedForL4.size}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs">
              <span className="text-amber-400/60 block text-[10px]">Cut after Level 3</span>
              <span className="text-amber-300 font-bold text-base">{Math.max(0, l3Pool.length - selectedForL4.size)}</span>
            </div>
          </div>

          <ShortlistRecommendation
            title={`Recommended top ${topAfterR3} for Level 4`}
            basis={`Level 3 marks (out of ${STAGE_MAX}), Level 3 teams only`}
            partColumns={[]}
            totalLabel="L3 /25"
            rec={recAfterR3}
            topN={topAfterR3}
            onTopNChange={setTopAfterR3}
            onApply={() => applyRecommendation(3)}
            selectedIds={selectedForL4}
            onToggle={toggleSelectTeamForL4}
            accent="wine"
          />
        </div>
      )}

      {activeTab === "l4" && (
        <div className="p-5 rounded-2xl bg-champagne-950/20 border border-champagne-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-champagne-400 animate-pulse" />
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
              className="px-4 py-2 rounded-xl bg-champagne-300 hover:bg-champagne-200 text-[#1a1a1a] font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-champagne-600/20"
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
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10 admin-panel">
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
        <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
          <span className="text-white/30 text-[10px] uppercase mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <button
            onClick={() => setSubFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              subFilter === "all" ? "bg-white/15 text-white font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            All ({filteredTeams.length})
          </button>
          <button
            onClick={() => setSubFilter("eligible")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              subFilter === "eligible" ? "bg-wine-500/20 text-wine-300 font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            Eligible
          </button>
          <button
            onClick={() => setSubFilter("shortlisted")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              subFilter === "shortlisted" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-white/50 hover:text-white"
            }`}
          >
            Shortlisted
          </button>
          <button
            onClick={() => setSubFilter("not_shortlisted")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
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
                {(activeTab === "l2" || activeTab === "l3") && (
                  <th className="py-3 px-3 text-center w-12" title="Tick to select">
                    <input
                      type="checkbox"
                      checked={filteredTeams.length > 0 && filteredTeams.every((t) => (activeTab === "l2" ? selectedForL3 : selectedForL4).has(t.id))}
                      onChange={(e) => {
                        const ids = filteredTeams.map((t) => t.id);
                        const setter = activeTab === "l2" ? setSelectedForL3 : setSelectedForL4;
                        setter((prev) => {
                          const next = new Set(prev);
                          ids.forEach((id) => (e.target.checked ? next.add(id) : next.delete(id)));
                          return next;
                        });
                      }}
                      className={`${activeTab === "l2" ? "accent-emerald-400" : "accent-wine-400"} h-4 w-4 rounded cursor-pointer`}
                      title="Tick all visible teams"
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
                {[1, 2, 3, 4].map((st) => (
                  <th key={st} className={`py-3 px-2 text-center ${activeTab === `l${st}` ? "text-white" : ""}`}>
                    L{st} /{STAGE_MAX}
                  </th>
                ))}
                <th
                  onClick={() => toggleSort("total")}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Total /{STAGE_MAX * 4}</span>
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
                const isChecked = activeTab === "l2" ? isSelectedInL2 : isSelectedInL3;

                return (
                  <tr
                    key={team.id}
                    className={`hover:bg-white/[0.03] transition-colors ${
                      isSelectedInL2 && activeTab === "l2"
                        ? "bg-emerald-950/20"
                        : isSelectedInL3 && activeTab === "l3"
                        ? "bg-wine-950/20"
                        : ""
                    }`}
                  >
                    {(activeTab === "l2" || activeTab === "l3") && (
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => (activeTab === "l2" ? toggleSelectTeamForL3(team.id) : toggleSelectTeamForL4(team.id))}
                          className={`${activeTab === "l2" ? "accent-emerald-400" : "accent-wine-400"} h-4 w-4 rounded cursor-pointer`}
                          title={`Tick ${team.name}`}
                        />
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

                    {/* Stage Marks (click to enter) */}
                    {[1, 2, 3, 4].map((st) => {
                      const val = stageScore(team, st);
                      const allowed = canScore(team, st);
                      return (
                        <td key={st} className="py-3 px-2 text-center font-bold">
                          {allowed ? (
                            <button
                              onClick={() => handleOpenScoreModal(team, st)}
                              className={`min-w-10 px-2 py-1 rounded-lg border transition-colors ${
                                val !== null
                                  ? "border-white/10 text-white hover:border-white/40"
                                  : "border-dashed border-white/20 text-white/40 hover:text-white hover:border-white/50"
                              } ${activeTab === `l${st}` ? "bg-white/[0.06]" : ""}`}
                              title={`Enter Level ${st} ${STAGE_NAMES[st]} marks`}
                            >
                              {val !== null ? val : "+"}
                            </button>
                          ) : (
                            <span className="text-white/15" title={`Not in Level ${st}`}>—</span>
                          )}
                        </td>
                      );
                    })}

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

                        {(() => {
                          const tabStage = activeTab.startsWith("l") ? Number(activeTab.slice(1)) : null;
                          const st = tabStage ?? [1, 2, 3, 4].find((n) => canScore(team, n) && stageScore(team, n) === null) ?? 1;
                          return canScore(team, st) ? (
                            <button
                              onClick={() => handleOpenScoreModal(team, st)}
                              className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold transition-colors"
                              title={`Enter Level ${st} marks`}
                            >
                              Marks L{st}
                            </button>
                          ) : null;
                        })()}

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
          <div className="bg-[#1c1a1a] border border-emerald-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs admin-modal">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Confirm Level 3 List</span>
              </h3>
              <button onClick={() => setShowL2ConfirmModal(false)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex justify-between text-white/70">
                <span>Cutoff (L1 + L2):</span>
                <span className="text-white font-bold">{l2Cutoff ?? "—"} / {STAGE_MAX * 2}</span>
              </div>
              <div className="flex justify-between text-emerald-300">
                <span>Shortlisted → can play Level 3:</span>
                <span className="font-bold text-emerald-200">{selectedForL3.size}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Not shortlisted (cut):</span>
                <span className="font-bold">{Math.max(0, (data?.teams.length ?? 0) - selectedForL3.size)}</span>
              </div>
            </div>

            {l2MissingScores.length > 0 && (
              <div className="p-3 rounded-xl border border-red-500/40 bg-red-950/30 text-red-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>Missing L1 or L2 marks: {l2MissingScores.map((t) => t.name).join(", ")}. Enter their marks first.</span>
              </div>
            )}

            <p className="text-white/50">Every team you didn&apos;t tick is marked not shortlisted and can&apos;t open Level 3. You can change the list and confirm again later.</p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setShowL2ConfirmModal(false)} className="px-4 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSaveL2Shortlist}
                disabled={isSavingL2Shortlist || l2MissingScores.length > 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40"
              >
                {isSavingL2Shortlist ? "Saving…" : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Level 3 -> Level 4 */}
      {showL3ConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1a1a] border border-wine-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs admin-modal">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-wine-400" />
                <span>Confirm Level 4 List</span>
              </h3>
              <button onClick={() => setShowL3ConfirmModal(false)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex justify-between text-white/70">
                <span>Teams in Level 3:</span>
                <span className="text-white font-bold">{l3Pool.length}</span>
              </div>
              <div className="flex justify-between text-wine-300">
                <span>Qualified → can play Level 4:</span>
                <span className="font-bold text-wine-200">{selectedForL4.size}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Cut after Level 3:</span>
                <span className="font-bold">{Math.max(0, l3Pool.length - selectedForL4.size)}</span>
              </div>
            </div>

            <p className="text-white/50">Only the ticked teams can open Level 4. Confirming again replaces the previous Level 4 list.</p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setShowL3ConfirmModal(false)} className="px-4 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSaveL3Shortlist}
                disabled={isSavingShortlist}
                className="px-5 py-2.5 rounded-xl bg-wine-600 hover:bg-wine-500 text-white font-bold uppercase tracking-wider transition-all shadow-md shadow-wine-500/20 disabled:opacity-40"
              >
                {isSavingShortlist ? "Saving…" : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Level 4 Finalist Publication */}
      {showL4ConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1a1a] border border-champagne-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl font-mono text-xs admin-modal">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-5 h-5 text-champagne-400" />
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
                className="px-5 py-2.5 rounded-xl bg-champagne-300 hover:bg-champagne-200 text-[#1a1a1a] font-bold uppercase tracking-wider"
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
          <div className="bg-[#1c1a1a] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs admin-modal">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  Marks — Level {scoreModalTeam.stage}: {STAGE_NAMES[scoreModalTeam.stage]}
                </h3>
                <p className="text-white/50 text-xs mt-0.5">{scoreModalTeam.team.name} ({scoreModalTeam.team.code})</p>
              </div>
              <button onClick={() => setScoreModalTeam(null)} className="text-white/40 hover:text-white p-1 rounded-lg" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Judge-guide rubric for this round */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-[#e9adb5] font-bold block">
                {STAGE_NAMES[scoreModalTeam.stage]} rubric ({STAGE_MAX})
              </span>
              {RUBRICS[scoreModalTeam.stage].map((c) => (
                <label key={c.key} className="flex items-center justify-between gap-3 py-1">
                  <span className="min-w-0">
                    <span className="text-white text-[11px] font-bold block">{c.label}</span>
                    <span className="text-white/40 text-[10px] block">{c.hint}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={c.max}
                      step="any"
                      value={rubric[c.key] ?? ""}
                      onChange={(e) => updateRubric(c.key, e.target.value)}
                      className="w-14 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-white"
                    />
                    <span className="text-white/40 w-7">/{c.max}</span>
                  </span>
                </label>
              ))}
              {scoreModalTeam.stage === 2 && (
                <label className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <span className="text-white/50 text-[10px]">Solve time from the Form (minutes) — fills Speed</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    onBlur={(e) => applySolveTime(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applySolveTime((e.target as HTMLInputElement).value)}
                    className="w-14 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-center font-bold text-white"
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-white/60 block text-[10px] uppercase">
                Total marks (max {STAGE_MAX}) — fills from the rubric, or type the final average:
              </label>
              <input
                type="number"
                step="any"
                min={0}
                max={STAGE_MAX}
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                placeholder="Enter marks…"
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
                Save Marks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Reason Edit Modal */}
      {editingReasonTeamId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1a1a] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs admin-modal">
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
          <div className="bg-[#1c1a1a] border border-white/20 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl font-mono text-xs admin-modal">
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
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
                  <span className="text-[10px] text-white/40 block">Level 1</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s1 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
                  <span className="text-[10px] text-white/40 block">Level 2</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s2 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
                  <span className="text-[10px] text-white/40 block">Level 3</span>
                  <span className="text-sm font-bold text-white">{detailTeam.scores.s3 ?? "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 admin-panel">
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
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5 admin-panel">
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
                  <span className={`font-bold uppercase ${detailTeam.shortlist_l4.qualified ? "text-champagne-300" : "text-white/40"}`}>
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
                  <div key={m.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between admin-panel">
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
