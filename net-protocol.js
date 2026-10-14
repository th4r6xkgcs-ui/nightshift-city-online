/* Multiplayer wire protocol (Claude-owned, v0.66). Pure; shared by the browser client (net.js), the room logic
 * (room-core.js) and both servers (Cloudflare Durable Object + Node dev server).
 * JSON messages over one WebSocket per player. Every message is an array: [type, ...fields] (small + fast).
 *  client -> server
 *    ['hello', protocol, name, look]              look = { car?: 'CX:m4', color?: '#4790e8' }
 *    ['st', t, x, y, angle, zone, flags, car, color]   your state, ~10 Hz. zone: 'city' | 'highway' | 'zone:<id>'
 *                                                  flags: bit0 moving, bit1 in car, bit2 downed, bit3 firing, bit4 teleport
 *    ['hit', packedHitEvent]                       a hit you claim on another player (combat-core pack())
 *    ['chat', text]   ['ping', clientTime]
 *  server -> client
 *    ['welcome', yourId, serverTime, mode, players[]]   players = [id, name, x, y, angle, zone, flags, car, color]
 *    ['snap', serverTime, rows[]]                  rows like players (everyone else, only what changed recently)
 *    ['join', id, name]   ['leave', id]   ['hit', packedHitEvent]   ['deny', reason]   ['chat', id, text]   ['pong', clientTime, serverTime]
 * Interpolation: render remote players ~120 ms in the past between the two snapshots around that time. */
(function (root) {
  'use strict';
  const PROTOCOL = 1, SEND_HZ = 10, SNAP_HZ = 10, DELAY_MS = 120, MAX_PLAYERS = 24, NAME_MAX = 16;
  const FLAG = { moving: 1, car: 2, downed: 4, firing: 8, teleport: 16 }; // teleport: a legit jump (exit, respawn, bus) — server allows one every 5 s
  const ZONE_RE = /^(city|highway|zone:[a-z0-9-]{1,24})$/;
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const r1 = (v) => Math.round(v * 10) / 10;
  function cleanName(s) { const t = String(s ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, NAME_MAX); return t || 'Player'; }
  function cleanColor(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null; }
  function cleanCar(m) { return typeof m === 'string' && /^(CX:[a-z0-9]{1,16}|SEDAN|COMPACT|VAN)$/.test(m) ? m : null; }
  // decode + validate one client message; returns null when malformed (server drops it)
  function parseClient(raw) {
    let m; try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
    if (!Array.isArray(m) || typeof m[0] !== 'string' || (typeof raw === 'string' && raw.length > 2048)) return null;
    switch (m[0]) {
      case 'hello': return { type: 'hello', protocol: m[1] | 0, name: cleanName(m[2]), car: cleanCar(m[3]?.car), color: cleanColor(m[3]?.color) };
      case 'st': { const zone = ZONE_RE.test(m[5]) ? m[5] : 'city'; return { type: 'st', t: num(m[1]), x: r1(num(m[2])), y: r1(num(m[3])), a: Math.round(num(m[4]) * 100) / 100, zone, flags: (m[6] | 0) & 31, car: cleanCar(m[7]), color: cleanColor(m[8]) }; }
      case 'hit': return Array.isArray(m[1]) && m[1].length === 14 ? { type: 'hit', packed: m[1] } : null;
      case 'chat': { const text = String(m[1] ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 140); return text ? { type: 'chat', text } : null; }
      case 'ping': return { type: 'ping', t: num(m[1]) };
      default: return null;
    }
  }
  const enc = (...m) => JSON.stringify(m);
  const row = (p) => [p.id, p.name, r1(p.x), r1(p.y), p.a, p.zone, p.flags, p.car, p.color];
  const unrow = (r) => ({ id: r[0], name: r[1], x: r[2], y: r[3], a: r[4], zone: r[5], flags: r[6], car: r[7], color: r[8] });

  // client-side interpolation buffer per remote player
  function buffer() { return { snaps: [] }; }
  function push(buf, t, s) { buf.snaps.push({ t, ...s }); if (buf.snaps.length > 30) buf.snaps.shift(); }
  const lerpAng = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * f; };
  function sample(buf, t) {
    const S = buf.snaps; if (!S.length) return null;
    if (t <= S[0].t) return { ...S[0] };
    for (let i = 1; i < S.length; i++) { const a = S[i - 1], b = S[i]; if (t <= b.t) { const f = (t - a.t) / Math.max(1, b.t - a.t); return { ...b, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, a: lerpAng(a.a, b.a, f) }; } }
    const z = S[S.length - 1]; const dt = Math.min(250, t - z.t); const prev = S[S.length - 2];
    if (prev && dt > 0) { const vx = (z.x - prev.x) / Math.max(1, z.t - prev.t), vy = (z.y - prev.y) / Math.max(1, z.t - prev.t); return { ...z, x: z.x + vx * dt, y: z.y + vy * dt }; } // short extrapolation
    return { ...z };
  }
  // NTP-style clock offset estimate from a ping: offset = serverTime - (clientSend + rtt/2)
  function clockOffset(clientSend, serverTime, clientRecv) { const rtt = Math.max(0, clientRecv - clientSend); return { rtt, offset: serverTime - (clientSend + rtt / 2) }; }

  const api = Object.freeze({ PROTOCOL, SEND_HZ, SNAP_HZ, DELAY_MS, MAX_PLAYERS, FLAG, cleanName, cleanColor, cleanCar, parseClient, enc, row, unrow, buffer, push, sample, clockOffset });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftNetProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
