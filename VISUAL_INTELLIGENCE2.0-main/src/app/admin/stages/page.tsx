export const instant = false;

import { createClient } from "@/lib/supabase-server";
import AdminStagesClient, { StageRecord, StageAssetRecord, StageSecretRecord } from "./AdminStagesClient";

export default async function AdminStagesDashboard() {
  const supabase = await createClient();

  const [{ data: stages }, { data: assets }, { data: secrets }] = await Promise.all([
    supabase.from("stages").select("*").order("number"),
    supabase.from("stage_assets").select("*").order("sort", { ascending: true }),
    supabase.from("stage_secrets").select("*"),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 font-mono">
      <AdminStagesClient
        initialStages={(stages as unknown as StageRecord[]) || []}
        initialAssets={(assets as unknown as StageAssetRecord[]) || []}
        initialSecrets={(secrets as unknown as StageSecretRecord[]) || []}
      />
    </div>
  );
}
