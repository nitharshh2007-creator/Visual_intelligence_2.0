// Stage access is entirely client-side (team identity lives in
// localStorage via registration.ts's session, not a cookie), so this
// route can't produce a meaningful static shell — `instant = false`
// opts it out of Cache Components' prerender/static-shell validation
// instead of fighting it. `instant` itself can't be used in a Client
// Component, which is why this thin server wrapper exists at all
// (same pattern as src/app/admin/page.tsx).
export const instant = false;

import StagesIndexClient from "./StagesIndexClient";

export default function StagesIndexPage() {
  return <StagesIndexClient />;
}
