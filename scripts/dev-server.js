#!/usr/bin/env node
/**
 * Dev Server — same-origin server for dev mode.
 *
 * Serves:
 *   /                        → DOL compiled HTML
 *   /__dev__/DOLI.js  → DOLI/dist/DOLI.js (no-cache)
 *   /modList.json            → dev modList pointing to Dev Loader zip
 *   /mod/*                   → dev loader mod zip file
 *
 * Usage:
 *   node scripts/dev-server.js [--port 9900] [--dol-html <path>]
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config ──
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const PORT = parseInt(getArg('--port', '9900'), 10);
const PROJECT_DIR = path.resolve(__dirname, '..');
const DOL_DIR = path.resolve(PROJECT_DIR, 'submodules', 'DOL');

// Default: look for any "Degrees of Lewdity*.html" in submodules/DOL/
function findDolHtml() {
  const explicit = getArg('--dol-html', '');
  if (explicit) return path.resolve(explicit);

  const files = fs.readdirSync(DOL_DIR).filter(
    f => f.startsWith('Degrees of Lewdity') && f.endsWith('.html')
  );
  if (files.length === 0) {
    console.error(
      '[dev-server] ERROR: No DoL HTML found in submodules/DOL/.\n' +
      '  Run "npm run dev:init" first, or pass --dol-html <path>.'
    );
    process.exit(1);
  }
  // Prefer CI-parity patched + injected html first, then plain injected html
  const patchedModHtml = files.find(f => f.endsWith('.sc2patch.html.mod.html'));
  if (patchedModHtml) return path.join(DOL_DIR, patchedModHtml);

  const modHtml = files.find(f => f.endsWith('.mod.html'));
  if (modHtml) return path.join(DOL_DIR, modHtml);
  const preferred = files.find(f => f === 'Degrees of Lewdity.html');
  return path.join(DOL_DIR, preferred || files[0]);
}

const DOL_HTML_PATH = findDolHtml();
const BUNDLE_PATH = path.join(PROJECT_DIR, 'dist', 'DOLI.js');
const DEV_LOADER_DIR = path.join(PROJECT_DIR, 'dev-loader');
const DEV_LOADER_ZIP_NAME = 'DOLIDevLoader.mod.zip';
const DEV_LOADER_ZIP_PATH = path.join(DEV_LOADER_DIR, DEV_LOADER_ZIP_NAME);

// ── MIME helpers ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.css': 'text/css; charset=utf-8',
};
function mimeFor(filePath) {
  return MIME[path.extname(filePath)] || 'application/octet-stream';
}

// ── Server ──
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  // Route: DOLI dev bundle
  if (pathname === '/__dev__/DOLI.js') {
    return serveFile(res, BUNDLE_PATH, { 'Cache-Control': 'no-store' });
  }

  // Route: modList.json (for RemoteLoader)
  if (pathname === '/modList.json') {
    const version = fs.existsSync(DEV_LOADER_ZIP_PATH)
      ? Math.floor(fs.statSync(DEV_LOADER_ZIP_PATH).mtimeMs)
      : Date.now();
    const body = JSON.stringify([`mod/${DEV_LOADER_ZIP_NAME}?v=${version}`], null, 2) + '\n';
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return;
  }

  // Route: dev-loader mod zip
  if (pathname.startsWith('/mod/')) {
    const relPath = pathname.slice(1); // strip leading '/'
    const filePath = path.join(DEV_LOADER_DIR, path.basename(relPath));
    return serveFile(res, filePath, { 'Cache-Control': 'no-store' });
  }

  // Route: root → DoL HTML
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile(res, DOL_HTML_PATH);
  }

  // Route: static files from DOL directory (for resources referenced by HTML)
  const dolFile = path.join(DOL_DIR, pathname);
  if (fs.existsSync(dolFile) && fs.statSync(dolFile).isFile()) {
    return serveFile(res, dolFile);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

function serveFile(res, filePath, extraHeaders = {}) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404: ${path.basename(filePath)} not found`);
    return;
  }
  const headers = {
    'Content-Type': mimeFor(filePath),
    ...extraHeaders,
  };
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-server] DoL HTML : ${DOL_HTML_PATH}`);
  console.log(`[dev-server] Bundle   : ${BUNDLE_PATH}`);
  console.log(`[dev-server] Listening: http://127.0.0.1:${PORT}/`);
  console.log(`[dev-server] Press Ctrl+C to stop.`);
});
