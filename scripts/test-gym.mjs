// Gym Tracker (beta) smoke test — headless puppeteer.
// 1) injects a real (non-allowlisted) session → asserts the Gym tab stays HIDDEN + no JS errors (gating works)
// 2) allowlists that user in-page + seeds gym rows → asserts the tracker renders and reads its own data via RLS
// Usage: node scripts/test-gym.mjs   (serves index.html on a local port)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { PROJECT_URL, getApiKeys, sql } from './sb.mjs';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const puppeteer = require('puppeteer');
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8757;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };

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
const ts = Date.now(), email = `physiq-gym-${ts}@example.com`, password = `Test!${ts}`;
let testUserId;

const browser = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
try {
  const c = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, { method:'POST', headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`,'Content-Type':'application/json'}, body: JSON.stringify({ email, password, email_confirm:true }) });
  testUserId = (await c.json()).id;
  const tok = await (await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`, { method:'POST', headers:{apikey:anon,'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })).json();
  const session = { access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: tok.expires_at, expires_in: tok.expires_in, token_type:'bearer', user: tok.user };

  // Seed gym data + a bodyweight for the test user (Management API bypasses RLS).
  await sql(`
    insert into gym_exercises (id,user_id,name,category) values
      ('11111111-1111-1111-1111-111111111111','${testUserId}','Bench Press','strength'),
      ('22222222-2222-2222-2222-222222222222','${testUserId}','Barbell Squat','strength'),
      ('33333333-3333-3333-3333-333333333333','${testUserId}','Deadlift','strength');
    insert into gym_sets (user_id,exercise_id,date,weight_lbs,reps,is_pr) values
      ('${testUserId}','11111111-1111-1111-1111-111111111111','2026-06-01',185,5,true),
      ('${testUserId}','11111111-1111-1111-1111-111111111111','2026-06-20',195,5,true),
      ('${testUserId}','22222222-2222-2222-2222-222222222222','2026-06-05',275,5,true),
      ('${testUserId}','22222222-2222-2222-2222-222222222222','2026-06-22',285,5,true),
      ('${testUserId}','33333333-3333-3333-3333-333333333333','2026-06-10',315,3,true),
      ('${testUserId}','33333333-3333-3333-3333-333333333333','2026-06-24',335,2,true);
    insert into weight_entries (user_id,date,weight) values ('${testUserId}','2026-06-01',180),('${testUserId}','2026-06-22',178);
  `);

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument((k, v) => localStorage.setItem(k, v), 'sb-physiq-session', JSON.stringify(session));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3500));

  console.log('[1] Gating — a non-allowlisted user must NOT see the Gym tab');
  ck('app booted (auth overlay hidden)', await page.$eval('#authOverlay', el => getComputedStyle(el).display === 'none').catch(() => false));
  ck('Gym nav button HIDDEN for non-allowlisted user', await page.$eval('#navGymBtn', el => getComputedStyle(el).display === 'none').catch(() => false));
  const noteErr = errors.filter(e => !/favicon|service ?worker|manifest|net::ERR|Failed to load resource/i.test(e));
  if (noteErr.length) console.log('    page errors:', noteErr);
  ck('no JS runtime errors', noteErr.length === 0);

  console.log('\n[2] Allowlist this user in-page → tracker renders + reads own data via RLS');
  await page.evaluate(async (uid) => {
    GYM_BETA_USERS.push(uid);          // const array is mutable
    await setupGymTab();               // reveals nav + preloads via authenticated RLS reads
    showView('gym', document.getElementById('navGymBtn'));
  }, testUserId);
  await new Promise(r => setTimeout(r, 1500));

  ck('Gym nav button now visible', await page.$eval('#navGymBtn', el => getComputedStyle(el).display !== 'none').catch(() => false));
  ck('voice quick-log bar rendered', await page.$('.gym-voicebar') !== null);
  const cardCount = await page.$$eval('.gym-card', els => els.length).catch(() => 0);
  ck('strength cards rendered from RLS data (3 exercises)', cardCount === 3);
  ck('PR pill shows on a card', await page.$('.gym-pr-pill') !== null);

  console.log('\n[3] Stats tab computes tiers + DOTS + chart');
  await page.evaluate(() => gymSetTab('stats'));
  await new Promise(r => setTimeout(r, 800));
  ck('DOTS hero rendered', await page.$('.gym-hero') !== null);
  ck('relative-strength section rendered', await page.$$eval('.gym-section', els => els.length >= 1).catch(() => false));
  ck('strength-vs-bodyweight chart canvas rendered', await page.$('#gymStatsChart') !== null);
  const errAll = errors.filter(e => !/favicon|service ?worker|manifest|net::ERR|Failed to load resource/i.test(e));
  ck('no JS errors through full gym flow', errAll.length === 0);
} catch (e) {
  fail++; console.error('\nFATAL:', e.message);
} finally {
  await browser.close();
  server.close();
  if (testUserId) {
    await sql(`delete from gym_sets where user_id='${testUserId}'; delete from gym_exercises where user_id='${testUserId}'; delete from gym_cardio where user_id='${testUserId}'; delete from weight_entries where user_id='${testUserId}';`).catch(()=>{});
    await fetch(`${PROJECT_URL}/auth/v1/admin/users/${testUserId}`, { method:'DELETE', headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`} }).catch(()=>{});
  }
  console.log(`\nGYM SMOKE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
