// Phase 3 — headless UI smoke test (puppeteer).
// 1) loads the app, asserts the OTP screen is correct + no leftover password/key fields + no JS errors
// 2) injects a REAL test-user session to bypass OTP, asserts the app boots and renders.
// Usage: node scripts/test-ui.mjs   (serves index.html on a local port internally)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { PROJECT_URL, getApiKeys, REF, sql } from './sb.mjs';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const puppeteer = require('puppeteer');
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8753;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };

// minimal static server
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
const ts = Date.now(), email = `physiq-ui-${ts}@example.com`, password = `Test!${ts}`;
let testUserId;

const browser = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
try {
  // ---- Test 1: OTP login screen ----
  console.log('[1] Login screen renders the OTP flow, no leftovers');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  ck('email step visible',        await page.$eval('#authStepEmail', el => el.offsetParent !== null).catch(() => false));
  ck('code step hidden initially',await page.$eval('#authStepCode', el => getComputedStyle(el).display === 'none').catch(() => false));
  ck('"Send my code" button present', await page.$eval('#authSendBtn', el => /code/i.test(el.textContent)).catch(() => false));
  ck('NO password field',         (await page.$('#authPassword')) === null);
  ck('NO gemini key field',       (await page.$('#geminiKeyInput')) === null);
  // ignore benign favicon/SW/CDN noise; care about real script errors
  const realErrors = errors.filter(e => !/favicon|service ?worker|manifest|net::ERR|Failed to load resource/i.test(e));
  if (realErrors.length) console.log('    page errors:', realErrors);
  ck('no JS runtime errors on load', realErrors.length === 0);

  // ---- Test 2: inject a real session, confirm app boots ----
  console.log('\n[2] App boots with an injected real session');
  // create + sign in a throwaway user to get a genuine session
  const c = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, { method:'POST', headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`,'Content-Type':'application/json'}, body: JSON.stringify({ email, password, email_confirm:true }) });
  testUserId = (await c.json()).id;
  const tok = await (await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`, { method:'POST', headers:{apikey:anon,'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })).json();
  const session = { access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: tok.expires_at, expires_in: tok.expires_in, token_type: 'bearer', user: tok.user };
  const storageKey = 'sb-physiq-session'; // matches the app's custom createClient storageKey

  const page2 = await browser.newPage();
  const errors2 = [];
  page2.on('pageerror', e => errors2.push(e.message));
  page2.on('console', m => { const t = m.text(); if (/seed|migrat/i.test(t)) console.log('    [browser]', t); });
  await page2.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v); }, storageKey, JSON.stringify(session));
  await page2.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3500)); // allow getSession + loadAppData

  ck('auth overlay hidden after login', await page2.$eval('#authOverlay', el => getComputedStyle(el).display === 'none').catch(() => false));
  ck('main header/app visible',         await page2.$eval('header', el => el.offsetParent !== null).catch(() => false));
  ck('a chart canvas rendered',         await page2.$$eval('canvas', els => els.length > 0).catch(() => false));
  const realErrors2 = errors2.filter(e => !/favicon|service ?worker|manifest|net::ERR|Failed to load resource/i.test(e));
  if (realErrors2.length) console.log('    page errors:', realErrors2);
  ck('no JS runtime errors after login', realErrors2.length === 0);

  // CRITICAL: a brand-new user must NOT be seeded with Ryan's data.json. Verify empty
  // (via Management API SQL — service_role REST is not granted on these tables).
  const wn = (await sql(`select count(*)::int n from weight_entries where user_id='${testUserId}'`))[0].n;
  const mn = (await sql(`select count(*)::int n from macro_entries where user_id='${testUserId}'`))[0].n;
  ck('new user has 0 seeded weights (no data.json leak)', wn === 0);
  ck('new user has 0 seeded macros (no data.json leak)', mn === 0);
} catch (e) {
  fail++; console.error('\nFATAL:', e.message);
} finally {
  await browser.close();
  server.close();
  if (testUserId) {
    // Delete rows first (postgres role via Management API), then the auth user.
    await sql(`delete from weight_entries where user_id='${testUserId}'; delete from macro_entries where user_id='${testUserId}';`).catch(()=>{});
    await fetch(`${PROJECT_URL}/auth/v1/admin/users/${testUserId}`, { method:'DELETE', headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`} });
  }
  console.log(`\nUI SMOKE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
