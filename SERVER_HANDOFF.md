# SERVER HANDOFF — Claude-owned backend (read this, Codex)

Separate file on purpose so Claude and Codex never edit the same handoff at the
same time. Codex: please don't edit `server/`, `shared/` or this file; comment
on PR #3 instead. Claude doesn't edit client files (including `city-data.js`).

## CURRENT — server v0.7 (2026-10-11, branch `claude/server-scaffold`, PR #3)

### New in v0.7: online jobs, chat, live testing
- **Online delivery jobs** (`job {action: start|pickup|deliver|cancel, tx}`): the server picks a pickup and dropoff among layout entrances at least 500px apart, and pays $150 + $0.15/px (max $450).
  - 60px proximity checks, a 5-minute limit, and a 15 s cooldown (5 s after a cancel or failure).
  - Dying or running out of time voids the job, and the parcel isn't dropped for others.
  - `you.job` and `you.stats {deliveries, earned}` persist. A restored reward is recomputed from the route.
  - This is server-native online work, **not** a copy of your courier routes. Your route data is still welcome if you want the online jobs to use your authored routes instead.
- **Chat** (`chat {ch: near|city, text}`, server sends `chat {from, name, ch, text}`): near = within 600px, city = everyone. Burst of 3, then about 1/s. The server cleans text: control and bidi-override characters stripped, links replaced with `[link]`, 120-character cap. `mute {id, on}` hides one player's chat for you only. **Render chat with textContent**, never innerHTML.
- `net-client` has `job(action)`, `chat(ch, text)`, `mute(id, on)` and `onChat`.
- **Live smoke test:** `node server/scripts/smoke-live.cjs <url>` runs 12 checks with two bots. The `live-smoke.yml` workflow runs it against `worker/LIVE_URL` after each push, once that file exists.
- **Test page fixes found by browser checks:** a button covered the player in small landscape, and in portrait the button column covered the player. Fixed and re-verified on 4 sizes, including a test that nothing interactive covers the player.
- `npm test`: 81 pass, 1 skipped. GitHub CI is green.
- **Cloudflare:** waiting for the owner to connect the repo (Workers Builds). The Worker isn't deployed yet.

## v0.6 (2026-10-11)

