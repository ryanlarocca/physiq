// Test the install / Add-to-Home-Screen helper across platforms (puppeteer).
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const puppeteer = require('puppeteer');
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8754;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = join(APP_DIR, p);
  if (!existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'text/plain' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));
const URL = `http://localhost:${PORT}/`;
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

let pass = 0, fail = 0;
const ck = (n, b) => b ? (pass++, console.log('  ✓', n)) : (fail++, console.error('  ✗', n));
// NOTE: offsetParent is null for position:fixed elements — use getBoundingClientRect instead.
const vis = (page, sel) => page.$eval(sel, el => {
  const s = getComputedStyle(el), r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
}).catch(() => false);

// Headless Chrome fires its OWN beforeinstallprompt regardless of UA, which real iOS
// Safari never does. Suppress the native one on every page; let only tagged synthetic
// events through, so each platform path is tested faithfully.
const SUPPRESS = () => window.addEventListener('beforeinstallprompt', e => { if (!e.__synthetic) e.stopImmediatePropagation(); }, true);

const browser = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
try {
  // ---- iOS Safari: shows guided banner + instructions sheet ----
  console.log('[1] iOS Safari');
  const p1 = await browser.newPage();
  const errs = []; p1.on('pageerror', e => errs.push(e.message));
  await p1.setUserAgent(IOS_UA);
  await p1.evaluateOnNewDocument(SUPPRESS);
  await p1.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000)); // banner shows after 1.5s
  const dbg = await p1.evaluate(() => ({ disp: document.getElementById('installBanner').style.display, btn: document.getElementById('installBtn').textContent }));
  console.log('    [debug] banner.display=', JSON.stringify(dbg.disp), 'btn=', JSON.stringify(dbg.btn), 'errors=', errs.slice(0,2));
  ck('install banner visible on iOS', await vis(p1, '#installBanner'));
  ck('button says "Add"', await p1.$eval('#installBtn', el => el.textContent.trim() === 'Add').catch(() => false));
  await p1.click('#installBtn');
  await new Promise(r => setTimeout(r, 200));
  ck('tapping shows the iOS instructions sheet', await vis(p1, '#iosInstallSheet'));

  // ---- Dismiss persists ----
  console.log('[2] Dismiss persists');
  const p2 = await browser.newPage();
  await p2.setUserAgent(IOS_UA);
  await p2.evaluateOnNewDocument(SUPPRESS);
  await p2.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await p2.click('#installDismiss');
  await new Promise(r => setTimeout(r, 100));
  ck('banner hidden after dismiss', !(await vis(p2, '#installBanner')));
  const flag = await p2.evaluate(() => localStorage.getItem('physiq_install_dismissed_v1'));
  ck('dismissal saved to localStorage', flag === '1');
  await p2.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  ck('banner stays hidden on reload after dismiss', !(await vis(p2, '#installBanner')));

  // ---- Android/Chromium: beforeinstallprompt → one-tap Install ----
  console.log('[3] Android/Chromium one-tap');
  const p3 = await browser.newPage();
  await p3.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} }); // [2] set a dismiss flag on this shared origin
  await p3.evaluateOnNewDocument(SUPPRESS);
  await p3.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));
  // simulate the browser firing the install prompt event (tagged so the suppressor allows it)
  await p3.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.__synthetic = true;
    e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await new Promise(r => setTimeout(r, 200));
  ck('banner shows after beforeinstallprompt', await vis(p3, '#installBanner'));
  ck('button says "Install"', await p3.$eval('#installBtn', el => el.textContent.trim() === 'Install').catch(() => false));

  // ---- Standalone (already installed): never shows ----
  console.log('[4] Already installed → silent');
  const p4 = await browser.newPage();
  await p4.setUserAgent(IOS_UA);
  await p4.evaluateOnNewDocument(SUPPRESS);
  await p4.evaluateOnNewDocument(() => { Object.defineProperty(window.navigator, 'standalone', { get: () => true }); });
  await p4.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  ck('banner NEVER shows when already installed', !(await vis(p4, '#installBanner')));
} catch (e) {
  fail++; console.error('FATAL:', e.message);
} finally {
  await browser.close(); server.close();
  console.log(`\nINSTALL HELPER: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
