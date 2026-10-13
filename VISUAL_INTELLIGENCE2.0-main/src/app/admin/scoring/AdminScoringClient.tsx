"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  adminGetTeams, adminListSubmissions, adminGetRubricScores,
  adminSubmitRubricScore, adminSetScore, adminSavePreliminaryScores,
  adminGetPreliminaryScores, adminGetShortlistConfig,
  adminSetShortlistConfig, adminSetShortlistDecision, adminBulkShortlistTeams,
  AdminError,
} from "@/lib/admin";
import type {
  AdminSubmissionRow, AdminTeamDetail,
  PreliminaryScoreRow, ShortlistConfig, ShortlistDecision,
} from "@/lib/supabase";

interface StageOption {
  slug: string;
  number: number;
  name: string;
  rubric: { name: string; max_points?: number; round?: number }[] | null;
}
type RubricPrefill = Record<string, { criteria: Record<string, number>; comment: string | null; updated_at: string }>;
type ToastKind = "ok" | "err";


export default function AdminScoringClient() {
  const [stages, setStages] = useState<StageOption[]>([]);
  const [stageSlug, setStageSlug] = useState<string | null>(null);
  const [teams, setTeams] = useState<AdminTeamDetail[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [rubricPrefill, setRubricPrefill] = useState<RubricPrefill>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scoringTeamId, setScoringTeamId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [registrationDetails, setRegistrationDetails] = useState<AdminTeamDetail[] | null>(null);
  const [detailsTeamId, setDetailsTeamId] = useState<string | null>(null);

  // Preliminary (stage 1/2) state
  const [prelim, setPrelim] = useState<PreliminaryScoreRow[]>([]);
  const [config, setConfig] = useState<ShortlistConfig | null>(null);
  const [prelimLoading, setPrelimLoading] = useState(false);
  const [eligibilityFilter, setEligibilityFilter] = useState<"all" | "pending" | "eligible" | "below">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "undecided" | "shortlisted" | "rejected" | "on_hold">("all");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const flash = useCallback((msg: string, kind: ToastKind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadStages() {
      const { data, error } = await getSupabaseClient()
        .from("stages")
        .select("slug, number, name, rubric")
        .order("number");
      if (error) throw error;
      if (!active) return;
      setStages(data ?? []);
      if (data && data.length > 0) setStageSlug(data[0].slug);
    }
    void loadStages().catch((error: unknown) => {
      if (active) flash(error instanceof Error ? error.message : "Could not load stages", "err");
    });
    return () => { active = false; };
  }, [flash]);

  const refreshPrelim = useCallback(async () => {
    setPrelimLoading(true);
    try {
      const [rows, cfg] = await Promise.all([
        adminGetPreliminaryScores(),
        adminGetShortlistConfig(),
      ]);
      setPrelim(rows);
      setConfig(cfg);
    } catch (e) {
      setPrelim([]);
      setConfig(null);
      flash(e instanceof AdminError ? e.message : "Could not load preliminary scores", "err");
    } finally {
      setPrelimLoading(false);
    }
  }, [flash]);

  async function refreshStage(slug: string) {
    try {
      const stageNumber = stages.find((stage) => stage.slug === slug)?.number ?? 0;
      const [allTeams, subs, rubrics, shortlistRows] = await Promise.all([
        adminGetTeams(),
        adminListSubmissions(slug),
        adminGetRubricScores(slug),
        stageNumber >= 3 ? adminGetPreliminaryScores() : Promise.resolve(null),
      ]);
      const shortlistedIds = shortlistRows
        ? new Set(shortlistRows.filter((row) => row.decision === "shortlisted").map((row) => row.team_id))
        : null;
      setTeams(shortlistedIds ? allTeams.filter((team) => shortlistedIds.has(team.id)) : allTeams);
      setSubmissions(subs);
      setRubricPrefill(rubrics);
    } catch (e) {
      setTeams([]);
      setSubmissions([]);
      setRubricPrefill({});
      flash(e instanceof AdminError ? e.message : "Could not load stage scoring data", "err");
    } finally {
      setLoading(false);
    }
  }

  const currentStage = stages.find((s) => s.slug === stageSlug);
  const isPrelimStage = currentStage && currentStage.number <= 2;

  useEffect(() => {
    if (!stageSlug) return;
    const load = async () => {
      if (isPrelimStage) {
        await refreshPrelim();
      } else {
        setLoading(true);
        await refreshStage(stageSlug);
      }
    };
    void Promise.resolve().then(load);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSlug]);


  // ── Summary stats ──
  const stats = useMemo(() => {
    const total = prelim.length;
    const completed = prelim.filter((r) => r.combined !== null).length;
    const aboveCutoff = prelim.filter((r) => {
      if (r.combined === null || config === null) return false;
      return r.combined >= config.combined_cutoff
        && (r.s1 ?? 0) >= config.stage1_min
        && (r.s2 ?? 0) >= config.stage2_min;
    }).length;
    const shortlisted = prelim.filter((r) => r.decision === "shortlisted").length;
    const rejected = prelim.filter((r) => r.decision === "rejected").length;
    const onHold = prelim.filter((r) => r.decision === "on_hold").length;
    return { total, completed, aboveCutoff, shortlisted, rejected, onHold };
  }, [prelim, config]);

  const teamEligible = useCallback((r: PreliminaryScoreRow): boolean => {
    if (r.combined === null || config === null) return false;
    return r.combined >= config.combined_cutoff
      && (r.s1 ?? 0) >= config.stage1_min
      && (r.s2 ?? 0) >= config.stage2_min;
  }, [config]);

  const teamStatus = useCallback((r: PreliminaryScoreRow): string => {
    if (r.decision === "shortlisted") return "shortlisted";
    if (r.decision === "rejected") return "rejected";
    if (r.decision === "on_hold") return "on_hold";
    if (r.combined === null) return "pending";
    if (teamEligible(r)) return "eligible";
    return "below";
  }, [teamEligible]);

  // Warn admin when cutoff change conflicts with existing manual decisions
  const conflictingDecisions = useMemo(() => {
    if (!config) return [];
    return prelim.filter((r) => {
      if (r.decision === "shortlisted") return !teamEligible(r);
      if (r.decision === "rejected") return teamEligible(r);
      return false;
    });
  }, [prelim, config, teamEligible]);

  const filteredPrelim = useMemo(() => {
    const q = search.toLowerCase();
    return prelim.filter((r) => {
      if (q && !r.team_name.toLowerCase().includes(q) && !r.team_code.toLowerCase().includes(q)) return false;
      if (eligibilityFilter === "pending" && r.combined !== null) return false;
      if (eligibilityFilter === "eligible" && !teamEligible(r)) return false;
      if (eligibilityFilter === "below" && (r.combined === null || teamEligible(r))) return false;
      if (decisionFilter === "undecided" && r.decision !== null) return false;
      if (decisionFilter !== "all" && decisionFilter !== "undecided" && r.decision !== decisionFilter) return false;
      if (scoreMin !== "" && (r.combined === null || r.combined < Number(scoreMin))) return false;
      if (scoreMax !== "" && (r.combined === null || r.combined > Number(scoreMax))) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prelim, search, eligibilityFilter, decisionFilter, scoreMin, scoreMax, config, teamEligible]);

  async function toggleRegistrationDetails(teamId: string) {
    if (detailsTeamId === teamId) {
      setDetailsTeamId(null);
      return;
    }
    if (registrationDetails === null) {
      try {
        setRegistrationDetails(await adminGetTeams());
      } catch (e) {
        flash(e instanceof AdminError ? e.message : "Could not load registration details", "err");
        return;
      }
    }
    setDetailsTeamId(teamId);
  }

  async function handleDecision(
    teamId: string, decision: ShortlistDecision,
    note?: string, forceOverride = false
  ) {
    if (!forceOverride) {
      const row = prelim.find((item) => item.team_id === teamId);
      const action = decision === "shortlisted" ? "approve" : decision === "rejected" ? "reject" : "place on hold";
      const accessWarning = decision === "shortlisted"
        ? "Approval grants access to Stages 3 and 4 when released."
        : "This will revoke access to Stages 3 and 4.";
      if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} ${row?.team_name ?? "this team"}? ${accessWarning}`)) return;
    }
    try {
      await adminSetShortlistDecision(teamId, decision, note, forceOverride);
      flash(
        decision === "shortlisted"
          ? forceOverride ? "Team shortlisted with cutoff override" : "Team shortlisted"
          : decision === "rejected" ? "Team rejected" : "Team placed on hold"
      );
      refreshPrelim();
    } catch (e) {
      if (e instanceof AdminError && e.code === "BELOW_CUTOFF" && decision === "shortlisted") {
        const ok = confirm("This team is below the cutoff. Shortlist anyway as an override?");
        if (ok) handleDecision(teamId, decision, note, true);
      } else {
        flash(e instanceof AdminError ? e.message : "Failed", "err");
      }
    }
  }

  async function handleBulkShortlist() {
    const eligible = filteredPrelim.filter((r) => teamEligible(r) && r.decision === null);
    if (eligible.length === 0) { flash("No eligible teams to shortlist", "err"); return; }
    if (!confirm(`Shortlist these ${eligible.length} eligible, undecided team(s)? Existing decisions will not be changed.`)) return;
    try {
      const res = await adminBulkShortlistTeams(eligible.map((row) => row.team_id));
      flash(`${res.shortlisted_count} team(s) shortlisted`);
      refreshPrelim();
      setSelected(new Set());
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed", "err");
    }
  }

  async function handleBulkDecisionSelected(decision: ShortlistDecision) {
    if (selected.size === 0) return;
    const selectedRows = prelim.filter((row) => selected.has(row.team_id));
    const pendingRows = decision === "shortlisted" ? selectedRows.filter((row) => row.combined === null) : [];
    const actionableRows = selectedRows.filter((row) => !pendingRows.includes(row));
    if (actionableRows.length === 0) {
      flash("Teams with pending scores cannot be shortlisted", "err");
      return;
    }
    const overrideRows = decision === "shortlisted" ? actionableRows.filter((row) => !teamEligible(row)) : [];
    const pendingMessage = pendingRows.length ? ` ${pendingRows.length} team(s) with pending scores will be skipped.` : "";
    const overrideMessage = overrideRows.length
      ? ` This explicitly overrides the cutoff for ${overrideRows.length} team(s): ${overrideRows.map((row) => row.team_name).join(", ")}.`
      : "";
    if (!confirm(`Apply "${decision}" to ${actionableRows.length} team(s)?${overrideMessage}${pendingMessage}`)) return;
    const failures: string[] = [];
    for (const row of actionableRows) {
      try {
        await adminSetShortlistDecision(row.team_id, decision, undefined, decision === "shortlisted" && !teamEligible(row));
      } catch (e) {
        failures.push(`${row.team_name}: ${e instanceof Error ? e.message : "Failed"}`);
      }
    }
    flash(
      failures.length
        ? `Applied with ${failures.length} error(s): ${failures[0]}`
        : `Applied to ${actionableRows.length} team(s)${pendingMessage}`,
      failures.length ? "err" : "ok"
    );
    refreshPrelim();
    setSelected(new Set());
  }


  const latestSubmissionByTeam = useMemo(() => {
    const map = new Map<string, AdminSubmissionRow>();
    for (const s of submissions) {
      const existing = map.get(s.team_id);
      if (!existing || s.version > existing.version) map.set(s.team_id, s);
    }
    return map;
  }, [submissions]);

  const submissionCountByTeam = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) map.set(s.team_id, (map.get(s.team_id) ?? 0) + 1);
    return map;
  }, [submissions]);

  const stageKey = currentStage ? (`s${currentStage.number}` as "s1" | "s2" | "s3" | "s4") : null;
  return (
    <div className="max-w-6xl mx-auto font-mono">
      {toast && (
        <div className={`fixed top-20 right-6 px-4 py-2 rounded border text-xs font-bold z-50 ${
          toast.kind === "ok"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>{toast.msg}</div>
      )}

      {/* Header + stage tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-sans font-bold uppercase tracking-[0.12em] text-lg text-white/80">Scoring</h1>
        <div className="flex gap-2 flex-wrap">
          {stages.map((s) => (
            <button
              key={s.slug}
              onClick={() => {
                setStageSlug(s.slug);
                setSearch("");
                setEligibilityFilter("all");
                setDecisionFilter("all");
                setScoreMin("");
                setScoreMax("");
                setSelected(new Set());
              }}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider rounded border ${
                stageSlug === s.slug ? "bg-white text-black border-white" : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              Stage {s.number}
            </button>
          ))}
        </div>
      </div>

      {/* ── PRELIMINARY STAGES (1 & 2) ── */}
      {isPrelimStage && (
        <PreliminaryTab
          key={config?.updated_at ?? "initial"}
          stageNumber={currentStage!.number}
          config={config}
          loading={prelimLoading}
          stats={stats}
          search={search}
          setSearch={setSearch}
          eligibilityFilter={eligibilityFilter}
          setEligibilityFilter={setEligibilityFilter}
          decisionFilter={decisionFilter}
          setDecisionFilter={setDecisionFilter}
          scoreMin={scoreMin}
          setScoreMin={setScoreMin}
          scoreMax={scoreMax}
          setScoreMax={setScoreMax}
          filteredPrelim={filteredPrelim}
          selected={selected}
          setSelected={setSelected}
          teamStatus={teamStatus}
          teamEligible={teamEligible}
          conflictingDecisions={conflictingDecisions}
          registrationDetails={registrationDetails}
          detailsTeamId={detailsTeamId}
          onToggleRegistrationDetails={toggleRegistrationDetails}
          handleDecision={handleDecision}
          handleBulkShortlist={handleBulkShortlist}
          handleBulkDecisionSelected={handleBulkDecisionSelected}
          onConfigSaved={async (cutoff, s1min, s2min) => {
            try {
              await adminSetShortlistConfig(cutoff, s1min, s2min);
              flash("Cutoff saved");
              refreshPrelim();
            } catch (e) {
              flash(e instanceof AdminError ? e.message : "Failed", "err");
            }
          }}
          onScoreSaved={() => { flash("Score saved"); refreshPrelim(); }}
        />
      )}

      {/* ── STAGES 3 & 4 ── */}
      {!isPrelimStage && currentStage && (
        <LaterStageTab
          stageNumber={currentStage.number}
          stageSlug={stageSlug!}
          currentStage={currentStage}
          teams={teams}
          loading={loading}
          search={search}
          setSearch={setSearch}
          scoringTeamId={scoringTeamId}
          setScoringTeamId={setScoringTeamId}
          latestSubmissionByTeam={latestSubmissionByTeam}
          submissionCountByTeam={submissionCountByTeam}
          stageKey={stageKey}
          rubricPrefill={rubricPrefill}
          onSaved={() => { flash("Score saved"); refreshStage(stageSlug!); setScoringTeamId(null); }}
        />
      )}
    </div>
  );
}


// ─── Status badge helper ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     "bg-white/5 text-white/40",
    below:       "bg-red-500/10 text-red-300",
    eligible:    "bg-cyan-500/10 text-cyan-300",
    shortlisted: "bg-emerald-500/10 text-emerald-300",
    rejected:    "bg-red-500/20 text-red-400",
    on_hold:     "bg-amber-500/10 text-amber-300",
  };
  const label: Record<string, string> = {
    pending:     "Pending Scores",
    below:       "Below Cutoff",
    eligible:    "Eligible for Shortlisting",
    shortlisted: "Shortlisted",
    rejected:    "Rejected",
    on_hold:     "On Hold",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${map[status] ?? "text-white/40"}`}>
      {label[status] ?? status}
    </span>
  );
}

// ─── Preliminary Tab ────────────────────────────────────────────────────────
function PreliminaryTab({
  stageNumber, config, loading, stats, search, setSearch,
  eligibilityFilter, setEligibilityFilter, decisionFilter, setDecisionFilter,
  scoreMin, setScoreMin, scoreMax, setScoreMax, filteredPrelim, selected, setSelected,
  teamStatus, teamEligible, conflictingDecisions, handleDecision, handleBulkShortlist,
  handleBulkDecisionSelected, onConfigSaved, onScoreSaved,
  registrationDetails, detailsTeamId, onToggleRegistrationDetails,
}: {
  stageNumber: number;
  config: ShortlistConfig | null;
  loading: boolean;
  stats: { total: number; completed: number; aboveCutoff: number; shortlisted: number; rejected: number; onHold: number };
  search: string;
  setSearch: (v: string) => void;
  eligibilityFilter: "all" | "pending" | "eligible" | "below";
  setEligibilityFilter: (v: "all" | "pending" | "eligible" | "below") => void;
  decisionFilter: "all" | "undecided" | "shortlisted" | "rejected" | "on_hold";
  setDecisionFilter: (v: "all" | "undecided" | "shortlisted" | "rejected" | "on_hold") => void;
  scoreMin: string;
  setScoreMin: (v: string) => void;
  scoreMax: string;
  setScoreMax: (v: string) => void;
  filteredPrelim: PreliminaryScoreRow[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  teamStatus: (r: PreliminaryScoreRow) => string;
  teamEligible: (r: PreliminaryScoreRow) => boolean;
  conflictingDecisions: PreliminaryScoreRow[];
  handleDecision: (id: string, d: ShortlistDecision, note?: string, force?: boolean) => void;
  handleBulkShortlist: () => void;
  handleBulkDecisionSelected: (d: ShortlistDecision) => void;
  registrationDetails: AdminTeamDetail[] | null;
  detailsTeamId: string | null;
  onToggleRegistrationDetails: (id: string) => void;
  onConfigSaved: (cutoff: number, s1min: number, s2min: number) => void;
  onScoreSaved: () => void;
}) {
  const [cutoffInput, setCutoffInput] = useState(String(config?.combined_cutoff ?? 60));
  const [s1minInput, setS1minInput] = useState(String(config?.stage1_min ?? 0));
  const [s2minInput, setS2minInput] = useState(String(config?.stage2_min ?? 0));
  const [editScoreTeamId, setEditScoreTeamId] = useState<string | null>(null);
  const editScoreTeam = filteredPrelim.find((row) => row.team_id === editScoreTeamId) ?? null;
  const validCutoff = cutoffInput.trim() !== "" && Number.isFinite(Number(cutoffInput)) && Number(cutoffInput) >= 0 && Number(cutoffInput) <= 100;
  const validStage1Min = s1minInput.trim() !== "" && Number.isFinite(Number(s1minInput)) && Number(s1minInput) >= 0 && Number(s1minInput) <= 50;
  const validStage2Min = s2minInput.trim() !== "" && Number.isFinite(Number(s2minInput)) && Number(s2minInput) >= 0 && Number(s2minInput) <= 50;

  const allFilteredIds = filteredPrelim.map((r) => r.team_id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allFilteredIds));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Cutoff</span>
        <label className="flex items-center gap-1.5 text-[10px] text-white/45">
          Combined
          <input aria-label="Combined cutoff out of 100" type="number" min={0} max={100} step="any" value={cutoffInput}
            onChange={(e) => setCutoffInput(e.target.value)}
            className="w-16 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white" />
          <span>/100</span>
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-white/45">
          S1 min
          <input aria-label="Stage 1 minimum out of 50" type="number" min={0} max={50} step="any" value={s1minInput}
            onChange={(e) => setS1minInput(e.target.value)}
            className="w-14 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white" />
          <span>/50</span>
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-white/45">
          S2 min
          <input aria-label="Stage 2 minimum out of 50" type="number" min={0} max={50} step="any" value={s2minInput}
            onChange={(e) => setS2minInput(e.target.value)}
            className="w-14 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white" />
          <span>/50</span>
        </label>
        <button
          onClick={() => onConfigSaved(Number(cutoffInput), Number(s1minInput), Number(s2minInput))}
          disabled={!validCutoff || !validStage1Min || !validStage2Min}
          className="rounded border border-white/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/65 hover:bg-white/5 disabled:opacity-40"
        >Save</button>
      </section>

      {/* Cutoff conflict warning */}
      {conflictingDecisions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider">Cutoff conflict:</span>{" "}
            {conflictingDecisions.length} saved decision(s) no longer match the current cutoff:
            {" "}{conflictingDecisions.map((r) => `${r.team_name} (${r.decision === "shortlisted" ? "approved below cutoff" : "rejected despite eligibility"})`).join(", ")}.
            {" "}Review these teams. No decision or access permission was changed automatically.
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
        {[
          { label: "Teams", value: stats.total, color: "text-white" },
          { label: "Scored", value: stats.completed, color: "text-white/60" },
          { label: "Above Cutoff", value: stats.aboveCutoff, color: "text-cyan-300" },
          { label: "Shortlisted", value: stats.shortlisted, color: "text-emerald-300" },
          { label: "Rejected", value: stats.rejected, color: "text-red-400" },
          { label: "On Hold", value: stats.onHold, color: "text-amber-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-white/35">{label}</span>
            <span className={`text-sm font-bold ${color}`}>{loading ? "—" : value}</span>
          </div>
        ))}
      </div>

      {/* Search + filter + bulk actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team name or code…"
          className="min-w-[170px] flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/30" />
        <label className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40">
          Min score
          <input type="number" min={0} max={100} step="any" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)}
            className="w-14 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1.5 text-[11px] text-white" />
        </label>
        <label className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40">
          Max score
          <input type="number" min={0} max={100} step="any" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)}
            className="w-14 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1.5 text-[11px] text-white" />
        </label>
        <select value={eligibilityFilter} onChange={(e) => setEligibilityFilter(e.target.value as typeof eligibilityFilter)}
          aria-label="Filter by cutoff eligibility"
          className="rounded-md border border-white/10 bg-[#10141f] px-2 py-1.5 text-[10px] text-white">
          <option value="all">All cutoff statuses</option>
          <option value="pending">Pending scores</option>
          <option value="eligible">Eligible</option>
          <option value="below">Below cutoff</option>
        </select>
        <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as typeof decisionFilter)}
          aria-label="Filter by shortlist decision"
          className="rounded-md border border-white/10 bg-[#10141f] px-2 py-1.5 text-[10px] text-white">
          <option value="all">All decisions</option>
          <option value="undecided">Undecided</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="rejected">Rejected</option>
          <option value="on_hold">On hold</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5">
          <span className="mr-1 text-[10px] text-white/50">{selected.size} selected</span>
          <button onClick={() => handleBulkDecisionSelected("shortlisted")}
            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] uppercase text-emerald-300 hover:bg-emerald-500/20">
            Shortlist Selected
          </button>
          <button onClick={() => handleBulkDecisionSelected("rejected")}
            className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] uppercase text-red-400 hover:bg-red-500/20">
            Reject Selected
          </button>
          <button onClick={() => handleBulkDecisionSelected("on_hold")}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] uppercase text-amber-300 hover:bg-amber-500/20">
            Hold Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto px-2 text-[9px] text-white/30 hover:text-white">Clear</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/30">{filteredPrelim.length} teams · Stage {stageNumber}</p>
        <button onClick={handleBulkShortlist}
          className="rounded border border-emerald-500/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/10">
          Bulk Shortlist Eligible
        </button>
      </div>

      {/* Team table */}
      {loading ? (
        <p className="text-white/30 text-sm py-12 text-center">Loading…</p>
      ) : filteredPrelim.length === 0 ? (
        <p className="text-white/30 text-sm py-12 text-center">No teams match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.025]">
          <table className="w-full min-w-[900px] table-fixed text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.025] text-[9px] uppercase tracking-wider text-white/40">
                <th className="w-[29%] px-2.5 py-2 text-left">
                  <span className="inline-flex items-center gap-2">
                    <input aria-label="Select all visible teams" type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-cyan-400" />
                    Team
                  </span>
                </th>
                <th className="w-[9%] px-2 py-2 text-center">Stage 1 / 50</th>
                <th className="w-[9%] px-2 py-2 text-center">Stage 2 / 50</th>
                <th className="w-[11%] px-2 py-2 text-center">Total / 100</th>
                <th className="w-[14%] px-2 py-2 text-center">Eligibility</th>
                <th className="w-[14%] px-2 py-2 text-center">Decision</th>
                <th className="w-[14%] px-2.5 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrelim.map((row) => {
                const st = teamStatus(row);
                const eligibilityStatus = row.combined === null ? "pending" : teamEligible(row) ? "eligible" : "below";
                return (
                  <React.Fragment key={row.team_id}>
                    <tr className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.025]">
                      <td className="px-2.5 py-1.5">
                        <input type="checkbox" checked={selected.has(row.team_id)}
                          onChange={() => toggleOne(row.team_id)} className="accent-cyan-400" />
                        <span className="ml-2 inline-block max-w-[calc(100%-26px)] align-middle">
                        <div className="font-bold text-white">{row.team_name}</div>
                        <div className="truncate text-[9px] text-white/35" title={`Team ID: ${row.team_id}`}>
                          {row.team_code} · {row.member_count} members · ID {row.team_id.slice(0, 8)}
                        </div>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {row.s1 !== null ? (
                          <span className="text-white">{row.s1}</span>
                        ) : (
                          <span className="text-white/25 italic">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {row.s2 !== null ? (
                          <span className="text-white">{row.s2}</span>
                        ) : (
                          <span className="text-white/25 italic">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {row.combined !== null ? (
                          <span className={`font-bold ${teamEligible(row) ? "text-emerald-300" : "text-red-400"}`}>
                            {row.combined} / 100
                          </span>
                        ) : (
                          <span className="text-white/25 italic">Pending</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge status={eligibilityStatus} /></td>
                      <td className="px-2 py-1.5 text-center">
                        {row.decision ? (
                          <span>
                            <StatusBadge status={row.decision} />
                            {row.decision === "shortlisted" && row.is_override && (
                              <span className="block mt-1 text-[9px] font-bold uppercase text-amber-300">Cutoff override</span>
                            )}
                            {row.decided_at && (
                              <span className="block mt-1 text-[9px] text-white/30">
                                {new Date(row.decided_at).toLocaleString()}
                                {row.decided_by ? ` · ${row.decided_by}` : ""}
                              </span>
                            )}
                          </span>
                        ) : <span className="text-white/30">Undecided</span>}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[9px]">
                          <button onClick={() => setEditScoreTeamId(row.team_id)}
                            className="rounded border border-cyan-400/25 px-1.5 py-1 text-cyan-300 hover:bg-cyan-400/10">Edit</button>
                          <button onClick={() => onToggleRegistrationDetails(row.team_id)}
                            title={detailsTeamId === row.team_id ? "Hide registration details" : "View registration details"}
                            className="rounded border border-white/10 px-1.5 py-1 text-white/55 hover:bg-white/5">
                            {detailsTeamId === row.team_id ? "Hide" : "Details"}
                          </button>
                          {st !== "shortlisted" && (
                            <button
                              onClick={() => handleDecision(row.team_id, "shortlisted")}
                              disabled={row.combined === null}
                              title={row.combined === null ? "Enter both preliminary scores before shortlisting" : undefined}
                              className="rounded border border-emerald-500/25 px-1.5 py-1 text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-35">Approve</button>
                          )}
                          {st !== "rejected" && (
                            <button onClick={() => handleDecision(row.team_id, "rejected")}
                              className="rounded border border-red-500/20 px-1.5 py-1 text-red-300 hover:bg-red-500/10">Reject</button>
                          )}
                          {st !== "on_hold" && (
                            <button onClick={() => handleDecision(row.team_id, "on_hold")}
                              className="rounded border border-amber-500/20 px-1.5 py-1 text-amber-300 hover:bg-amber-500/10">Hold</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {detailsTeamId === row.team_id && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={7} className="p-3">
                          <TeamRegistrationDetails
                            team={registrationDetails?.find((team) => team.id === row.team_id) ?? null}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editScoreTeam && (
        <InlineScoreEditor
          key={editScoreTeam.team_id}
          teamId={editScoreTeam.team_id}
          teamName={editScoreTeam.team_name}
          s1={editScoreTeam.s1}
          s2={editScoreTeam.s2}
          cutoff={config?.combined_cutoff ?? 60}
          stage1Min={config?.stage1_min ?? 0}
          stage2Min={config?.stage2_min ?? 0}
          onCancel={() => setEditScoreTeamId(null)}
          onSaved={() => { setEditScoreTeamId(null); onScoreSaved(); }}
        />
      )}
    </div>
  );
}

function TeamRegistrationDetails({ team }: { team: AdminTeamDetail | null }) {
  if (!team) return <p className="text-xs text-white/40">Loading registration details…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-white/50">
        <span>Team ID: {team.id}</span>
        <span>Roster: {team.member_count}</span>
        {team.captain_id && <span>Captain record: {team.captain_id}</span>}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {team.members.map((member) => (
          <div key={member.id} className="rounded border border-white/10 p-3 text-xs">
            <div className="font-bold text-white">{member.name} <span className="font-normal text-white/40">({member.role})</span></div>
            <div className="mt-1 text-white/50">{member.reg_no} · {member.email}</div>
            {member.phone && <div className="text-white/40">{member.phone}</div>}
            <div className="text-white/40">{member.section ?? "No section"} · {member.year ?? "Year unspecified"}</div>
          </div>
        ))}
      </div>
      {team.members.length === 0 && <p className="text-xs text-white/40">No registration records found.</p>}
    </div>
  );
}


// ─── Preliminary score editor ──────────────────────────────────────────────
function InlineScoreEditor({
  teamId, teamName, s1, s2, cutoff, stage1Min, stage2Min, onSaved, onCancel,
}: {
  teamId: string;
  teamName: string;
  s1: number | null;
  s2: number | null;
  cutoff: number;
  stage1Min: number;
  stage2Min: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [v1, setV1] = useState(s1 !== null ? String(s1) : "");
  const [v2, setV2] = useState(s2 !== null ? String(s2) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const n1 = v1 === "" ? null : Number(v1);
  const n2 = v2 === "" ? null : Number(v2);
  const combined = n1 !== null && n2 !== null ? n1 + n2 : null;
  const invalid1 = v1 !== "" && (n1 === null || !Number.isFinite(n1) || n1 < 0 || n1 > 50);
  const invalid2 = v2 !== "" && (n2 === null || !Number.isFinite(n2) || n2 < 0 || n2 > 50);
  const eligible = combined !== null && combined >= cutoff && n1! >= stage1Min && n2! >= stage2Min;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, saving]);

  async function save() {
    if (invalid1 || invalid2) { setErr("Check score ranges (S1: 0-50, S2: 0-50)"); return; }
    if (v1 === "" && v2 === "") { setErr("Enter at least one score"); return; }
    setSaving(true); setErr(null);
    try {
      await adminSavePreliminaryScores(teamId, n1, n2, v1 !== "", v2 !== "");
      onSaved();
    } catch (e) {
      setErr(e instanceof AdminError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="preliminary-score-title"
        className="w-full max-w-md rounded-xl border border-white/15 bg-[#10141f] p-4 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="preliminary-score-title" className="text-sm font-bold text-white">Edit preliminary score</h2>
            <p className="mt-1 truncate text-xs text-white/50">{teamName}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving}
            aria-label="Close score editor" className="rounded p-1.5 text-white/45 hover:bg-white/5 hover:text-white disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[10px] uppercase tracking-wide text-white/45">
            Stage 1 / 50
            <input autoFocus type="number" min={0} max={50} step="any" value={v1}
              onChange={(e) => setV1(e.target.value)}
              className={`w-full rounded-md border bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60 ${invalid1 ? "border-red-500" : "border-white/15"}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] uppercase tracking-wide text-white/45">
            Stage 2 / 50
            <input type="number" min={0} max={50} step="any" value={v2}
              onChange={(e) => setV2(e.target.value)}
              className={`w-full rounded-md border bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60 ${invalid2 ? "border-red-500" : "border-white/15"}`} />
          </label>
        </div>
        <p className="mt-2 text-[10px] text-white/35">Leave a blank field unchanged. Marks must be between 0 and 50.</p>
        <div className="mt-4 flex items-center justify-between rounded-md border border-white/10 bg-white/[0.025] px-3 py-2">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-white/40">Combined total</p>
            <p className="text-sm font-bold text-white">{combined === null ? "Pending" : `${combined} / 100`}</p>
          </div>
          {combined !== null && (
            <span className={`rounded px-2 py-1 text-[9px] font-bold uppercase ${eligible ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
              {eligible ? "Eligible" : "Below cutoff"}
            </span>
          )}
        </div>
        <p className="mt-1 text-right text-[9px] text-white/35">
          Cutoff {cutoff} / 100{stage1Min || stage2Min ? ` · Minimums S1 ${stage1Min}, S2 ${stage2Min}` : ""}
        </p>
        {err && <p role="alert" className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-md border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase text-white/60 hover:bg-white/5 disabled:opacity-40">Cancel</button>
          <button type="button" onClick={save} disabled={saving || invalid1 || invalid2 || (v1 === "" && v2 === "")}
            className="rounded-md bg-emerald-400 px-3.5 py-1.5 text-[10px] font-bold uppercase text-[#07110c] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : "Save scores"}
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Later Stage Tab (Stage 3 / 4) ─────────────────────────────────────────
function LaterStageTab({
  stageNumber, stageSlug, currentStage, teams, loading, search, setSearch,
  scoringTeamId, setScoringTeamId, latestSubmissionByTeam, submissionCountByTeam,
  stageKey, rubricPrefill, onSaved,
}: {
  stageNumber: number;
  stageSlug: string;
  currentStage: StageOption;
  teams: AdminTeamDetail[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  scoringTeamId: string | null;
  setScoringTeamId: (id: string | null) => void;
  latestSubmissionByTeam: Map<string, AdminSubmissionRow>;
  submissionCountByTeam: Map<string, number>;
  stageKey: "s1" | "s2" | "s3" | "s4" | null;
  rubricPrefill: RubricPrefill;
  onSaved: () => void;
}) {
  const hasRubric = (currentStage.rubric?.length ?? 0) > 0;
  const filteredTeams = teams
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {stageNumber >= 3 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-300 flex items-center justify-between flex-wrap gap-2">
          <span>Only shortlisted teams appear here. Teams not shortlisted are blocked at the database level.</span>
          <Link
            href={`/admin/teams?tab=${stageNumber === 4 ? "l4" : "l3"}`}
            className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:text-white uppercase font-bold text-[10px]"
          >
            Manage {stageNumber === 4 ? "Level 4 Finalists" : "Level 3 Shortlist"} →
          </Link>
        </div>
      )}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search team…"
        className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30" />
      {!hasRubric && (
        <p className="text-[11px] text-amber-400/80">
          No rubric defined for this stage — scoring uses a single point value.
        </p>
      )}
      {loading ? (
        <p className="text-white/40 text-sm py-12 text-center">Loading…</p>
      ) : filteredTeams.length === 0 ? (
        <p className="text-white/30 text-sm py-12 text-center">No teams match.</p>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map((team) => {
            const sub = latestSubmissionByTeam.get(team.id);
            const subCount = submissionCountByTeam.get(team.id) ?? 0;
            const currentScore = stageKey ? team[stageKey] : 0;
            return (
              <div key={team.id} className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{team.name}</span>
                      <span className="text-[10px] text-white/30 uppercase">score: {currentScore || 0}</span>
                    </div>
                    {sub ? (
                      <>
                        <div className="text-[10px] text-white/30 uppercase mt-1">
                          v{sub.version} · {sub.kind}{subCount > 1 ? ` · ${subCount} versions` : ""}
                        </div>
                        {sub.kind === "url" && sub.url ? (
                          <a href={sub.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 underline break-all">{sub.url}</a>
                        ) : (
                          <p className="text-xs text-white/60 mt-1 whitespace-pre-wrap break-words">{sub.text_value}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-white/30 mt-1 italic">No submission yet.</p>
                    )}
                  </div>
                  <button
                    onClick={() => setScoringTeamId(scoringTeamId === team.id ? null : team.id)}
                    className="shrink-0 px-3 py-1.5 text-[10px] uppercase font-bold rounded bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 text-[#060912]">
                    {scoringTeamId === team.id ? "Close" : "Score"}
                  </button>
                </div>
                {scoringTeamId === team.id && (
                  <ScorePanel
                    teamId={team.id}
                    stageSlug={stageSlug}
                    stageNumber={currentStage.number}
                    rubric={currentStage.rubric ?? []}
                    currentScore={currentScore}
                    prefill={rubricPrefill[team.id]}
                    onSaved={onSaved}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ScorePanel (rubric / overall for stages 3/4) ──────────────────────────
function ScorePanel({
  teamId, stageSlug, stageNumber, rubric, currentScore, prefill, onSaved,
}: {
  teamId: string; stageSlug: string; stageNumber: number;
  rubric: { name: string; max_points?: number; round?: number }[];
  currentScore: number;
  prefill?: { criteria: Record<string, number>; comment: string | null };
  onSaved: () => void;
}) {
  const [criteria, setCriteria] = useState<Record<string, number>>(prefill?.criteria ?? {});
  const [overall, setOverall] = useState(currentScore || 0);
  const [comment, setComment] = useState(prefill?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roundCount = Math.max(1, ...rubric.map((c) => c.round ?? 1));
  const keyFor = (c: { name: string; round?: number }) =>
    roundCount > 1 ? `Round ${c.round ?? 1} :: ${c.name}` : c.name;
  const roundTotals = Array.from({ length: roundCount }, (_, i) => {
    const r = i + 1;
    return rubric.filter((c) => (c.round ?? 1) === r).reduce((s, c) => s + (criteria[keyFor(c)] ?? 0), 0);
  });
  const total = rubric.length > 0
    ? roundTotals.reduce((s, t) => s + t, 0) / roundCount
    : overall;
  const invalidRubric = rubric.some((c) => {
    const p = criteria[keyFor(c)];
    return p === undefined || !Number.isFinite(p) || p < 0 || p > (c.max_points ?? 10);
  });
  const invalidOverall = !Number.isFinite(overall) || overall < 0 || overall > 100;

  async function handleSave() {
    setSubmitting(true); setError(null);
    try {
      if (rubric.length > 0) {
        await adminSubmitRubricScore(teamId, stageSlug, criteria, comment || undefined);
      } else {
        await adminSetScore(teamId, stageNumber, overall, comment || undefined);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof AdminError ? e.message : "Failed to save score");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
      {rubric.length > 0 ? (
        Array.from({ length: roundCount }, (_, i) => i + 1).map((round) => (
          <fieldset key={round} className="space-y-3">
            {roundCount > 1 && (
              <legend className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">Round {round}</legend>
            )}
            {rubric.filter((c) => (c.round ?? 1) === round).map((c) => {
              const key = keyFor(c);
              return (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label htmlFor={`${teamId}-${stageSlug}-${key}`} className="text-xs text-white/70 flex-1">{c.name}</label>
                  <input id={`${teamId}-${stageSlug}-${key}`} type="number" min={0} max={c.max_points ?? 10} step="any"
                    value={criteria[key] ?? ""}
                    onChange={(e) => setCriteria((prev) => {
                      const next = { ...prev };
                      if (e.target.value === "") delete next[key]; else next[key] = Number(e.target.value);
                      return next;
                    })}
                    className="w-20 px-2 py-1 bg-white/5 border border-white/15 rounded text-sm text-center" />
                  <span className="text-[10px] text-white/30 w-16">/ {c.max_points ?? 10}</span>
                </div>
              );
            })}
            {roundCount > 1 && (
              <p className="text-right text-[10px] text-white/40">Round {round} total: {roundTotals[round - 1]} / 100</p>
            )}
          </fieldset>
        ))
      ) : (
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-white/70">Overall points</label>
          <input type="number" min={0} max={100} step="any" value={overall}
            onChange={(e) => setOverall(Number(e.target.value))}
            className="w-24 px-2 py-1 bg-white/5 border border-white/15 rounded text-sm text-center" />
        </div>
      )}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Judge comment (optional)"
        className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded text-xs h-16" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">
          {roundCount > 1 ? "Final average" : "Total"}: <span className="font-bold text-white">{total}</span>
        </span>
        <button onClick={handleSave}
          disabled={submitting || (rubric.length > 0 ? invalidRubric : invalidOverall)}
          className="px-4 py-2 text-[11px] uppercase font-bold rounded bg-emerald-500 text-black disabled:opacity-50">
          {submitting ? "Saving…" : "Save Score"}
        </button>
      </div>
    </div>
  );
}
