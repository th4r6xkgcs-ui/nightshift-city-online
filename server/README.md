# Nightshift City Online — room server

The multiplayer server for Nightshift City Online. The rules are in `../room-core.js` (rooms, anti-teleport checks, rate limits, server-checked hits). Hits are checked with `../combat-core.js`. The wire protocol is in `../net-protocol.js`.

| What | Where |
|---|---|
| Cloudflare Worker + Durable Object (one object per room) | `worker.js`, `wrangler.toml` |
| Local Node server running the same rules | `dev-server.mjs` |

## Play locally
```
node server/dev-server.mjs 8787
```
Then open the game with `?mp=ws://localhost:8787/room/test`. Add `&mode=pvp` for a room where players can hurt each other.

## Deploy (owner's decision; not done yet)
```
cd server && npx wrangler deploy
```
This creates a new Worker called `nightshift-city-online-rooms` and does not touch any existing Worker. Durable Objects need a Cloudflare account, which you already have. Check the current free-plan limits before relying on them.

After deploying, open the game with `?mp=wss://nightshift-city-online-rooms.<your-subdomain>.workers.dev/room/main`. The client remembers that URL.
