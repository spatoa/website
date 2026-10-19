#!/usr/bin/env node
/**
 * @file scripts/verify-browser.js
 * @description Serves public/ on an ephemeral port and runs headless Chromium to capture screenshots
 * of the web portal, desktop OS, and desert golfing standalone PWA.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const CHROMIUM_BIN = '/run/current-system/sw/bin/chromium';
const ARTIFACT_DIR = '/home/spatoa/.gemini/antigravity-ide/brain/3840be96-03c2-42e6-b369-60d094fe549e';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) {
    reqPath += 'index.html';
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
  } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`[Browser Verify] Local server running on port ${port}`);

  const targets = [
    { name: 'portal', url: `http://127.0.0.1:${port}/`, file: 'verify_portal.png', size: '1280,1024' },
    { name: 'desktop', url: `http://127.0.0.1:${port}/desktop/`, file: 'verify_desktop.png', size: '1280,1024' },
    { name: 'golf_standalone', url: `http://127.0.0.1:${port}/golf/`, file: 'verify_golf_pwa.png', size: '960,540' }
  ];

  try {
    for (const t of targets) {
      const outPath = path.join(ARTIFACT_DIR, t.file);
      console.log(`[Browser Verify] Capturing ${t.name} from ${t.url} ...`);
      execFileSync(CHROMIUM_BIN, [
        '--headless',
        '--disable-gpu',
        `--screenshot=${outPath}`,
        `--window-size=${t.size}`,
        t.url
      ], { stdio: 'inherit' });
      console.log(`[Browser Verify] Saved screenshot to ${outPath}`);
    }
    console.log('[Browser Verify] All browser screenshots captured successfully!');
  } catch (err) {
    console.error('[Browser Verify] Chromium error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
