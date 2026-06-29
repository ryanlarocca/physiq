// Phase 3 — automated RLS isolation test using REAL user sessions.
// Proves two accounts cannot see or write each other's data, exercising the live
// auth.uid() = user_id policies (not the service key, which bypasses RLS).
// Creates two throwaway users, runs assertions, then deletes them + their rows.
// Usage: node scripts/test-isolation.mjs
import { PROJECT_URL, getApiKeys, sql } from './sb.mjs';

const { anon, serviceRole } = await getApiKeys();
if (!anon || !serviceRole) { console.error('Could not fetch anon/service_role keys'); process.exit(1); }

const STAMP = Date.now();
const PW = `Test!${STAMP}`;
const userA = { email: `physiq-iso-a-${STAMP}@example.com`, password: PW };
const userB = { email: `physiq-iso-b-${STAMP}@example.com`, password: PW };

let pass = 0, fail = 0;
function check(name, cond) { (cond ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.error(`  ✗ ${name}`))); }

async function adminCreate(u) {
  const r = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`admin create ${u.email}: ${r.status} ${await r.text()}`);
  return (await r.json()).id;
}
async function adminDelete(id) {
  if (!id) return;
  await fetch(`${PROJECT_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE', headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  });
}
async function signIn(u) {
  const r = await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  if (!r.ok) throw new Error(`signin ${u.email}: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}
// REST call AS a user (RLS enforced for the authenticated role).
async function asUser(jwt, path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${PROJECT_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

let idA, idB;
try {
  console.log('Creating two throwaway users…');
  idA = await adminCreate(userA);
  idB = await adminCreate(userB);
  const jwtA = await signIn(userA);
  const jwtB = await signIn(userB);

  console.log('\n[1] Each user writes their own weight row');
  const wA = await asUser(jwtA, 'weight_entries', { method: 'POST', prefer: 'return=representation', body: { date: '2026-01-01', weight: 111, user_id: idA } });
  const wB = await asUser(jwtB, 'weight_entries', { method: 'POST', prefer: 'return=representation', body: { date: '2026-01-01', weight: 222, user_id: idB } });
  check('user A insert succeeds', wA.status === 201);
  check('user B insert succeeds', wB.status === 201);

  console.log('\n[2] Each user reads weight_entries — sees ONLY their own');
  const readA = await asUser(jwtA, 'weight_entries?select=weight,user_id');
  const readB = await asUser(jwtB, 'weight_entries?select=weight,user_id');
  check('A sees exactly 1 row', Array.isArray(readA.data) && readA.data.length === 1);
  check('A sees only its own user_id', readA.data.every(r => r.user_id === idA));
  check("A does NOT see B's weight (222)", !readA.data.some(r => r.weight === 222));
  check('B sees exactly 1 row', Array.isArray(readB.data) && readB.data.length === 1);
  check("B does NOT see A's weight (111)", !readB.data.some(r => r.weight === 111));

  console.log('\n[3] Macros isolation');
  await asUser(jwtA, 'macro_entries', { method: 'POST', prefer: 'return=representation', body: { date: '2026-01-01', calories: 500, food_name: 'A-only', user_id: idA } });
  const mB = await asUser(jwtB, 'macro_entries?select=food_name,user_id');
  check("B sees none of A's macros", Array.isArray(mB.data) && !mB.data.some(r => r.food_name === 'A-only'));

  console.log('\n[4] RLS WITH CHECK blocks spoofing another user_id');
  const spoof = await asUser(jwtA, 'weight_entries', { method: 'POST', prefer: 'return=representation', body: { date: '2026-02-02', weight: 999, user_id: idB } });
  check('A cannot insert a row owned by B (RLS rejects)', spoof.status === 401 || spoof.status === 403);

  console.log('\n[5] Anonymous (no JWT) sees nothing');
  const anonRead = await fetch(`${PROJECT_URL}/rest/v1/weight_entries?select=weight`, { headers: { apikey: anon } });
  const anonRows = await anonRead.json();
  check('anon read returns 0 rows', Array.isArray(anonRows) && anonRows.length === 0);
} catch (e) {
  fail++; console.error('\nFATAL:', e.message);
} finally {
  console.log('\nCleaning up test users + their rows…');
  // Delete rows first (postgres role via Management API — service_role REST isn't granted),
  // then the auth users (FK would otherwise block the delete).
  for (const id of [idA, idB].filter(Boolean)) {
    await sql(`delete from weight_entries where user_id='${id}'; delete from macro_entries where user_id='${id}';`).catch(()=>{});
  }
  await adminDelete(idA); await adminDelete(idB);
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
