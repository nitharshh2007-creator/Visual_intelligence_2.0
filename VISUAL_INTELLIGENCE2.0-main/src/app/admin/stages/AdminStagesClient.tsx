"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Folder, FileText, X, Check, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

export interface StageRecord {
  slug: string;
  number: number;
  name: string;
  hook?: string | null;
  tests?: string[] | null;
  duration_min?: number | null;
  overview_md?: string | null;
  rules_md?: string | null;
  roles_md?: string | null;
  rubric?: { name: string; max_points?: number; round?: number }[] | null;
  phases?: { name: string; minutes: number; accepts_submission: boolean; releases: string[] }[] | null;
  status?: string | null;
}

export interface StageAssetRecord {
  id: string;
  stage_slug: string;
  kind: string;
  label?: string | null;
  sort?: number | null;
  storage_path?: string | null;
  text_value?: string | null;
  release?: string | null;
  assign_mode?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface StageSecretRecord {
  stage_slug: string;
  bugx_password_hash?: string | null;
  bugx_form_url?: string | null;
  bugx_pdf_asset_id?: string | null;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

export default function AdminStagesClient({
  initialStages,
  initialAssets,
  initialSecrets,
}: {
  initialStages: StageRecord[];
  initialAssets: StageAssetRecord[];
  initialSecrets: StageSecretRecord[];
}) {
  const [stages, setStages] = useState<StageRecord[]>(initialStages);
  const [assets, setAssets] = useState<StageAssetRecord[]>(initialAssets);
  const [secrets, setSecrets] = useState<StageSecretRecord[]>(initialSecrets);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedStageSlug, setSelectedStageSlug] = useState<string>(
    initialStages[0]?.slug || "cyber-styling"
  );
  const [uploadKind, setUploadKind] = useState<"file" | "text">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetLabel, setAssetLabel] = useState("");
  const [textValue, setTextValue] = useState("");
  const [assignMode, setAssignMode] = useState<"all" | "random">("all");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const toastIdRef = useRef(0);

