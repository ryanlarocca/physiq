const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

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

  // Handle data.json POST (save data)
  if (req.method === 'POST' && pathname === '/data.json') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const entries = JSON.parse(body);
        await fs.writeFile(path.join(process.cwd(), 'data.json'), JSON.stringify(entries, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
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
