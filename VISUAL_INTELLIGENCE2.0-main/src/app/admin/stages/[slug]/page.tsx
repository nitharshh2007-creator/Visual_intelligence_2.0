export const instant = false;

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AdminStageClient from "./AdminStageClient";

export default async function AdminStageContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: stage } = await supabase
    .from("stages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!stage) {
    notFound();
  }

  const { data: assets } = await supabase
    .from("stage_assets")
    .select("*")
    .eq("stage_slug", slug)
    .order("sort", { ascending: true });

  const { data: secrets } = await supabase
    .from("stage_secrets")
    .select("*")
    .eq("stage_slug", slug)
    .single();

  return <AdminStageClient initialStage={stage} initialAssets={assets || []} initialSecrets={secrets || { stage_slug: slug }} />;
}
