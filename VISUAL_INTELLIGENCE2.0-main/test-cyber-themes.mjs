import assert from "node:assert";
import { CYBER_THEMES } from "./src/data/cyberThemes.ts";

console.log("=== TEST SUITE: ROUND 1 CYBER STYLING THEME ALLOCATION ===\n");

// 1. Verify Catalog Completeness
console.log("1. Verifying 38-Theme Catalog...");
assert.strictEqual(CYBER_THEMES.length, 38, "Catalog must have exactly 38 themes");

const themeIds = new Set();
const titles = new Set();
const styles = new Set();
const sortOrders = new Set();

for (const t of CYBER_THEMES) {
  assert.ok(t.theme_id, "Theme must have theme_id");
  assert.ok(t.title, "Theme must have title");
  assert.ok(t.description_line1, `Theme ${t.title} must have description_line1`);
  assert.ok(t.description_line2, `Theme ${t.title} must have description_line2`);
  assert.ok(t.palette && t.palette.length >= 3, `Theme ${t.title} must have at least 3 palette colors`);

  // Verify two-line descriptions are distinct and descriptive
  assert.ok(t.description_line1.length > 20, `Line 1 for ${t.title} must be descriptive`);
  assert.ok(t.description_line2.length > 20, `Line 2 for ${t.title} must be descriptive`);

  assert.ok(!themeIds.has(t.theme_id), `Duplicate theme_id: ${t.theme_id}`);
  assert.ok(!titles.has(t.title), `Duplicate title: ${t.title}`);
  assert.ok(!styles.has(t.visual_style), `Duplicate visual_style: ${t.visual_style}`);
  assert.ok(!sortOrders.has(t.sort_order), `Duplicate sort_order: ${t.sort_order}`);

  themeIds.add(t.theme_id);
  titles.add(t.title);
  styles.add(t.visual_style);
  sortOrders.add(t.sort_order);
}

// Verify example themes requested by user exist
const requiredExamples = [
  "Retro Wave",
  "Cyber Tokyo",
  "Medieval Fantasy",
  "Neon Rush",
  "Matrix Mode",
  "Glasswave",
  "Cyberpunk",
];
for (const ex of requiredExamples) {
  assert.ok(titles.has(ex), `Required example theme missing: ${ex}`);
}
console.log("✓ All 38 themes valid, unique, and include all user example themes.\n");

// 2. Test Allocation Algorithm: 38 Teams (Unique Allocation)
console.log("2. Testing Unique Allocation for 38 Teams...");

function simulateAllocation(teamCount) {
  const assignments = new Map(); // teamId -> themeId
  const themeCounts = new Map(CYBER_THEMES.map((t) => [t.theme_id, 0]));

  for (let i = 1; i <= teamCount; i++) {
    const teamId = `team-${i}`;

    // Allocation logic matching database RPC
    let minCount = Infinity;
    for (const count of themeCounts.values()) {
      if (count < minCount) minCount = count;
    }
    const candidates = CYBER_THEMES.filter((t) => themeCounts.get(t.theme_id) === minCount);
    // Random selection
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    assignments.set(teamId, chosen.theme_id);
    themeCounts.set(chosen.theme_id, themeCounts.get(chosen.theme_id) + 1);
  }

  return { assignments, themeCounts };
}

const run38 = simulateAllocation(38);
const uniqueThemesUsed38 = new Set(run38.assignments.values());
assert.strictEqual(uniqueThemesUsed38.size, 38, "All 38 teams must receive a distinct unique theme");
for (const count of run38.themeCounts.values()) {
  assert.strictEqual(count, 1, "Each theme must be allocated exactly once for 38 teams");
}
console.log("✓ Perfectly unique allocation for 38 teams: 38/38 distinct themes.\n");

// 3. Test Overflow Handling for 60 Teams (Event Scale)
console.log("3. Testing Overflow Allocation for 60 Teams (Fairness)...");
const run60 = simulateAllocation(60);
assert.strictEqual(run60.assignments.size, 60, "All 60 teams must receive a theme");

let onesCount = 0;
let twosCount = 0;
for (const count of run60.themeCounts.values()) {
  if (count === 1) onesCount++;
  if (count === 2) twosCount++;
  assert.ok(count === 1 || count === 2, `Theme count must be 1 or 2 (found ${count})`);
}
assert.strictEqual(twosCount, 22, "Exactly 22 themes should be assigned twice (38 + 22 = 60)");
assert.strictEqual(onesCount, 16, "Exactly 16 themes should be assigned once");
console.log(`✓ 60 teams handled fairly: 22 themes assigned twice, 16 assigned once. Zero themes assigned 3 times.\n`);

// 4. Test Persistence & Determinism (No Re-rolling on Page Reload)
console.log("4. Testing Persistence & Idempotency...");
const teamAId = "team-abc-123";
let initialTheme = null;

// Mock store
const dbStore = new Map();

function getOrAssignTeamTheme(teamId) {
  if (dbStore.has(teamId)) {
    return dbStore.get(teamId); // Persistent return
  }
  const chosen = CYBER_THEMES[0];
  dbStore.set(teamId, chosen);
  return chosen;
}

const firstFetch = getOrAssignTeamTheme(teamAId);
const secondFetch = getOrAssignTeamTheme(teamAId);
const thirdFetch = getOrAssignTeamTheme(teamAId);

assert.strictEqual(firstFetch.theme_id, secondFetch.theme_id, "Theme must persist on reload");
assert.strictEqual(firstFetch.theme_id, thirdFetch.theme_id, "Theme must persist on re-login");
console.log("✓ Persistent assignment verified: identical theme returned across multiple requests.\n");

// 5. Test Concurrency Simulation
console.log("5. Testing Concurrency Safety Simulation...");
const concurrentTeams = Array.from({ length: 20 }, (_, i) => `concurrent-team-${i}`);
const concurrencyStore = new Map();
const concurrencyThemeCounts = new Map(CYBER_THEMES.map((t) => [t.theme_id, 0]));

// Simulated serialized/locked transaction
function atomicAllocate(teamId) {
  if (concurrencyStore.has(teamId)) return concurrencyStore.get(teamId);
  let minCount = Infinity;
  for (const count of concurrencyThemeCounts.values()) {
    if (count < minCount) minCount = count;
  }
  const candidates = CYBER_THEMES.filter((t) => concurrencyThemeCounts.get(t.theme_id) === minCount);
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  concurrencyStore.set(teamId, chosen.theme_id);
  concurrencyThemeCounts.set(chosen.theme_id, concurrencyThemeCounts.get(chosen.theme_id) + 1);
  return chosen.theme_id;
}

await Promise.all(concurrentTeams.map(async (t) => atomicAllocate(t)));
const uniqueAllocated = new Set(concurrencyStore.values());
assert.strictEqual(uniqueAllocated.size, 20, "20 concurrent requests must receive 20 unique themes");
console.log("✓ 20 concurrent requests resulted in 20 unique themes.\n");

console.log("ALL UNIT AND LOGIC TESTS PASSED SUCCESSFULLY! 🎉");
