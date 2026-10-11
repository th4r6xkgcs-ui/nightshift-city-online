'use strict';
// Live smoke test: two bot players against a running server.
//   node server/scripts/smoke-live.cjs https://nightshift-city-online.<sub>.workers.dev
//   node server/scripts/smoke-live.cjs http://localhost:2567
// Exits 0 when every check passes. Uses the shared net-client, like the game.
const { createClient } = require('../../shared/net-client.js');

const base = (process.argv[2] || process.env.SMOKE_URL || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) { console.error('usage: smoke-live.cjs <http(s)://server>'); process.exit(2); }
const wsUrl = base.replace(/^http/, 'ws') + '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const inCI = !!process.env.GITHUB_ACTIONS;
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`;
  console.log(line);
  // In GitHub Actions, also publish each result as an annotation (readable via the API).
  if (inCI) console.log(`::${ok ? 'notice' : 'error'} title=live smoke::${line.replace(/[\r\n]+/g, ' ').slice(0, 300)}`);
};

function bot(name, token) {
  const s = { name, welcome: null, chats: [], results: [], events: [] };
  s.c = createClient({
    url: wsUrl, name, token,
    onWelcome: (w) => { s.welcome = w; },
    onChat: (m) => s.chats.push(m),
    onResult: (r) => s.results.push(r),
    onEvent: (e) => s.events.push(e),
  });
  let last = performance.now();
  s.loop = setInterval(() => { const t = performance.now(); s.view = s.c.update(t - last); last = t; }, 16);
  s.stop = () => { clearInterval(s.loop); s.c.close(); };
  return s;
}
async function until(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(25); } return false; }

(async () => {
  const run = Date.now().toString(36).slice(-4);
  // HTTP side
  try {
    const h = await fetch(base + '/healthz', { signal: AbortSignal.timeout(10000) });
    check('health endpoint', h.ok && (await h.text()).trim() === 'ok', `HTTP ${h.status}`);
    const page = await fetch(base + '/', { signal: AbortSignal.timeout(10000) });
    check('test page served', page.ok && /Nightshift Online/.test(await page.text()), `HTTP ${page.status}`);
    const lib = await fetch(base + '/shared/net-client.js', { signal: AbortSignal.timeout(10000) });
    check('client library served', lib.ok, `HTTP ${lib.status}`);
  } catch (e) { check('HTTP reachable', false, e.message); }

  const a = bot('SmokeA' + run), b = bot('SmokeB' + run);
  check('bot A joined', await until(() => a.welcome), a.welcome ? `id ${a.welcome.id}` : 'no welcome');
  check('bot B joined', await until(() => b.welcome));
  if (!a.welcome || !b.welcome) return finish([a, b]);

  const sees = await until(() => a.view?.others?.some((o) => o.id === b.welcome.id) && b.view?.others?.some((o) => o.id === a.welcome.id));
  check('bots see each other', sees);

  // Movement: walk up the open street from spawn (no buildings north of spawn).
  const y0 = a.view.me.serverY;
  a.c.setInput({ mx: 0, my: -1, aim: 0, sprint: false });
  await sleep(1000);
  a.c.setInput({ mx: 0, my: 0, aim: 0, sprint: false });
  const moved = await until(() => y0 - a.view.me.serverY > 100);
  check('server moves the player', moved, `${Math.round(y0 - a.view.me.serverY)}px in ~1s (expect ~180)`);
  const bSees = await until(() => { const o = b.view.others.find((x) => x.id === a.welcome.id); return o && Math.abs(o.y - a.view.me.serverY) < 15; });
  check('other bot sees the move', bSees);

  // Chat
  const text = 'smoke ' + run;
  a.c.chat('city', text);
  check('city chat delivered', await until(() => b.chats.some((m) => m.text === text && m.from === a.welcome.id)));

  // Jobs
  a.c.job('start');
  check('delivery job starts', await until(() => a.results.some((r) => r.req === 'job' && r.ok && r.job)));
  a.c.job('cancel');

  // Resume: reconnect bot A with its token, same character comes back.
  const token = a.c.token, cash = a.view.me.cash;
  a.stop();
  await sleep(800);
  const a2 = bot('SmokeA' + run, token);
  check('resume with token', await until(() => a2.welcome), a2.welcome ? `resumed=${a2.welcome.resumed}` : '');
  check('same character restored', !!a2.welcome?.resumed && a2.welcome.you.cash === cash);
  finish([a2, b]);
})().catch((e) => { check('smoke run', false, e.stack); finish([]); });

function finish(bots) {
  for (const s of bots) try { s.stop(); } catch {}
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
