// Tiny static server for local use. No dependencies.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const BLOCKED = ['node_modules', '.git', 'test', 'e2e', 'scripts', 'package.json', 'package-lock.json'];

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const clean = normalize(path).replace(/^([/\\])+/, '');
    if (BLOCKED.some((b) => clean === b || clean.startsWith(`${b}${sep}`))) throw new Error('blocked');
    let file = join(ROOT, clean);
    if (!file.startsWith(ROOT)) throw new Error('outside');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}).listen(PORT, HOST, () => {
  console.log(`Flaum läuft auf http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
