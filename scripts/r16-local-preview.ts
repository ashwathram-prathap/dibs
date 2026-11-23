import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { WebSocket, WebSocketServer } from 'ws';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { SECURITY_HEADERS } from '../shared/security';
const root = resolve('dist');
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};
const server = http
  .createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
      }
      if (req.url!.startsWith('/api/') || ['/robots.txt', '/sitemap.xml'].includes(req.url!)) {
        const response = await fetch('https://dibs.here' + req.url);
        res.writeHead(
          response.status,
          Object.fromEntries(
            [...response.headers].filter(
              ([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k),
            ),
          ),
        );
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      let path = resolve(root, '.' + new URL(req.url!, 'http://localhost').pathname);
      if (!path.startsWith(root + '/')) path = root + '/index.html';
      if (!existsSync(path) || !statSync(path).isFile()) path = root + '/index.html';
      const headers = {
        ...SECURITY_HEADERS,
        'Content-Security-Policy': readFileSync(root + '/_headers', 'utf8').match(
          /Content-Security-Policy: ([^\n]+)/,
        )![1],
      };
      delete headers['X-Robots-Tag'];
      const raw = readFileSync(path);
      const compress = /\.(html|js|css|json|txt|svg)$/.test(path);
      const bytes = compress ? gzipSync(raw) : raw;
      res.writeHead(200, {
        ...headers,
        ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
        'Content-Type': mime[extname(path)] || 'application/octet-stream',
        'Cache-Control':
          extname(path) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(bytes);
    } catch {
      res.writeHead(500);
      res.end('Unavailable');
    }
  })
  .listen(5191, '127.0.0.1', () => console.log('Local production build: http://127.0.0.1:5191'));

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/api/live') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (client) => {
    const remote = new WebSocket('wss://dibs.here/api/live', { origin: 'https://dibs.here' });
    remote.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) client.send(data.toString());
    });
    remote.on('error', () => client.close());
    remote.on('close', () => client.close());
    client.on('close', () => remote.close());
    // This audit proxy accepts no write/RPC traffic from the browser.
  });
});
