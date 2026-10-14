// Local room server (Node + ws) running the same room-core.js as the Cloudflare Worker.
// Run:  node server/dev-server.mjs [port]   then open the game with ?mp=ws://localhost:8787/room/test
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let WebSocketServer;
try { ({ WebSocketServer } = require('ws')); } catch { ({ WebSocketServer } = require(process.env.WS_PATH || '/opt/npm-tools/node_modules/ws')); }
const { Room } = require('../room-core.js');
const port = Number(process.argv[2]) || 8787;
const rooms = new Map();
const server = http.createServer((req, res) => { res.writeHead(req.url === '/health' ? 200 : 404); res.end(req.url === '/health' ? 'ok' : 'connect to /room/<name>'); });
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, sock, head) => {
  const url = new URL(req.url, 'http://x'), m = /^\/room\/([a-z0-9-]{1,32})$/i.exec(url.pathname);
  if (!m) { sock.destroy(); return; }
  const name = m[1].toLowerCase();
  let R = rooms.get(name); if (!R) { R = { room: new Room({ mode: url.searchParams.get('mode') === 'pvp' ? 'pvp' : 'pve' }), socks: new Map() }; rooms.set(name, R); R.timer = setInterval(() => send(R, R.room.tick(Date.now())), 100); }
  wss.handleUpgrade(req, sock, head, (ws) => {
    const id = Math.random().toString(36).slice(2, 10); let joined = false;
    ws.on('message', (data) => { const s = String(data), now = Date.now(); if (!joined) { joined = true; R.socks.set(id, ws); let hello = null; try { const m2 = JSON.parse(s); if (m2[0] === 'hello') hello = { name: m2[2], car: m2[3]?.car, color: m2[3]?.color }; } catch { /* bad */ } send(R, R.room.join(id, hello, now)); return; } send(R, R.room.message(id, s, now)); });
    ws.on('close', () => { if (R.socks.delete(id)) send(R, R.room.leave(id)); });
  });
});
function send(R, out) { for (const o of out) { if (o.to === 'all' || o.to === 'others') { for (const [id, ws] of R.socks) if (!(o.to === 'others' && id === o.except)) ws.send(o.data); } else R.socks.get(o.to)?.send(o.data); } }
server.listen(port, () => console.log(`Nightshift rooms on ws://localhost:${port}/room/<name>`));
