import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
} catch (e) {}

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: catData, error: catErr } = await client.from('cyber_theme_catalog').select('theme_id').limit(1);
  console.log('cyber_theme_catalog:', catErr ? catErr.message : 'EXISTS');

  const { data: asgnData, error: asgnErr } = await client.from('cyber_theme_assignments').select('*');
  console.log('cyber_theme_assignments:', asgnErr ? asgnErr.message : `EXISTS (${asgnData.length} rows)`);
  if (asgnData && asgnData.length > 0) {
    console.log('Rows:', asgnData);
  }
}

check().catch(console.error);
