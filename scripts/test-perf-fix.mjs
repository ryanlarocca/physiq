// Verifies the 2026-07-16 slow-load fix end-to-end (local files, real Supabase):
// A) first load populates the local data cache
// B) reopen with Supabase REST stalled → paints from cache in <5s (was: minutes)
// C) background refresh racing a write does NOT roll the write back
// D) same-date weight log twice → ONE row in the DB (true upsert)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { PROJECT_URL, getApiKeys, sql } from './sb.mjs';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const puppeteer = require('puppeteer');
const APP_DIR = '/Users/ryanlarocca/.openclaw/workspace/physiq-app';
const PORT = 8791;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(APP_DIR, p);
  if (!existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'text/plain' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));
const URL = `http://localhost:${PORT}/`;

let pass = 0, fail = 0;
const ck = (n, b) => b ? (pass++, console.log('  ✓', n)) : (fail++, console.error('  ✗', n));

const { anon, serviceRole } = await getApiKeys();
const ts = Date.now(), email = `physiq-perffix-${ts}@example.com`, password = `Test!${ts}`;
let userId;
const browser = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });

try {
  const c = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) });
  userId = (await c.json()).id;
  await sql(`insert into weight_entries (user_id, date, weight) select '${userId}', (date '2026-01-01' + i), 180 + i % 5 from generate_series(0, 99) i`);
  const tok = await (await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
  const session = { access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: tok.expires_at, expires_in: tok.expires_in, token_type: 'bearer', user: tok.user };

  // ---- A: first load fills the data cache ----
  console.log('[A] First load populates local data cache');
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v); }, 'sb-physiq-session', JSON.stringify(session));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => typeof _weightCache !== 'undefined' && _weightCache.length >= 100, { timeout: 30000 });
  const cacheRaw = await page.evaluate(() => localStorage.getItem('physiq_data_cache_v1'));
  ck('data cache saved after load', !!cacheRaw && JSON.parse(cacheRaw).weights.length >= 100);

  // ---- D: same-date double log → one DB row ----
  console.log('[D] Same-date weight logged twice → single DB row (upsert)');
  await page.evaluate(async () => { await upsertWeightEntry('2026-07-16', 190.0); });
  await page.evaluate(async () => { await upsertWeightEntry('2026-07-16', 191.5); });
  const dup = await sql(`select count(*)::int n, max(weight) w from weight_entries where user_id='${userId}' and date='2026-07-16'`);
  ck('exactly one row for the date', dup[0].n === 1);
  ck('row holds the latest weight (191.5)', dup[0].w === 191.5);
  // and via the UI-cache-miss path: wipe the cache entry, log again — still one row
  await page.evaluate(async () => { _weightCache = _weightCache.filter(e => e.date !== '2026-07-16'); await upsertWeightEntry('2026-07-16', 192.5); });
  const dup2 = await sql(`select count(*)::int n from weight_entries where user_id='${userId}' and date='2026-07-16'`);
  ck('cache-miss re-log still one row (old bug made 2)', dup2[0].n === 1);

  // ---- C: refresh racing a write keeps the write on screen ----
  console.log('[C] Background refresh racing a write does not roll it back');
  const kept = await page.evaluate(async () => {
    _lastSyncMs = 0;
    const refresh = refreshFromSupabase();          // snapshot taken before the write
    await upsertWeightEntry('2026-07-17', 193.0);   // write lands mid-flight
    await refresh;
    return _weightCache.some(e => e.date === '2026-07-17');
  });
  ck('entry written mid-refresh still visible after refresh resolves', kept);
  await page.close();

  // ---- B: reopen with Supabase REST stalled → cache paints fast ----
  console.log('[B] Reopen with all Supabase calls stalled → cache paint <5s');
  const page2 = await browser.newPage();
  await page2.setRequestInterception(true);
  page2.on('request', r => {
    if (r.url().includes('supabase.co')) return; // never respond = stalled connection
    r.continue();
  });
  const logs = [];
  page2.on('console', m => logs.push(m.text()));
  await page2.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v); }, 'sb-physiq-session', JSON.stringify(session));
  const t0 = Date.now();
  await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const painted = await page2.waitForFunction(
    () => typeof _weightCache !== 'undefined' && _weightCache.length >= 100 && document.getElementById('authOverlay')?.style.display === 'none',
    { timeout: 5000 }).then(() => true).catch(() => false);
  const dt = Date.now() - t0;
  ck(`data visible with network fully stalled (took ${(dt / 1000).toFixed(2)}s)`, painted && dt < 5000);
  ck('painted from local cache (console confirms)', logs.some(l => l.includes('[cache] Painted')));
  await page2.close();
} catch (e) {
  fail++; console.error('FATAL:', e);
} finally {
  await browser.close();
  server.close();
  if (userId) {
    await sql(`delete from weight_entries where user_id='${userId}'; delete from macro_entries where user_id='${userId}'; delete from user_goals where user_id='${userId}';`).catch(() => {});
    await fetch(`${PROJECT_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } });
  }
  console.log(`\nPERF FIX: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