  function pushToast(kind: Toast["kind"], message: string) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  async function refreshData() {
    setIsRefreshing(true);
    try {
      const supabase = getSupabaseClient();
      const [{ data: s }, { data: a }, { data: sec }] = await Promise.all([
        supabase.from("stages").select("*").order("number"),
        supabase.from("stage_assets").select("*").order("sort", { ascending: true }),
        supabase.from("stage_secrets").select("*"),
      ]);
      if (s) setStages(s as StageRecord[]);
      if (a) setAssets(a as StageAssetRecord[]);
      if (sec) setSecrets(sec as StageSecretRecord[]);
      pushToast("info", "Data refreshed");
    } catch {
      pushToast("error", "Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  }

  function openUploadForStage(stageSlug: string) {
    setSelectedStageSlug(stageSlug);
    setSelectedFile(null);
    setAssetLabel("");
    setTextValue("");
    setAssignMode("all");
    setUploadKind("file");
    setUploadModalOpen(true);
  }

  function handleFileSelection(file: File) {
    setSelectedFile(file);
    if (!assetLabel) {
      const clean = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      setAssetLabel(clean.charAt(0).toUpperCase() + clean.slice(1));
    }
  }

  async function handlePerformUpload(e: React.FormEvent) {
    e.preventDefault();
    if (uploadKind === "file" && !selectedFile) {
      pushToast("error", "Please select a file to upload");
      return;
    }
    if (uploadKind === "text" && !textValue.trim()) {
      pushToast("error", "Please enter text content");
      return;
    }
    if (!assetLabel.trim()) {
      pushToast("error", "Please enter an asset label");
      return;
    }

    setIsUploading(true);
    const supabase = getSupabaseClient();

    try {
      let storagePath: string | null = null;

      if (uploadKind === "file" && selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${selectedStageSlug}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("stage-assets")
          .upload(path, selectedFile, { upsert: true });

        if (uploadErr) {
          throw new Error(`Upload failed: ${uploadErr.message}`);
        }
        storagePath = path;
      }

      const stageAssets = assets.filter((a) => a.stage_slug === selectedStageSlug);
      const nextSort = stageAssets.length;

      const { data: newRow, error: insertErr } = await supabase.from("stage_assets")
        .insert({
          stage_slug: selectedStageSlug,
          kind: uploadKind,
          label: assetLabel.trim(),
          storage_path: storagePath,
          text_value: uploadKind === "text" ? textValue : null,
          assign_mode: assignMode,
          sort: nextSort,
        })
        .select()
        .single();

      if (insertErr) {
        throw new Error(`Database save failed: ${insertErr.message}`);
      }

      if (newRow) {
        setAssets((prev) => [...prev, newRow as StageAssetRecord]);
      }

      pushToast("success", `Uploaded "${assetLabel}"`);
      setUploadModalOpen(false);
      setSelectedFile(null);
      setAssetLabel("");
      setTextValue("");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePreviewAsset(storagePath: string) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage
        .from("stage-assets")
        .createSignedUrl(storagePath, 120);

      if (error || !data?.signedUrl) {
        throw error || new Error("Could not create signed URL");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Could not preview asset");
    }
  }

  async function handleDeleteAsset(asset: StageAssetRecord) {
    if (!confirm(`Delete "${asset.label || asset.id}"? This cannot be undone.`)) {
      return;
    }

    try {
      const supabase = getSupabaseClient();

      if (asset.storage_path) {
        await supabase.storage.from("stage-assets").remove([asset.storage_path]);
      }

      const { error } = await supabase.from("stage_assets").delete().eq("id", asset.id);
      if (error) throw error;

      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      pushToast("success", "Asset deleted");
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const totalDuration = stages.reduce((acc, s) => acc + (s.duration_min || 0), 0);
  const totalAssetsCount = assets.length;

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-[70] space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-lg text-xs font-mono border shadow-lg backdrop-blur-md flex items-center gap-2 ${
              t.kind === "success"
                ? "bg-zinc-900 border-emerald-500/40 text-emerald-300"
                : t.kind === "error"
                ? "bg-zinc-900 border-red-500/40 text-red-300"
                : "bg-zinc-900 border-white/20 text-zinc-200"
            }`}
          >
            <span>{t.kind === "success" ? "✓" : t.kind === "error" ? "⚠" : "•"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Neat Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-1">
            Admin / Stages &amp; Materials
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Stage Readiness &amp; Assets
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Configure challenge files, rules, rubrics, and passwords across all 4 stages.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => openUploadForStage(stages[0]?.slug || "cyber-styling")}
            className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>+ Upload Asset</span>
          </button>

          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs text-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <span className={isRefreshing ? "animate-spin inline-block" : ""}>↻</span>
            <span>{isRefreshing ? "Refreshing" : "Refresh"}</span>
          </button>

          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs text-zinc-300 transition-colors"
          >
            ← Event Flow
          </Link>
        </div>
      </div>

      {/* Clean Telemetry / Summary Strip */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono admin-panel">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider block">Duration</span>
            <span className="text-white font-semibold text-sm">{totalDuration} min</span>
          </div>

          <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />

          <div>
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider block">Schedule</span>
            <span className="text-zinc-300 font-medium">120m window (2.0 hrs)</span>
          </div>

          <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />

          <div>
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider block">Vault Assets</span>
            <span className="text-white font-medium">{totalAssetsCount} file{totalAssetsCount === 1 ? "" : "s"}</span>
          </div>

          <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />

          <div>
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider block">Stages Configured</span>
            <span className="text-zinc-300 font-medium">4 of 4 stages ready</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>All stage definitions active</span>
        </div>
      </div>

      {/* Grid of 4 Neat Stage Cards */}
      <div className="grid md:grid-cols-2 gap-5">
        {stages.map((stage) => {
          const stageAssets = assets.filter((a) => a.stage_slug === stage.slug);
          const stageSecret = secrets.find((s) => s.stage_slug === stage.slug);
          const isOverviewDone = !!stage.overview_md;
          const isRubricDone = !!stage.rubric && stage.rubric.length > 0;
          const rubricCriterionCount = new Set(stage.rubric?.map((criterion) => criterion.name) ?? []).size;
          const rubricRoundCount = Math.max(1, ...(stage.rubric?.map((criterion) => criterion.round ?? 1) ?? []));
          const isPasswordSet = stage.slug === "bugx-hacker" ? !!stageSecret?.bugx_password_hash : true;

          return (
            <div
              key={stage.slug}
              className="rounded-xl p-5 bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.16] transition-all flex flex-col justify-between admin-panel"
            >
              <div>
                {/* Stage Header */}
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/[0.06] mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-zinc-400 bg-white/[0.05] border border-white/[0.08]">
                        Stage 0{stage.number}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {stage.duration_min} min
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-white tracking-wide">
                      {stage.name}
                    </h2>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400 bg-white/[0.04] px-2.5 py-1 rounded border border-white/[0.06]">
                    {stageAssets.length} asset{stageAssets.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Hook / Subtitle */}
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  {stage.hook || "No summary provided."}
                </p>

                {/* Challenge test tags */}
                {stage.tests && stage.tests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {stage.tests.map((test) => (
                      <span
                        key={test}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/[0.03] text-zinc-400 border border-white/[0.06] font-mono"
                      >
                        {test}
                      </span>
                    ))}
                  </div>
                )}

                {/* Checklist Matrix */}
                <div className="p-3 rounded-lg bg-black/30 border border-white/[0.06] space-y-1.5 mb-4 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Overview &amp; Rules</span>
                    <span className={isOverviewDone ? "text-zinc-200" : "text-zinc-600"}>
                      {isOverviewDone ? "✓ Configured" : "Pending"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Rubric Criteria</span>
                    <span className={isRubricDone ? "text-zinc-200" : "text-zinc-600"}>
                      {isRubricDone
                        ? `✓ ${rubricCriterionCount} criteria${rubricRoundCount > 1 ? ` · ${rubricRoundCount} rounds` : ""}`
                        : "Pending"}
                    </span>
                  </div>

                  {stage.slug === "bugx-hacker" && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">BugX Password</span>
                      <span className={isPasswordSet ? "text-emerald-400" : "text-amber-400"}>
                        {isPasswordSet ? "✓ Configured" : "Pending"}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Vault Assets</span>
                    <span className="text-zinc-200">
                      {stageAssets.length > 0 ? `${stageAssets.length} uploaded` : "None"}
                    </span>
                  </div>
                </div>

                {/* Attached Assets List */}
                <div className="mb-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
                    <span>Attached Assets ({stageAssets.length})</span>
                    <button
                      onClick={() => openUploadForStage(stage.slug)}
                      className="text-zinc-300 hover:text-white underline cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>

                  {stageAssets.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-white/[0.08] text-center text-xs text-zinc-500 font-mono">
                      No assets attached. Click &quot;Upload&quot; below.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {stageAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-2 text-xs font-mono group hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-zinc-500 text-xs flex items-center">
                              {asset.kind === "file" ? <Folder className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                            </span>
                            <span className="text-zinc-200 truncate" title={asset.label || "Asset"}>
                              {asset.label || "Asset"}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-400 uppercase shrink-0">
                              {asset.assign_mode === "random" ? "Random" : "All"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {asset.storage_path && (
                              <button
                                onClick={() => handlePreviewAsset(asset.storage_path!)}
                                className="text-[10px] text-zinc-400 hover:text-white uppercase font-medium underline"
                              >
                                View
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors p-1"
                              title="Delete asset"
                              aria-label="Delete asset"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  onClick={() => openUploadForStage(stage.slug)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Upload Asset</span>
                </button>

                <Link
                  href={`/admin/stages/${stage.slug}`}
                  className="py-1.5 px-3 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-zinc-300 hover:text-white text-xs transition-colors"
                >
                  Configure
                </Link>

                <Link
                  href={`/stages/${stage.slug}?demo=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-zinc-400 hover:text-white text-xs transition-colors"
                  title="Preview student screen"
                >
                  Preview ↗
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Neat Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl bg-zinc-950 border border-white/[0.12] p-6 shadow-2xl relative text-zinc-100 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Upload Stage Asset
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Upload a file or enter prompt text for the selected stage.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePerformUpload} className="space-y-4 text-xs font-mono">
              {/* Target Stage */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  Stage
                </label>
                <select
                  value={selectedStageSlug}
                  onChange={(e) => setSelectedStageSlug(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                >
                  {stages.map((s) => (
                    <option key={s.slug} value={s.slug} className="bg-zinc-900 text-white">
                      Stage 0{s.number}: {s.name} ({s.duration_min} min)
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Switcher */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadKind("file")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadKind === "file"
                        ? "bg-white/10 border-white/30 text-white"
                        : "bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Binary File (PDF, HTML, Image)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadKind("text")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadKind === "text"
                        ? "bg-white/10 border-white/30 text-white"
                        : "bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Text / Prompt Instructions</span>
                  </button>
                </div>
              </div>

              {/* Dropzone or Text Area */}
              {uploadKind === "file" ? (
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">
                    File
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelection(file);
                    }}
                    className={`p-5 rounded-lg border border-dashed text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-white bg-white/10"
                        : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                    onClick={() => {
                      const input = document.getElementById("asset-file-input");
                      input?.click();
                    }}
                  >
                    <input
                      id="asset-file-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelection(file);
                      }}
                    />

                    {selectedFile ? (
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-white flex items-center justify-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{selectedFile.name}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {(selectedFile.size / 1024).toFixed(1)} KB · Click to change file
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs text-zinc-300">
                          Click to browse or drop file here
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          PDF, HTML, images, ZIP archives, prompt files
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">
                    Text Content
                  </label>
                  <textarea
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Enter challenge rules, prompt keywords, theme guidelines..."
                    rows={4}
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              )}

              {/* Label & Assign Mode */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">
                    Label
                  </label>
                  <input
                    type="text"
                    value={assetLabel}
                    onChange={(e) => setAssetLabel(e.target.value)}
                    placeholder="e.g. Starter Template"
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">
                    Assignment
                  </label>
                  <select
                    value={assignMode}
                    onChange={(e) => setAssignMode(e.target.value as "all" | "random")}
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="all" className="bg-zinc-900">All teams</option>
                    <option value="random" className="bg-zinc-900">Random per team</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={isUploading}
                  className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                      <span>Uploading…</span>
                    </>
                  ) : (
                    <span>Save to Vault</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
