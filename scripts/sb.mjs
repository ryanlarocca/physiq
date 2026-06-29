// Physiq — Supabase Management API helper (hands-off DB + auth config).
// Reads SUPABASE_PAT / SUPABASE_PROJECT_REF from ../.env.local
// Usage from other scripts:  import { sql, getAuthConfig, patchAuthConfig } from './sb.mjs'
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const txt = readFileSync(join(__dir, '..', '.env.local'), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
export const REF = env.SUPABASE_PROJECT_REF;
export const PROJECT_URL = env.SUPABASE_URL;
const PAT = env.SUPABASE_PAT;
const BASE = `https://api.supabase.com/v1/projects/${REF}`;

if (!PAT || !REF) { console.error('Missing SUPABASE_PAT or SUPABASE_PROJECT_REF in .env.local'); process.exit(1); }

async function mgmt(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

/** Run arbitrary SQL, returns array of rows (or throws with the PG error). */
export async function sql(query) {
  const out = await mgmt('/database/query', { method: 'POST', body: { query } });
  if (out && out.message && /ERROR/.test(out.message)) throw new Error(out.message);
  return out;
}

export const getAuthConfig = () => mgmt('/config/auth');
export const patchAuthConfig = (body) => mgmt('/config/auth', { method: 'PATCH', body });

// Returns { anon, serviceRole } legacy JWT keys (used by the isolation test to
// mint real user sessions and to admin-create/delete throwaway test users).
export async function getApiKeys() {
  const keys = await mgmt('/api-keys');
  const find = (name) => (keys.find(k => k.name === name && k.type === 'legacy') || {}).api_key;
  return { anon: find('anon'), serviceRole: find('service_role') };
}

// CLI: `node scripts/sb.mjs "<sql>"` for quick one-off queries
if (process.argv[2]) {
  sql(process.argv[2]).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exit(1); });
}
