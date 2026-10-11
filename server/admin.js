'use strict';
// Authenticated admin/stats HTTP handling shared by the Node and Cloudflare hosts.
// Admin is OFF unless an ADMIN_KEY (min 16 chars) is configured.

function sameKey(a, b) { // constant-time string compare
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// Returns { status, body } or null when the path isn't /admin or /stats.
async function handleAdmin({ method, path, authorization, bodyText }, room, adminKey) {
  if (path === '/stats' && method === 'GET') return { status: 200, body: room.stats() };
  if (path !== '/admin') return null;
  if (!adminKey || String(adminKey).length < 16) return { status: 404, body: { ok: false, reason: 'not found' } };
  if (method !== 'POST') return { status: 405, body: { ok: false, reason: 'use POST' } };
  const m = /^Bearer (.+)$/.exec(authorization || '');
  if (!m || !sameKey(m[1], adminKey)) return { status: 401, body: { ok: false, reason: 'unauthorized' } };
  let cmd;
  try { cmd = JSON.parse(bodyText || '{}'); } catch { return { status: 400, body: { ok: false, reason: 'bad json' } }; }
  return { status: 200, body: await room.admin(cmd) };
}

module.exports = { handleAdmin, sameKey };
