"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getTeam, loadSession, normalizeTeamCode, subscribeToTeam } from "@/lib/registration";
import type { RegistrationTeam } from "@/lib/types";
import LobbyBoard from "@/components/register/LobbyBoard";
import JoinTeamFlow from "@/components/register/JoinTeamFlow";

export default function JoinTeamPage() {
  return (
    <Suspense fallback={null}>
      <JoinTeamContent />
    </Suspense>
  );
}

function JoinTeamContent() {
  const params = useParams<{ code: string }>();
  const inviteCode = normalizeTeamCode(params.code ?? "");

  const [joinedTeam, setJoinedTeam] = useState<RegistrationTeam | null>(null);
  const [isCaptainView, setIsCaptainView] = useState(false);
  const [checkedSession, setCheckedSession] = useState(false);

  const teamId = joinedTeam?.inviteCode ?? null;
  useEffect(() => {
    if (!teamId) return;
    return subscribeToTeam(teamId, (updated) => {
      if (updated) setJoinedTeam(updated);
    });
  }, [teamId]);

  // Someone already on this team (captain or a prior joiner)
  // re-opening the invite link: resolve straight to the lobby instead
  // of making them "find" and re-join their own team. A first-time
  // visitor has no matching session, so they fall through to
  // JoinTeamFlow below as normal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = loadSession();
      const sameTeam = session?.teamCode && normalizeTeamCode(session.teamCode) === inviteCode;
      if (sameTeam) {
        const existing = await getTeam(inviteCode);
        if (!cancelled && existing) {
          setJoinedTeam(existing);
          setIsCaptainView(session!.isCaptain);
        }
      }
      if (!cancelled) setCheckedSession(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  if (!checkedSession) return null;

  return (
    <main className="relative z-10 min-h-screen bg-brand-bg/50 backdrop-blur-md text-brand-fg px-6 lg:px-12 py-20">
      <div className="max-w-3xl mx-auto mb-12">
        <Link href="/" className="font-sans text-xs uppercase tracking-[0.15em] text-brand-fg/50 hover:text-brand-fg transition-colors">
          ← Back home
        </Link>
      </div>

      {joinedTeam ? (
        <LobbyBoard team={joinedTeam} isCaptainView={isCaptainView} />
      ) : (
        <JoinTeamFlow
          initialCode={inviteCode}
          onJoined={(team) => {
            setIsCaptainView(false);
            setJoinedTeam(team);
          }}
        />
      )}
    </main>
  );
}
