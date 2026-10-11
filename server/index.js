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

function createServer({ port = 2567, host = '127.0.0.1', clock = Date.now, world = new World() } = {}) {
  const N = RULES.net;
  const wss = new WebSocketServer({ port, host, maxPayload: N.maxMsgBytes });
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
        id = randomUUID().slice(0, 8);
        clearTimeout(helloTimer);
        const p = world.addPlayer(id, msg.name, now);
        conns.set(id, ws);
        send(ws, { t: S.WELCOME, id, v: VERSION, rules: RULES, you: world.privateView(p) });
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
      if (id) { world.removePlayer(id); conns.delete(id); }
    });
    ws.on('error', () => {});
  });

  function flush() {
    for (const { to, msg } of world.drain()) {
      const ws = conns.get(to);
      if (ws) send(ws, msg);
    }
  }

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
    close: () => new Promise((resolve) => {
      clearInterval(timer);
      for (const ws of wss.clients) ws.terminate();
      wss.close(() => resolve());
    }),
  };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 2567;
  const host = process.env.HOST || '0.0.0.0';
  const srv = createServer({ port, host });
  srv.ready.then(() => console.log(`Nightshift City Online server on ws://${host}:${srv.port}`));
  process.on('SIGINT', () => srv.close().then(() => process.exit(0)));
}
