import { redirect } from "next/navigation";

// Scoring now lives on the Teams & Shortlisting page.
export default function AdminScoringPage() {
  redirect("/admin/teams");
}
