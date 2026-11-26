// Kleiner Webserver nur für die Tests: liefert die App unter / (wie live) und unter /beta/ (wie die Testversion).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = +(process.argv[2] || 4173);
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
  let pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/beta(\/|$)/, '/');
  if (pfad.endsWith('/')) pfad += 'index.html';
  const datei = normalize(join(ROOT, pfad));
  if (!datei.startsWith(ROOT) || /[\\/](\.git|node_modules)[\\/]/.test(datei)) { res.writeHead(403).end(); return; }
  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(inhalt);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('nicht gefunden');
  }
}).listen(PORT, () => console.log(`Vokabel-Studio Testserver: http://localhost:${PORT}/ und /beta/`));
