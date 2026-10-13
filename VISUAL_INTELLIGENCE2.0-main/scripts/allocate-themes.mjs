import { CYBER_THEMES } from '../src/data/cyberThemes.ts';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Deterministic Pseudo-Random Generator (Murmur-like 32-bit hash)
function hashString(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Pseudo-random generator (LCG) seeded by a number
function createRng(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return function () {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

async function run() {
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, name, code, status')
    .order('created_at', { ascending: true });

  if (teamsErr || !teams) {
    console.error('Failed to fetch teams:', teamsErr);
    process.exit(1);
  }

  // Shuffle the 38 themes deterministically using an event seed
  const rng = createRng(hashString('visual-intelligence-round-1-themes-2026'));
  const themePool = [...CYBER_THEMES];
  for (let i = themePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [themePool[i], themePool[j]] = [themePool[j], themePool[i]];
  }

  // Sort teams stably by team code/id
  const sortedTeams = [...teams].sort((a, b) => a.code.localeCompare(b.code));

  const results = [];
  const assignedThemes = new Set();

  sortedTeams.forEach((team, idx) => {
    // Pick unique theme from pool (idx modulo length if > 38, but here length is 4)
    const theme = themePool[idx % themePool.length];
    assignedThemes.add(theme.theme_id);
    results.push({
      team_id: team.id,
      team_name: team.name,
      team_code: team.code,
      status: team.status,
      theme_id: theme.theme_id,
      theme_title: theme.title,
      line1: theme.description_line1,
      line2: theme.description_line2,
      palette: theme.palette
    });
  });

  console.log(JSON.stringify({
    total_teams: teams.length,
    unique_themes_count: assignedThemes.size,
    is_strictly_unique: assignedThemes.size === teams.length,
    results
  }, null, 2));

  // Check Supabase if table exists
  const { error: upsertErr } = await supabase
    .from('cyber_theme_assignments')
    .upsert(
      results.map(r => ({
        team_id: r.team_id,
        theme_id: r.theme_id,
        theme_title: r.theme_title,
        metadata: {
          palette: r.palette,
          description_line1: r.line1,
          description_line2: r.line2
        }
      })),
      { onConflict: 'team_id' }
    );
}

run().catch(console.error);
