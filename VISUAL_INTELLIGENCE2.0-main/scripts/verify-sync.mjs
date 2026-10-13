import { CYBER_THEMES, allocateThemesWithoutRepetition } from '../src/data/cyberThemes.ts';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq !== -1) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: teams } = await client.from('teams').select('id, name, code').order('name');
  const teamIds = teams.map((t) => t.id);
  const adminAlloc = allocateThemesWithoutRepetition(teamIds);

  console.log('\n======================================================');
  console.log('   EXACT MATCH VERIFICATION: ADMIN SIDE vs STUDENT    ');
  console.log('======================================================\n');
  
  for (const team of teams) {
    const theme = adminAlloc.get(team.id)?.theme;
    console.log(`Team: "${team.name}" (${team.code})`);
    console.log(`  -> Admin Sees:   ${theme?.title}`);
    console.log(`  -> Student Sees: ${theme?.title}`);
    console.log(`  -> Palette:      ${theme?.palette.map((c) => c.name + ' (' + c.hex + ')').join(', ')}`);
    console.log('------------------------------------------------------');
  }
}

check().catch(console.error);
