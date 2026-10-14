import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CYBER_THEMES } from "./cyberThemes";

const unique = (values: unknown[]) => new Set(values).size === values.length;

describe("cyber theme catalog", () => {
  it("has 40 themes with unique ids, titles, styles and sort orders 1..40", () => {
    expect(CYBER_THEMES).toHaveLength(40);
    expect(unique(CYBER_THEMES.map((t) => t.theme_id))).toBe(true);
    expect(unique(CYBER_THEMES.map((t) => t.title))).toBe(true);
    expect(unique(CYBER_THEMES.map((t) => t.visual_style))).toBe(true);
    expect(CYBER_THEMES.map((t) => t.sort_order)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it("every theme satisfies the cyber_theme_catalog constraints", () => {
    for (const t of CYBER_THEMES) {
      expect(t.palette.length).toBeGreaterThanOrEqual(3);
      expect(t.palette.length).toBeLessThanOrEqual(4);
      for (const c of t.palette) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.description_line1.startsWith("Visual Style: ")).toBe(true);
      expect(t.description_line2.startsWith("What to Create: ")).toBe(true);
      expect(t.instructions.length).toBeGreaterThan(0);
    }
  });

  it("includes The Upside Down and Phantom Protocol as themes 39 and 40", () => {
    expect(CYBER_THEMES.find((t) => t.theme_id === "the-upside-down")?.sort_order).toBe(39);
    expect(CYBER_THEMES.find((t) => t.theme_id === "phantom-protocol")?.sort_order).toBe(40);
  });

  it("the manual SQL inserts exactly the same two themes", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/manual/add_cyber_themes_39_40.sql"), "utf8");
    for (const t of CYBER_THEMES.slice(38)) {
      const row = `('${t.theme_id}', '${t.title}', '${t.description_line1}', '${t.description_line2}', '${t.instructions}', '${JSON.stringify(t.palette)}'::jsonb, '${t.visual_style}', ${t.sort_order})`;
      expect(sql).toContain(row);
    }
    expect(sql.match(/::jsonb/g)).toHaveLength(2);
  });
});
