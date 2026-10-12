"use client";

import type { EventState } from "@/lib/types";

interface Props {
  eventState: EventState;
  round: string | null;
  totalTeams: number;
  shownTeams: number;
}

function getSubtitle(eventState: EventState): string {
  if (eventState.status === "finished") return "FINAL RESULTS";
  const currentStatus = eventState.stageStatuses[eventState.currentStage - 1];
  if (currentStatus === "finished") return `AFTER STAGE ${eventState.currentStage}`;
  if (currentStatus === "upcoming") return `NEXT: STAGE ${eventState.currentStage}`;
  return "LIVE STANDINGS";
}

export default function TitleBlock({ eventState, round, totalTeams, shownTeams }: Props) {
  const subtitle = getSubtitle(eventState);
  // "TOP n of N TEAMS" is only meaningful once some teams have
  // registered; before that (shownTeams === totalTeams === 0) it would
  // just read "TOP 0 of 0 TEAMS", which is noise, not information.
  const showCount = totalTeams > 0;

  return (
    <div className="text-center py-6 md:py-10" aria-live="polite">
      <p
        className="text-[11px] md:text-xs font-semibold tracking-[0.25em] mb-3"
        style={{ color: "var(--lb-rose-200)" }}
      >
        VISUAL INTELLIGENCE 2.0
      </p>

      {showCount && (
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--lb-grey-400)" }}>
            TOP {shownTeams} of {totalTeams} TEAMS
          </span>
          {round && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
              style={{ background: "var(--lb-burgundy-700)", color: "var(--lb-white)", borderRadius: 4 }}
            >
              {round}
            </span>
          )}
        </div>
      )}

      <h1
        className="lb-display mx-auto"
        style={{
          fontSize: "clamp(44px, 10vw, 96px)",
          background: "linear-gradient(180deg, #FFFFFF 0%, #F2C9D2 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: "0 0 60px rgba(109,0,26,0.55)",
        }}
      >
        TOP TEAMS
      </h1>

      <div className="flex items-center justify-center gap-3 mt-4">
        <p
          className="text-xs md:text-sm font-semibold tracking-[0.2em]"
          style={{ color: "var(--lb-rose-200)" }}
        >
          {subtitle}
        </p>
        {eventState.status === "paused" && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
            style={{ background: "var(--lb-burgundy-700)", color: "var(--lb-white)", borderRadius: 4 }}
          >
            Paused
          </span>
        )}
      </div>

      {/* Stage progress dots */}
      <div className="flex items-center justify-center gap-2.5 mt-5" aria-hidden="true">
        {eventState.stageStatuses.map((status, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${status === "live" ? "lb-live-dot" : ""}`}
            style={{
              background:
                status === "finished" ? "var(--lb-white)" : status === "live" ? "var(--lb-burgundy-300)" : "var(--lb-grey-400)",
              opacity: status === "upcoming" ? 0.35 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
