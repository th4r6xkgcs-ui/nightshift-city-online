/* Walk-in interiors for every building in the city (Claude-owned; v0.71 premium rebuild on interior-kit.js).
 * Each building type has its own furnished room — tall readable back walls (shelves, neon, posters, night windows),
 * textured floors, 2.5D furniture with contact shadows, y-sorted props you walk around (plants, lamps, mannequins,
 * stools, punching bags), light pools and animated neon — plus staff, customers and things to DO:
 *   CORNER SHOP (counter), DINER (order food), BOUTIQUE (try on / mirror), GARAGE (tune + style), BANK (invest, vault),
 *   CLUB (bar, dance floor, venue), WAREHOUSE (scavenge), APARTMENT LOBBY (mail),
 *   v0.71 new: GUN SHOP (weapons store), TATTOO (ink = charisma), AUTO PARTS (car parts/tuning), GYM (train),
 *   HOSPITAL (heal), POLICE STATION (pay off your wanted level).
 * New types are deterministic variants of existing city buildings (NightshiftInteriorKit-independent `variant(b)`),
 * and the street sign (modern-city.js brand) uses the same variant so outside and inside match.
 * A 🚪 ENTER point sits at every building door (your own apartment keeps its HOME door).
 * Save: nightshift-interiors-v1 (crate / mailbox refill timers, unchanged). API: NightshiftInteriors2.{enter, doors, TYPES, variant, BLURB, title} */
