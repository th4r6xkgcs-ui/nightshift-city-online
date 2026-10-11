'use strict';
// The only files the game server serves over HTTP (Node and Cloudflare).
// Paths are relative to server/.
const JS = 'text/javascript; charset=utf-8';
const STATIC = {
  '/': { file: 'public/play.html', type: 'text/html; charset=utf-8' },
  '/play': { file: 'public/play.html', type: 'text/html; charset=utf-8' },
  '/test': { file: 'public/play.html', type: 'text/html; charset=utf-8' },
  '/shared/rules.js': { file: '../shared/rules.js', type: JS },
  '/shared/protocol.js': { file: '../shared/protocol.js', type: JS },
  '/shared/city.js': { file: '../shared/city.js', type: JS },
  '/shared/movement.js': { file: '../shared/movement.js', type: JS },
  '/shared/net-client.js': { file: '../shared/net-client.js', type: JS },
};
module.exports = { STATIC };
