import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !['.html','.css','.js','.json','.webmanifest'].includes(path.extname(file)) || pathname.startsWith('/tools/')) {
      response.writeHead(403).end(); return;
    }
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${types[path.extname(file)]}; charset=utf-8`, 'Cache-Control':'no-cache' }).end(content);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(8080, '127.0.0.1', () => console.log('Tekken Book: http://127.0.0.1:8080 — Ctrl+C to stop'));
