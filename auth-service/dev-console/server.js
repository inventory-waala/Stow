/**
 * Static file server + API proxy for the auth-service dev console.
 *
 * Serves the page AND forwards /api/* to the auth service, so everything lives
 * on a single origin. That matters for two reasons:
 *   - no CORS to configure, and
 *   - WebAuthn requires the page origin to match WEBAUTHN_EXPECTED_ORIGIN, and
 *     rpID must be a registrable domain. With one origin you can expose this
 *     through a single HTTPS tunnel and test passkeys from a phone.
 *
 * Port 3000 by default: already in CORS_ORIGINS, and http://localhost is a
 * secure context, which WebAuthn requires.
 *
 * No dependencies: node dev-console/server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.CONSOLE_PORT) || 3000;
const API_TARGET = process.env.API_TARGET || 'http://localhost:3001';
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const target = new URL(API_TARGET);

function proxy(req, res) {
  const upstreamPath = req.url.replace(/^\/api/, '') || '/';
  const headers = { ...req.headers };
  delete headers.host; // let the upstream see its own host
  delete headers['accept-encoding']; // avoid negotiating compression we'd just pipe

  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: upstreamPath,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Auth service unreachable',
        target: API_TARGET,
        detail: err.message,
      }),
    );
  });

  req.pipe(upstream);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(ROOT, rel);

  // Keep the server inside its own directory.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type':
        TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    proxy(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(
    `\nAuth dev console:  http://localhost:${PORT}\n` +
      `Proxying /api  ->  ${API_TARGET}\n\n`,
  );
});
