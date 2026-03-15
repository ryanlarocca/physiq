const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const path = require('path');
const url = require('url');

// Load .env if present
try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch(e) { /* no .env */ }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGemini(contents) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ contents });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 60000  // 60-second timeout for Gemini API
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { reject(new Error('Invalid JSON from Gemini')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini API timeout (60s)'));
    });
    req.write(body);
    req.end();
  });
}

function extractJSON(raw) {
  const cb = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (cb) return JSON.parse(cb[1]);
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) return JSON.parse(raw.slice(s, e + 1));
  throw new Error('Unable to parse JSON from response');
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const PORT = process.env.PORT || 8888;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ── Get Gemini API key ─────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/gemini-key') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ key: GEMINI_API_KEY || '' }));
    return;
  }

  // ── AI parse-meal endpoint (text) ──────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/parse-meal') {
    try {
      const bodyStr = await readBody(req);
      const { text } = JSON.parse(bodyStr);
      if (!text) throw new Error('Missing text');
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured on server');

      const prompt = `You are a macro logging assistant. Parse this food and return ONLY valid JSON, no markdown.
Key protein references: chicken breast cooked=31g/100g 165cal, egg white=11g/100g 52cal, salmon=25g/100g, white rice cooked=2.7g/100g 130cal.
Keys: description (string), calories (number), protein (number grams), carbs (number grams), fat (number grams).
Food: "${text}"`;

      const result = await callGemini([{ parts: [{ text: prompt }] }]);
      if (result.status !== 200) throw new Error(result.body.error?.message || 'Gemini API error');

      const raw = (result.body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      const parsed = extractJSON(raw);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch(e) {
      console.error('[parse-meal]', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── AI parse-meal-photo endpoint (base64 image) ─────────────────────────
  if (req.method === 'POST' && pathname === '/api/parse-meal-photo') {
    try {
      const bodyStr = await readBody(req);
      const { imageBase64, mimeType, caption } = JSON.parse(bodyStr);
      if (!imageBase64) throw new Error('Missing imageBase64');
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured on server');

      const captionNote = caption
        ? `The user says: "${caption}". Trust this description — image is supplementary.`
        : 'Use visual analysis to identify the food.';
      const prompt = `Analyze this food image and return macros. ${captionNote}
Rules: nutrition label → read exactly; food photo → estimate USDA averages. Return ONLY valid JSON: {"description":"...","calories":number,"protein":number,"carbs":number,"fat":number}`;

      const result = await callGemini([{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
        ]
      }]);
      if (result.status !== 200) throw new Error(result.body.error?.message || 'Gemini API error');

      const raw = (result.body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      const parsed = extractJSON(raw);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch(e) {
      console.error('[parse-meal-photo]', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Handle data.json POST (save data)
  if (req.method === 'POST' && pathname === '/data.json') {
    try {
      const body = await readBody(req);
      const entries = JSON.parse(body);
      await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(entries, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));

      // Trigger async Google Sheets sync (non-blocking)
      const syncScript = path.join(process.cwd(), 'sync-physiq.sh');
      const child = spawn('/bin/bash', [syncScript], {
        detached: true,
        stdio: 'ignore',
        cwd: process.cwd(),
        env: { ...process.env, GOG_ACCOUNT: 'info@lrghomes.com', PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
      });
      child.unref();
      console.log('[sync] Triggered Physiq sync (macros + weights) to Google Sheets');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    return;
  }

  // Handle data.json GET (load data)
  if (pathname === '/data.json') {
    try {
      const data = await fs.readFile(path.join(process.cwd(), 'data.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ macros: [], weights: [], settings: {} }));
    }
    return;
  }

  // Serve static files
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(process.cwd(), 'index.html');
  } else {
    filePath = path.join(process.cwd(), pathname.slice(1));
  }

  let ext = path.extname(filePath).toLowerCase();
  let mimeType;
  switch (ext) {
    case '.html': mimeType = 'text/html; charset=utf-8'; break;
    case '.js': mimeType = 'application/javascript; charset=utf-8'; break;
    case '.json': mimeType = 'application/json'; break;
    case '.png': mimeType = 'image/png'; break;
    case '.svg': mimeType = 'image/svg+xml'; break;
    case '.ico': mimeType = 'image/x-icon'; break;
    case '.css': mimeType = 'text/css; charset=utf-8'; break;
    default: mimeType = 'application/octet-stream';
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✨ Physiq server running at http://${HOST}:${PORT}/`);
  console.log(`📊 Dashboard: http://${HOST}:${PORT}/`);
  console.log(`💾 Data API: http://${HOST}:${PORT}/data.json`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close(() => {
    console.log('Physiq server stopped');
    process.exit(0);
  });
});
