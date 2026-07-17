// Pure Node.js re-implementation of server.ps1, used only by the Electron app. Runs in-process (no
// child process spawn at all) instead of shelling out to `powershell.exe -ExecutionPolicy Bypass
// -File server.ps1` — that spawn pattern (unsigned .exe launching PowerShell with an explicit
// security-bypass flag) is a classic antivirus/SmartScreen heuristic trigger, and a real user report
// showed the packaged app's window opening then closing itself ~8s later, consistent with something
// terminating it shortly after launch. Removing the PowerShell dependency removes that signature
// entirely, and having Electron own the server directly is also simpler than managing a child process.
//
// Mirrors server.ps1's API exactly (same endpoints, same event/connection shape) so studio.html,
// tiktok-bridge, and ANSLUT-TIKTOK-LIVE.cmd all work unchanged — only server.ps1's shell process is
// replaced, not the contract other code depends on. The standalone (non-Electron) path via
// STARTA-HEMSIDAN.cmd still uses server.ps1; this file is Electron-only.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function startLocalServer(root, port = 4173) {
  const events = [];
  const connection = { connected: false, username: '', mode: 'demo', updated: Date.now() };

  function sendJson(res, obj, status = 200) {
    const body = Buffer.from(JSON.stringify(obj), 'utf8');
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
    res.end(body);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = new URL(req.url, `http://127.0.0.1:${port}`);
      const p = parsed.pathname;

      if (p === '/api/status') {
        return sendJson(res, { ok: true, server: 'VYRA Live Server', connection, lastEventId: events.length ? events[events.length - 1].id : 0 });
      }
      if (p === '/api/connect' && req.method === 'POST') {
        const d = JSON.parse((await readBody(req)) || '{}');
        connection.connected = true;
        connection.username = String(d.username || '');
        connection.mode = 'connector-ready';
        connection.updated = Date.now();
        return sendJson(res, { ok: true, connection, message: 'Redo for LIVE-events' });
      }
      if (p === '/api/disconnect' && req.method === 'POST') {
        connection.connected = false;
        connection.updated = Date.now();
        return sendJson(res, { ok: true, connection });
      }
      if (p === '/api/events' && req.method === 'GET') {
        const after = Number(parsed.searchParams.get('after') || 0) || 0;
        return sendJson(res, { ok: true, events: events.filter(e => e.id > after) });
      }
      if (p === '/api/events' && req.method === 'POST') {
        const d = JSON.parse((await readBody(req)) || '{}');
        let id = Date.now();
        while (events.length && events[events.length - 1].id >= id) id++;
        const e = {
          id, type: String(d.type || ''), username: String(d.username || ''), name: String(d.name || ''),
          profileImage: String(d.profileImage || ''), giftName: String(d.giftName || ''), giftImage: String(d.giftImage || ''),
          coins: d.coins, count: d.count, multiplier: d.multiplier, points: d.points, level: d.level, timestamp: id
        };
        events.push(e);
        while (events.length > 250) events.shift();
        return sendJson(res, { ok: true, event: e });
      }
      if (p === '/api/state' && req.method === 'GET') {
        const backupFile = path.join(root, 'vyra-state-backup.json');
        if (fs.existsSync(backupFile)) {
          const body = fs.readFileSync(backupFile);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
          return res.end(body);
        }
        return sendJson(res, { ok: false, error: 'Ingen backup sparad an' }, 404);
      }
      if (p === '/api/state' && req.method === 'POST') {
        const raw = await readBody(req);
        if (raw) fs.writeFileSync(path.join(root, 'vyra-state-backup.json'), raw, 'utf8');
        return sendJson(res, { ok: true });
      }

      if (req.method !== 'GET') {
        return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);
      }

      let rel = decodeURIComponent(p).replace(/^\/+/, '');
      if (!rel) rel = 'index.html';
      const rootResolved = path.resolve(root);
      const filePath = path.resolve(path.join(rootResolved, rel));
      if (!filePath.toLowerCase().startsWith(rootResolved.toLowerCase()) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return sendJson(res, { ok: false, error: 'Hittades inte' }, 404);
      }
      const body = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const type = TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': body.length });
      res.end(body);
    } catch (err) {
      try { sendJson(res, { ok: false, error: err.message }, 500); } catch { /* response already sent */ }
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startLocalServer };
