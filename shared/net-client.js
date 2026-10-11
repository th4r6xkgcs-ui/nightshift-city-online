// Nightshift City Online — drop-in network client (browser + Node).
//
// Handles: connect, resume token, auto-reconnect, input sending, client-side
// prediction of your own player (instant response to the stick), correction
// toward the server using input acks, smooth interpolation of other players,
// and one-call helpers for every action. Rendering stays in the game.
//
// Browser: load shared/rules.js, protocol.js, city.js (and the client's
// city-data.js if present), movement.js, then this file. Global: NightshiftNet.
//
//   const net = NightshiftNet.createClient({ url: 'wss://host', name: 'Ana',
//     token: localStorage.getItem('nsco-token'),
//     onWelcome: (w) => localStorage.setItem('nsco-token', w.token) });
//   // every frame:
//   net.setInput({ mx, my, aim, sprint });
//   const view = net.update(dtMs);   // view.me.x/y predicted, view.others smoothed
(function (root) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const RULES = node ? require('./rules.js') : root.NightshiftRules;
  const { VERSION, C, S } = node ? require('./protocol.js') : root.NightshiftProtocol;
  const CITY = node ? require('./city.js') : root.NightshiftCity;
  const MOVE = node ? require('./movement.js') : root.NightshiftOnlineMovement;

  const SNAP_ERROR_PX = 80;     // farther than this from the server: jump, don't glide
  const CORRECTION = 0.3;       // fraction of the remaining error fixed per server update
  const MIN_INPUT_MS = 50;      // at most 20 input messages/s while the stick moves
  const HEARTBEAT_MS = 250;     // keep-alive resend when nothing changes
  const MAX_HISTORY = 120;      // predicted frames kept for reconciliation

  function createClient(opts) {
    const o = {
      interpDelayMs: 100, reconnect: true, now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      WebSocket: root.WebSocket, city: null, ...opts,
    };
    if (!o.url || !o.name) throw new Error('url and name are required');
    const city = o.city || CITY.createCity();
    const emit = (fn, arg) => { if (typeof fn === 'function') { try { fn(arg); } catch (e) { setTimeout(() => { throw e; }); } } };

    let ws = null, status = 'connecting', closedByUser = false, retryMs = 500, retryTimer = null;
    let id = null, token = o.token || null, me = null, pos = null;
    let input = { mx: 0, my: 0, aim: 0, sprint: false }, seq = 0, lastKey = '', lastSentAt = -1e9;
    let history = []; // [{seq, dx, dy}] predicted movement not yet confirmed by the server
    let nextFireAt = 0, txN = 0;
    const others = new Map(); // id -> {name, pvp, hp, dead, aim, snaps:[{t,x,y}]}
    let bags = [];

    const setStatus = (s) => { if (s !== status) { status = s; emit(o.onStatus, s); } };
    const send = (m) => { if (ws && ws.readyState === 1 && id) { ws.send(JSON.stringify(m)); return true; } return false; };
    const tx = () => 'c' + Date.now().toString(36) + (txN++).toString(36);

    function connect() {
      clearTimeout(retryTimer);
      setStatus('connecting');
      const sock = new o.WebSocket(o.url);
      ws = sock;
      sock.onopen = () => {
        const hello = { t: C.HELLO, name: o.name, v: VERSION };
        if (token) hello.token = token;
        sock.send(JSON.stringify(hello));
      };
      sock.onmessage = (e) => { if (ws === sock) receive(JSON.parse(typeof e.data === 'string' ? e.data : String(e.data))); };
      sock.onclose = (e) => {
        if (ws !== sock) return;
        id = null;
        if (e.code === 4004) return setStatus('replaced');         // signed in on another device
        if (e.code === 4002) return setStatus('rejected');          // bad hello / version
        setStatus('offline');
        if (o.reconnect && !closedByUser) {
          retryTimer = setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 5000);
        }
      };
      sock.onerror = () => {};
    }

    function receive(m) {
      if (m.t === S.WELCOME) {
        id = m.id; token = m.token; me = m.you; pos = { x: me.x, y: me.y };
        history = []; lastKey = ''; retryMs = 500; others.clear();
        setStatus('online');
        emit(o.onWelcome, m);
      } else if (m.t === S.STATE) {
        reconcile(m.you);
        const t = o.now(), seen = new Set();
        for (const p of m.others) {
          seen.add(p.id);
          let rec = others.get(p.id);
          if (!rec) { rec = { snaps: [] }; others.set(p.id, rec); }
          Object.assign(rec, { id: p.id, name: p.name, pvp: p.pvp, hp: p.hp, dead: p.dead, aim: p.aim });
          rec.snaps.push({ t, x: p.x, y: p.y });
          if (rec.snaps.length > 12) rec.snaps.shift();
        }
        for (const k of others.keys()) if (!seen.has(k)) others.delete(k);
        bags = m.bags;
        emit(o.onState, m);
      } else if (m.t === S.RESULT) emit(o.onResult, m);
      else if (m.t === S.EVENT) emit(o.onEvent, m);
      else if (m.t === S.ERROR) emit(o.onError, m);
    }

    // Server position + movement we predicted after the input it last saw.
    function reconcile(you) {
      me = you;
      if (!pos || you.dead) { pos = { x: you.x, y: you.y }; history = []; return; }
      history = history.filter((h) => h.seq > you.ack);
      let tx_ = you.x, ty = you.y;
      for (const h of history) { tx_ += h.dx; ty += h.dy; }
      const ex = tx_ - pos.x, ey = ty - pos.y, err = Math.hypot(ex, ey);
      if (err > SNAP_ERROR_PX) { pos = { x: you.x, y: you.y }; history = []; }
      else if (err > 0.25) {
        const nx = pos.x + ex * CORRECTION, ny = pos.y + ey * CORRECTION;
        if (!city.blocked(nx, ny)) pos = { x: nx, y: ny };
        else pos = { x: you.x, y: you.y };
      }
    }

    function sendInput(t) {
      const key = [input.mx.toFixed(2), input.my.toFixed(2), input.aim.toFixed(2), input.sprint].join();
      const since = t - lastSentAt;
      if (key === lastKey ? since < HEARTBEAT_MS : since < MIN_INPUT_MS) return;
      if (send({ t: C.INPUT, seq: seq + 1, mx: input.mx, my: input.my, aim: input.aim, sprint: input.sprint })) {
        seq++; lastKey = key; lastSentAt = t;
      }
    }

    function interpolated(rec, t) {
      const s = rec.snaps;
      if (s.length === 1) return { x: s[0].x, y: s[0].y };
      for (let i = s.length - 1; i > 0; i--) {
        const a = s[i - 1], b = s[i];
        if (t >= a.t) {
          if (t >= b.t) return { x: b.x, y: b.y };
          const k = (t - a.t) / Math.max(1, b.t - a.t);
          return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        }
      }
      return { x: s[0].x, y: s[0].y };
    }

    const api = {
      get status() { return status; },
      get id() { return id; },
      get token() { return token; },

      setInput(next) {
        const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
        input = {
          mx: Math.max(-1, Math.min(1, num(next.mx, 0))), my: Math.max(-1, Math.min(1, num(next.my, 0))),
          aim: num(next.aim, input.aim), sprint: !!next.sprint,
        };
      },

      // Call once per frame. Returns what to draw.
      update(dtMs) {
        const t = o.now();
        if (id) {
          sendInput(t);
          if (me && pos && !me.dead) {
            const next = MOVE.step(pos, input, dtMs, city, RULES);
            history.push({ seq, dx: next.x - pos.x, dy: next.y - pos.y });
            if (history.length > MAX_HISTORY) history.shift();
            pos = next;
          }
        }
        return api.view();
      },

      view() {
        const rt = o.now() - o.interpDelayMs;
        const list = [];
        for (const rec of others.values()) {
          const p = interpolated(rec, rt);
          list.push({ id: rec.id, name: rec.name, x: p.x, y: p.y, aim: rec.aim, hp: rec.hp, dead: rec.dead, pvp: rec.pvp });
        }
        return {
          status, me: me && pos ? { ...me, x: pos.x, y: pos.y, aim: input.aim, serverX: me.x, serverY: me.y } : null,
          others: list, bags,
        };
      },

      // Actions. Money actions return their transaction id (or null if offline).
      fire(aim = input.aim) {
        const t = o.now();
        if (t < nextFireAt) return false;
        if (!send({ t: C.FIRE, aim })) return false;
        nextFireAt = t + RULES.combat.fireIntervalMs;
        return true;
      },
      reload: () => send({ t: C.RELOAD }),
      use: (item) => send({ t: C.USE, item }),
      pickup: (bag) => send({ t: C.PICKUP, bag }),
      setPvp: (on) => send({ t: C.PVP, on: !!on }),
      buy(item) { const x = tx(); return send({ t: C.BUY, item, tx: x }) ? x : null; },
      sell(item) { const x = tx(); return send({ t: C.SELL, item, tx: x }) ? x : null; },
      give(to, cash) { const x = tx(); return send({ t: C.GIVE, to, cash, tx: x }) ? x : null; },
      buyHome() { const x = tx(); return send({ t: C.HOME, tx: x }) ? x : null; },
      stash(dir, item, count) { const x = tx(); return send({ t: C.STASH, dir, item, count, tx: x }) ? x : null; },
      // Resend a money action after a disconnect with the SAME tx: never double-charges.
      retry: (msg) => send(msg),

      close() {
        closedByUser = true; clearTimeout(retryTimer);
        const sock = ws; ws = null; id = null; // nothing is sent after close()
        if (sock) sock.close(1000, 'bye');
        setStatus('closed');
      },
    };
    connect();
    return api;
  }

  const api = Object.freeze({ createClient });
  if (node) module.exports = api;
  else root.NightshiftNet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
