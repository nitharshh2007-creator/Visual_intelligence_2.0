"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  adminGenerateStageAssignments,
  adminGetStageAssignments,
  adminSetTeamAssignment,
  adminGetTeams,
  adminGetPreliminaryScores,
  adminSetBugxPassword,
  AdminError,
} from "@/lib/admin";

interface StageRecord {
  slug: string;
  name: string;
  number: number;
  status: string | null;
  hook?: string | null;
  duration_min?: number | null;
  overview_md?: string | null;
  rules_md?: string | null;
  roles_md?: string | null;
  phases?: { name: string; minutes: number; accepts_submission: boolean; releases: string[] }[] | null;
  rubric?: { name: string; max_points?: number; round?: number }[] | null;
}
interface StageAsset {
  id: string;
  kind: string;
  label?: string | null;
  release?: string | null;
  assign_mode?: string | null;
  text_value?: string | null;
  storage_path?: string | null;
  sort?: number | null;
}
interface StageSecrets {
  stage_slug: string;
  bugx_password_hash?: string | null;
  bugx_form_url?: string | null;
  bugx_pdf_asset_id?: string | null;
}
interface Assignment {
  team_id: string;
  team_name: string;
  asset_id: string | null;
  asset_label: string | null;
}

export default function AdminStageClient({
  initialStage,
  initialAssets,
  initialSecrets,
}: {
  initialStage: StageRecord;
  initialAssets: StageAsset[];
  initialSecrets: StageSecrets;
}) {
  const stage = initialStage;
  const [assets, setAssets] = useState<StageAsset[]>(initialAssets);
  const [secrets, setSecrets] = useState<StageSecrets>(initialSecrets);
  const [activeTab, setActiveTab] = useState("Assets");
  const [isSaving, setIsSaving] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" | "info" } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [bugxPassword, setBugxPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  const tabs = ["Assets", "Details", "Phases", "Rubric", "Assignments", "Secrets"];

  function flash(msg: string, kind: "success" | "error" | "info" = "success") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadAssignments() {
    try {
      const [a, allTeams, preliminary] = await Promise.all([
        adminGetStageAssignments(stage.slug),
        adminGetTeams(),
        stage.number >= 3 ? adminGetPreliminaryScores() : Promise.resolve(null),
      ]);
      const shortlistedIds = preliminary
        ? new Set(preliminary.filter((row) => row.decision === "shortlisted").map((row) => row.team_id))
        : null;
      setAssignments(a as unknown as Assignment[]);
      setTeams(allTeams
        .filter((team) => shortlistedIds === null || shortlistedIds.has(team.id))
        .map((team) => ({ id: team.id, name: team.name })));
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Could not load assignments", "error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (activeTab === "Assignments" && !cancelled) await loadAssignments();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSaveAssets = async () => {
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const client = supabase.from as unknown as (table: string) => {
        insert: (v: object) => Promise<unknown>;
        update: (v: object) => { eq: (col: string, val: string) => Promise<unknown> };
        upsert: (v: object) => Promise<unknown>;
      };
      for (const asset of assets) {
        if (asset.id.startsWith("new-")) {
          const { id, ...rest } = asset;
          void id;
          await client("stage_assets").insert({ ...rest, stage_slug: stage.slug });
        } else {
          await client("stage_assets").update(asset).eq("id", asset.id);
        }
      }

      const { bugx_password_hash, ...secretsToSave } = secrets;
      void bugx_password_hash;
      await client("stage_secrets").upsert({ ...secretsToSave, stage_slug: stage.slug });
      flash("Saved changes");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addAsset = () => {
    setAssets([
      ...assets,
      {
        id: `new-${Date.now()}`,
        kind: "text",
        label: `Asset ${assets.length + 1}`,
        assign_mode: "all",
        text_value: "",
        sort: assets.length,
      },
    ]);
  };

  const updateAsset = (index: number, field: string, value: string) => {
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], [field]: value };
    setAssets(newAssets);
  };

  const removeAsset = (index: number) => {
    const newAssets = [...assets];
    newAssets.splice(index, 1);
    setAssets(newAssets);
  };

  async function handleUploadFile(index: number, file: File) {
    const asset = assets[index];
    setUploadingId(asset.id);
    try {
      const supabase = getSupabaseClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${stage.slug}/${asset.id}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("stage-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      updateAsset(index, "storage_path", path);
      if (!asset.label || asset.label.startsWith("Asset ")) {
        updateAsset(index, "label", file.name);
      }
      flash("File uploaded. Click Save to finish.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploadingId(null);
    }
  }

  async function handlePreviewAsset(storagePath: string) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from("stage-assets").createSignedUrl(storagePath, 120);
      if (error || !data) throw error ?? new Error("Could not sign URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Preview failed", "error");
    }
  }

  async function handleSetBugxPassword() {
    setSettingPassword(true);
    try {
      await adminSetBugxPassword(stage.slug, bugxPassword);
      setBugxPassword("");
      flash("BugX password set");
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed to set password", "error");
    } finally {
      setSettingPassword(false);
    }
  }

  async function handleGenerateRandom() {
    setGenerating(true);
    try {
      const res = await adminGenerateStageAssignments(stage.slug);
      flash(`Assigned ${res.assigned} team${res.assigned === 1 ? "" : "s"}`);
      await loadAssignments();
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed to generate assignments", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleManualAssign(teamId: string, assetId: string) {
    try {
      await adminSetTeamAssignment(teamId, stage.slug, assetId);
      await loadAssignments();
      flash("Assignment updated");
    } catch (e) {
      flash(e instanceof AdminError ? e.message : "Failed to set assignment", "error");
    }
  }

  const randomAssets = assets.filter((a) => a.assign_mode === "random");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-mono space-y-6 text-zinc-100">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-[70] px-4 py-2.5 rounded-lg text-xs font-mono border shadow-lg backdrop-blur-md flex items-center gap-2 ${
            toast.kind === "success"
              ? "bg-zinc-900 border-emerald-500/40 text-emerald-300"
              : toast.kind === "error"
              ? "bg-zinc-900 border-red-500/40 text-red-300"
              : "bg-zinc-900 border-white/20 text-zinc-200"
          }`}
        >
          <span>{toast.kind === "success" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : toast.kind === "error" ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> : "•"}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <Link
            href="/admin/stages"
            className="text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors mb-2 inline-flex items-center gap-1.5"
          >
            <span>← Back to Stages</span>
          </Link>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-zinc-400 bg-white/[0.05] border border-white/[0.08]">
              Stage 0{stage.number}
            </span>
            <h1 className="text-xl md:text-2xl font-semibold text-white tracking-wide">
              {stage.name}
            </h1>
          </div>

          <p className="text-xs text-zinc-400 mt-1 max-w-2xl font-sans">
            {stage.hook || "Manage challenge assets, files, rubric, and secrets."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/stages/${stage.slug}?demo=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <span>Preview Student View ↗</span>
          </Link>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex gap-1 border-b border-white/[0.08] overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-2 text-xs uppercase font-medium tracking-wider rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? "bg-white/[0.08] text-white border-b-2 border-white font-semibold"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {tab === "Assets" ? `Assets (${assets.length})` : tab}
          </button>
        ))}
      </div>

      {/* Main glass tab content container */}
      <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 md:p-7">
        {/* ASSETS TAB */}
        {activeTab === "Assets" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-sm font-semibold text-white">Challenge Materials &amp; Assets</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Upload files or prompt text. Choose &quot;Assign&quot; to give all teams or distribute randomly.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={addAsset}
                  className="px-3 py-1.5 text-xs border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-zinc-200 rounded-lg transition-colors cursor-pointer"
                >
                  + Add Asset
                </button>
                <button
                  onClick={handleSaveAssets}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-medium bg-white text-zinc-950 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {isSaving ? "Saving…" : "Save Assets"}
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              {assets.map((asset, idx) => (
                <div
                  key={asset.id}
                  className="p-4 rounded-lg bg-black/30 border border-white/[0.06] space-y-3 hover:border-white/[0.12] transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Label */}
                    <div className="md:col-span-5">
                      <label className="block text-[10px] uppercase tracking-wider font-medium mb-1 text-zinc-400">
                        Asset Label
                      </label>
                      <input
                        value={asset.label || ""}
                        onChange={(e) => updateAsset(idx, "label", e.target.value)}
                        placeholder="e.g. Starter Code"
                        className="w-full p-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
                      />
                    </div>

                    {/* Kind */}
                    <div className="md:col-span-3">
                      <label className="block text-[10px] uppercase tracking-wider font-medium mb-1 text-zinc-400">
                        Kind
                      </label>
                      <select
                        value={asset.kind || "text"}
                        onChange={(e) => updateAsset(idx, "kind", e.target.value)}
                        className="w-full p-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
                      >
                        <option value="file" className="bg-zinc-900 text-white">File Upload</option>
                        <option value="text" className="bg-zinc-900 text-white">Text / Prompt</option>
                      </select>
                    </div>

                    {/* Assignment Mode */}
                    <div className="md:col-span-3">
                      <label className="block text-[10px] uppercase tracking-wider font-medium mb-1 text-zinc-400">
                        Assign Mode
                      </label>
                      <select
                        value={asset.assign_mode || "all"}
                        onChange={(e) => updateAsset(idx, "assign_mode", e.target.value)}
                        className="w-full p-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
                      >
                        <option value="all" className="bg-zinc-900 text-white">All teams</option>
                        <option value="random" className="bg-zinc-900 text-white">Random per team</option>
                      </select>
                    </div>

                    {/* Remove button */}
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        onClick={() => removeAsset(idx)}
                        className="p-2 rounded-lg border border-white/[0.08] text-zinc-400 hover:text-red-400 hover:bg-white/[0.02] text-xs transition-colors w-full flex items-center justify-center cursor-pointer"
                        title="Remove"
                        aria-label="Remove asset"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* File / Text content area */}
                  <div>
                    {asset.kind === "text" ? (
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-medium mb-1 text-zinc-400">
                          Text Content
                        </label>
                        <textarea
                          value={asset.text_value || ""}
                          onChange={(e) => updateAsset(idx, "text_value", e.target.value)}
                          placeholder="Type or paste markdown instructions..."
                          rows={3}
                          className="w-full p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                        />
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 truncate">
                          <label className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 text-xs font-medium cursor-pointer transition-colors shrink-0">
                            <span>Browse File</span>
                            <input
                              type="file"
                              disabled={uploadingId === asset.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadFile(idx, file);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>

                          <span className="text-xs text-zinc-400 font-mono truncate max-w-sm">
                            {uploadingId === asset.id
                              ? "Uploading…"
                              : asset.storage_path || "No file uploaded yet"}
                          </span>
                        </div>

                        {asset.storage_path && uploadingId !== asset.id && (
                          <button
                            type="button"
                            onClick={() => handlePreviewAsset(asset.storage_path!)}
                            className="text-xs font-medium text-zinc-300 hover:text-white underline shrink-0 cursor-pointer"
                          >
                            Preview ↗
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {assets.length === 0 && (
                <div className="p-8 rounded-lg border border-dashed border-white/[0.08] text-center text-zinc-500 space-y-2 text-xs">
                  <p>No assets configured for this stage.</p>
                  <button
                    onClick={addAsset}
                    className="text-xs text-zinc-300 hover:text-white underline"
                  >
                    + Add first asset
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DETAILS TAB */}
        {activeTab === "Details" && (
          <div className="space-y-4 max-w-4xl text-xs">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-400 text-[11px]">
              Stage definition is fixed per Phase 3 specifications.
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06]">
                <span className="text-zinc-500 uppercase text-[10px] block mb-1">Stage Name</span>
                <span className="text-sm font-semibold text-white">{stage.name}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06]">
                <span className="text-zinc-500 uppercase text-[10px] block mb-1">Duration</span>
                <span className="text-sm font-semibold text-white">{stage.duration_min} minutes</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] space-y-1">
              <span className="text-zinc-500 uppercase text-[10px] block font-medium">Hook</span>
              <p className="text-zinc-300 text-xs">{stage.hook}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] space-y-1">
              <span className="text-zinc-500 uppercase text-[10px] block font-medium">Overview</span>
              <p className="text-zinc-300 text-xs whitespace-pre-wrap">{stage.overview_md}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] space-y-1">
              <span className="text-zinc-500 uppercase text-[10px] block font-medium">Rules</span>
              <p className="text-zinc-300 text-xs whitespace-pre-wrap">{stage.rules_md}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] space-y-1">
              <span className="text-zinc-500 uppercase text-[10px] block font-medium">Roles</span>
              <p className="text-zinc-300 text-xs whitespace-pre-wrap">{stage.roles_md}</p>
            </div>
          </div>
        )}

        {/* PHASES TAB */}
        {activeTab === "Phases" && (
          <div className="space-y-3 max-w-4xl">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Configured Phase Timeline
            </p>
            <div className="space-y-2">
              {stage.phases?.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded bg-white/[0.06] text-zinc-300 font-mono flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-white block">{p.name}</span>
                      <span className="text-zinc-500 text-[11px]">{p.minutes} minutes</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                      Submissions: {p.accepts_submission ? "Yes" : "No"}
                    </span>
                    <span className="text-zinc-500 text-[11px]">
                      Releases: {p.releases?.length ? p.releases.join(", ") : "None"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RUBRIC TAB */}
        {activeTab === "Rubric" && (
          <div className="space-y-3 max-w-4xl">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Scoring Criteria ({new Set(stage.rubric?.map((criterion) => criterion.name) ?? []).size}
              {Math.max(1, ...(stage.rubric?.map((criterion) => criterion.round ?? 1) ?? [])) > 1
                ? ` · ${Math.max(1, ...(stage.rubric?.map((criterion) => criterion.round ?? 1) ?? []))} rounds`
                : ""})
            </p>
            <div className="space-y-2">
              {(stage.rubric || []).map((c, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-black/30 border border-white/[0.06] flex items-center justify-between text-xs"
                >
                  <span className="text-zinc-200">
                    {Math.max(1, ...(stage.rubric?.map((criterion) => criterion.round ?? 1) ?? [])) > 1 && (
                      <span className="text-zinc-500 mr-2">Round {c.round ?? 1}</span>
                    )}
                    {c.name}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-300 font-mono text-[11px]">
                    {c.max_points || 10} pts
                  </span>
                </div>
              ))}
              {(!stage.rubric || stage.rubric.length === 0) && (
                <div className="p-8 rounded-lg border border-dashed border-white/[0.08] text-center text-zinc-500 text-xs">
                  No rubric criteria defined.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
        {activeTab === "Assignments" && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
              <p className="text-xs text-zinc-400">
                {randomAssets.length > 0
                  ? `${randomAssets.length} &quot;Random per team&quot; asset(s) ready to assign.`
                  : "Mark asset assign mode as \"Random per team\" on the Assets tab to use this."}
              </p>
              <button
                onClick={handleGenerateRandom}
                disabled={generating || randomAssets.length === 0}
                className="px-3.5 py-1.5 text-xs font-medium bg-white text-zinc-950 rounded-lg hover:bg-zinc-200 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {generating ? "Generating…" : "Generate Random Assignments"}
              </button>
            </div>

            <div className="space-y-2">
              {teams.map((team) => {
                const current = assignments.find((a) => a.team_id === team.id);
                return (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/[0.06] text-xs"
                  >
                    <span className="text-zinc-200">{team.name}</span>
                    <select
                      value={current?.asset_id || ""}
                      onChange={(e) => e.target.value && handleManualAssign(team.id, e.target.value)}
                      className="text-xs p-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                    >
                      <option value="" className="bg-zinc-900 text-zinc-400">— None —</option>
                      {randomAssets.map((a) => (
                        <option key={a.id} value={a.id} className="bg-zinc-900 text-white">{a.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {teams.length === 0 && (
                <p className="text-center text-zinc-500 text-xs py-8">No registered teams yet.</p>
              )}
            </div>
          </div>
        )}

        {/* SECRETS TAB */}
        {activeTab === "Secrets" && (
          <div className="space-y-5 max-w-4xl text-xs">
            <p className="text-zinc-400">
              Configure challenge secrets and passwords. These are withheld from client payloads until verified.
            </p>

            <div className="p-4 rounded-lg bg-black/30 border border-white/[0.06] space-y-2.5">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-400">
                BUGX Password Vault
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bugxPassword}
                  onChange={(e) => setBugxPassword(e.target.value)}
                  className="flex-1 p-2 rounded-lg bg-zinc-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                  placeholder="Type password — hashed server-side with bcrypt"
                />
                <button
                  onClick={handleSetBugxPassword}
                  disabled={settingPassword || !bugxPassword}
                  className="px-3.5 py-2 text-xs font-medium bg-white text-zinc-950 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {settingPassword ? "Setting…" : "Set Password"}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                {initialSecrets.bugx_password_hash ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Check className="w-3 h-3" /> Password is configured for this stage.
                  </span>
                ) : (
                  "No password configured yet."
                )}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-black/30 border border-white/[0.06] space-y-1.5">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-400">
                BUGX Google Form URL
              </label>
              <input
                value={secrets.bugx_form_url || ""}
                onChange={(e) => setSecrets({ ...secrets, bugx_form_url: e.target.value })}
                className="w-full p-2 rounded-lg bg-zinc-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                placeholder="https://docs.google.com/forms/..."
              />
            </div>

            <div className="p-4 rounded-lg bg-black/30 border border-white/[0.06] space-y-1.5">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-400">
                BUGX Locked PDF Asset
              </label>
              <select
                value={secrets.bugx_pdf_asset_id || ""}
                onChange={(e) => setSecrets({ ...secrets, bugx_pdf_asset_id: e.target.value })}
                className="w-full p-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
              >
                <option value="" className="bg-zinc-900 text-zinc-400">— None (no PDF withheld) —</option>
                {assets.filter((a) => a.kind === "file").map((a) => (
                  <option key={a.id} value={a.id} className="bg-zinc-900 text-white">{a.label || a.id}</option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-500">
                This file is withheld from the Challenge tab until the team solves the password above.
              </p>
            </div>

            <button
              onClick={handleSaveAssets}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium bg-white text-zinc-950 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSaving ? "Saving…" : "Save Secrets"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
