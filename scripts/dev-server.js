import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 5173);
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json' };
createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = path === '/' ? 'index.html' : path.slice(1);
  if (!/^(index\.html|sw\.js|manifest\.webmanifest|(?:js|css|icons)\/[^?]+)$/.test(relative) || relative.split('/').includes('..')) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(resolve(root, relative));
    response.writeHead(200, { 'Content-Type': mime[extname(relative)] ?? 'application/octet-stream', 'Cache-Control':'no-store' }).end(content);
  } catch { response.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log('Treino: http://127.0.0.1:' + port));
