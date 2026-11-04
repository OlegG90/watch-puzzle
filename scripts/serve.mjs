// A tiny static server for development, with no dependencies.
//   node scripts/serve.mjs         this computer only
//   node scripts/serve.mjs --lan   also phones on the same Wi-Fi

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? 8123);
const LAN = process.argv.includes('--lan');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
// Only what the game itself needs; never the repository's other contents.
const PUBLIC = ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'src', 'vendor', 'icons'];

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const relative = normalize(path === '/' ? 'index.html' : path.slice(1));
  if (!PUBLIC.includes(relative.split(sep)[0])) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(join(ROOT, relative));
    res.writeHead(200, { 'Content-Type': TYPES[extname(relative)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`http://localhost:${PORT}`);
  if (LAN) {
    for (const nets of Object.values(networkInterfaces())) {
      for (const net of nets ?? []) {
        if (net.family === 'IPv4' && !net.internal) console.log(`http://${net.address}:${PORT}`);
      }
    }
  }
});
