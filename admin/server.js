const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT      = 3001;
const ROOT      = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'departamentos.json');
const ADMIN_HTML = path.join(__dirname, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
  '.png':  'image/png',  '.webp': 'image/webp',
  '.gif':  'image/gif',  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon', '.pdf': 'application/pdf',
  '.woff': 'font/woff',  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
};

const EXT_FROM_MIME = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg',
  'image/png':  '.png', 'image/webp': '.webp', 'image/gif': '.gif',
};

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Depto-Id');
}

function json(res, code, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(code);
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) { res.writeHead(403); res.end('Forbidden'); return; }
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ── GET / → admin UI ──────────────────────────────────────
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    serveStatic(res, ADMIN_HTML);
    return;
  }

  // ── GET /api/departamentos ────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/departamentos') {
    try {
      const data = fs.existsSync(DATA_FILE)
        ? fs.readFileSync(DATA_FILE, 'utf8')
        : '[]';
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(data);
    } catch (e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // ── PUT /api/departamentos ────────────────────────────────
  if (req.method === 'PUT' && pathname === '/api/departamentos') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body.toString('utf8'));
      if (!Array.isArray(data)) throw new Error('El body debe ser un array JSON');
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
      json(res, 200, { ok: true, count: data.length });
    } catch (e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // ── POST /api/upload ─────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/upload') {
    try {
      const rawId = req.headers['x-depto-id'] || '';
      const safeId = rawId.replace(/[^a-zA-Z0-9\-_]/g, '');
      if (!safeId) { json(res, 400, { ok: false, error: 'Falta el header X-Depto-Id' }); return; }

      const ct = (req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
      const ext = EXT_FROM_MIME[ct] || '.jpg';

      const dir = path.join(ROOT, 'images', safeId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const filename = `imagen${ext}`;
      const filepath = path.join(dir, filename);
      const buffer   = await readBody(req);
      fs.writeFileSync(filepath, buffer);

      const relativePath = `./images/${safeId}/${filename}`;
      json(res, 200, { ok: true, path: relativePath });
    } catch (e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // ── GET /* → archivos estáticos del proyecto ──────────────
  if (req.method === 'GET') {
    // Prevenir path traversal
    const rel = decodeURIComponent(pathname);
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(ROOT, safe);
    // Solo servir archivos dentro del ROOT
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    serveStatic(res, filePath);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║   BairesRental Admin                  ║');
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
  console.log('  Ctrl+C para detener el servidor.');
  console.log('');
  exec(`start http://localhost:${PORT}`);
});
