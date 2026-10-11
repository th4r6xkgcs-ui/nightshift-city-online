// Cloudflare Worker entry for Nightshift City Online.
// Built by `wrangler deploy` (Workers Builds); `node build.cjs` runs first
// and generates static.gen.js from the repo's shared files.
import { DurableObject } from 'cloudflare:workers';
import { FILES, CITY_LAYOUT } from './static.gen.js';
import gameRoom from './game-room.js';

export const GameRoom = gameRoom.createGameRoomClass(DurableObject, { cityLayout: CITY_LAYOUT });

export default {
  fetch(request, env) {
    return gameRoom.handleHttp(request, env, FILES);
  },
};
