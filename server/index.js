'use strict';
// WebSocket room for Nightshift City Online.
// Transport only: parsing, handshake, rate limits, broadcasting.
// All game decisions live in sim.js.
//
// Run:  cd server && npm start      (PORT env, default 2567; no dependencies)

const { WebSocketServer } = require('./ws-lite.js');
const { randomUUID } = require('node:crypto');
const RULES = require('../shared/rules.js');
const { VERSION, C, S, validate } = require('../shared/protocol.js');
const { World } = require('./sim.js');
const { MemoryStore, FileStore, newToken, isToken } = require('./store.js');
const fs = require('node:fs');
const path = require('node:path');

// Static files the server will serve: a fixed allowlist, nothing else.
const STATIC = {
  '/': ['public/play.html', 'text/html; charset=utf-8'],
  '/play': ['public/play.html', 'text/html; charset=utf-8'],
  '/shared/rules.js': ['../shared/rules.js', 'text/javascript; charset=utf-8'],
  '/shared/protocol.js': ['../shared/protocol.js', 'text/javascript; charset=utf-8'],
  '/shared/city.js': ['../shared/city.js', 'text/javascript; charset=utf-8'],
};
function serveStatic(req, res) {
  const url = (req.url || '/').split('?')[0];
  const hit = req.method === 'GET' || req.method === 'HEAD' ? STATIC[url] : null;
  const headers = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' };
  if (url === '/healthz') { res.writeHead(200, { ...headers, 'content-type': 'text/plain' }); return res.end('ok\n'); }
  if (!hit) { res.writeHead(404, { ...headers, 'content-type': 'text/plain' }); return res.end('not found\n'); }
  fs.readFile(path.join(__dirname, hit[0]), (err, body) => {
    if (err) { res.writeHead(500, headers); return res.end(); }
    res.writeHead(200, { ...headers, 'content-type': hit[1], 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}

function createServer({ port = 2567, host = '127.0.0.1', clock = Date.now, world = new World(), store = new MemoryStore(), saveEveryMs = 10000 } = {}) {
  const N = RULES.net;
  const tokens = new Map(); // playerId -> token
  const online = new Map(); // token -> playerId (one session per character)
  const persist = (pid) => { const t = tokens.get(pid); const prof = world.exportProfile(pid); if (t && prof) store.save(t, prof); };
  const wss = new WebSocketServer({ port, host, maxPayload: N.maxMsgBytes, onRequest: serveStatic });
  const conns = new Map(); // playerId -> ws
  let last = clock();

  const send = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };

  wss.on('connection', (ws) => {
    let id = null;
    let strikes = 0;
    let bucket = N.maxMsgsPerSec, bucketAt = clock();
    const helloTimer = setTimeout(() => { if (!id) ws.close(4001, 'hello timeout'); }, 5000);

    const strike = (reason) => {
      send(ws, { t: S.ERROR, reason });
      if (++strikes >= N.maxStrikes) ws.close(4003, 'too many bad messages');
    };

    ws.on('message', (data, isBinary) => {
      const now = clock();
      bucket = Math.min(N.maxMsgsPerSec, bucket + ((now - bucketAt) / 1000) * N.maxMsgsPerSec);
      bucketAt = now;
      if (bucket < 1) return strike('rate limited');
      bucket -= 1;
      if (isBinary) return strike('binary not supported');

      let msg;
      try { msg = JSON.parse(data.toString('utf8')); } catch { return strike('bad json'); }

      if (!id) {
        if (msg?.t !== C.HELLO) return strike('say hello first');
        const bad = validate(msg);
        if (bad) { send(ws, { t: S.ERROR, reason: bad }); return ws.close(4002, bad); }
        let token = isToken(msg.token) ? msg.token : null;
        const saved = token ? store.load(token) : null;
        if (!saved) token = newToken();
        const prior = online.get(token);
        if (prior) { // same character signed in again: newest session wins
          persist(prior);
          const old = conns.get(prior);
          world.removePlayer(prior); conns.delete(prior); tokens.delete(prior);
          if (old) old.close(4004, 'signed in elsewhere');
        }
        id = randomUUID().slice(0, 8);
        clearTimeout(helloTimer);
        const p = world.addPlayer(id, msg.name, now, saved);
        conns.set(id, ws);
        tokens.set(id, token);
        online.set(token, id);
        persist(id);
        send(ws, { t: S.WELCOME, id, v: VERSION, rules: RULES, you: world.privateView(p), token, resumed: !!saved });
        return;
      }

      if (msg?.t === C.PING) {
        const bad = validate(msg);
        return bad ? strike(bad) : send(ws, { t: S.PONG, at: msg.at, now });
      }

      const result = world.handle(id, msg, now);
      if (result.strike) return strike(result.reason);
      if (!result.quiet) send(ws, { t: S.RESULT, req: msg.t, ...result });
      flush();
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (id && conns.get(id) === ws) {
        persist(id);
        const t = tokens.get(id);
        if (online.get(t) === id) online.delete(t);
        world.removePlayer(id); conns.delete(id); tokens.delete(id);
      }
    });
    ws.on('error', () => {});
  });

  function flush() {
    for (const { to, msg } of world.drain()) {
      const ws = conns.get(to);
      if (ws) send(ws, msg);
    }
  }

  const saver = setInterval(() => { for (const pid of conns.keys()) persist(pid); }, saveEveryMs);

  const timer = setInterval(() => {
    const now = clock();
    world.step(now - last, now);
    last = now;
    flush();
    for (const [pid, ws] of conns) send(ws, world.snapshotFor(pid));
  }, 1000 / N.tickHz);

  const ready = new Promise((resolve) => wss.on('listening', resolve));
  return {
    world,
    ready,
    get port() { return wss.address().port; },
    store,
    close: () => new Promise((resolve) => {
      for (const pid of conns.keys()) persist(pid);
      store.flush();
      clearInterval(timer);
      clearInterval(saver);
      for (const ws of wss.clients) ws.terminate();
      wss.close(() => resolve());
    }),
  };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 2567;
  const host = process.env.HOST || '0.0.0.0';
  const file = process.env.PROFILES || require('node:path').join(__dirname, 'data', 'profiles.json');
  const srv = createServer({ port, host, store: new FileStore(file) });
  srv.ready.then(() => console.log(`Nightshift City Online server on ws://${host}:${srv.port} · test page http://localhost:${srv.port}/`));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => srv.close().then(() => process.exit(0)));
}
