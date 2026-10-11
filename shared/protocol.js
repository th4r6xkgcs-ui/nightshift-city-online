// Nightshift City Online — wire protocol (version 1).
// Every message is a JSON object with a string `t` (type). Clients send
// INTENT only ("I want to move this way", "I want to buy ammo"); the server
// decides outcomes and sends back state. Nothing the client says about its
// own cash, hp, ammo or inventory is ever trusted.
(function (root) {
  'use strict';
  const VERSION = 1;

  // Client -> server
  const C = Object.freeze({
    HELLO: 'hello',       // {name, v, token?}
    INPUT: 'input',       // {seq, mx, my, aim, sprint}
    FIRE: 'fire',         // {aim}
    RELOAD: 'reload',     // {}
    BUY: 'buy',           // {item, tx}
    SELL: 'sell',         // {item, tx}
    USE: 'use',           // {item}
    PICKUP: 'pickup',     // {bag}
    GIVE: 'give',         // {to, cash, tx}
    PVP: 'pvp',           // {on}
    HOME: 'home',         // {tx}  buy the starter apartment (stand at it)
    STASH: 'stash',       // {dir: in|out, item: cash|ammo|<item>, count, tx}
    PING: 'ping',         // {at}
  });

  // Server -> client
  const S = Object.freeze({
    WELCOME: 'welcome',   // {id, v, rules, you, token, resumed}
    STATE: 'state',       // {tick, you, others, bags}
    RESULT: 'result',     // {tx?, ok, reason?, ...}
    EVENT: 'event',       // {kind, ...}
    ERROR: 'error',       // {reason}
    PONG: 'pong',         // {at, now}
  });

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const isTx = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
  const isId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
  const isItem = (v) => typeof v === 'string' && /^[a-z]{1,20}$/.test(v);

  // Returns null when valid, otherwise a short reason string.
  function validate(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return 'not an object';
    switch (msg.t) {
      case C.HELLO:
        if (typeof msg.name !== 'string' || !/^[\w .-]{1,20}$/.test(msg.name)) return 'bad name';
        if (msg.v !== VERSION) return 'protocol version mismatch';
        if (msg.token !== undefined && (typeof msg.token !== 'string' || !/^[a-f0-9]{32}$/.test(msg.token))) return 'bad token';
        return null;
      case C.INPUT:
        if (!Number.isSafeInteger(msg.seq) || msg.seq < 0) return 'bad seq';
        if (!isNum(msg.mx) || !isNum(msg.my) || !isNum(msg.aim)) return 'bad input';
        if (typeof msg.sprint !== 'boolean') return 'bad sprint';
        return null;
      case C.FIRE:
        return isNum(msg.aim) ? null : 'bad aim';
      case C.RELOAD:
        return null;
      case C.BUY:
      case C.SELL:
        return isItem(msg.item) && isTx(msg.tx) ? null : 'bad trade';
      case C.USE:
        return isItem(msg.item) ? null : 'bad item';
      case C.PICKUP:
        return isId(msg.bag) ? null : 'bad bag';
      case C.GIVE:
        return isId(msg.to) && Number.isSafeInteger(msg.cash) && msg.cash > 0 && isTx(msg.tx)
          ? null : 'bad give';
      case C.PVP:
        return typeof msg.on === 'boolean' ? null : 'bad pvp';
      case C.HOME:
        return isTx(msg.tx) ? null : 'bad home';
      case C.STASH:
        if (msg.dir !== 'in' && msg.dir !== 'out') return 'bad stash';
        if (!isItem(msg.item) || !isTx(msg.tx)) return 'bad stash';
        return Number.isSafeInteger(msg.count) && msg.count > 0 && msg.count <= 100000000 ? null : 'bad stash';
      case C.PING:
        return isNum(msg.at) ? null : 'bad ping';
      default:
        return 'unknown type';
    }
  }

  const api = Object.freeze({ VERSION, C, S, validate });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
