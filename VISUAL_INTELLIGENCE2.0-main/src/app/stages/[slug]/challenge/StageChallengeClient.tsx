"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useStageGate } from "@/hooks/useStageGate";
import StageLockCard, { StageNotFound, isEliminatedAccess } from "@/components/stages/StageLockCard";
import BugxPasswordPanel from "./BugxPasswordPanel";
import CyberThemeCard from "@/components/stages/CyberThemeCard";
import Loader from "@/components/ui/Loader";
import { CUTOFFS } from "@/data/event";
import { FileText, ExternalLink, Code, Globe, Download, AlertTriangle } from "lucide-react";

export default function StageChallengeClient() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, entry, content, session, refresh } = useStageGate(slug);

  const isEnded = entry?.stage_status === "ended" || entry?.reason === "stage_ended";

  if (!hydrated) return <Loader label="Loading challenge" tone="dark" />;
  if (!entry) return <div className="p-8 text-center text-white/50">Stage not found</div>;
  if (isEliminatedAccess(entry.state, entry.reason)) return <StageNotFound />;

  if (isEnded && !content) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-champagne-500/10 border border-champagne-500/30 flex items-center justify-center text-champagne-300">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-[10px] font-mono tracking-widest text-champagne-400 uppercase">Stage Concluded</span>
          <h1 className="text-2xl font-serif text-white uppercase tracking-wider">This Stage Has Ended</h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-md mx-auto">
            The organizer has ended this round. Challenge materials and official Google Form submissions for this stage are now closed.
          </p>
        </div>
        <div>
          <Link
            href={`/stages/${slug}`}
            className="lb-cta inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-mono font-bold uppercase tracking-wider"
          >
            <span>View Stage Rules & Overview</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!content || !session) return <StageLockCard stage={entry.stage} name={entry.name} state={entry.state} reason={entry.reason} />;

  const { assets } = content;
  const assetHref = (assetId: string, download: boolean) =>
    `/api/assets/${assetId}?code=${encodeURIComponent(session.teamCode)}&reg_no=${encodeURIComponent(session.regNo ?? "")}&slug=${encodeURIComponent(slug)}${download ? "&download=1" : ""}`;
  const isImage = (path: string | null) => !!path && /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

  return (
    <div className="space-y-8 pb-16">
      {isEnded && (
        <div className="p-4 rounded-xl border border-champagne-400/30 bg-champagne-400/10 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-champagne-200">Stage Ended</p>
          <p className="text-xs text-white/70 mt-1">
            This stage has ended. Submissions and Google Forms are closed.
          </p>
        </div>
      )}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-3xl font-serif text-white uppercase tracking-wider">Challenge Materials</h1>
        <p className="text-white/50">Assets and instructions for this stage.</p>
      </div>

      {slug === "cyber-styling" && (
        <>
          <div className="p-6 border border-wine-500/30 bg-wine-950/20 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-wine-500/5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-wine-500/10 border border-wine-500/30 text-wine-400">
                <Code className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Cyber Styling Base HTML File</h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Download the common starter HTML code as a text file or open it directly in your browser as a website.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await fetch("/cyber-styling.txt");
                    const text = await res.text();
                    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "cyber-styling.txt";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch {
                    window.location.href = "/api/cyber-style/download";
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-500 hover:bg-wine-400 text-white text-xs font-mono font-bold transition-all shadow-md shadow-wine-500/20 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Download as Code (.txt)</span>
              </button>
              <a
                href="/cyber-styling.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-bold transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Open as Website</span>
              </a>
            </div>
          </div>
          <CyberThemeCard teamCode={session.teamCode} regNo={session.regNo} isEnded={isEnded} />
        </>
      )}

      {content.bugx_configured && (
        <BugxPasswordPanel
          slug={slug}
          teamCode={session.teamCode}
          regNo={session.regNo ?? ""}
          solved={content.bugx_solved}
          formUrl={content.bugx_form_url}
          onSolved={refresh}
          isEnded={isEnded}
        />
      )}

      {/* Stage 1 Submission Form Attachment */}
      {slug === "cyber-styling" && (
        <div className="p-6 border border-champagne-500/30 bg-champagne-950/20 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-champagne-500/5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-champagne-500/10 border border-champagne-500/30 text-champagne-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Round 1 Submission Form</h3>
              <p className="text-xs text-white/60 mt-0.5">
                {isEnded
                  ? "This stage has ended. Submissions are closed."
                  : "Official Google Form to submit your generative AI prompts, restyled HTML, and assets."}
              </p>
            </div>
          </div>
          {isEnded ? (
            <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-mono font-bold uppercase tracking-wider">
              Stage Ended · Submissions Closed
            </div>
          ) : (
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScX1EqwjTGJmmcBORdVcxPS6UxLmAho1b9Mzm-jCF5--ZMuhQ/viewform?usp=publish-editor"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-champagne-500 hover:bg-champagne-400 text-black text-xs font-mono font-bold transition-all shadow-md shadow-champagne-500/20"
            >
              <span>Open Google Form</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Stage 3 (Prompt Rumble) Google Form Attachment */}
      {slug === "prompt-rumble" && (
        <div className="p-6 border border-wine-500/30 bg-wine-950/20 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-wine-500/5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-wine-500/10 border border-wine-500/30 text-wine-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Level 3 Submission Form · Prompt Rumble</h3>
              <p className="text-xs text-white/60 mt-0.5">
                {isEnded
                  ? "This stage has ended. Submissions are closed."
                  : "Official Google Form to submit your 30-second AI advertisement and materials."}
              </p>
            </div>
          </div>
          {isEnded ? (
            <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-mono font-bold uppercase tracking-wider">
              Stage Ended · Submissions Closed
            </div>
          ) : (
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfTr-yvIy-TcD40SlyXOC52rJPZn_pp4--tSuZ0zQDW8B6XeA/viewform"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-wine-500 hover:bg-wine-400 text-white text-xs font-mono font-bold transition-all shadow-md shadow-wine-500/20"
            >
              <span>Open Google Form</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Stage 4 (Prompt Charades) Google Form Attachment */}
      {slug === "prompt-charades" && (
        <div className="p-6 border border-wine-500/30 bg-wine-950/20 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-wine-500/5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-wine-500/10 border border-wine-500/30 text-wine-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Level 4 Submission Form · Prompt Charades</h3>
              <p className="text-xs text-white/60 mt-0.5">
                {isEnded
                  ? "This stage has ended. Submissions are closed."
                  : "Official Google Form to submit your prompt charades generative images and answers."}
              </p>
            </div>
          </div>
          {isEnded ? (
            <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-mono font-bold uppercase tracking-wider">
              Stage Ended · Submissions Closed
            </div>
          ) : (
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSetBbJZyIyvgTcRv1owaleEwUWUe1zmlHII6JUm7rCFHz_PFg/viewform"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-wine-500 hover:bg-wine-400 text-white text-xs font-mono font-bold transition-all shadow-md shadow-wine-500/20"
            >
              <span>Open Google Form</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="p-8 text-center border border-white/10 bg-white/5 rounded-2xl text-white/50 text-sm">
          No additional materials released for this stage.
        </div>
      ) : (
        <div className="grid gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="lb-panel p-6 border border-white/10 bg-white/5 rounded-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-white font-medium text-lg">{asset.label || asset.kind}</h3>
                  <p className="text-sm text-white/50 mt-1 uppercase tracking-widest text-[10px]">{asset.kind}</p>
                </div>
                {asset.kind === "file" && asset.storage_path && (
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={assetHref(asset.id, false)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 border border-white/15 hover:bg-white/5 text-white rounded transition-colors text-sm"
                    >
                      View
                    </a>
                    <a
                      href={assetHref(asset.id, true)}
                      className="px-4 py-2 bg-[var(--lb-burgundy-600)] hover:bg-[var(--lb-burgundy-500)] text-white rounded transition-colors text-sm"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
              {asset.kind === "file" && isImage(asset.storage_path) && (
                // eslint-disable-next-line @next/next/no-img-element -- private, team-scoped signed URL; next/image's remote-domain config isn't a fit here.
                <img
                  src={assetHref(asset.id, false)}
                  alt={asset.label || "Challenge asset"}
                  className="mt-4 rounded-lg border border-white/10 max-h-96 w-auto"
                />
              )}
              {asset.kind === "text" && asset.text_value && (
                <div className="mt-4 p-4 bg-black/40 rounded border border-white/5 font-mono text-sm text-white/80 whitespace-pre-wrap">
                  {asset.text_value}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
