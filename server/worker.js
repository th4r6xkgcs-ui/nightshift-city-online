/* Nightshift City Online — room server for Cloudflare Workers (Claude-owned, v0.66).
 * One Durable Object per room name: wss://<worker>/room/<name>[?mode=pvp]. Game rules live in ../room-core.js
 * (shared with the Node dev server and the tests), hits are checked with ../combat-core.js.
 * NOT deployed yet: deploying is the owner's call (see server/README.md). */
import '../net-protocol.js';
import '../combat-core.js';
import '../room-core.js';

const { Room } = globalThis.NightshiftRoomCore;

export class NightshiftRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.room = null; this.socks = new Map(); this.timer = null; }
  send(out) {
    for (const o of out) {
      if (o.to === 'all' || o.to === 'others') { for (const [id, ws] of this.socks) if (!(o.to === 'others' && id === o.except)) try { ws.send(o.data); } catch { /* closed */ } }
      else { const ws = this.socks.get(o.to); if (ws) try { ws.send(o.data); } catch { /* closed */ } }
    }
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const url = new URL(req.url);
    if (!this.room) this.room = new Room({ mode: url.searchParams.get('mode') === 'pvp' ? 'pvp' : 'pve' });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const id = crypto.randomUUID().slice(0, 8);
    let joined = false;
    server.addEventListener('message', (e) => {
      const now = Date.now();
      if (!joined) { joined = true; this.socks.set(id, server); let hello = null; try { const m = JSON.parse(e.data); if (Array.isArray(m) && m[0] === 'hello') hello = { name: m[2], car: m[3]?.car, color: m[3]?.color }; } catch { /* bad hello */ } this.send(this.room.join(id, hello, now)); return; }
      this.send(this.room.message(id, e.data, now));
    });
    const bye = () => { if (this.socks.delete(id)) this.send(this.room.leave(id)); if (!this.socks.size && this.timer) { clearInterval(this.timer); this.timer = null; } };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => this.send(this.room.tick(Date.now())), 100);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    const m = /^\/room\/([a-z0-9-]{1,32})$/i.exec(url.pathname);
    if (!m) return new Response('Nightshift City Online rooms · connect to /room/<name>', { status: 404 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1].toLowerCase())).fetch(req);
  },
};