### New in v0.6: Cloudflare hosting (owner approved Cloudflare, free plan)
- `worker/` is the Cloudflare host. It has a Worker front door (test page, shared scripts, `/healthz`, WebSocket routing) and one `GameRoom` Durable Object holding the whole city. That object runs the **same** `server/room.js` and `server/sim.js` as the Node server.
- **Profiles:** stored in SQLite-backed Durable Object storage (the free plan's kind), keyed by the SHA-256 of the resume token. Unchanged profiles aren't rewritten, to save free-plan writes.
- **Limits** come from `vars`: `MAX_CONNECTIONS`, `MAX_PER_IP` (uses `CF-Connecting-IP`), and optional `ALLOWED_ORIGINS`. Workers can't send ping frames, so silence means at least 30 s without input or keep-alive (the client sends one every ≤250 ms).
- **Deploy:** Workers Builds from GitHub.
  - Worker name: `nightshift-city-online`
  - Root directory: `worker`
  - Deploy command: `npx wrangler deploy`
  - Branch: `claude/server-scaffold` until it merges, then `main`
  - `node build.cjs` runs automatically first. It packs the page and shared scripts, plus `city-data.js` once that's in the branch.
- The client's `net-client` WebSocket URL becomes `wss://nightshift-city-online.<account-subdomain>.workers.dev/`. I'll post the exact URL once it's live.
- `server/room.js` now holds all connection rules for both hosts. `server/index.js` is just the Node transport.
- **Fix in net-client:** input is capped at 20/s with a 250 ms keep-alive. Before, moving the stick every frame sent 60/s, which could trip the server's rate limit and burn the free quota.
- **Verified:** `npm test` gives 69 pass, 1 skipped. A fake Workers runtime (socket pairs, `Response.webSocket`, Durable Object storage) is driven by the real `net-client`, against both the source and an **esbuild bundle** built like Wrangler's: two players, movement, resume after an object restart, limits, origin lock, static routes.
  - Not yet run on real Cloudflare: that happens on first deploy.

## v0.5 (2026-10-11)

### New in v0.5: ready for public hosting (still NOT deployed)
- **No ghost players:** the server pings every 10 s and drops sockets silent for 30 s. Phones that lose signal often send no close frame. Browsers answer pings automatically.
- **Fixed a leak:** Node's HTTP server keeps half-open sockets, so an abrupt client disconnect never fired `close`. The player and their connection slot lingered until the idle timeout. Now the socket is destroyed when the client's side ends.
- **Limits, checked before the handshake:**
  - Total connections (`MAX_CONNECTIONS`, default 200) → 503
  - Per IP (`MAX_PER_IP`, default 8, since a household or carrier NAT can share one IP) → 429
  - Optional origin allowlist (`ALLOWED_ORIGINS`, comma-separated) → 403
  - Behind a host's proxy, set `TRUST_PROXY=1` so limits use `X-Forwarded-For`.
- **Container recipe:** `docker build -f server/Dockerfile -t nightshift-server .` from the repo root. It uses node:22-alpine, runs as non-root, keeps profiles on a `/data` volume, has a `/healthz` healthcheck, and needs no npm install. The Docker daemon isn't available in Claude's workspace, so **the image hasn't been built**. Instead, the exact allowlisted file set was assembled and run: healthz OK, page 200, `city-data.js` picked up, and SIGTERM saved profiles.
- `npm test`: **59 pass, 1 skipped**.

## v0.4 (2026-10-11)

### New in v0.4: drop-in network client for the game
**`shared/net-client.js` (global `NightshiftNet`)** is the recommended way for the real game to go online. It does the hard parts so `net.js` can stay small:
- Connect, keep the resume token, and auto-reconnect with backoff (500 ms up to 5 s). Status goes to `onStatus`: connecting / online / offline / replaced / rejected / closed.
- **Prediction:** your player moves the same frame the stick moves, using `shared/movement.js`. That is the exact movement code the server runs, walls included. When server updates arrive, the client corrects toward server position plus not-yet-acknowledged movement: 30% of the gap per update, or an instant jump if the gap is over 80px (death, respawn, teleport).
- **Interpolation:** other players render 100 ms in the past, blended between server updates, so they glide instead of stepping 20×/s.
- Action helpers: `fire` (with a local cadence guard), `reload`, `use`, `pickup`, `setPvp`, `buy`, `sell`, `give`, `buyHome`, `stash`. Money actions return their `tx` id, and `retry(msg)` resends with the same id after a drop.

Minimal use (browser; load `shared/rules.js`, `protocol.js`, `city.js`, `movement.js`, `net-client.js` after your own `city-data.js`):
```js
const net = NightshiftNet.createClient({ url: 'wss://HOST', name,
  token: localStorage.getItem('nsco-token'),
  onWelcome: (w) => localStorage.setItem('nsco-token', w.token),
  onResult: (r) => { if (!r.ok) say(r.reason); }, onEvent, onStatus });
// each frame:
net.setInput({ mx, my, aim, sprint }); if (firing) net.fire(aim);
const view = net.update(dtMs); // view.me (predicted x/y + server stats), view.others (smoothed), view.bags
```
**Global names:** mine are `NightshiftRules`, `NightshiftProtocol`, `NightshiftCity`, `NightshiftOnlineMovement` and `NightshiftNet`. I avoided `NightshiftMovement` because that's your stamina module, and a test checks I never set it.

**Verified:** `npm test` gives 53 pass, 1 skipped. That includes 6 tests through a simulated **150 ms each-way** connection (stable 3/3 runs):
- Local movement is visible before the server has even received the input.
- After stopping, the client agrees with the server within 3px.
- The predicted position is never inside a building.
- Server teleports snap correctly.
- Other players' largest per-frame jump is under 7px, versus 9px raw ticks, and they never move backwards.
- A dropped connection reconnects to the same character.

The test page now runs on this library. Browser checks pass on 4 screen sizes with no errors.

### v0.3
- **Apartment:** `home {tx}` buys the $1,200 starter apartment while standing inside `layout.apartment.radius`. Once per character, idempotent.
- **Home stash:** `stash {dir:'in'|'out', item, count, tx}` moves things between pockets and home, matching client limits: cash up to 100M, spare ammo up to 270 (never the loaded magazine, not while reloading), items up to 999. Owner only, at home only, and every check runs before anything changes.
  - The stash survives death, is saved in the profile, is re-clamped on restore, and other players never see it.
  - `you.home = {owned, stash}` arrives in `welcome` and `state`.
  - Cash-conservation tests now count stash cash too.
- **Starter pocket** now matches a fresh client save: 2 scrap, 1 watch, 1 pistol.
- The new messages are additive, so the protocol stays **v1**.
- **Fix:** the v0.2 test page called `createCity(w, h)` after the layout refactor and failed to boot. Fixed, and a new test now boots the page's script in a browser-like sandbox. I confirmed that test fails on the old bug.
- **Verified:**
  - `npm test`: 47 pass, 1 skipped; 48/48 with `city-data.js` present.
  - Headless Chromium on 4 screen sizes (844×390, 390×844, 667×375, 1100×700): no control overlap, nothing under the HUD, and no console errors.
  - Two players see each other, two-thumb move+fire works, and a page reload resumes the same character.

## v0.2 (2026-10-11)

**Status:** local, dependency-free Node server running one authoritative
shared world over WebSocket, plus a bare test page. **Not deployed. Not wired
into the real game client.** The real game is still single-player.

### New since v0.1
- **City catalog (Codex contract v1):** `shared/city.js` uses the client's
  `city-data.js` `layout()` whenever that file exists, so there is no copied
  map. Until the client branch merges, a built-in copy of layout v1 is used,
  and `server/tests/city.test.cjs` fails if it ever differs from `city-data.js`.
  Verified against `codex/city-traffic-v19`: the layouts are exactly equal, and the server reports source `city-data.js`.
- **Walls:** server movement slides along buildings using `buildingPadding`.
- **Bullet cover:** buildings stop hitscan shots.
- **Clinic safe zone:** no PvP damage to or from anyone inside `clinic.radius`. (The client's "no protection while wanted" rule isn't on the server, because wanted heat isn't server-side yet.)
- **Shop range:** buy/sell only within 120px of a CORNER SHOP `entrance`.
- **Profiles and reconnect:** `welcome` returns a `token`. `hello {token}` restores cash, hp, ammo, items, position and PvP choice. If the same character signs in twice, the newer session wins and the old one is closed with code 4004. Saved in one JSON file (`server/data/profiles.json`, gitignored) with atomic writes. Tokens are stored only as SHA-256 hashes. A corrupt file is kept aside, never overwritten. Restored values are re-clamped to the game rules. No database and no paid service.
- **Test page:** `npm start`, then open `http://localhost:2567/`. Two tabs or two devices on the same Wi-Fi see each other. It has twin sticks plus RELOAD/PVP/LOOT/MEDKIT/BUY buttons. **This is not the game client**, only a way to exercise the server. The server serves only an allowlist (the page and the three shared scripts) plus `/healthz`.

### Verified
- `cd server && npm test`: **36 pass, 0 fail, 1 skipped** (the drift guard skips because `city-data.js` isn't on this branch). With Codex's `city-data.js` present: **37/37 pass**.
- Real headless Chromium:
  - A desktop player and an emulated iPhone 13 in landscape see each other's server positions. Walking speed is 180 px/s as specified.
  - Two-thumb touch (move and fire at once) works, and firing stops when the thumb lifts.
  - Reloading the page resumes the same character.
  - No console errors.
  - Controls don't overlap in landscape (844×390), portrait (390×844) or desktop.
- Bugs found and fixed by those runs: the join overlay blocked touches after joining, and the button column covered the aim stick in landscape.

### Load test (local, one process running the server plus all bots)
Bots walk randomly and fire 3×/s for 8 seconds.

| Bots | CPU | Snapshot interval p50 / p99 (target 50 ms) | Largest snapshot | Memory |
| --- | --- | --- | --- | --- |
| 30 | 12% of one core | 50 / 55 ms | 3.4 KB | 82 MB |
| 100 | 48% of one core | 50 / 60 ms | 10.9 KB | 130 MB |

A single small instance is plenty for early testing. Watch-out: when everyone crowds into one spot, each player receives about 220 KB/s at 100 players. Delta or binary snapshots would fix that if we ever get there.

## File map
| Path | What |
| --- | --- |
| `shared/rules.js` | Server-enforced numbers mirroring client v0.17 |
| `shared/protocol.js` | Protocol v1 message types and validation |
| `shared/city.js` | City geometry from `city-data.js` layout v1 (or the built-in copy) |
| `server/sim.js` | Authoritative world: movement, combat, death bags, shop, gifts, PvP, profiles |
| `server/index.js` | WebSocket room, handshake/resume, rate limits, snapshots, static allowlist |
| `server/ws-lite.js` | Minimal RFC 6455 server on Node stdlib (npm is blocked in Claude's workspace) |
| `server/store.js` | MemoryStore / FileStore |
| `server/public/play.html` | Server test page (not the game) |
| `server/tests/*.test.cjs` | rules, city, persistence, HTTP and real two-client WebSocket tests |

## Protocol v1
Client → server:
```
hello  {name, v:1, token?}               first message; token resumes a saved character
input  {seq, mx, my, aim, sprint}        on change or ~10-20/s; seq strictly increasing
fire   {aim}      reload {}
buy    {item: ammo|med|pistol|medkit, tx}    sell {item: scrap|watch|jewelry, tx}
use    {item: medkit}   pickup {bag}   give {to, cash, tx}   pvp {on}   ping {at}
```
Server → client:
- `welcome {id, v, rules, you, token, resumed}`
- `state {tick, you, others, bags}` at 20 Hz (`you.ack` is the last processed input `seq`)
- `result {req, ok, reason?, ...}`
- `event {kind: hit|death|respawn|received}`
- `error {reason}`
- `pong`

Close codes: 4001 hello timeout, 4002 bad hello, 4003 too many bad messages, 4004 signed in elsewhere.

## For Codex: client integration (your files, your call)
`server/public/play.html` is a working reference for every message above, about 250 lines.
1. Optional `net.js` behind a flag (e.g. `?online=ws://host:2567`); offline single-player stays the default.
2. Keep the resume `token` per device (`play.html` uses `sessionStorage` per tab so two test tabs stay separate players; the real game probably wants `localStorage`).
3. Send `input` from the existing sticks. Render `others` from `state`. Predict the local player and correct toward `you` using `ack`.
4. When online, route shop/medkit/loot/fire through the server and show `result.reason` in the existing toast.

## Not done (honest list)
- Vehicles, NPCs, police, traffic, courier jobs, crafting, apartments, salvage and heat are client-only. Per Codex's PR #4 note, local traffic and client gameplay are deliberately **not** copied into the server.
- No interiors on the server: the shop is checked at its entrance.
- Accounts are anonymous resume tokens, not logins. Losing the token means losing the character.
- **Deployment:** none. A host that supports WebSockets is needed (ChatGPT Sites is static). Owner approval is required before any hosting or paid service.
- `ws-lite` rejects fragmented frames and has no compression. That's fine for small JSON.

## Next (Claude)
Server-side vehicles and courier payouts both need client data, like the city did. Codex, if you agree, please expose them as data:
- **Vehicles:** model IDs, handling, and parked spawn positions with stable IDs.
- **Courier routes:** pickup, dropoff and reward.

Until then the only online money source is starting cash plus selling starter items, which is fine for testing. After that: wanted heat, so the clinic rule can match the client, then a hosting proposal (ask the owner).
