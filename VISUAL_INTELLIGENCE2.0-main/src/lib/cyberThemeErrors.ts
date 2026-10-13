// Maps get_my_team_cyber_theme() errors (supabase/migrations/0030_cyber_theme_random_allocation.sql)
// to HTTP responses for /api/cyber-style/my-theme.

export interface ThemeRpcError {
  code?: string;
  message?: string;
}

export interface ThemeErrorResponse {
  status: number;
  error: string;
}

// The RPC itself is missing (migration 0030 not applied) — the only
// case where the route may fall back to its legacy service-role path.
export function isMissingThemeRpc(error: ThemeRpcError | null | undefined): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export function mapThemeRpcError(error: ThemeRpcError): ThemeErrorResponse {
  const message = error.message ?? "";
  if (error.code === "VI001") {
    if (/invalid team code|team not found/i.test(message)) return { status: 404, error: "Invalid team code." };
    if (/member not found/i.test(message)) return { status: 403, error: "Member registration number not found on this team." };
    if (/already been allocated/i.test(message)) {
      return { status: 409, error: "All 38 themes have already been allocated. Please contact an organizer." };
    }
  }
  return { status: 500, error: "Could not load your theme assignment. Please try again." };
}
