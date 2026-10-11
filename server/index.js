'use strict';
// Node host for Nightshift City Online (local dev, Docker, any VPS).
// Transport only: HTTP, WebSocket handshake, limits, timers.
// Game and connection rules live in room.js (shared with the Cloudflare host).
//
// Run:  cd server && npm start      (PORT env, default 2567; no dependencies)

const { WebSocketServer } = require('./ws-lite.js');
const RULES = require('../shared/rules.js');
const { World } = require('./sim.js');
const { Room } = require('./room.js');
const { MemoryStore, FileStore } = require('./store.js');
const { STATIC } = require('./static-files.js');
const fs = require('node:fs');
const path = require('node:path');

function serveStatic(req, res) {
  const url = (req.url || '/').split('?')[0];
  const hit = req.method === 'GET' || req.method === 'HEAD' ? STATIC[url] : null;
  const headers = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' };
  if (url === '/healthz') { res.writeHead(200, { ...headers, 'content-type': 'text/plain' }); return res.end('ok\n'); }
  if (!hit) { res.writeHead(404, { ...headers, 'content-type': 'text/plain' }); return res.end('not found\n'); }
  fs.readFile(path.join(__dirname, hit.file), (err, body) => {
    if (err) { res.writeHead(500, headers); return res.end(); }
    res.writeHead(200, { ...headers, 'content-type': hit.type, 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}

function createServer({
  port = 2567, host = '127.0.0.1', clock = Date.now, world = new World(), store = new MemoryStore(), saveEveryMs = 10000,
  maxConnections = 200,       // whole server
  maxPerIp = 8,               // one household/phone carrier NAT can share an IP
  allowedOrigins = null,      // e.g. ['https://game.example'] — null allows any (local dev)
  trustProxy = false,         // true behind a hosting proxy: use X-Forwarded-For
  pingEveryMs = 10000, idleTimeoutMs = 30000,
} = {}) {
  const room = new Room({ world, store, clock });
  const clientIp = (req) => {
    const fwd = trustProxy && req.headers['x-forwarded-for'];
    return (fwd ? String(fwd).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
  };
  const perIp = new Map();
  const allowUpgrade = (req) => {
    if (allowedOrigins && !allowedOrigins.includes(req.headers.origin)) return [403, 'Forbidden'];
    if (wss.clients.size >= maxConnections) return [503, 'Server Full'];
    if ((perIp.get(clientIp(req)) || 0) >= maxPerIp) return [429, 'Too Many Connections'];
    return null;
  };
  const wss = new WebSocketServer({ port, host, maxPayload: RULES.net.maxMsgBytes, onRequest: serveStatic, allowUpgrade, clientIp });

  wss.on('connection', (ws) => {
    perIp.set(ws.ip, (perIp.get(ws.ip) || 0) + 1);
    room.open(ws);
    ws.on('message', (data, isBinary) => room.message(ws, isBinary ? null : data.toString('utf8')));
    ws.on('close', () => {
      const n = (perIp.get(ws.ip) || 1) - 1;
      if (n) perIp.set(ws.ip, n); else perIp.delete(ws.ip);
      room.close(ws);
    });
    ws.on('error', () => {});
  });

  const saver = setInterval(() => { room.saveAll(); }, saveEveryMs);
  // Phones that lose signal often vanish without a close frame. Ping everyone
  // (browsers answer automatically); drop anyone silent too long.
  const reaper = setInterval(() => {
    room.reap(idleTimeoutMs);
    for (const ws of wss.clients) ws.ping();
  }, pingEveryMs);
  const timer = setInterval(() => room.tick(), 1000 / RULES.net.tickHz);

  const ready = new Promise((resolve) => wss.on('listening', resolve));
  return {
    world,
    room,
    ready,
    get port() { return wss.address().port; },
    store,
    _wss: wss, // for tests (e.g. simulating dropped connections)
    close: async () => {
      clearInterval(timer); clearInterval(saver); clearInterval(reaper);
      await room.saveAll();
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}

module.exports = { createServer };

if (require.main === module) {
  const env = process.env;
  const port = Number(env.PORT) || 2567;
  const host = env.HOST || '0.0.0.0';
  const file = env.PROFILES || path.join(__dirname, 'data', 'profiles.json');
  const srv = createServer({
    port, host, store: new FileStore(file),
    maxConnections: Number(env.MAX_CONNECTIONS) || 200,
    maxPerIp: Number(env.MAX_PER_IP) || 8,
    allowedOrigins: env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : null,
    trustProxy: env.TRUST_PROXY === '1',
  });
  srv.ready.then(() => console.log(`Nightshift City Online server on ws://${host}:${srv.port} · test page http://localhost:${srv.port}/`));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => srv.close().then(() => process.exit(0)));
}
