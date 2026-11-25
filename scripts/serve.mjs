import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png']
]);
const port = Number(process.env.PORT || 4173);

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relative = path.replace(/^\/+/, '') || 'index.html';
    const target = resolve(root, relative);
    if (target !== root && !target.startsWith(root + sep)) throw new Error('Forbidden');
    const info = await stat(target);
    const file = info.isDirectory() ? resolve(target, 'index.html') : target;
    const data = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime.get(extname(file)) || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    response.end(data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`LifeOS em http://localhost:${port}`));
