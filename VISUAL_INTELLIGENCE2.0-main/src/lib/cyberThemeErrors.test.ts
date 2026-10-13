import { describe, expect, it } from "vitest";
import { isMissingThemeRpc, mapThemeRpcError } from "./cyberThemeErrors";

describe("cyber theme RPC errors", () => {
  it("only treats a missing function as fallback-eligible", () => {
    expect(isMissingThemeRpc({ code: "PGRST202" })).toBe(true);
    expect(isMissingThemeRpc({ code: "42883" })).toBe(true);
    expect(isMissingThemeRpc({ code: "VI001", message: "Member not found in team" })).toBe(false);
    expect(isMissingThemeRpc(null)).toBe(false);
  });

  it("maps get_my_team_cyber_theme errors to precise responses", () => {
    expect(mapThemeRpcError({ code: "VI001", message: "Invalid team code" })).toEqual({ status: 404, error: "Invalid team code." });
    expect(mapThemeRpcError({ code: "VI001", message: "Member not found in team" }).status).toBe(403);
    expect(mapThemeRpcError({ code: "VI001", message: "All 38 themes have already been allocated" }).status).toBe(409);
    expect(mapThemeRpcError({ code: "XX000", message: "boom" }).status).toBe(500);
  });
});
