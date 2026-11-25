// Seeds the sample race into your Supabase development project for one user (brief §10.6).
// Runs on your machine only. Needs, in .env.local (never commit it):
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_EMAIL
// The user must have signed in once (so the auth user exists). Their existing ITERACE rows are replaced.
//   npm run seed
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { buildSeed } from '../src/data/seed';
import { TABLES, type AnyRow } from '../src/data/types';

config({ path: '.env.local' });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;
if (!url || !key || !email) {
  console.error('Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_EMAIL in .env.local');
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user with email ${email}. Sign in to the app once first.`);
  process.exit(1);
}
const name = (user.user_metadata?.full_name as string) || email.split('@')[0];
const db = buildSeed(user.id, name, new Date());

// Clear the user's rows (children first), then insert (parents first).
for (const t of [...TABLES].reverse()) {
  const { error } = await admin.from(t).delete().eq('user_id', user.id);
  if (error) throw new Error(`${t}: ${error.message}`);
}
for (const t of TABLES) {
  const rows = db[t] as AnyRow[];
  if (!rows.length) continue;
  // The sample calendar is local-mode only (it has no iCal link).
  if (t === 'calendar_sources') continue;
  const { error } = await admin.from(t).insert(rows);
  if (error) throw new Error(`${t}: ${error.message}`);
}
console.log(`Seeded the sample race for ${email}.`);
