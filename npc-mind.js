/* NPC minds runtime (Claude-owned). Requires npc-mind-data.js. Sits on top of the existing citizen AI
 * (routines, fleeing, cover, conversations) without replacing it:
 *  - every pedestrian becomes one of their district's fixed residents (name, job, traits, secret)
 *  - they SEE what you do (shooting, kills, robberies, fights, hit-and-runs, helping people) and remember it
 *  - personality decides the reaction: flee, hide, FILM you on their phone (heat if you let them finish),
 *    CALL the cops, CONFRONT you, CHEER (gang members when you drop a rival)
 *  - they recognise you later: fans wave and sometimes slip you something, people who hate you run or glare
 *  - word spreads when people stop and chat (gossip)
 *  - they jump out of the way of a speeding car instead of standing in the road
 *  - 🔍 tag over the nearest person: tap it (or press I) for their card: who they are, mood, what they think of you,
 *    what they remember, their secret (earn it, or lean on them), TALK / TIP $20 / LEAN ON THEM
 *  - 📱 People app: everyone you've met.
 * Save: nightshift-minds-v1. API: NightshiftMind.{state, of, open, close, paused, people, stats} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const M = root.NightshiftMindData; if (!M) return;
  const KEY = 'nightshift-minds-v1';
  let state = M.fresh();
  try { state = M.clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* fresh */ }
  let dirty = false; const persist = () => { dirty = true; };
  setInterval(() => { if (!dirty) return; dirty = false; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ } }, 2000);
  const st = { assigned: 0, witnessed: 0, films: 0, calls: 0, dodges: 0, gossip: 0, waves: 0, gifts: 0, confronts: 0, opened: 0 };

  // ---------- environment ----------
  const G = () => { try { return { peds, player, cars, camera, W, H }; } catch { return null; } }; /* eslint-disable-line no-undef */
  const isBlocked = (x, y) => { try { return typeof blocked === 'function' && blocked(x, y); } catch { return false; } }; /* eslint-disable-line no-undef */
  const say = (s) => { try { root.NightshiftFeedback?.toast?.(s); } catch { /* n/a */ } try { if (typeof root.say === 'function') root.say(s); else { const t = document.querySelector('#toast'); if (t) { t.textContent = s; t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 2600); } } } catch { /* n/a */ } };
  const REGION = { DOWNTOWN: 'Downtown', 'OLD TOWN': 'Old Town', 'MARKET DISTRICT': 'Market', HARBOR: 'Harbor', IRONWORKS: 'Ironworks', 'THE HEIGHTS': 'Heights', FAIRVIEW: 'Fairview', 'THE FLATS': 'The Flats', SOUTHSIDE: 'Southside', 'THE DOCKS': 'The Docks', MIDTOWN: 'Midtown', 'WEST END': 'West End' };
  const districtAt = (x, y) => { try { const W0 = root.NightshiftWorld; return REGION[W0?.districtName?.(x, y) || W0?.regionAt?.(x, y)?.name] || 'Downtown'; } catch { return 'Downtown'; } };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const armed = () => { try { const w = root.NightshiftWeapons?.current?.(); return !!(w && w.id && w.id !== 'none'); } catch { return false; } };
  const day = () => Math.floor(Date.now() / 600000); // a "day" for talk/tip limits = 10 real minutes
  const hour = () => { try { return ((root.NightshiftEnvironment?.state?.minute ?? 1200) % 1440) / 60; } catch { return 20; } };
  const charisma = () => { try { return root.NightshiftSkills?.level?.('charisma') || 0; } catch { return 0; } };
  const emit = (detail) => { try { root.dispatchEvent(new CustomEvent('ns:event', { detail })); } catch { /* n/a */ } };

  // ---------- who is who ----------
  const cache = new Map(), inUse = new Map(); // id -> ped
  const resident = (id) => { if (cache.has(id)) return cache.get(id); const m = /^(.*)-(\d+)$/.exec(id); if (!m) return null; const d = M.DISTRICTS.find((x) => x.toLowerCase().replace(/\s+/g, '-') === m[1]); const r = d ? M.resident(d, +m[2]) : null; if (r) cache.set(id, r); return r; };
  function assign(p) {
    const d = districtAt(p.x, p.y), base = M.hash((p.id || '') + ':' + Math.round(p.x) + ':' + Math.round(p.y) + ':' + st.assigned);
    // a third of the time, prefer somebody you've already met in this district, so faces come back
    const known = Object.keys(state.met).filter((id) => id.startsWith(d.toLowerCase().replace(/\s+/g, '-') + '-') && !inUse.has(id));
    let id = null;
    if (known.length && base % 3 === 0) id = known[base % known.length];
    for (let k = 0; !id && k < M.PER_DISTRICT; k++) { const c = M.resident(d, (base + k * 7) % M.PER_DISTRICT).id; if (!inUse.has(c)) id = c; }
    if (!id) return null; if (p.mind) inUse.delete(p.mind); p.mind = id; inUse.set(id, p); p.__mx = p.x; p.__my = p.y; st.assigned++; return id;
  }
  const of = (p) => (p && p.mind ? resident(p.mind) : null);
  function sync(env) {
    const alive = new Set();
    for (const p of env.peds) {
      if (!(p.hp > 0)) continue; if (!p.mind || Math.hypot(p.x - (p.__mx ?? p.x), p.y - (p.__my ?? p.y)) > 260) assign(p);
      p.__mx = p.x; p.__my = p.y; if (p.mind) alive.add(p.mind);
    }
    for (const [id, p] of inUse) if (!alive.has(id) || inUse.get(id) !== p || !env.peds.includes(p)) inUse.delete(id);
  }

  // ---------- bubbles (drawn in world space) ----------
  const bubbles = []; // { p, text, until, color }
  function bubble(p, text, ms = 2200, color = '#fff') { const i = bubbles.findIndex((b) => b.p === p); if (i >= 0) bubbles.splice(i, 1); bubbles.push({ p, text, until: performance.now() + ms, color }); if (bubbles.length > 8) bubbles.shift(); }

  // ---------- witnessing ----------
  const busy = new Map(); // ped -> { kind:'film'|'call'|'confront'|'dodge'|'look', until, ... }
  let lastCall = 0;
  function witnesses(env, at, range, except) { return env.peds.filter((p) => p !== except && p.hp > 0 && p.mind && dist(p, at) < range); }
  function witness(env, at, kind, memory, opts = {}) {
    const now = performance.now(), list = witnesses(env, at, opts.range || 320, opts.victim);
    for (const p of list) {
      const who = of(p); if (!who) continue; M.remember(state, who, memory, Date.now(), opts.gang || ''); st.witnessed++;
      const act = M.react(who, { kind, dist: dist(p, env.player), armed: armed(), op: M.opinion(state, who.id), gangKill: memory === 'saw-gangkill', gang: opts.gang });
      act0(env, p, who, act, at, now, kind);
    }
    persist();
  }
  function act0(env, p, who, act, at, now, kind) {
    const C = root.NightshiftCitizens;
    if (act === 'flee' || act === 'hide') { try { C?.react?.(p, at, now, kind === 'robbery' ? 'robbery' : 'gunshot'); } catch { /* n/a */ } if (Math.random() < 0.35) bubble(p, act === 'hide' ? 'Get down!' : ['Oh my god!', 'RUN!', 'Nope nope nope'][Math.floor(Math.random() * 3)], 1400, '#ffd2d2'); return; }
    if (act === 'film' && !busy.has(p)) { busy.set(p, { kind: 'film', until: now + 6500, at }); bubble(p, '📱 Recording…', 6500, '#9fd4ff'); st.films++; return; }
    if (act === 'call' && !busy.has(p) && now - lastCall > 12000) { lastCall = now; busy.set(p, { kind: 'call', until: now + 4200, at }); bubble(p, '📞 911? Yes, I\'m watching right now—', 4200, '#ffd970'); st.calls++; return; }
    if (act === 'confront' && !busy.has(p)) { busy.set(p, { kind: 'confront', until: now + 6000, shoved: false }); bubble(p, ['Hey! I SAW that!', 'You think that\'s funny?', 'Not on my block!'][Math.floor(Math.random() * 3)], 2000, '#ffb0a0'); st.confronts++; return; }
    if (act === 'cheer') { bubble(p, ['HA! Get \'em!', 'That\'s what they get!', 'Respect.'][Math.floor(Math.random() * 3)], 1800, '#7cdeb5'); }
  }

  root.addEventListener?.('ns:event', (e) => {
    const d = e.detail || {}, env = G(); if (!env || !env.player) return;
    try {
      if (d.type === 'kill' && d.byPlayer) { lastSpecial = performance.now(); witness(env, d, 'kill', 'saw-gangkill', { gang: d.team }); }
      else if (d.type === 'officer-down') { lastSpecial = performance.now(); witness(env, d, 'kill', 'saw-copkill'); }
      else if (d.type === 'hit' && d.ev && d.ev.src === 'player') {
        const ev = d.ev, to = ev.to || { x: ev.tx, y: ev.ty }; if (!Number.isFinite(to?.x)) return;
        const victim = env.peds.find((p) => p.mind && dist(p, to) < 26);
        if (victim) { const who = of(victim); if (who) M.remember(state, who, 'shot-me', Date.now()); }
        if (ev.result === 'killed') setTimeout(() => { if (performance.now() - lastSpecial > 80) witness(env, to, 'kill', 'saw-kill', { victim }); }, 0);
        else witness(env, to, 'shots', 'saw-shooting', { victim, range: 380 });
      } else if (d.type === 'melee') {
        const victim = d.target === 'ped' ? env.peds.find((p) => p.mind && dist(p, d) < 30) : null;
        if (victim) { const who = of(victim); if (who) M.remember(state, who, 'beat-me', Date.now()); }
        witness(env, d, 'fight', 'saw-fight', { victim, range: 220 });
      }
    } catch (err) { console.error(err); }
  });
  let lastSpecial = 0;

  // robbery: wrap the ROB action to see who got robbed
  function hookCrime() {
    const C = root.NightshiftCrime; if (!C || typeof C.attempt !== 'function' || C.__mind) return !!C?.__mind;
    const a0 = C.attempt; C.attempt = function () {
      const env = G(); const before = env?.player?.cash ?? 0, victim = env ? env.peds.filter((p) => p.mind && p.hp > 0).sort((a, b) => dist(a, env.player) - dist(b, env.player))[0] : null;
      const r = a0.apply(this, arguments);
      try { if (env && env.player.cash > before && victim && dist(victim, env.player) < 90) { const who = of(victim); if (who) M.remember(state, who, 'robbed-me', Date.now()); witness(env, env.player, 'robbery', 'saw-robbery', { victim, range: 260 }); } } catch (e) { console.error(e); }
      return r;
    };
    // walking up to a ped's card from the crime button's victim pick doesn't change anything else
    C.__mind = true; return true;
  }
  // helping people (npc-life street events) is seen too
  function hookEncounters() {
    const EN = root.NightshiftEncounters; if (!EN || typeof EN.use !== 'function' || EN.__mind) return !!EN?.__mind;
    const u0 = EN.use, d0 = EN.draw;
    EN.use = function (id) { const r = u0.apply(this, arguments); try { if (r && typeof id === 'string' && /^npcl-/.test(id) && id !== 'npcl-drop') { const env = G(); if (env) witness(env, env.player, 'help', 'saw-help', { range: 260 }); } } catch { /* n/a */ } return r; };
    EN.draw = function () { const r = d0?.apply(this, arguments); try { drawWorld(); } catch (e) { console.error(e); } return r; };
    EN.__mind = true; return true;
  }

  // ---------- per-frame behaviour ----------
  let lastSync = 0, lastSeen = 0, lastGossip = 0, lastT = 0, lastGift = 0;
  const greeted = new Map(), gossiped = new Map();
  function tick(now) {
    const env = G(); if (!env || !env.player || !Array.isArray(env.peds)) return;
    const dt = lastT ? Math.min(3, (now - lastT) / 16.67) : 1; lastT = now; const P = env.player;
    if (now - lastSync > 300) { lastSync = now; sync(env); }
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].until < now || !(bubbles[i].p.hp > 0)) bubbles.splice(i, 1);

    // hit-and-run: a ped near your moving car that just lost health
    if (P.car && Math.abs(P.car.speed || 0) > 1.6) {
      for (const p of env.peds) {
        if (!p.mind) continue; const dd = dist(p, P.car);
        if (dd < 70 && Number.isFinite(p.__hp) && p.hp < p.__hp) { const who = of(p); if (who) M.remember(state, who, 'hit-by-car', Date.now()); witness(env, p, 'car', 'saw-hitrun', { victim: p, range: 260 }); }
        // dodge: in front of a fast car → dive sideways
        const sp = Math.abs(P.car.speed); if (sp > 3 && dd < 40 + sp * 16 && !busy.has(p) && p.hp > 0) {
          const ax = Math.cos(P.car.angle) * Math.sign(P.car.speed), ay = Math.sin(P.car.angle) * Math.sign(P.car.speed), rx = p.x - P.car.x, ry = p.y - P.car.y, ahead = rx * ax + ry * ay, side = -rx * ay + ry * ax;
          if (ahead > 10 && Math.abs(side) < 26) { const s = side >= 0 ? 1 : -1, who = of(p), quick = who ? 0.45 + who.bravery * 0.2 + (who.age < 40 ? 0.25 : 0) : 0.6; if (Math.random() < quick) { busy.set(p, { kind: 'dodge', until: now + 260, nx: -ay * s, ny: ax * s }); if (Math.random() < 0.5) bubble(p, ['WHOA!', 'Watch it!!', 'Are you crazy?!'][Math.floor(Math.random() * 3)], 1200, '#ffd2d2'); st.dodges++; } }
        }
      }
    }
    for (const p of env.peds) p.__hp = p.hp;

    // busy states
    for (const [p, b] of busy) {
      if (!(p.hp > 0) || !env.peds.includes(p)) { busy.delete(p); continue; }
      const who = of(p);
      if (b.kind === 'dodge') { const step = 4.2 * dt, nx = p.x + b.nx * step, ny = p.y + b.ny * step; if (!isBlocked(nx, ny)) { p.x = nx; p.y = ny; p.__mx = p.x; p.__my = p.y; } p.moving = true; if (now > b.until) busy.delete(p); continue; }
      p.socialUntil = now + 400; p.path = []; // hold still (the routine AI respects socialUntil)
      if (b.kind === 'film') {
        p.angle = Math.atan2(P.y - p.y, P.x - p.x);
        if (dist(p, P) < 48 && !P.car) { busy.delete(p); bubble(p, 'OK OK! Deleting it!', 1400, '#ffd2d2'); try { root.NightshiftCitizens?.react?.(p, P, now, 'gunshot'); } catch { /* n/a */ } if (who) M.remember(state, who, 'threatened', Date.now()); continue; }
        if (now > b.until) { busy.delete(p); P.heat = Math.min(5, (P.heat || 0) + 0.6); say(`📱 ${who ? who.first : 'Someone'} posted a video of you · heat up`); try { root.NightshiftCrime?.report?.({ x: P.x, y: P.y }, now, 'video'); } catch { /* n/a */ } emit({ type: 'filmed', who: who?.id }); }
      } else if (b.kind === 'call') {
        p.angle = Math.atan2(P.y - p.y, P.x - p.x);
        if (now > b.until) { busy.delete(p); if (dist(p, P) < 700) { try { root.NightshiftCrime?.report?.({ x: b.at.x, y: b.at.y }, now, 'shots'); } catch { /* n/a */ } say(`📞 ${who ? who.first : 'A witness'} called it in`); } }
      } else if (b.kind === 'confront') {
        const d = dist(p, P); p.angle = Math.atan2(P.y - p.y, P.x - p.x);
        if (P.car || now > b.until || armed() && d < 120 && Math.random() < 0.01) { busy.delete(p); if (!P.car) bubble(p, 'Whatever. I know your face.', 1600); continue; }
        if (d > 26) { const s = 1.5 * dt, nx = p.x + (P.x - p.x) / d * s, ny = p.y + (P.y - p.y) / d * s; if (!isBlocked(nx, ny)) { p.x = nx; p.y = ny; p.__mx = p.x; p.__my = p.y; } p.moving = true; }
        else if (!b.shoved) { b.shoved = true; const nx = P.x + (P.x - p.x) / Math.max(1, d) * 14, ny = P.y + (P.y - p.y) / Math.max(1, d) * 14; if (!isBlocked(nx, ny)) { P.x = nx; P.y = ny; } bubble(p, ['*shove* Back off!', 'Get outta here!', 'Try me.'][Math.floor(Math.random() * 3)], 1600, '#ffb0a0'); b.until = Math.min(b.until, now + 1500); }
      }
    }

    // recognition: people who know you react when you walk past
    if (now - lastSeen > 650 && !P.car) {
      lastSeen = now;
      for (const p of env.peds) {
        if (!p.mind || busy.has(p) || !(p.hp > 0) || dist(p, P) > 150 || (greeted.get(p.mind) || 0) > now) continue;
        const who = of(p), op = M.opinion(state, p.mind); if (!who || (op > -15 && op < 25)) continue;
        greeted.set(p.mind, now + 45000);
        const act = M.react(who, { kind: 'seen', dist: dist(p, P), armed: armed(), op });
        if (act === 'wave') { p.angle = Math.atan2(P.y - p.y, P.x - p.x); p.socialUntil = now + 1200; bubble(p, op >= 60 ? ['Yo! It\'s you!', 'My hero!', 'Legend!'][Math.floor(Math.random() * 3)] : ['Hey!', 'Evening!', '👋'][Math.floor(Math.random() * 3)], 1600, '#bff3dd'); st.waves++;
          if (op >= 60 && now - lastGift > 180000 && Math.random() < 0.35) { lastGift = now; const cash = 15 + Math.floor(Math.random() * 40); P.cash += cash; bubble(p, `Here, for you. ($${cash})`, 2000, '#7cdeb5'); say(`🎁 ${who.first} slipped you $${cash}`); st.gifts++; } }
        else if (act === 'glare') { p.angle = Math.atan2(P.y - p.y, P.x - p.x); bubble(p, ['…', 'I know you.', 'Keep walking.'][Math.floor(Math.random() * 3)], 1400, '#ffd970'); }
        else if (act === 'flee') { bubble(p, 'It\'s THEM!', 1400, '#ffd2d2'); try { root.NightshiftCitizens?.react?.(p, P, now, 'crash'); } catch { /* n/a */ } }
        else if (act === 'confront') act0(env, p, who, 'confront', P, now, 'seen');
      }
    }
    // gossip between people stopped together
    if (now - lastGossip > 1500) {
      lastGossip = now; const talking = env.peds.filter((p) => p.mind && p.socialUntil > now && !busy.has(p) && dist(p, P) < 900);
      for (let i = 0; i < talking.length; i++) for (let j = i + 1; j < talking.length; j++) {
        const a = talking[i], b = talking[j]; if (dist(a, b) > 70) continue; const key = a.mind < b.mind ? a.mind + '|' + b.mind : b.mind + '|' + a.mind; if ((gossiped.get(key) || 0) > now) continue; gossiped.set(key, now + 60000);
        const A = of(a), B = of(b); if (!A || !B) continue; const ab = M.spread(state, A, B, Date.now()), ba = M.spread(state, B, A, Date.now());
        if (ab || ba) { st.gossip++; persist(); if (dist(a, P) < 260) bubble(Math.abs(ab) >= Math.abs(ba) ? a : b, M.opinion(state, (Math.abs(ab) >= Math.abs(ba) ? A : B).id) > 0 ? 'You hear what they did? Good people.' : 'That\'s the one I told you about…', 2200, '#e8e0ff'); }
      }
    }
    tag(env, now);
  }

  function drawWorld() {
    let c = null; try { c = g; } catch { return; } /* eslint-disable-line no-undef */ if (!c) return; const now = performance.now();
    c.save(); c.font = '600 9px ui-monospace,Menlo,monospace'; c.textAlign = 'center';
    for (const b of bubbles) {
      const p = b.p, w = Math.min(190, c.measureText(b.text).width + 10), x = p.x, y = p.y - 44, fade = Math.min(1, (b.until - now) / 300);
      c.globalAlpha = 0.92 * fade; c.fillStyle = '#0d1424'; c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - 10, w, 14, 5) : c.rect(x - w / 2, y - 10, w, 14); c.fill();
      c.beginPath(); c.moveTo(x - 3, y + 4); c.lineTo(x, y + 8); c.lineTo(x + 3, y + 4); c.fill(); c.globalAlpha = fade; c.fillStyle = b.color; c.fillText(b.text, x, y + 1);
    }
    for (const [p, b] of busy) if (b.kind === 'film') { c.fillStyle = (now / 300 | 0) % 2 ? '#ff3b3b' : '#7a1010'; c.beginPath(); c.arc(p.x + 8, p.y - 22, 2.5, 0, 6.3); c.fill(); }
    c.restore();
  }

  // ---------- 🔍 tag over the nearest person ----------
  const css = document.createElement('style');
  css.textContent = `#mindTag{position:fixed;z-index:30;transform:translate(-50%,-100%);all:unset;position:fixed;z-index:30;transform:translate(-50%,-100%);cursor:pointer;font:700 10px ui-monospace,Menlo,monospace;color:#fff;background:#0d1424d9;border:1px solid var(--c,#9fd4ff);border-radius:999px;padding:3px 8px 3px 6px;white-space:nowrap;box-shadow:0 2px 8px #0008;pointer-events:auto;touch-action:manipulation}
  #mindTag[hidden]{display:none}
  #mindCard{position:fixed;inset:6% 8%;z-index:47;overflow:auto;background:#0f1830f7;border:1px solid #6f8db3;border-radius:16px;padding:12px 14px;color:#e8eff7;font:12.5px ui-monospace,Menlo,monospace;display:grid;grid-template-columns:120px 1fr;gap:4px 14px}
  #mindCard[hidden]{display:none} #mindCard h2{margin:0;font-size:17px} #mindCard .sub{color:#b9c8da;font-size:11.5px;margin:2px 0 6px}
  #mindCard .por{grid-row:1/span 3;width:120px;height:150px;border-radius:12px;background:radial-gradient(circle at 50% 40%,#2c3f6a,#121b30);border:1px solid #3a5080}
  #mindCard .chips span{display:inline-block;margin:0 5px 5px 0;padding:2px 8px;border-radius:999px;background:#1d2c4a;border:1px solid #34507c;font-size:11px}
  #mindCard .bar{height:8px;border-radius:5px;background:#1d2c4a;position:relative;margin:4px 0 2px;overflow:hidden} #mindCard .bar i{position:absolute;top:0;bottom:0;left:50%;background:var(--c)}
  #mindCard h3{margin:8px 0 4px;font-size:11px;color:#9fb3c8;letter-spacing:.08em} #mindCard ul{margin:0;padding-left:16px;color:#d6e0ee} #mindCard .sec{background:#16233d;border:1px dashed #4a6a99;border-radius:9px;padding:7px 9px}
  #mindCard .acts{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  #mindCard button{all:unset;box-sizing:border-box;cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;background:#2c4c7c;color:#fff;border:1px solid #6f8db3;border-radius:9px;padding:8px 12px} #mindCard button[disabled]{opacity:.4;cursor:default} #mindCard .x{position:absolute;right:12px;top:10px}
  #mindCard .say{grid-column:1/-1;min-height:18px;color:#ffe7a8;font-style:italic}
  #mindCard .ppl{grid-column:1/-1} #mindCard .row{display:flex;gap:8px;align-items:center;background:#16233d;border:1px solid #2f4669;border-radius:9px;padding:7px 9px;margin-bottom:6px;cursor:pointer} #mindCard .row div{flex:1} #mindCard .row small{display:block;color:#b9c8da}`;
  document.head.appendChild(css);
  const tagEl = Object.assign(document.createElement('button'), { id: 'mindTag', hidden: true }); document.body.appendChild(tagEl);
  let tagged = null;
  tagEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (tagged) open(tagged); });
  root.addEventListener?.('keydown', (e) => { if ((e.key === 'i' || e.key === 'I') && tagged && !paused()) open(tagged); });
  function tag(env, now) {
    const P = env.player; let best = null, bd = 95;
    if (!P.car && !paused() && !(root.NightshiftHome?.paused?.()) && !(root.NightshiftZones?.active?.())) for (const p of env.peds) { if (!p.mind || !(p.hp > 0) || busy.get(p)?.kind === 'dodge' || p.fleeUntil > now) continue; const d = dist(p, P); if (d < bd) { bd = d; best = p; } }
    tagged = best; if (!best) { if (!tagEl.hidden) tagEl.hidden = true; return; }
    const who = of(best), op = M.opinion(state, who.id), b = M.band(op), cam = env.camera, cv = document.querySelector('canvas'), rc = cv?.getBoundingClientRect?.() || { left: 0, top: 0, width: env.W, height: env.H }, sx = rc.width / (env.W || rc.width), sy = rc.height / (env.H || rc.height);
    const x = rc.left + (best.x - cam.x) * cam.zoom * sx, y = rc.top + (best.y - 40 - cam.y) * cam.zoom * sy;
    const label = `🔍 ${state.met[who.id] ? who.first : 'Stranger'}`; if (tagEl.textContent !== label) tagEl.textContent = label; tagEl.style.setProperty('--c', b.color);
    tagEl.style.left = Math.round(x) + 'px'; tagEl.style.top = Math.round(y) + 'px'; if (tagEl.hidden) tagEl.hidden = false;
  }

  // ---------- the card ----------
  const card = Object.assign(document.createElement('section'), { id: 'mindCard', hidden: true }); document.body.appendChild(card);
  const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); for (const k of kids) if (k != null) n.append(k); return n; };
  let current = null, line = '';
  function portrait(p) {
    const cv = el('canvas', { className: 'por', width: 240, height: 300 }); if (!p) return cv;
    try { const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.scale(4.4, 4.4); const q = { ...p, x: 27.3, y: 52, angle: Math.PI / 2, moveAngle: Math.PI / 2, moving: false, hp: p.maxHp || 40 }; root.NightshiftSprites?.personTo?.(c, q, false, { hideHealth: true }); } catch { /* n/a */ }
    return cv;
  }
  function open(p, idOnly) {
    const who = p ? of(p) : resident(idOnly); if (!who) return; current = { p: p || inUse.get(who.id) || null, id: who.id };
    if (!state.met[who.id]) { state.met[who.id] = Date.now(); persist(); line = M.greet(who, M.opinion(state, who.id)) + ` I'm ${who.first}.`; } else if (!line) line = M.greet(who, M.opinion(state, who.id));
    st.opened++; render(); card.hidden = false; tagEl.hidden = true; try { root.NightshiftHaptics?.tap?.(); } catch { /* n/a */ }
  }
  function close() { card.hidden = true; current = null; line = ''; }
  const paused = () => !card.hidden;
  function speak(text) { line = text; if (current?.p) bubble(current.p, text.length > 46 ? text.slice(0, 44) + '…' : text, 2600); }
  function render() {
    if (!current) return; const who = resident(current.id), p = current.p, near = p && p.hp > 0 && dist(p, G().player) < 140;
    const D = M.describe(who, state, { hour: hour(), rain: root.NightshiftEnvironment?.rain?.() || 0, scared: p && p.fleeUntil > performance.now() });
    const r = M.rec(state, who.id), P = G().player, today = day(), gangName = who.gang ? (root.NightshiftGangsData?.BY_ID?.[who.gang]?.name || who.gang) : null;
    const pct = Math.abs(D.op) / 2, left = D.op >= 0 ? 50 : 50 - pct;
    const acts = el('div', { className: 'acts' },
      el('button', { textContent: '💬 TALK', disabled: !near, onclick: () => { const fresh = r.talkDay !== today; if (fresh) { r.talkDay = today; M.remember(state, who, 'talked', Date.now()); persist(); } speak(Math.random() < 0.45 ? M.smallTalk(who) : M.rumor(who, { gangs: Object.fromEntries((root.NightshiftGangsData?.GANGS || []).map((g) => [g.id, g.name])), wanted: P.heat || 0 })); if (!r.secret && M.canSecret(r.o, charisma()) && fresh) { r.secret = true; persist(); line += `  …Between us? ${who.secret.me}.`; } try { root.NightshiftSkills?.gain?.('charisma', 3, 'talk'); } catch { /* n/a */ } render(); } }),
      el('button', { textContent: r.tipDay === today ? '💵 TIPPED' : '💵 TIP $20', disabled: !near || r.tipDay === today || P.cash < 20, onclick: () => { P.cash -= 20; r.tipDay = today; M.remember(state, who, 'tipped', Date.now()); persist(); speak(who.traits.includes('greedy') ? 'Now we\'re talking. 😏' : 'Oh! Thank you, seriously.'); render(); } }),
      el('button', { textContent: '😠 LEAN ON THEM', disabled: !near, onclick: () => lean(who, p) }),
      who.secret.kind === 'debt' && r.secret && !r.paidDebt ? el('button', { textContent: `💸 PAY THEIR DEBT (${who.secret.text.match(/\$\d+/)?.[0] || '$1000'})`, disabled: P.cash < +(who.secret.text.match(/\$(\d+)/)?.[1] || 1000), onclick: () => { const amt = +(who.secret.text.match(/\$(\d+)/)?.[1] || 1000); P.cash -= amt; r.paidDebt = true; r.o = Math.min(100, r.o + 60); r.mem.push({ k: 'saved', t: Date.now() }); persist(); speak('You… you did WHAT? I owe you my life.'); render(); } }) : null,
      who.secret.kind === 'stash' && r.secret && !r.stashDone ? el('button', { textContent: '📍 MARK THE STASH', onclick: () => markStash(who, r) }) : null);
    card.replaceChildren(
      el('button', { className: 'x', textContent: 'CLOSE', onclick: close }), portrait(p),
      el('div', {}, el('h2', { textContent: D.name }), el('div', { className: 'sub', textContent: `${D.age} · ${D.job} · lives in ${D.from}${gangName ? ' · runs with the ' + gangName : ''}` }),
        el('div', { className: 'chips' }, ...D.traits.map((t) => el('span', { textContent: t })), el('span', { textContent: `${D.mood.icon} ${D.mood.label}` }), el('span', { textContent: `❤️ ${D.like}` }))),
      el('div', {}, el('h3', { textContent: `WHAT THEY THINK OF YOU · ${D.band.toUpperCase()} (${D.op > 0 ? '+' : ''}${D.op})` }), (() => { const b = el('div', { className: 'bar' }), i = el('i'); i.style.left = left + '%'; i.style.width = Math.max(1.5, pct) + '%'; b.style.setProperty('--c', D.color); b.append(i); return b; })()),
      el('div', {}, el('h3', { textContent: 'REMEMBERS' }), D.memories.length ? el('ul', {}, ...D.memories.slice(0, 4).map((m) => el('li', { textContent: m }))) : el('div', { className: 'sub', textContent: 'Nothing about you. Yet.' }),
        el('h3', { textContent: 'SECRET' }), el('div', { className: 'sec', textContent: D.secret || `🔒 Locked · get them to like you (${Math.max(20, 40 - Math.min(20, charisma() * 2))}+) and TALK, or lean on them` })),
      el('div', { className: 'say', textContent: line ? `“${line}”` : '' }), acts);
  }
  function lean(who, p) {
    const r = M.rec(state, who.id), res = M.intimidate(who, armed()); M.remember(state, who, 'threatened', Date.now());
    if (res === 'secret') { r.secret = true; speak(`Okay, okay! I'll tell you… ${M.secretLine(who)}`); }
    else if (res === 'cash') { const c = 20 + Math.floor(Math.random() * 60); G().player.cash += c; speak(`Here! Take it! ($${c}) Just leave me alone.`); }
    else if (res === 'fight') { speak('You want to go? Let\'s go.'); if (p) { close(); act0(G(), p, who, 'confront', G().player, performance.now(), 'seen'); } }
    else speak('Do what you gotta do. I\'m not scared of you.');
    if (p && G().player.heat < 1 && Math.random() < 0.3) { witness(G(), p, 'robbery', 'saw-robbery', { victim: p, range: 180 }); }
    persist(); if (!card.hidden) render();
  }
  function markStash(who, r) {
    const d = who.secret.text.match(/in ([A-Z][A-Za-z ]+)$/)?.[1] || who.district, rr = M.rng(M.hash(who.id + 'stash'));
    // pick a pavement spot near a random building in that district
    let spot = null; try { const list = (typeof buildings !== 'undefined' ? buildings : []).filter((b) => districtAt(b.x + b.w / 2, b.y + b.h) === d); const b = list[Math.floor(rr() * list.length)]; if (b) spot = { x: b.x + b.w / 2, y: b.y + b.h + 16 }; } catch { /* n/a */ } /* eslint-disable-line no-undef */
    if (!spot) { speak('Ah, I forget exactly where. Sorry.'); r.stashDone = true; persist(); return; }
    r.stash = spot; persist(); try { root.NightshiftMap?.navigate?.({ x: spot.x, y: spot.y, label: `${who.first}'s tip`, id: 'mind-stash' }); } catch { /* n/a */ }
    speak(`Behind the building there, in ${d}. Don't say I sent you.`); render();
  }
  // stash pickup + People list
  setInterval(() => { const env = G(); if (!env?.player) return; for (const [id, r] of Object.entries(state.ops)) if (r.stash && !r.stashDone && dist(r.stash, env.player) < 46) { r.stashDone = true; const cash = 150 + Math.floor(M.rng(M.hash(id))() * 300); env.player.cash += cash; say(`💰 Found the stash ${resident(id)?.first || 'they'} told you about · $${cash}`); persist(); } }, 500);
  function people() {
    const list = Object.keys(state.met).map((id) => ({ id, who: resident(id), op: M.opinion(state, id) })).filter((x) => x.who).sort((a, b) => b.op - a.op);
    current = null; card.replaceChildren(el('button', { className: 'x', textContent: 'CLOSE', onclick: close }),
      el('div', { className: 'ppl' }, el('h2', { textContent: '👥 People you know' }), el('div', { className: 'sub', textContent: list.length ? 'Everyone keeps living their life around their neighbourhood. Find them there.' : 'Nobody yet · tap the 🔍 tag over anyone on the street.' }),
        ...list.map((x) => { const b = M.band(x.op); return el('div', { className: 'row', onclick: () => open(inUse.get(x.id) || null, x.id) }, el('div', {}, document.createTextNode(`${x.who.name}`), el('small', { textContent: `${x.who.job} · ${x.who.district}${inUse.has(x.id) ? ' · nearby now' : ''}` })), el('b', { textContent: b.label, style: `color:${b.color}` })); })));
    card.hidden = false;
  }

  // ---------- boot ----------
  function loop(now) { try { hookCrime(); hookEncounters(); if (!paused()) tick(now); else if (current) { const p = current.p; if (p) p.socialUntil = now + 400; } } catch (e) { console.error(e); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  root.NightshiftMind = Object.freeze({ get state() { return state; }, of, open, close, paused, people, resident, bubble, stats: () => ({ ...st, inUse: inUse.size, known: Object.keys(state.met).length }) });
})(typeof window !== 'undefined' ? window : globalThis);
