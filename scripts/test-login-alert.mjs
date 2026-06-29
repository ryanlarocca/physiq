// End-to-end: drive the REAL OTP login UI (send code → verify) so the app's actual
// SIGNED_IN handler runs → it calls /api/notify-login. We can't read the emailed code,
// so we mint a fresh valid one via admin generate_link right before verifying.
// NOTE: this sends ONE real Telegram alert for the throwaway test email.
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { PROJECT_URL, getApiKeys } from './sb.mjs';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const puppeteer = require('puppeteer');
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8755;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p === '/') p = '/index.html';
  const f = join(APP_DIR, p);
  if (!existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'text/plain' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));
const URL = `http://localhost:${PORT}/`;

let pass = 0, fail = 0;
const ck = (n, b) => b ? (pass++, console.log('  ✓', n)) : (fail++, console.error('  ✗', n));

const { anon, serviceRole } = await getApiKeys();
const ts = Date.now(), email = `physiq-loginalert-${ts}@gmail.com`;
let id;

// Pre-check: this test drives the real OTP send, which needs the email service to work.
// With Supabase's built-in email (rate_limit 2/hr) this is often exhausted — skip cleanly
// rather than fail, since that's an email-config issue, not a code bug.
{
  const probe = await fetch(`${PROJECT_URL}/auth/v1/otp`, { method:'POST', headers:{apikey:anon,'Content-Type':'application/json'}, body: JSON.stringify({ email:`physiq-probe-${ts}@gmail.com`, create_user:true }) });
  if (probe.status === 429) {
    console.log('SKIP: OTP email send is rate-limited (built-in email, 2/hr). Configure custom SMTP to run this + deliver to real users.');
    server.close(); process.exit(0);
  }
}
const browser = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  let notifyHit = null;
  page.on('request', req => { if (req.url().includes('/api/notify-login')) notifyHit = { method: req.method(), auth: (req.headers()['authorization'] || '').startsWith('Bearer ') }; });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  // Step 1: enter email + send code (signInWithOtp creates the user + emails a code)
  await page.type('#authEmail', email);
  await page.click('#authSendBtn');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('authStepCode')).display !== 'none', { timeout: 15000 });

  // Mint a fresh valid code via admin (we can't read the emailed one); this becomes the latest OTP
  const gl = await (await fetch(`${PROJECT_URL}/auth/v1/admin/generate_link`, { method:'POST', headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`,'Content-Type':'application/json'}, body: JSON.stringify({ type:'magiclink', email }) })).json();
  id = gl.user_id; const code = gl.email_otp;

  // Step 2: enter the code + verify → triggers the app's real SIGNED_IN handler
  await page.type('#authCode', code);
  await page.click('#authVerifyBtn');
  await new Promise(r => setTimeout(r, 4000)); // allow verifyOtp → SIGNED_IN → notifyLogin

  ck('logged in (auth overlay hidden)', await page.$eval('#authOverlay', el => getComputedStyle(el).display === 'none').catch(() => false));
  ck('app called /api/notify-login on login', notifyHit !== null);
  ck('notify call was a POST', notifyHit?.method === 'POST');
  ck('notify call carried the bearer token', notifyHit?.auth === true);
  console.log('    (a real Telegram alert was sent for', email + ')');
} catch (e) {
  fail++; console.error('FATAL:', e.message);
} finally {
  await browser.close(); server.close();
  // resolve id if the flow failed before generate_link
  if (!id) { const u = await (await fetch(`${PROJECT_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`} })).json().catch(()=>({})); id = u?.users?.[0]?.id; }
  if (id) await fetch(`${PROJECT_URL}/auth/v1/admin/users/${id}`, { method:'DELETE', headers:{apikey:serviceRole,Authorization:`Bearer ${serviceRole}`} });
  console.log(`\nLOGIN ALERT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
