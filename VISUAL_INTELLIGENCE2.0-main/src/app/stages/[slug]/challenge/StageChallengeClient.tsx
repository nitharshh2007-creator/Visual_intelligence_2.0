"use client";

import { useParams } from "next/navigation";
import { useStageGate } from "@/hooks/useStageGate";
import StageLockCard from "@/components/stages/StageLockCard";
import BugxPasswordPanel from "./BugxPasswordPanel";

export default function StageChallengeClient() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, entry, content, session, refresh } = useStageGate(slug);

  if (!hydrated) return null;
  if (!entry) return <div className="p-8 text-center text-white/50">Stage not found</div>;
  if (!content || !session) return <StageLockCard stage={entry.stage} name={entry.name} state={entry.state} reason={entry.reason} />;

  const { assets } = content;
  const assetHref = (assetId: string, download: boolean) =>
    `/api/assets/${assetId}?code=${encodeURIComponent(session.teamCode)}&reg_no=${encodeURIComponent(session.regNo ?? "")}&slug=${encodeURIComponent(slug)}${download ? "&download=1" : ""}`;
  const isImage = (path: string | null) => !!path && /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

  return (
    <div className="space-y-8 pb-16">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-3xl font-serif text-white uppercase tracking-wider">Challenge Materials</h1>
        <p className="text-white/50">Assets and instructions for this stage.</p>
      </div>

      {content.bugx_configured && (
        <BugxPasswordPanel
          slug={slug}
          teamCode={session.teamCode}
          regNo={session.regNo ?? ""}
          solved={content.bugx_solved}
          formUrl={content.bugx_form_url}
          onSolved={refresh}
        />
      )}

      {assets.length === 0 ? (
        <div className="p-12 text-center border border-white/10 bg-white/5 rounded-2xl text-white/50">
          No materials have been released yet.
        </div>
      ) : (
        <div className="grid gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="p-6 border border-white/10 bg-white/5 rounded-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
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
