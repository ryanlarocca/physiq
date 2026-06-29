// Backup all Physiq data from Supabase to CSV (peace-of-mind snapshot before shipping).
// Runs as postgres via the Management API, so it sees ALL rows (RLS does not apply).
// Usage: node scripts/backup-csv.mjs
import { sql } from './sb.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const now = new Date();
const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
const outDir = join(__dir, '..', 'backups', `physiq-backup-${stamp}`);
mkdirSync(outDir, { recursive: true });

function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

const tables = ['weight_entries', 'macro_entries', 'quick_add_presets', 'bug_reports'];
let total = 0;
for (const t of tables) {
  let rows;
  try { rows = await sql(`select * from ${t} order by 1`); }
  catch (e) { console.log(`  (skip ${t}: ${e.message.split('\n')[0]})`); continue; }
  writeFileSync(join(outDir, `${t}.csv`), toCSV(rows));
  console.log(`  ${t}: ${rows.length} rows → ${t}.csv`);
  total += rows.length;
}
// user reference (id ↔ email) so the user_id columns are decodable
const users = await sql(`select id, email, email_confirmed_at is not null as confirmed, created_at from auth.users order by created_at`);
writeFileSync(join(outDir, `users.csv`), toCSV(users));
console.log(`  users: ${users.length} rows → users.csv`);

console.log(`\n✅ Backup complete — ${total} data rows`);
console.log(`📁 ${outDir}`);
