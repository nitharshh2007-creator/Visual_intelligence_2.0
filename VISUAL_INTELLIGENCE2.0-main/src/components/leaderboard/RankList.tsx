"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Team } from "@/lib/types";
import RankRow from "./RankRow";
import { denseRanks } from "./helpers";

interface Props {
  teams: Team[]; // full list, already sorted by the active criterion (desc)
  activeStage: number; // 0 = overall, 1-4 = specific — used to read the right score per row
  onTeamClick: (team: Team) => void;
}

const DEFAULT_VISIBLE = 15;

export default function RankList({ teams, activeStage, onTeamClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scoreOf = (t: Team) => (activeStage === 0 ? t.total : t.scores[`s${activeStage}` as keyof typeof t.scores]);

  // Dense ranks over the FULL list (including the top 3 shown on the
  // podium) so numbering here stays consistent with the podium above.
  const ranks = useMemo(() => denseRanks(teams, scoreOf), [teams, activeStage]); // eslint-disable-line react-hooks/exhaustive-deps

  const listTeams = teams.slice(3); // rank 4 onward — top 3 live on the podium
  const visibleTeams = expanded ? listTeams : listTeams.slice(0, DEFAULT_VISIBLE);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const match = listTeams.find((t) => t.name.toLowerCase().includes(q));
    if (!match) return;
    if (!expanded && !visibleTeams.includes(match)) setExpanded(true);
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(`[data-team-id="${match.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(match.id);
      setTimeout(() => setHighlightedId(null), 2000);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="lb-display-800 text-sm tracking-wider" style={{ color: "var(--lb-white)" }}>
          Full Standings
        </h2>
        <form onSubmit={handleSearch}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find your team…"
            className="px-3 py-1.5 text-xs w-44 md:w-56 outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 999,
              color: "var(--lb-white)",
              border: "1px solid var(--lb-line)",
            }}
          />
        </form>
      </div>

      <div ref={containerRef} className="space-y-2">
        <AnimatePresence initial={false}>
          {visibleTeams.map((team) => (
            <RankRow
              key={team.id}
              team={team}
              displayRank={ranks.get(team.id) ?? team.rank}
              displayScore={scoreOf(team)}
              isTied={listTeams.filter((t) => scoreOf(t) === scoreOf(team)).length > 1}
              highlighted={highlightedId === team.id}
              onOpen={onTeamClick}
            />
          ))}
        </AnimatePresence>
      </div>

      {listTeams.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: "var(--lb-grey-400)" }}>
          Waiting for the first scores…
        </div>
      )}

      {!expanded && listTeams.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--lb-white)", borderRadius: 12 }}
        >
          Show all {teams.length} teams
        </button>
      )}
    </div>
  );
}
