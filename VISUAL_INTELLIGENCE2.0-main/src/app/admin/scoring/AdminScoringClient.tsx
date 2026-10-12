"use client";

// The single scoring surface — replaces the old separate Judge Quick
// Mode and Submissions viewer pages. Every team shows up here
// regardless of whether they've submitted anything yet (Judge's old
// behavior); when they have, the submission content is right there
// next to the score field (Submissions' old behavior).
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { adminGetTeams, adminListSubmissions, adminGetRubricScores, adminSubmitRubricScore, adminSetScore, AdminError } from "@/lib/admin";
import type { AdminSubmissionRow, AdminTeamDetail } from "@/lib/supabase";

interface StageOption {
  slug: string;
  number: number;
  name: string;
  rubric: { name: string; max_points?: number }[] | null;
}

type RubricPrefill = Record<string, { criteria: Record<string, number>; comment: string | null; updated_at: string }>;

export default function AdminScoringClient() {
  const [stages, setStages] = useState<StageOption[]>([]);
  const [stageSlug, setStageSlug] = useState<string | null>(null);
  const [teams, setTeams] = useState<AdminTeamDetail[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [rubricPrefill, setRubricPrefill] = useState<RubricPrefill>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scoringTeamId, setScoringTeamId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    getSupabaseClient()
      .from("stages")
      .select("slug, number, name, rubric")
      .order("number")
      .then(({ data }) => {
        setStages(data ?? []);
        if (data && data.length > 0) setStageSlug(data[0].slug);
      });
  }, []);

  async function refresh(slug: string) {
    try {
      const [teamList, subs, rubrics] = await Promise.all([
        adminGetTeams(),
        adminListSubmissions(slug),
        adminGetRubricScores(slug),
      ]);
      setTeams(teamList);
      setSubmissions(subs);
      setRubricPrefill(rubrics);
    } catch {
      // non-fatal — list just stays empty until retried
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (stageSlug && !cancelled) await refresh(stageSlug);
    })();
    return () => {
      cancelled = true;
    };
  }, [stageSlug]);

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

  const currentStage = stages.find((s) => s.slug === stageSlug);
  const hasRubric = (currentStage?.rubric?.length ?? 0) > 0;
  const stageKey = currentStage ? (`s${currentStage.number}` as "s1" | "s2" | "s3" | "s4") : null;

  const filteredTeams = teams
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <div className="fixed top-20 right-6 px-4 py-2 rounded bg-emerald-500 text-black text-xs font-bold z-50">{toast}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold uppercase tracking-wider">Scoring</h1>
        <div className="flex gap-2">
          {stages.map((s) => (
            <button
              key={s.slug}
              onClick={() => setStageSlug(s.slug)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-wider rounded border ${
                stageSlug === s.slug ? "bg-white text-black border-white" : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              Stage {s.number}
            </button>
          ))}
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search team…"
        className="w-full px-4 py-2.5 mb-4 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30"
      />

      {!hasRubric && currentStage && (
        <p className="text-[11px] text-amber-400/80 mb-4">
          No rubric criteria defined for this stage yet — scoring is a single overall point value.
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
                        <div className="text-[10px] text-white/30 uppercase mt-1">v{sub.version} · {sub.kind}{subCount > 1 ? ` · ${subCount} versions` : ""}</div>
                        {sub.kind === "url" && sub.url ? (
                          <a href={sub.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 underline break-all">
                            {sub.url}
                          </a>
                        ) : (
                          <p className="text-xs text-white/60 mt-1 whitespace-pre-wrap break-words">{sub.text_value}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-white/30 mt-1 italic">No submission yet for this stage.</p>
                    )}
                  </div>
                  <button
                    onClick={() => setScoringTeamId(scoringTeamId === team.id ? null : team.id)}
                    className="shrink-0 px-3 py-1.5 text-[10px] uppercase font-bold rounded bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 text-[#060912]"
                  >
                    {scoringTeamId === team.id ? "Close" : "Score"}
                  </button>
                </div>

                {scoringTeamId === team.id && stageSlug && currentStage && (
                  <ScorePanel
                    teamId={team.id}
                    stageSlug={stageSlug}
                    stageNumber={currentStage.number}
                    rubric={currentStage.rubric ?? []}
                    currentScore={currentScore}
                    prefill={rubricPrefill[team.id]}
                    onSaved={() => {
                      flash("Score saved");
                      refresh(stageSlug);
                      setScoringTeamId(null);
                    }}
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

function ScorePanel({
  teamId,
  stageSlug,
  stageNumber,
  rubric,
  currentScore,
  prefill,
  onSaved,
}: {
  teamId: string;
  stageSlug: string;
  stageNumber: number;
  rubric: { name: string; max_points?: number }[];
  currentScore: number;
  prefill?: { criteria: Record<string, number>; comment: string | null };
  onSaved: () => void;
}) {
  const [criteria, setCriteria] = useState<Record<string, number>>(prefill?.criteria ?? {});
  const [overall, setOverall] = useState(currentScore || 0);
  const [comment, setComment] = useState(prefill?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = rubric.length > 0 ? Object.values(criteria).reduce((a, b) => a + (b || 0), 0) : overall;

  async function handleSave() {
    setSubmitting(true);
    setError(null);
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
        rubric.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-3">
            <label className="text-xs text-white/70 flex-1">{c.name}</label>
            <input
              type="number"
              min={0}
              max={c.max_points ?? 10}
              value={criteria[c.name] ?? ""}
              onChange={(e) => setCriteria((prev) => ({ ...prev, [c.name]: Number(e.target.value) }))}
              className="w-20 px-2 py-1 bg-white/5 border border-white/15 rounded text-sm text-center"
            />
            <span className="text-[10px] text-white/30 w-16">/ {c.max_points ?? 10}</span>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-white/70">Overall points</label>
          <input
            type="number"
            value={overall}
            onChange={(e) => setOverall(Number(e.target.value))}
            className="w-24 px-2 py-1 bg-white/5 border border-white/15 rounded text-sm text-center"
          />
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Judge comment (optional)"
        className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded text-xs h-16"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Total: <span className="font-bold text-white">{total}</span></span>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="px-4 py-2 text-[11px] uppercase font-bold rounded bg-emerald-500 text-black disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save Score"}
        </button>
      </div>
    </div>
  );
}