(function (root) {
  'use strict';
  // ---------------- building variants (pure; also used by the street signs) ----------------
  const hash = (b) => ((Math.imul(Math.round(b.x), 73856093) ^ Math.imul(Math.round(b.y), 19349663)) >>> 0) % 100;
  function variant(b) {
    if (!b) return null; const h = hash(b), n = b.name;
    if (n === 'CORNER SHOP') return h < 16 ? 'GUN SHOP' : h < 28 ? 'TATTOO' : h < 40 ? 'AUTO PARTS' : n;
    if (n === 'CLOTHING') return h < 22 ? 'GYM' : n;
    if (n === 'BANK') return h < 22 ? 'POLICE' : n;
    if (n === 'APARTMENTS') return h < 9 ? 'HOSPITAL' : n;
    return n;
  }
  const BRANDS = { 'GUN SHOP': ['AMMO & ARMS', 'IRON SIGHT', 'LOCK & LOAD'], TATTOO: ['INK HOUSE', 'BLACKLINE', 'NEEDLE & CO'], 'AUTO PARTS': ['PARTS+', 'TORQUE SUPPLY', 'BOOST SHOP'], GYM: ['IRON GYM', 'PUMP HOUSE', '24 FIT'], POLICE: ['POLICE', 'PRECINCT 9'], HOSPITAL: ['CITY HOSPITAL', 'MERCY MED'] };
  // v0.71 actions (pure logic in ACT so it can be tested in Node)
  const ROB = { 'CORNER SHOP': [150, 350, 1.2], DINER: [100, 250, 1], CLOTHING: [200, 420, 1.2], 'GUN SHOP': [400, 750, 2], TATTOO: [120, 260, 1], 'AUTO PARTS': [180, 380, 1.2] }; // [min $, max $, heat]
  const ROB_COOLDOWN = 30 * 60000, HOLD_MS = 3000;
  const ACT = {
    heal(p) { if (p.hp >= 100) return { ok: false, msg: '🩺 "You look fine. Next!"' }; const cost = p.cash >= 60 ? 60 : 0; p.cash -= cost; p.hp = 100; return { ok: true, msg: cost ? '🩺 Patched up · full health ($60)' : '🩺 No money? They patch you up anyway. Full health.' }; },
    fine(p) { const heat = p.heat || 0; if (heat < 0.1) return { ok: false, msg: '🚔 "Nothing on file. Keep it that way."' }; const cost = Math.ceil(heat * 150); if (p.cash < cost) return { ok: false, msg: `🚔 Fine is $${cost}. Come back with the cash.` }; p.cash -= cost; p.heat = 0; return { ok: true, msg: `🚔 Fine paid ($${cost}) · wanted level cleared` }; },
    tattoo(p, last, now) { if (now - last < 10 * 60000) return { ok: false, msg: '🖋️ Still healing. Give it a few minutes.' }; if (p.cash < 150) return { ok: false, msg: '🖋️ A piece is $150' }; p.cash -= 150; return { ok: true, msg: '🖋️ Fresh ink · +charisma, the block respects it' }; },
    /** hold-up result: payout range + heat by store type; the gun shop clerk fights back sometimes */
    rob(type, roll, roll2) { const R = ROB[type]; if (!R) return null; if (type === 'GUN SHOP' && roll2 < 0.45) return { ok: false, resist: true, dmg: 30, heat: 1.2, msg: '💥 The clerk pulls a shotgun from under the counter!' }; const cash = Math.round(R[0] + (R[1] - R[0]) * roll); return { ok: true, cash, heat: R[2], msg: `💰 You cleaned out the register · +$${cash} · the cops are on the way` }; },
    armed(w) { return !!w && !!w.cls && w.cls !== 'none'; },
    train(p, last, now) { if (now - last < 3 * 60000) return { ok: false, msg: '🏋️ Muscles need rest · come back in a few minutes' }; if (p.cash < 20) return { ok: false, msg: '🏋️ Day pass is $20' }; p.cash -= 20; return { ok: true, msg: '🏋️ Good session · +athletics +toughness ($20)' }; },
  };
  root.NightshiftVariants = Object.freeze({ variant, BRANDS });
  if (!root.document) { if (typeof module !== 'undefined') module.exports = { variant, BRANDS, ACT, ROB, ROB_COOLDOWN }; return; }

  const KEY = 'nightshift-interiors-v1';
  let state = { crates: {}, mail: {}, robbed: {} };
  try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); if (r && typeof r === 'object') state = { crates: r.crates || {}, mail: r.mail || {}, robbed: r.robbed && typeof r.robbed === 'object' ? r.robbed : {} }; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  const B = () => { try { return buildings; } catch { return []; } };
  /* eslint-enable no-undef */
  const say = (t) => { try { root.say?.(t); } catch { /* no toast */ } };
  const gameSave = () => { try { if (typeof save === 'function') save(); } catch { /* not ready */ } }; // eslint-disable-line no-undef
  const K = root.NightshiftInteriorKit; if (!K) return;
  const { W, H, WALL, R } = K, DOOR = { x: W / 2, y: H - 14 };
  const solid = (x, y, w, h) => ({ x, y, w, h });
  const prop = (x, y, fn) => ({ x, y, draw: (c) => fn(c, x, y) });

  // ---------------- room types ----------------
  const T = {
    'CORNER SHOP': {
      title: 'CORNER SHOP', robAt: { x: 392, y: 336 },  floor: 'tile', wall: ['tile', '#cfd8d4', '#e05a4a'], dark: 0.06, seed: 11,
      art(c) {
        K.neon(c, 'OPEN 24/7', 140, 18, '#ff5a5a', 13); K.shelf(c, 20, 30, 250, 3, (cc, x, y, w, k) => (k % 2 ? K.boxes(cc, x, y, w, k) : K.bottles(cc, x, y, w, k)), '#8a939b');
        K.fridges(c, 300, 32, 7); K.ceilingLights(c, [100, 240, 380, 500], 0);
        K.aisle(c, 50, 150, 190, 3); K.aisle(c, 50, 238, 190, 7);
        K.counter(c, 370, 262, 150, 24, 30, '#5a3e2a', '#2a2d36'); K.register(c, 470, 262); R(c, '#f2c84a', 390, 266, 30, 10); K.boxes(c, 392, 252, 60, 2); K.atm(c, 20, 300);
      },
      props: [prop(530, 386, (c, x, y) => K.plant(c, x, y, 1))],
      lights: [{ x: 160, y: 200, r: 160, a: 0.4 }, { x: 420, y: 160, r: 150, a: 0.4 }],
      glow(c, t) { K.glow(c, 420, 70, 140, '#9fe6ff', 0.12 + 0.02 * Math.sin(t * 3)); K.glow(c, 140, 20, 60, '#ff5a5a', 0.25); },
      solids: [solid(300, WALL, 240, 12), solid(50, 150, 190, 50), solid(50, 238, 190, 50), solid(370, 262, 150, 56), solid(20, 300, 34, 62)], staff: [{ x: 450, y: 246 }], browsers: [{ x: 140, y: 214 }, { x: 410, y: 140 }],
      targets: () => [{ x: 440, y: 336, r: 52, action: 'SHOP', label: 'Counter · food, meds, ammo', use: () => openSafe(() => root.NightshiftRecovery?.openShop?.()) }] },

    DINER: {
      title: 'DINER', robAt: { x: 92, y: 186 },  floor: 'check', wall: ['stripe', '#3d7f8a', '#e05a4a'], dark: 0.08, seed: 21,
      art(c) {
        K.neon(c, 'DINER', 120, 22, '#ff6b6b', 16); K.neon(c, 'OPEN', 240, 22, '#7cffb5', 11); for (let i = 0; i < 4; i++) K.poster(c, 40 + i * 52, 46, 38, 30, 31 + i, '#e3c25a');
        K.windowNight(c, 360, 20, 80, 60, 3); K.windowNight(c, 456, 20, 80, 60, 4); K.clock(c, 300, 40);
        K.counter(c, 34, 110, 290, 22, 28, '#c8432f', '#e8e2d0'); for (let i = 0; i < 5; i++) { R(c, '#f2c84a', 52 + i * 56, 114, 10, 6); R(c, '#ffffff', 66 + i * 56, 115, 8, 5); }
        K.booth(c, 390, 116, 140, '#c84659'); K.booth(c, 390, 248, 140, '#c84659'); K.booth(c, 40, 248, 140, '#3d7fd0');
      },
      props: [60, 104, 148, 192, 236, 280].map((x) => prop(x, 176, (c, xx, yy) => K.stool(c, xx, yy, '#c8432f'))).concat([prop(24, 220, (c, x, y) => K.plant(c, x, y, 0.9))]),
      lights: [{ x: 180, y: 160, r: 150, a: 0.4 }, { x: 460, y: 200, r: 150, a: 0.4 }],
      glow(c, t) { K.glow(c, 120, 22, 70, '#ff6b6b', 0.3); K.glow(c, 240, 22, 40, '#7cffb5', 0.25 + 0.1 * (Math.sin(t * 6) > 0.6 ? 1 : 0)); },
      solids: [solid(34, 108, 294, 54), solid(390, 116, 140, 100), solid(390, 248, 140, 100), solid(40, 248, 140, 100)], staff: [{ x: 180, y: 100 }],
      patrons: [{ x: 410, y: 140 }, { x: 500, y: 196 }, { x: 440, y: 330 }, { x: 80, y: 272 }, { x: 140, y: 330 }],
      targets: () => [{ x: 190, y: 186, r: 60, action: 'ORDER', label: 'Diner counter · meals with buffs', use: () => openSafe(() => root.NightshiftFood?.openDiner?.()) }] },

    CLOTHING: {
      title: 'BOUTIQUE', robAt: { x: 400, y: 364 },  floor: 'oak', wall: ['panel', '#2e2236', '#6a4a7a'], dark: 0.08, seed: 31,
      art(c) {
        K.neon(c, 'CLOTHES', 290, 18, '#ff4ad8', 15); K.shelf(c, 20, 26, 220, 3, K.shoes, '#e3c25a'); K.shelf(c, 340, 26, 200, 3, K.boxes, '#e3c25a');
        K.rug(c, 190, 200, 180, 110, '#3a2440', '#e3c25a');
        K.rack(c, 40, 130, 150, 5); K.rack(c, 40, 230, 150, 9); K.rack(c, 380, 130, 150, 13);
        K.mirror(c, 520, 120, 24, 90); K.counter(c, 380, 300, 150, 22, 28, '#2a1f1a', '#e3c25a'); K.register(c, 486, 300);
      },
      props: [prop(250, 176, (c, x, y) => K.mannequin(c, x, y, '#ff9a2e')), prop(320, 176, (c, x, y) => K.mannequin(c, x, y, '#3d7fd0')), prop(530, 380, (c, x, y) => K.plant(c, x, y, 1)), prop(26, 382, (c, x, y) => K.plant(c, x, y, 0.9))],
      lights: [{ x: 290, y: 240, r: 170, a: 0.45 }],
      glow(c) { K.glow(c, 290, 18, 90, '#ff4ad8', 0.3); },
      solids: [solid(40, 130, 150, 48), solid(40, 230, 150, 48), solid(380, 130, 150, 48), solid(380, 300, 150, 52), solid(518, 118, 28, 94), solid(240, 160, 20, 20), solid(310, 160, 20, 20)],
      staff: [{ x: 455, y: 286 }], browsers: [{ x: 120, y: 200 }, { x: 450, y: 196 }],
      targets: () => [{ x: 455, y: 362, r: 60, action: 'TRY ON', label: 'Boutique · try on & buy', use: () => openSafe(() => root.NightshiftWardrobe?.open?.('store')) }, { x: 500, y: 230, r: 46, action: 'MIRROR', label: 'Mirror · change what you wear', use: () => openSafe(() => root.NightshiftWardrobe?.open?.('home')) }] },

    GARAGE: {
      title: 'GARAGE', floor: 'concrete', wall: ['block', '#3a3f48', '#e2c24a'], dark: 0.12, seed: 41,
      art(c) {
        K.neon(c, 'TUNE LAB', 290, 18, '#a34dff', 15); K.pegboard(c, 24, 26, 150, 50); K.shelf(c, 390, 26, 150, 3, K.parts, '#5a606b');
        K.carLift(c, 190, 120, 170, 210, (cc, x, y) => { try { const C = root.NightshiftCars; const s = C?.sprite?.('vanta', '#8a3fd6'); if (s) { cc.save(); cc.translate(x, y); cc.rotate(-Math.PI / 2); cc.fillStyle = 'rgba(0,0,0,0.35)'; cc.fillRect(-s.w * 0.85 + 6, -s.h * 0.85 + 8, s.w * 1.7, s.h * 1.7); cc.drawImage(s.cv, -s.w * 0.85, -s.h * 0.85, s.w * 1.7, s.h * 1.7); cc.restore(); } } catch { /* art optional */ } });
        K.toolChest(c, 30, 110, '#c8432f'); K.toolChest(c, 30, 200, '#3d7fd0'); K.block(c, 400, 240, 130, 22, 26, '#5a606b', { panels: 3, handles: true }); R(c, '#9aa3ab', 420, 236, 30, 6); R(c, '#e05a4a', 470, 234, 12, 8);
      },
      props: [prop(470, 150, (c, x, y) => K.tires(c, x, y, 4)), prop(510, 170, (c, x, y) => K.tires(c, x, y, 3)), prop(520, 380, (c, x, y) => K.tires(c, x, y, 2))],
      lights: [{ x: 275, y: 225, r: 180, a: 0.5 }],
      glow(c) { K.glow(c, 290, 18, 90, '#a34dff', 0.32); K.glow(c, 275, 225, 120, '#e8d8ff', 0.08); },
      solids: [solid(30, 110, 70, 64), solid(30, 200, 70, 64), solid(400, 240, 130, 48), solid(450, 120, 80, 56), solid(500, 356, 40, 30), solid(206, 135, 138, 180)],
      staff: [{ x: 380, y: 210 }],
      targets: () => [{ x: 380, y: 236, r: 60, action: 'TUNE', label: 'Mechanic · tune & style your car parked outside', use: () => openSafe(() => root.NightshiftTuning?.open?.()) }, { x: 120, y: 160, r: 50, action: 'TOOLS', label: 'Tool chest · scrap metal', use: (api) => crate('garage-' + api.key, { metal: 2, spring: 1 }, 'tool chest') }] },

    BANK: {
      title: 'BANK', floor: 'marble', wall: ['panel', '#22384a', '#c9a86a'], dark: 0.05, seed: 51,
      art(c) {
        K.neon(c, 'FIRST NIGHTSHIFT', 200, 18, '#e3c25a', 13, { board: true }); K.vault(c, 488, 52, 34); K.clock(c, 360, 36);
        K.counter(c, 40, 118, 380, 24, 38, '#5a4030', '#2a2d36'); for (let i = 0; i < 4; i++) { R(c, K.INK, 52 + i * 94, 92, 70, 28); R(c, '#9fc3d6', 54 + i * 94, 94, 66, 24); R(c, '#ffffff55', 56 + i * 94, 96, 10, 20); R(c, '#e3c25a', 80 + i * 94, 112, 14, 3); }
        K.rug(c, 180, 220, 200, 120, '#2a3f62', '#c9a86a'); K.waiting(c, 40, 300, 4, '#2a3f62'); K.atm(c, 480, 280); K.atm(c, 520, 280);
      },
      props: [prop(24, 250, (c, x, y) => K.plant(c, x, y, 1.1)), prop(440, 210, (c, x, y) => K.plant(c, x, y, 1.1))],
      lights: [{ x: 230, y: 200, r: 200, a: 0.4 }],
      glow(c, t) { K.glow(c, 488, 52, 60, '#e3c25a', 0.08 + 0.04 * Math.sin(t)); },
      solids: [solid(40, 116, 380, 66), solid(450, WALL, 90, 8), solid(40, 290, 80, 26), solid(478, 278, 80, 66)], staff: [{ x: 130, y: 104 }, { x: 320, y: 104 }],
      targets: (b) => { const out = [{ x: 230, y: 200, r: 70, action: 'BANK', label: 'Teller · invest your cash', use: () => openSafe(() => root.NightshiftMarket?.open?.()) }]; const v = heistAt(b); out.push({ x: 488, y: 120, r: 54, action: v ? 'CASE IT' : 'VAULT', label: v ? 'Vault · plan the heist' : 'Vault · locked tight', use: () => (v ? (root.NightshiftZones?.leave?.(), setTimeout(() => openSafe(() => root.NightshiftHeists?.open?.(v.id)), 80)) : say('🔒 Time lock. This vault isn’t worth the trouble.')) }); return out; } },

    CLUB: {
      title: 'CLUB', floor: 'club', wall: ['acoustic', '#1d1430', '#ff4ad8'], dark: 0.55, seed: 61,
      art(c) {
        K.backbar(c, 20, 200); K.neon(c, 'BAR', 120, 14, '#ff4ad8', 12); K.neon(c, 'NEON ROOM', 400, 18, '#3ad0ff', 15);
        K.counter(c, 28, 120, 200, 22, 30, '#2a1f30', '#5a3a6a'); K.speaker(c, 252, 100); K.speaker(c, 470, 100); K.djBooth(c, 316, 104);
        K.sofa(c, 440, 270, 96, '#5a2a6a'); K.block(c, 456, 330, 64, 20, 10, '#2a1f30'); R(c, '#ffd970', 470, 334, 6, 8); R(c, '#9fe6ff', 490, 334, 6, 8);
        K.poolTable(c, 40, 250);
      },
      props: [44, 84, 124, 164, 204].map((x) => prop(x, 186, (c, xx, yy) => K.stool(c, xx, yy, '#ff4ad8'))),
      lights: [{ x: 120, y: 150, r: 110, a: 0.6 }, { x: 330, y: 240, r: 160, a: 0.55 }, { x: 488, y: 300, r: 90, a: 0.5 }, { x: 100, y: 280, r: 90, a: 0.5 }],
      glow(c, t) {
        for (let x = 250; x < 430; x += 30) for (let y = 180; y < 320; y += 30) { const k = (Math.floor(t * 3) + x / 30 + y / 30) % 4; c.fillStyle = ['#ff4ad855', '#3ad0ff55', '#c9e86a55', '#ffffff1a'][k]; c.fillRect(x, y, 28, 28); }
        K.glow(c, 400, 18, 110, '#3ad0ff', 0.3); K.glow(c, 120, 14, 60, '#ff4ad8', 0.3); K.glow(c, 340, 250, 150, ['#ff4ad8', '#3ad0ff', '#a34dff'][Math.floor(t * 1.5) % 3], 0.16);
        c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const a = t * 0.8 + i * 2.1; c.fillStyle = ['#ff4ad818', '#3ad0ff18', '#c9e86a18'][i]; c.beginPath(); c.moveTo(370, 120); c.lineTo(340 + Math.cos(a) * 140 - 24, 250 + Math.sin(a) * 60); c.lineTo(340 + Math.cos(a) * 140 + 24, 250 + Math.sin(a) * 60); c.fill(); } c.restore();
      },
      solids: [solid(28, 118, 204, 56), solid(252, WALL, 30, 64), solid(470, WALL, 30, 64), solid(316, 104, 110, 52), solid(434, 270, 108, 72), solid(40, 250, 120, 78)],
      staff: [{ x: 120, y: 104 }, { x: 370, y: 100 }], dancers: [{ x: 290, y: 220 }, { x: 350, y: 260 }, { x: 410, y: 210 }, { x: 320, y: 300 }, { x: 270, y: 280 }, { x: 390, y: 290 }],
      targets: (b) => { const v = venueAt(b); return [{ x: 130, y: 200, r: 60, action: v ? 'VIP' : 'BAR', label: v ? `${v.name} · the venue` : 'Bar · a round for the house ($40)', use: () => (v ? openSafe(() => root.NightshiftVenues?.open?.('club', v.id)) : drink()) }, { x: 340, y: 250, r: 80, action: 'DANCE', label: 'Dance floor · shake off some heat', use: () => dance() }]; } },

    WAREHOUSE: {
      title: 'WAREHOUSE', floor: 'concrete', wall: ['block', '#4a463a', '#e2c24a'], dark: 0.2, seed: 71,
      art(c) {
        K.neon(c, 'LOADING BAY 3', 290, 18, '#e2c24a', 12); K.shelf(c, 20, 26, 520, 3, K.boxes, '#c8432f', 20);
        for (const [x, y, w, h] of [[40, 120, 140, 50], [40, 210, 100, 50], [400, 120, 120, 90], [300, 270, 90, 40]]) { K.block(c, x, y, w, 18, h - 18, '#a87a4a', { panels: Math.max(2, Math.round(w / 40)) }); for (let i = 0; i < w; i += 12) R(c, '#c79a62', x + i, y + 2, 1, 14); }
        K.block(c, 230, 130, 70, 30, 14, '#8a6a3e', { panels: 3 }); R(c, '#e2c24a', 220, 330, 120, 3);
      },
      props: [prop(350, 230, (c, x, y) => K.tires(c, x, y, 3))],
      lights: [{ x: 280, y: 200, r: 200, a: 0.5 }],
      glow(c) { K.glow(c, 290, 18, 90, '#e2c24a', 0.2); },
      solids: [solid(40, 120, 140, 50), solid(40, 210, 100, 50), solid(400, 120, 120, 90), solid(300, 270, 90, 40), solid(230, 130, 70, 44), solid(330, 214, 36, 18)], staff: [{ x: 480, y: 300, guard: true }],
      targets: (b, api) => [{ x: 110, y: 196, r: 50, action: 'SEARCH', label: 'Crates · scavenge parts', use: () => crate('wh1-' + api.key, { metal: 3, pipe: 1, tape: 1 }, 'crates') }, { x: 90, y: 286, r: 50, action: 'SEARCH', label: 'Crates · scavenge parts', use: () => crate('wh2-' + api.key, { spring: 2, wood: 2 }, 'crates') }, { x: 460, y: 236, r: 50, action: 'SEARCH', label: 'Pallet · hardware', use: () => crate('wh3-' + api.key, { metal: 2, tape: 1, spring: 1 }, 'pallet') }] },

    APARTMENTS: {
      title: 'APARTMENT LOBBY', floor: 'lobby', wall: ['panel', '#4a3a2e', '#8a6a3e'], dark: 0.1, seed: 81,
      art(c) {
        for (let i = 0; i < 16; i++) { const x = 30 + (i % 8) * 24, y = 20 + Math.floor(i / 8) * 22; R(c, K.INK, x, y, 22, 20); R(c, '#c8a050', x + 1, y + 1, 20, 18); R(c, '#8a6a30', x + 7, y + 8, 8, 2); R(c, '#f4f1ea', x + 3, y + 3, 6, 3); }
        R(c, K.INK, 400, 14, 96, 82); R(c, '#9aa3ab', 402, 16, 92, 80); R(c, '#c9d1d6', 402, 16, 92, 3); R(c, '#5a6168', 447, 16, 2, 80); R(c, '#f2c84a', 500, 50, 6, 6); K.neon(c, '▲ ▼', 448, 8, '#f2c84a', 8, { board: false });
        K.poster(c, 260, 26, 50, 40, 5, '#c8a050'); K.windowNight(c, 324, 22, 56, 50, 7);
        K.rug(c, 190, 220, 180, 100, '#5a2a2a', '#c8a050'); K.sofa(c, 210, 250, 140, '#3d5a6a'); K.desk(c, 40, 180, 90, '#5a3e2a', true);
      },
      props: [prop(520, 330, (c, x, y) => K.plant(c, x, y, 1.2)), prop(30, 330, (c, x, y) => K.lamp(c, x, y)), prop(380, 240, (c, x, y) => K.plant(c, x, y, 0.9))],
      lights: [{ x: 280, y: 260, r: 160, a: 0.45 }, { x: 30, y: 290, r: 90, a: 0.6 }],
      glow(c) { K.glow(c, 30, 286, 70, '#ffe9a8', 0.3); },
      solids: [solid(400, WALL, 96, 6), solid(204, 250, 152, 50), solid(40, 180, 90, 42), solid(508, 310, 26, 24), solid(18, 310, 24, 24), solid(370, 224, 22, 20)], staff: [{ x: 84, y: 166 }],
      targets: (b, api) => [{ x: 130, y: 120, r: 60, action: 'MAIL', label: 'Mailboxes · anything good?', use: () => mail('mail-' + api.key) }, { x: 448, y: 130, r: 50, action: 'ELEVATOR', label: 'Elevator · needs a key', use: () => say('🛗 Needs a resident key. Your own place is at the Midtown apartments.') }] },

    // ---------------- v0.71 new rooms ----------------
    'GUN SHOP': {
      title: 'GUN SHOP', robAt: { x: 396, y: 346 },  floor: 'concrete', wall: ['brick', '#4a2626', '#1d2024'], dark: 0.18, seed: 91,
      art(c) {
        K.neon(c, 'AMMO & ARMS', 280, 16, '#ff4a4a', 14); K.shelf(c, 24, 28, 232, 3, K.guns, '#3a2a20', 19); K.shelf(c, 304, 28, 232, 3, (cc, x, y, w, k) => (k === 2 ? K.boxes(cc, x, y, w, 4) : K.pistols(cc, x, y, w, k)), '#3a2a20', 19);
        K.displayCase(c, 40, 140, 200, (cc, x, y, w) => K.pistols(cc, x, y, w, 1)); K.displayCase(c, 320, 140, 200, (cc, x, y, w) => K.pistols(cc, x, y, w, 2));
        K.counter(c, 380, 280, 150, 22, 28, '#2a2d36', '#5a3e2a'); K.register(c, 480, 280); K.poster(c, 20, 240, 26, 34, 77, '#e05a4a');
        R(c, K.INK, 30, 300, 110, 56); R(c, '#1d2024', 31, 301, 108, 54); for (let i = 0; i < 3; i++) { c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(56 + i * 30, 328, 10, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e05a4a'; c.beginPath(); c.arc(56 + i * 30, 328, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(56 + i * 30, 328, 2.5, 0, Math.PI * 2); c.fill(); }
      },
      props: [prop(530, 220, (c, x, y) => K.plant(c, x, y, 0.9))],
      lights: [{ x: 140, y: 170, r: 120, a: 0.5 }, { x: 420, y: 170, r: 120, a: 0.5 }, { x: 455, y: 300, r: 100, a: 0.5 }],
      glow(c, t) { K.glow(c, 280, 16, 110, '#ff4a4a', 0.28 + 0.04 * Math.sin(t * 5)); K.glow(c, 140, 150, 90, '#9fe6ff', 0.1); K.glow(c, 420, 150, 90, '#9fe6ff', 0.1); },
      solids: [solid(40, 140, 200, 46), solid(320, 140, 200, 46), solid(380, 280, 150, 52), solid(30, 300, 110, 56)], staff: [{ x: 455, y: 266 }, { x: 280, y: 120, guard: true }], browsers: [{ x: 140, y: 214 }],
      targets: () => [{ x: 455, y: 346, r: 60, action: 'BUY', label: 'Gun counter · weapons, mods, repairs', use: () => openSafe(() => root.NightshiftWeapons?.open?.()) }, { x: 140, y: 214, r: 50, action: 'LOOK', label: 'Display case · inspect a gun', use: () => openSafe(() => root.NightshiftWeaponArt?.inspect?.()) }] },

    TATTOO: {
      title: 'TATTOO', robAt: { x: 176, y: 232 },  floor: 'check', wall: ['stripe', '#2a1a2a', '#ff4ad8'], dark: 0.22, seed: 101,
      art(c) {
        K.neon(c, 'TATTOO', 400, 18, '#ff4ad8', 16); K.flash(c, 24, 14, 240, 3, 7); K.mirror(c, 316, 34, 40, 54);
        K.tattooChair(c, 300, 140); K.tattooChair(c, 420, 140); K.curtain(c, 384, 110, 96, '#5a2a6a');
        K.counter(c, 40, 160, 150, 22, 28, '#1d1430', '#ff4ad8'); K.register(c, 150, 160); K.sofa(c, 40, 290, 120, '#5a2a6a');
      },
      props: [prop(530, 380, (c, x, y) => K.plant(c, x, y, 1)), prop(200, 310, (c, x, y) => K.lamp(c, x, y, '#ff8ad8'))],
      lights: [{ x: 330, y: 190, r: 110, a: 0.6 }, { x: 450, y: 190, r: 110, a: 0.6 }, { x: 110, y: 200, r: 110, a: 0.5 }, { x: 200, y: 270, r: 80, a: 0.6 }],
      glow(c, t) { K.glow(c, 400, 18, 100, '#ff4ad8', 0.3 + 0.05 * Math.sin(t * 4)); K.glow(c, 200, 262, 60, '#ff8ad8', 0.25); },
      solids: [solid(300, 140, 56, 84), solid(420, 140, 56, 84), solid(40, 160, 150, 52), solid(36, 290, 136, 50), solid(190, 296, 20, 16)], staff: [{ x: 360, y: 180 }, { x: 110, y: 146 }], patrons: [{ x: 316, y: 170 }],
      targets: () => [{ x: 470, y: 250, r: 60, action: 'INK', label: 'Get a tattoo · $150 · +charisma', use: () => tattoo() }, { x: 110, y: 230, r: 54, action: 'FLASH', label: 'Flash wall · pick a design', use: () => say('🖋️ Pick a design at the chair · each piece is one of a kind') }] },

    'AUTO PARTS': {
      title: 'AUTO PARTS', robAt: { x: 392, y: 346 },  floor: 'tile', wall: ['block', '#3a4250', '#e05a4a'], dark: 0.08, seed: 111,
      art(c) {
        K.neon(c, 'PARTS', 280, 16, '#ff6b4a', 15); K.shelf(c, 24, 28, 230, 3, K.parts, '#5a606b', 19); K.shelf(c, 306, 28, 230, 3, (cc, x, y, w, k) => K.parts(cc, x, y, w, k + 1), '#5a606b', 19);
        for (const y of [140, 220]) { K.block(c, 50, y, 190, 14, 34, '#5a606b', { panels: 4 }); K.parts(c, 54, y - 10, 180, y); }
        K.counter(c, 370, 280, 160, 22, 28, '#2a2d36', '#e05a4a'); K.register(c, 480, 280); R(c, '#c9d1d6', 390, 276, 26, 8);
      },
      props: [prop(440, 190, (c, x, y) => K.tires(c, x, y, 4)), prop(490, 200, (c, x, y) => K.tires(c, x, y, 5)), prop(520, 160, (c, x, y) => K.tires(c, x, y, 3))],
      lights: [{ x: 150, y: 200, r: 150, a: 0.45 }, { x: 450, y: 250, r: 140, a: 0.45 }],
      glow(c) { K.glow(c, 280, 16, 90, '#ff6b4a', 0.28); },
      solids: [solid(50, 140, 190, 50), solid(50, 220, 190, 50), solid(370, 280, 160, 52), solid(420, 168, 120, 40)], staff: [{ x: 455, y: 266 }], browsers: [{ x: 140, y: 208 }],
      targets: () => [{ x: 455, y: 346, r: 60, action: 'PARTS', label: 'Parts counter · tune your car outside', use: () => openSafe(() => root.NightshiftTuning?.open?.()) }, { x: 145, y: 290, r: 54, action: 'STYLE', label: 'Body kits & rims · style studio', use: () => openSafe(() => { const v = root.NightshiftCars?.live?.().find((q) => q.owned); return v ? root.NightshiftCarStyle?.open?.(v) : (say('🚗 Park a car you own outside first'), true); }) }] },

    GYM: {
      title: 'GYM', floor: 'rubber', wall: ['block', '#2a2d36', '#e05a4a'], dark: 0.12, seed: 121,
      art(c) {
        K.neon(c, 'IRON GYM', 280, 16, '#ff5a5a', 15); for (let i = 0; i < 4; i++) K.mirror(c, 30 + i * 130, 32, 110, 54);
        K.dumbbells(c, 30, 104, 220); K.benchPress(c, 70, 170); K.benchPress(c, 70, 260); K.treadmill(c, 440, 120); K.treadmill(c, 490, 120);
        K.block(c, 300, 300, 90, 30, 6, '#3d7fd0'); K.block(c, 410, 300, 90, 30, 6, '#3d7fd0');
      },
      props: [prop(330, 200, (c, x, y) => K.punchBag(c, x, y)), prop(390, 200, (c, x, y) => K.punchBag(c, x, y))],
      lights: [{ x: 160, y: 220, r: 160, a: 0.45 }, { x: 420, y: 240, r: 160, a: 0.45 }],
      glow(c) { K.glow(c, 280, 16, 90, '#ff5a5a', 0.3); },
      solids: [solid(30, 104, 220, 26), solid(54, 160, 92, 36), solid(54, 250, 92, 36), solid(440, 120, 84, 84), solid(320, 186, 20, 16), solid(380, 186, 20, 16)], staff: [{ x: 250, y: 140 }], browsers: [{ x: 460, y: 160 }, { x: 110, y: 240 }],
      targets: () => [{ x: 350, y: 260, r: 70, action: 'TRAIN', label: 'Train · athletics & toughness', use: () => train() }, { x: 250, y: 160, r: 50, action: 'COACH', label: 'Coach · memberships', use: () => openSafe(() => root.NightshiftVenues?.open?.('gym', 'iron')) }] },

    HOSPITAL: {
      title: 'HOSPITAL', floor: 'lino', wall: ['tile', '#dfe9ec', '#3d99d6'], dark: 0.04, seed: 131,
      art(c) {
        K.neon(c, '✚ EMERGENCY', 160, 18, '#ff4a4a', 13); K.shelf(c, 300, 30, 230, 3, K.meds, '#c9d1d6'); K.clock(c, 270, 40);
        K.counter(c, 40, 120, 200, 22, 30, '#e8eef3', '#3d99d6'); K.desk(c, 100, 104, 70, '#e8eef3', true);
        K.hospitalBed(c, 320, 130); K.hospitalBed(c, 420, 130); K.curtain(c, 396, 118, 100, '#7cc4b8'); K.curtain(c, 496, 118, 100, '#7cc4b8');
        K.waiting(c, 40, 300, 5, '#3d99d6'); K.block(c, 330, 300, 30, 16, 24, '#c9d1d6'); R(c, '#e05a4a', 334, 304, 8, 6); R(c, '#9fd8f0', 346, 304, 8, 6);
      },
      props: [prop(250, 330, (c, x, y) => K.plant(c, x, y, 1))],
      lights: [{ x: 280, y: 220, r: 240, a: 0.3 }],
      glow(c, t) { K.glow(c, 160, 18, 80, '#ff4a4a', 0.2 + 0.08 * (Math.sin(t * 3) > 0 ? 1 : 0)); },
      solids: [solid(40, 120, 200, 52), solid(320, 128, 46, 96), solid(420, 128, 46, 96), solid(36, 290, 104, 22), solid(330, 300, 30, 40), solid(240, 316, 20, 16)], staff: [{ x: 135, y: 106 }, { x: 390, y: 260 }], patrons: [{ x: 342, y: 170 }],
      targets: () => [{ x: 140, y: 196, r: 60, action: 'HEAL', label: 'Reception · patch you up ($60)', use: () => heal() }] },

    POLICE: {
      title: 'POLICE STATION', floor: 'tile', wall: ['block', '#2a3548', '#3d7fd0'], dark: 0.1, seed: 141,
      art(c) {
        K.neon(c, 'POLICE', 200, 18, '#3d99ff', 15); R(c, K.INK, 300, 20, 110, 60); R(c, '#d8cfb4', 302, 22, 106, 56); for (let i = 0; i < 6; i++) K.poster(c, 308 + (i % 3) * 34, 26 + Math.floor(i / 3) * 26, 26, 22, 200 + i, '#1d2024'); K.shelf(c, 20, 30, 150, 3, K.files, '#5a606b');
        K.counter(c, 40, 120, 220, 22, 34, '#2a3548', '#9aa3ab'); K.desk(c, 60, 210, 80, '#5a606b', true); K.desk(c, 170, 210, 80, '#5a606b', true);
        K.cellBars(c, 420, 110, 120, 140); K.block(c, 436, 210, 60, 14, 8, '#5a606b'); K.lockers(c, 30, 300, 5, '#3d6e8a');
      },
      props: [prop(380, 380, (c, x, y) => K.plant(c, x, y, 0.9))],
      lights: [{ x: 150, y: 200, r: 170, a: 0.4 }, { x: 480, y: 180, r: 90, a: 0.3 }],
      glow(c, t) { K.glow(c, 200, 18, 90, '#3d99ff', 0.28); const red = Math.sin(t * 5) > 0; K.glow(c, 540, 12, 40, red ? '#ff3a3a' : '#3d7fff', 0.4); },
      solids: [solid(40, 120, 220, 58), solid(60, 196, 80, 42), solid(170, 196, 80, 42), solid(416, 108, 128, 146), solid(28, 296, 92, 66)], staff: [{ x: 150, y: 104 }, { x: 100, y: 196 }, { x: 330, y: 200, guard: true }],
      targets: () => [{ x: 150, y: 200, r: 60, action: 'FINE', label: 'Front desk · pay off your wanted level', use: () => payFine() }, { x: 480, y: 280, r: 54, action: 'CELL', label: 'Holding cell', use: () => say('🚔 "Keep walking, unless you want the room."') }] },
  };

  // ---------------- actions ----------------
  function openSafe(fn) { try { const r = fn(); if (r === false) say('Not available right now'); } catch (e) { console.error(e); say('Not available right now'); } }
  function crate(id, loot, what) {
    const now = Date.now(), next = state.crates[id] || 0;
    if (now < next) { say(`📦 Picked clean · the ${what} refill in ${Math.ceil((next - now) / 60000)} min`); return; }
    const SUP = root.NightshiftSupply; if (!SUP?.give) { say('🎒 You need your backpack'); return; }
    const r = SUP.give(loot); state.crates[id] = now + 20 * 60000; persist(); gameSave();
    const got = Object.entries(loot).map(([k, n]) => `${n} ${k}`).join(', ');
    say(r && r.ok === false ? `🎒 Backpack full · couldn't carry ${got}` : `📦 Found ${got} · back in 20 min`);
    try { root.NightshiftSkills?.gain?.('crafting', 6, 'scavenge'); } catch { /* optional */ }
  }
  function mail(id) {
    const now = Date.now(), next = state.mail[id] || 0, p = P(); if (!p) return;
    if (now < next) { say('📭 Nothing new. Check back later.'); return; }
    state.mail[id] = now + 30 * 60000; persist();
    const roll = Math.random();
    if (roll < 0.35) { const c = 20 + Math.floor(Math.random() * 60); p.cash += c; say(`💌 A birthday card with $${c} inside. Not yours, but… finders keepers.`); try { root.NightshiftCrime?.heat?.(0.2); } catch { /* optional */ } }
    else if (roll < 0.6) { root.NightshiftSupply?.give?.({ tape: 1 }); say('📦 A package with packing tape. Useful for crafting.'); }
    else say('📭 Junk mail. Pizza coupons, mostly.');
    gameSave();
  }
  function drink() { const p = P(); if (!p) return; if (p.cash < 40) { say('Needs $40'); return; } p.cash -= 40; p.hp = Math.min(100, p.hp + 10); try { root.NightshiftSkills?.gain?.('charisma', 15, 'bar'); } catch { /* optional */ } say('🥃 You buy a round · +10 health, people like you more'); gameSave(); }
  let lastDance = 0;
  function dance() { const now = Date.now(); if (now - lastDance < 60000) { say('💃 Catch your breath first'); return; } lastDance = now; const p = P(); if (p) p.heat = Math.max(0, (p.heat || 0) - 0.5); try { root.NightshiftSkills?.gain?.('athletics', 12, 'dance'); } catch { /* optional */ } say('🕺 You hit the floor · heat cools off, +athletics'); }
  const now0 = () => Date.now(); let lastInk = 0, lastTrain = 0;
  function heal() { const p = P(); if (!p) return; const r = ACT.heal(p); say(r.msg); if (r.ok) gameSave(); }
  function payFine() { const p = P(); if (!p) return; const r = ACT.fine(p); say(r.msg); if (r.ok) gameSave(); }
  function tattoo() { const p = P(); if (!p) return; const r = ACT.tattoo(p, lastInk, now0()); say(r.msg); if (r.ok) { lastInk = now0(); try { root.NightshiftSkills?.gain?.('charisma', 40, 'tattoo'); } catch { /* optional */ } gameSave(); } }
  function train() { const p = P(); if (!p) return; const r = ACT.train(p, lastTrain, now0()); say(r.msg); if (r.ok) { lastTrain = now0(); try { root.NightshiftSkills?.gain?.('athletics', 30, 'gym'); root.NightshiftSkills?.gain?.('toughness', 20, 'gym'); } catch { /* optional */ } gameSave(); } }
  // ---- hold-ups (v0.72) ----
  let hold = null;
  function weaponNow() { try { const W = root.NightshiftWeapons; return W?.state?.equipped ? W.current() : null; } catch { return null; } }
  function startRob(type, key, spot, api, people) {
    if (hold) return; const p = P(); if (!p) return;
    if (!ACT.armed(weaponNow())) { say('🔫 You need a gun out to rob the place'); return; }
    const last = state.robbed[key] || 0; if (Date.now() - last < ROB_COOLDOWN) { say(`🚨 They just got robbed · the register is empty for ${Math.ceil((last + ROB_COOLDOWN - Date.now()) / 60000)} min`); return; }
    const clerk = people.filter((q) => !q.seated && q.dance === undefined).sort((a, b) => dist(a, spot) - dist(b, spot))[0] || null;
    hold = { type, key, spot, t0: performance.now(), clerk, tick: 0 };
    say('🔫 "Empty the register! Now!"'); api.float(spot.x, spot.y - 50, '🔫 HANDS UP!', '#ff6a6a'); if (clerk) api.float(clerk.x, clerk.y - 46, '😨🙌', '#ffe9a8');
    try { root.NightshiftCombatVision?.engage?.(4000); } catch { /* n/a */ }
  }
  function holdTick(api) {
    if (!hold) return; const p = P(), pos = api.pos; if (!p || !pos) { hold = null; return; }
    const el = performance.now() - hold.t0;
    if (Math.hypot(pos.x - hold.spot.x, pos.y - hold.spot.y) > 90) { p.heat = (p.heat || 0) + 0.8; say('🚨 You backed off · the clerk hit the silent alarm'); hold = null; gameSave(); return; }
    const sec = Math.floor(el / 1000); if (sec > hold.tick && sec < 3) { hold.tick = sec; api.float(hold.spot.x, hold.spot.y - 50, String(3 - sec), '#ffe9a8'); }
    if (el < HOLD_MS) return;
    const r = ACT.rob(hold.type, Math.random(), Math.random()); state.robbed[hold.key] = Date.now(); persist();
    if (r.resist) { try { root.NightshiftAuthority?.damagePlayer?.(r.dmg, 'clerk'); } catch { p.hp = Math.max(1, p.hp - r.dmg); } api.shake?.(5); api.fx?.('muzzle', hold.spot.x, hold.spot.y - 30, 200); }
    else { p.cash += r.cash; api.float(hold.spot.x, hold.spot.y - 50, '+$' + r.cash, '#7cffb5'); try { root.NightshiftSkills?.gain?.('stealth', 20, 'robbery'); } catch { /* optional */ } }
    const store = hold.type; p.heat = (p.heat || 0) + r.heat; say(r.msg); hold = null; gameSave();
    try { root.dispatchEvent?.(new CustomEvent('ns:event', { detail: { type: 'store-robbed', store, ok: r.ok } })); } catch { /* n/a */ }
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function heistAt(b) { try { const vs = root.NightshiftHeists?.state ? (root.NightshiftHeistsData?.BANKS || []) : []; for (const v of vs) { const best = B().filter((x) => x.name === 'BANK' && variant(x) === 'BANK').sort((p, q) => dist(p, v.near) - dist(q, v.near))[0]; if (best === b) return v; } } catch { /* n/a */ } return null; }
  function venueAt(b) { try { return (root.NightshiftVenues?.places?.() || []).find((v) => v.kind === 'club' && Math.abs(v.y - (b.y + b.h + 12)) < 4 && Math.abs(v.x - (b.x + b.w / 2)) < 140) || null; } catch { return null; } }

  // ---------------- zones: one per room type, the building's identity passed in on enter ----------------
  const rng = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const zid = (type) => 'in-' + type.toLowerCase().replace(/\s+/g, '-');
  function register() {
    const Z = root.NightshiftZones; if (!Z?.register) return false;
    for (const [type, t] of Object.entries(T)) {
      let curB = null, people = [];
      Z.register({
        id: zid(type), name: t.title, tagline: 'USE things to interact · 🚪 exit at the bottom', w: W, h: H, indoor: true, dark: t.dark ?? 0.08, zoom: 1.2, fit: 1.0, camBias: 0.66, bg: '#07090d',
        spawn: { x: DOOR.x, y: DOOR.y - 34, angle: -Math.PI / 2 },
        ground(c) { K.floor(c, t.floor, t.seed); K.wall(c, t.wall[0], t.wall[1], t.wall[2], t.seed); t.art(c); },
        drawGround: t.glow ? (c, tt) => t.glow(c, tt) : undefined,
        props: () => t.props || [],
        lights: () => t.lights || [],
        solids: [solid(0, 0, W, WALL + 4), solid(0, 0, 10, H), solid(W - 10, 0, 10, H), solid(0, H - 8, W / 2 - 34, 8), solid(W / 2 + 34, H - 8, W / 2 - 34, 8), ...t.solids],
        onEnter(api, data) {
          hold = null; curB = data?.b || null; const r = rng((data?.seed || 7) >>> 0); people = [];
          for (const s of t.staff || []) people.push({ x: s.x, y: s.y, angle: Math.PI / 2, id: type + '-staff-' + s.x, role: s.guard ? 'security' : null });
          for (const s of t.patrons || []) if (r() < 0.8) people.push({ x: s.x, y: s.y, angle: Math.PI / 2, id: type + '-pat-' + Math.floor(r() * 24), seated: true, seat: { x: s.x, y: s.y } });
          for (const s of t.browsers || []) if (r() < 0.85) people.push({ x: s.x, y: s.y, angle: -Math.PI / 2, id: type + '-b-' + Math.floor(r() * 24) });
          for (const s of t.dancers || []) people.push({ x: s.x, y: s.y, angle: r() * 6, id: type + '-d-' + Math.floor(r() * 24), dance: r() * 6 });
          api.key = data?.key || 'x';
        },
        update(api, dt) { holdTick(api); const now = performance.now() / 1000; for (const p of people) { if (p.dance !== undefined) { p.angle = p.dance + now * 2.2; p.moving = Math.sin(now * 5 + p.dance) > 0; p.walkTicks = (p.walkTicks || 0) + dt; } } },
        actors: () => people,
        targets: (api) => [{ x: DOOR.x, y: DOOR.y - 6, r: 46, action: 'EXIT', label: 'Back to the street', use: () => root.NightshiftZones.leave() }, ...t.targets(curB || {}, api), ...(t.robAt ? [{ x: t.robAt.x, y: t.robAt.y, r: 40, action: hold ? '…' : 'ROB', label: hold ? 'Hold it…' : 'Hold up the register (needs a gun out)', use: () => startRob(type, 'rob-' + api.key, t.robAt, api, people) }] : [])],
      });
    }
    return true;
  }
  // ---------------- doors in the city ----------------
  const BLURB = { 'CORNER SHOP': 'food, meds, ammo', DINER: 'meals with buffs', CLOTHING: 'clothes & mirror', GARAGE: 'tune your car · scrap', BANK: 'invest · case the vault', CLUB: 'drinks, dancing, cools heat', WAREHOUSE: 'scavenge crafting parts', APARTMENTS: 'lobby · mailboxes',
    'GUN SHOP': 'weapons, mods, repairs', TATTOO: 'ink · +charisma', 'AUTO PARTS': 'car parts & kits', GYM: 'train · athletics', HOSPITAL: 'heal up', POLICE: 'pay off your wanted level' };
  const homeDoor = { x: 950, y: 735 };
  let doorList = null;
  function doors() { if (doorList) return doorList; doorList = B().map((b, i) => ({ b, i, type: variant(b), x: b.x + b.w / 2, y: b.y + b.h + 14 })).filter((d) => T[d.type] && !(d.b.name === 'APARTMENTS' && Math.hypot(d.x - homeDoor.x, d.y - homeDoor.y) < 120)); return doorList; }
  function enter(d) { const Z = root.NightshiftZones; const p = P(); if (!Z || !p) return false; return Z.enter(zid(d.type), null, { ret: { x: d.x, y: d.y + 10 }, data: { b: d.b, key: d.i, seed: d.i * 7919 + 17 } }); }
  const ICON = { 'CORNER SHOP': '🏪', DINER: '🍔', CLOTHING: '👕', GARAGE: '🔧', BANK: '🏦', CLUB: '🪩', WAREHOUSE: '📦', APARTMENTS: '🏢', 'GUN SHOP': '🔫', TATTOO: '🖋️', 'AUTO PARTS': '⚙️', GYM: '🏋️', HOSPITAL: '🏥', POLICE: '🚔' };
  function hookDoors() {
    const E = root.NightshiftEncounters; if (!E || E.__interiors) return !!E?.__interiors;
    const locs = E.locations, use = E.use;
    E.locations = function () { const list = locs.apply(this, arguments) || []; const p = P(); if (!p || p.hp <= 0) return list; const near = doors().filter((d) => Math.abs(d.x - p.x) < 900 && Math.abs(d.y - p.y) < 700); return [...list, ...near.map((d) => ({ id: 'door-' + d.i, type: 'door', x: d.x, y: d.y, ready: true, color: '#9fd4ff', label: (ICON[d.type] || '🚪') + ' ' + T[d.type].title, action: 'ENTER', hint: 'Walk in · ' + (BLURB[d.type] || 'look around') }))]; };
    E.use = function (id) { if (String(id).startsWith('door-')) { const d = doors().find((q) => 'door-' + q.i === id); if (d) { enter(d); return true; } } return use.apply(this, arguments); };
    E.__interiors = true; return true;
  }
  const t1 = setInterval(() => { if (register()) clearInterval(t1); }, 300);
  const t2 = setInterval(() => { if (hookDoors()) clearInterval(t2); }, 300);
  root.NightshiftInteriors2 = Object.freeze({ enter, doors, variant, TYPES: Object.keys(T), BLURB, ACT, title: (ty) => T[ty]?.title || ty });
})(typeof globalThis !== 'undefined' ? globalThis : this);
