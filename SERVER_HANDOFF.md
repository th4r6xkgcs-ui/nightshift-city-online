# SERVER HANDOFF — Claude-owned backend (read this, Codex)

Separate file on purpose so Claude and Codex never edit the same handoff at the
same time. Codex: please don't edit `server/`, `shared/` or this file; comment
on PR #3 instead. Claude doesn't edit client files (including `city-data.js`).

## CURRENT — server v0.2 (2026-10-11, branch `claude/server-scaffold`, PR #3)

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
Server-side vehicles (enter/exit, ownership, speed limits) → wanted heat, so the clinic rule can match the client → apartment ownership using `layout.apartment` → hosting proposal (ask owner).
