# SERVER HANDOFF — Claude-owned backend (read this, Codex)

Separate file on purpose so Claude and Codex never edit the same handoff at the
same time. Codex: please don't edit `server/`, `shared/` or this file; open an
issue/PR comment instead. Claude won't edit client files.

## CURRENT — v0.1 authoritative server scaffold (2026-10-11, branch `claude/server-scaffold`)

**What exists:** a local, dependency-free Node server that runs an authoritative
shared world for multiple players over WebSocket. **Not deployed. Not yet
connected to the game client.** The game is still single-player until the
client integration below is done.

| Path | What |
| --- | --- |
| `shared/rules.js` | All server-enforced numbers. Mirrors client v0.17 (hp 100, $750 start, 180/300 px/s walk/run, 30 mag, 240 reserve, 270 carried, 1.3s reload, 180ms fire interval, 20 dmg, shop $2/round, first aid $40, pistol $150, medkit $60, sell 15/85/200). Browser-loadable as `NightshiftRules`. |
| `shared/protocol.js` | Message types + validator, protocol v1. Browser-loadable as `NightshiftProtocol`. |
| `server/sim.js` | Pure authoritative world: movement, combat, reload, death/bags/respawn, shop, sell, medkit, cash gifts, PvP opt-in, snapshots. |
| `server/index.js` | WebSocket room: hello handshake, rate limit (60 msg/s), 2 KB message cap, strike/kick, 20 Hz snapshots. |
| `server/ws-lite.js` | Minimal RFC 6455 server on Node stdlib (npm registry is blocked in Claude's workspace; also keeps repo dependency-free). |
| `server/tests/` | 17 rule tests + 4 real two-client WebSocket tests (uses Node's built-in WebSocket client). |
| `.github/workflows/server.yml` | CI for `server/` and `shared/` only. Separate from Codex's `check.yml`. |

**Run:** `cd server && npm start` (ws://0.0.0.0:2567, `PORT`/`HOST` env).
**Test:** `cd server && npm test` → 21/21 pass on Node 22 (run 3× in a row, no flakes).

## Security model
- Client sends **intent only**: stick (-1..1), aim, fire, reload, buy/sell/use/pickup/give/pvp. The server integrates movement itself, so speed and teleport hacks can't work. Extra fields like `cash` are ignored.
- Cash/hp/ammo/inventory live only on the server. Other players see name/position/aim/hp/dead/pvp, never cash or items.
- Money requests carry a client `tx` id; resends return the first result (`replay: true`) and never double-charge or double-pay. Tests prove total world cash is conserved across gifts, deaths and looting.
- PvP is **opt-in**: damage only lands when both shooter and target have `pvp` on.

## Protocol v1 (client → server)
```
hello  {name, v:1}                       first message, required
input  {seq, mx, my, aim, sprint}        send on change or ~20/s; seq strictly increasing
fire   {aim}      reload {}
buy    {item: ammo|med|pistol|medkit, tx}    sell {item: scrap|watch|jewelry, tx}
use    {item: medkit}   pickup {bag}   give {to, cash, tx}   pvp {on}   ping {at}
```
Server → client: `welcome {id, rules, you}`, `state {tick, you, others, bags}` at 20 Hz (`you.ack` = last processed input seq, for reconciliation), `result {req, ok, reason?, ...}`, `event {kind: hit|death|respawn|received}`, `error {reason}`, `pong`.

## For Codex: suggested client integration (your files, your call)
1. Optional `net.js` behind a flag (e.g. `?online=ws://host:2567`), so offline single-player stays the default.
2. Send `input` from the existing stick/keys; render `others` from `state`; draw local player with client prediction and correct toward `you` using `ack`.
3. Route shop/medkit/loot/fire through server messages when online; show `result.reason` in the existing toast.

## Not done yet (honest list)
- **Building collision and bullet cover** on the server: needs the city layout shared. If Codex can expose `world.js` building rects as data (e.g. `shared/city.json` or a pure function), Claude will enforce collision/occlusion server-side.
- **Shop/home/courier proximity** checks: same dependency (service locations).
- Vehicles, NPCs, police, courier jobs, crafting, apartments are still client-only.
- **Persistence/accounts:** players reset on reconnect. Needs a database choice — will ask the owner before adding any paid service.
- **Deployment:** none. A WebSocket host is needed (ChatGPT Sites is static). Owner approval required before any hosting.
- `ws-lite` rejects fragmented frames (browsers don't fragment small JSON); no `permessage-deflate`.

## Next (Claude)
Shared city layout → server collision/occlusion → shop proximity → vehicle authority → persistence design (ask owner) → hosting proposal (ask owner).
