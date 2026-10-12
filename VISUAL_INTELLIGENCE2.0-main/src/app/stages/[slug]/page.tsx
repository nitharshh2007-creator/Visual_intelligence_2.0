// See src/app/stages/page.tsx for why `instant = false` + a thin
// server wrapper (stage access/content is client-side only).
export const instant = false;

import StageOverviewClient from "./StageOverviewClient";

export default function StageOverviewPage() {
  return <StageOverviewClient />;
}
