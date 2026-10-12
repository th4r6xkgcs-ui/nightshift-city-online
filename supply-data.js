/* Supply chains (Claude-owned). Pure and Node-testable; supply.js runs it in game. Fictional game economy.
 *
 * The loop: COLLECT raw materials at a place (stand there while a ring fills), carry them in a backpack with
 * limited space, PROCESS them somewhere else, then SELL somewhere else again. Guns follow the same idea:
 * collect parts -> craft at a bench (home bench for crude guns, your Lockup workshop for real ones) -> use
 * them until they wear out, or sell them to the arms buyer.
 *
 * Numbers are tuned so every chain makes money but starts slow: spots run dry and refill over time
 * (stock/regen), bags are small at first, illegal spots build heat, and some only open at night.
 * Processed weed/coke go into the game's own pocket (inventory.js), so Codex dealers, street customers and
 * orders keep working. Everything else lives in this module's bag / home locker. */
(function (root) {
  'use strict';

  // ---- materials (w = backpack space per unit; price = what the hardware counter / parts counter charges) ----
  const MATERIALS = {
    metal: { name: 'Scrap metal', icon: '🔩', w: 1, price: 6, kind: 'gun' },
    pipe: { name: 'Steel pipe', icon: '🪈', w: 2, price: 30, kind: 'gun' },
    spring: { name: 'Spring', icon: '🌀', w: 1, price: 25, kind: 'gun' },
    wood: { name: 'Hardwood', icon: '🪵', w: 2, price: 14, kind: 'gun' },
    tape: { name: 'Duct tape', icon: '🩹', w: 1, price: 8, kind: 'gun' },
    barrel: { name: 'Barrel', icon: '📏', w: 2, price: 220, kind: 'part' },
    trigger: { name: 'Trigger group', icon: '⚙️', w: 1, price: 160, kind: 'part' },
    frame: { name: 'Frame', icon: '🧱', w: 3, price: 380, kind: 'part' },
    bolt: { name: 'Bolt carrier', icon: '🔧', w: 2, price: 260, kind: 'part' },
    lens: { name: 'Optic lens', icon: '🔍', w: 1, price: 180, kind: 'part' },
    leaf: { name: 'Raw leaf', icon: '🍃', w: 1, price: 0, kind: 'drug' },
    snow: { name: 'Raw snow brick', icon: '🧊', w: 2, price: 0, kind: 'drug' },
    chem: { name: 'Chemicals', icon: '⚗️', w: 2, price: 0, kind: 'drug' },
    baggie: { name: 'Baggies', icon: '🛍️', w: 0, price: 1, kind: 'drug' },
    pills: { name: 'Party pills', icon: '💊', w: 0, price: 0, kind: 'product' },
  };
  const IDS = Object.keys(MATERIALS);
  // Things the hardware counter (next to the corner shop) sells, in packs.
  const HARDWARE = [
    { id: 'tape', n: 2 }, { id: 'baggie', n: 10 }, { id: 'metal', n: 5 }, { id: 'wood', n: 2 },
  ];
  // Things the gun shop's parts counter sells (one at a time).
  const PARTS_COUNTER = ['spring', 'pipe', 'barrel', 'trigger', 'bolt', 'frame', 'lens'];

  // ---- backpacks (bought at a clothing store) ----
  const BAGS = [
    { id: 'pockets', name: 'Jacket pockets', icon: '🧥', cap: 24, price: 0 },
    { id: 'school', name: 'Old school bag', icon: '🎒', cap: 45, price: 250 },
    { id: 'duffel', name: 'Gym duffel', icon: '👜', cap: 80, price: 900 },
    { id: 'hiking', name: 'Hiking pack', icon: '🏕️', cap: 130, price: 2600 },
    { id: 'rig', name: 'Smuggler rig', icon: '🦺', cap: 200, price: 7500 },
  ];
  const LOCKER_CAP = 600; // home locker (in the apartment, at the workbench)

  // ---- places ----
  // loot: [item, chance per cycle, min, max]; stock = cycles before the spot runs dry; regen = seconds per +1 stock.
  // hours: [from, to) game hours when open (wraps midnight); heat added per cycle (illegal spots).
  const GATHER = [
    { id: 'scrapyard', name: 'Scrapyard', icon: '🔩', x: 250, y: 1520, r: 70, seconds: 4.5, stock: 14, regen: 25,
      loot: [['metal', 1, 1, 2], ['pipe', 0.22, 1, 1], ['spring', 0.24, 1, 1], ['wood', 0.1, 1, 1], ['trigger', 0.015, 1, 1]],
      xp: { luck: 6 }, desc: 'Dig through the junk piles: scrap metal, pipe, springs, the odd wood offcut.' },
    { id: 'construction', name: 'Construction site', icon: '🚧', x: 1150, y: 190, r: 70, seconds: 5, stock: 12, regen: 30, hours: [6, 20],
      loot: [['metal', 0.55, 1, 2], ['pipe', 0.35, 1, 1], ['wood', 0.45, 1, 2], ['tape', 0.2, 1, 1]],
      xp: { luck: 6 }, desc: 'Skips full of offcuts. Daytime only: security locks it at 8 PM.' },
    { id: 'plots', name: 'Grow plots', icon: '🌿', x: 230, y: 820, r: 75, seconds: 6, stock: 10, regen: 40, heat: 0.03,
      loot: [['leaf', 1, 1, 2]], xp: { farming: 10 }, desc: 'Guerrilla plants in the park beds. Pick raw leaf; neighbours call it in if you linger.' },
    { id: 'boat', name: 'Smuggler boat', icon: '🚤', x: 2120, y: 1545, r: 70, seconds: 8, stock: 6, regen: 150, hours: [20, 5], heat: 0.1,
      loot: [['snow', 1, 1, 1], ['chem', 0.15, 1, 1]], xp: { stealth: 14 }, desc: 'A speedboat ties up at the east docks after dark. Unload raw snow bricks fast.' },
    { id: 'pharmacy', name: 'Pharmacy dumpster', icon: '⚗️', x: 300, y: 235, r: 65, seconds: 6.5, stock: 9, regen: 45, heat: 0.02,
      loot: [['chem', 0.65, 1, 1], ['baggie', 0.35, 2, 4], ['lens', 0.02, 1, 1]], xp: { stealth: 8 }, desc: 'Behind the clinic. Expired chemicals and packaging get tossed here.' },
    { id: 'container', name: 'Arms container', icon: '📦', x: 2140, y: 1170, r: 65, seconds: 9, stock: 5, regen: 140, hours: [21, 4], heat: 0.12,
      loot: [['spring', 0.5, 1, 2], ['trigger', 0.18, 1, 1], ['barrel', 0.14, 1, 1], ['bolt', 0.08, 1, 1], ['frame', 0.06, 1, 1], ['lens', 0.06, 1, 1]],
      xp: { stealth: 18, luck: 6 }, desc: 'A cracked shipping container of gun parts. Only unguarded late at night. Hot.' },
  ];
  // in/out per cycle; pocket = goes to the game's pocket (weed/coke for Codex dealers); seconds per cycle.
  const PROCESS = [
    { id: 'trim', name: 'Trim house', icon: '✂️', x: 250, y: 1150, r: 65, seconds: 6, in: { leaf: 3, baggie: 1 }, out: { weed: 1 }, pocket: true, heat: 0.02,
      xp: { farming: 18, dealing: 6 }, desc: 'A boarded-up shack. Dry, trim and bag raw leaf into weed.' },
    { id: 'kitchen', name: 'Motel kitchen', icon: '🍳', x: 1800, y: 200, r: 65, seconds: 12, in: { snow: 1, chem: 1, baggie: 2 }, out: { coke: 2 }, pocket: true, heat: 0.06,
      xp: { dealing: 30, stealth: 6 }, desc: 'Room 6 at the Starlite Motel. Cut a snow brick into bagged product.' },
    { id: 'trailer', name: 'Trailer lab', icon: '🚐', x: 700, y: 200, r: 65, seconds: 10, in: { chem: 2, baggie: 1 }, out: { pills: 3 }, heat: 0.05,
      xp: { dealing: 20, farming: 6 }, desc: 'A rusted camper on blocks. Press chemicals into party pills.' },
  ];
  // Selling: weed/coke go to Codex dealers + customers. Pills sell to the party promoter (demand refills).
  const PROMOTER = { id: 'promoter', name: 'Party promoter', icon: '🎟️', x: 1240, y: 640, r: 60, price: 48, demand: 12, refill: 600, hours: [19, 5],
    desc: 'Works the line outside the Neon Room at night. Buys party pills.' };
  // Sells crafted guns (spares) and buys them back; open at night.
  const ARMS_BUYER = { id: 'armsbuyer', name: 'Arms buyer', icon: '🚚', x: 2140, y: 380, r: 60, hours: [20, 6], demand: 4, refill: 900, desc: 'A van with the engine running. Buys guns, a few a night. Spares pay full value.' };
  const HARDWARE_SITE = { id: 'hardware', name: 'Hardware counter', icon: '🧰', x: 1180, y: 1290, r: 55, desc: 'Tape, baggies, scrap and wood.' };
  const BAG_SHOPS = [{ id: 'bags-west', x: 560, y: 940 }, { id: 'bags-docks', x: 1480, y: 1622 }];
  // Your lockup workshop (buy, then upgrade). Real guns need it.
  const LOCKUP = { id: 'lockup', name: 'Lockup workshop', icon: '🔧', x: 1480, y: 195, r: 65,
    levels: [{ price: 6000, name: 'Lockup' }, { price: 18000, name: 'Machine shop' }, { price: 45000, name: 'Arms factory' }] };
  const HOME_BENCH = { id: 'home', name: 'Home workbench', icon: '🛠️' };

  // ---- starter income properties (cheap; the Empire fronts take over later) ----
  const STARTER_FRONTS = [
    { id: 'shoeshine', name: 'Shoeshine stand', icon: '👞', price: 800, perHour: 30, capHours: 6 },
    { id: 'hotdog', name: 'Hot dog cart', icon: '🌭', price: 2500, perHour: 95, capHours: 6 },
    { id: 'arcade', name: 'Corner arcade', icon: '🕹️', price: 6000, perHour: 220, capHours: 8 },
  ];

  // ---- state ----
  const int = (v, max, d = 0) => (Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : d);
  function cleanBag(raw, max = 9999) {
    const out = {};
    for (const id of IDS) { const n = int(raw?.[id], max); if (n > 0) out[id] = n; }
    return out;
  }
  function clean(raw, now = Date.now()) {
    const s = { version: 1, bag: cleanBag(raw?.bag), locker: cleanBag(raw?.locker), bagLevel: int(raw?.bagLevel, BAGS.length - 1),
      lockup: int(raw?.lockup, LOCKUP.levels.length), stock: {}, promoter: { sold: 0, at: 0 }, arms: { sold: 0, at: 0 }, fronts: {},
      stats: { gathered: 0, processed: 0, crafted: 0, gunsSold: 0, earned: 0, pillsSold: 0 }, newLife: raw?.newLife === true, started: Number.isFinite(raw?.started) ? raw.started : now };
    for (const sp of GATHER) {
      const r = raw?.stock?.[sp.id];
      s.stock[sp.id] = { n: int(r?.n, sp.stock, sp.stock), at: Number.isFinite(r?.at) && r.at <= now ? r.at : now };
    }
    s.promoter = { sold: int(raw?.promoter?.sold, PROMOTER.demand), at: Number.isFinite(raw?.promoter?.at) && raw.promoter.at <= now ? raw.promoter.at : now };
    s.arms = { sold: int(raw?.arms?.sold, ARMS_BUYER.demand), at: Number.isFinite(raw?.arms?.at) && raw.arms.at <= now ? raw.arms.at : now };
    for (const f of STARTER_FRONTS) {
      const r = raw?.fronts?.[f.id];
      if (r?.owned === true) s.fronts[f.id] = { owned: true, since: Number.isFinite(r.since) && r.since <= now ? r.since : now };
    }
    for (const k of Object.keys(s.stats)) s.stats[k] = int(raw?.stats?.[k], 1e12);
    return s;
  }

  // ---- bag ----
  const weightOf = (items) => Object.entries(items || {}).reduce((t, [id, n]) => t + (MATERIALS[id]?.w || 0) * n, 0);
  const cap = (s) => BAGS[s.bagLevel].cap;
  const room = (s) => Math.max(0, cap(s) - weightOf(s.bag));
  // How many units of `id` still fit (weightless items: effectively unlimited, 999 per item).
  function fits(s, id) { const w = MATERIALS[id]?.w; if (w === undefined) return 0; if (w === 0) return Math.max(0, 999 - (s.bag[id] || 0)); return Math.floor(room(s) / w); }
  function has(bag, cost) { return Object.entries(cost).every(([k, n]) => (bag[k] || 0) >= n); }
  function take(bag, cost) { for (const [k, n] of Object.entries(cost)) { bag[k] = (bag[k] || 0) - n; if (bag[k] <= 0) delete bag[k]; } }
  // Adds what fits; returns { added, lost }.
  function give(s, items) {
    const added = {}, lost = {};
    for (const [id, n] of Object.entries(items)) {
      const k = Math.min(n, fits(s, id));
      if (k > 0) { s.bag[id] = (s.bag[id] || 0) + k; added[id] = k; }
      if (n - k > 0) lost[id] = n - k;
    }
    return { added, lost };
  }
  const costText = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${MATERIALS[k]?.icon || ''}${MATERIALS[k] ? '' : k}`.trim()).join(' · ');
  const missing = (bag, cost) => Object.entries(cost).filter(([k, n]) => (bag[k] || 0) < n).map(([k, n]) => [k, n - (bag[k] || 0)]);

  // ---- hours ----
  function openAt(hours, minute) {
    if (!hours) return true;
    const h = ((minute / 60) % 24 + 24) % 24, [a, b] = hours;
    return a < b ? h >= a && h < b : h >= a || h < b;
  }
  const hhmm = (h) => `${String(h % 24).padStart(2, '0')}:00`;
  const hoursText = (hours) => (hours ? `open ${hhmm(hours[0])}–${hhmm(hours[1])}` : 'open 24h');

  // ---- gathering ----
  const GBY = Object.fromEntries(GATHER.map((g) => [g.id, g]));
  const PBY = Object.fromEntries(PROCESS.map((p) => [p.id, p]));
  function stockNow(s, id, now = Date.now()) {
    const sp = GBY[id], st = s.stock[id];
    if (!sp || !st) return 0;
    const gained = Math.floor(Math.max(0, now - st.at) / (sp.regen * 1000));
    if (gained > 0) { st.n = Math.min(sp.stock, st.n + gained); st.at = st.n >= sp.stock ? now : st.at + gained * sp.regen * 1000; }
    if (st.n >= sp.stock) st.at = now;
    return st.n;
  }
  // Seconds until the next +1 stock (0 when full).
  function refillIn(s, id, now = Date.now()) { const sp = GBY[id], st = s.stock[id]; if (!sp || !st || stockNow(s, id, now) >= sp.stock) return 0; return Math.max(0, Math.ceil((st.at + sp.regen * 1000 - now) / 1000)); }
  // One gather cycle. luck >= 1 raises the chance of the rarer loot rows (not the first, guaranteed row).
  function gather(s, id, { now = Date.now(), minute = 720, rnd = Math.random, luck = 1 } = {}) {
    const sp = GBY[id];
    if (!sp) return { ok: false, reason: 'Unknown place' };
    if (!openAt(sp.hours, minute)) return { ok: false, reason: `${sp.name} is closed now (${hoursText(sp.hours)})`, closed: true };
    if (stockNow(s, id, now) <= 0) return { ok: false, reason: `${sp.name} is picked clean. More in ${refillIn(s, id, now)}s`, dry: true };
    if (room(s) <= 0 && !sp.loot.some(([it]) => MATERIALS[it].w === 0)) return { ok: false, reason: 'Backpack full', full: true };
    const items = {};
    sp.loot.forEach(([it, chance, a, b], i) => {
      const c = i === 0 ? chance : Math.min(0.95, chance * luck);
      if (rnd() < c) items[it] = (items[it] || 0) + a + Math.floor(rnd() * (b - a + 1));
    });
    const r = give(s, items);
    if (!Object.keys(r.added).length) return { ok: false, reason: 'Backpack full', full: true, lost: r.lost };
    if (s.stock[id].n >= sp.stock) s.stock[id].at = now;
    s.stock[id].n -= 1;
    s.stats.gathered += Object.values(r.added).reduce((a, b) => a + b, 0);
    return { ok: true, added: r.added, lost: r.lost, heat: sp.heat || 0, xp: sp.xp || {} };
  }

  // ---- processing ----
  // pocket: the game's pocket (weed/coke land there); pocketMax: per-item cap (inventory.js uses 999).
  function process(s, id, pocket, { pocketMax = 999 } = {}) {
    const sp = PBY[id];
    if (!sp) return { ok: false, reason: 'Unknown place' };
    if (!has(s.bag, sp.in)) return { ok: false, reason: `Need ${costText(sp.in)} per batch`, need: missing(s.bag, sp.in) };
    if (sp.pocket) {
      if (!pocket) return { ok: false, reason: 'No pocket' };
      for (const [k, n] of Object.entries(sp.out)) if ((pocket[k] || 0) + n > pocketMax) return { ok: false, reason: 'Pockets full' };
    } else {
      const before = weightOf(s.bag) - weightOf(sp.in) + weightOf(sp.out);
      if (before > cap(s)) return { ok: false, reason: 'Backpack full' };
    }
    take(s.bag, sp.in);
    for (const [k, n] of Object.entries(sp.out)) { if (sp.pocket) pocket[k] = (pocket[k] || 0) + n; else s.bag[k] = (s.bag[k] || 0) + n; }
    s.stats.processed += 1;
    return { ok: true, out: sp.out, heat: sp.heat || 0, xp: sp.xp || {} };
  }
  // How many batches the bag can feed right now.
  const batches = (s, id) => { const sp = PBY[id]; if (!sp) return 0; return Math.min(...Object.entries(sp.in).map(([k, n]) => Math.floor((s.bag[k] || 0) / n))); };

  // ---- selling pills ----
  function promoterLeft(s, now = Date.now()) {
    if (now - s.promoter.at >= PROMOTER.refill * 1000) { s.promoter.sold = 0; s.promoter.at = now; }
    return PROMOTER.demand - s.promoter.sold;
  }
  function sellPills(s, wallet, n, { now = Date.now(), minute = 23 * 60, price = 1 } = {}) {
    if (!openAt(PROMOTER.hours, minute)) return { ok: false, reason: `The promoter works nights (${hoursText(PROMOTER.hours)})` };
    const left = promoterLeft(s, now), have = s.bag.pills || 0, k = Math.min(n, left, have);
    if (have <= 0) return { ok: false, reason: 'No pills to sell' };
    if (left <= 0) return { ok: false, reason: 'The promoter is stocked up. Come back later.' };
    const cash = Math.round(k * PROMOTER.price * price);
    take(s.bag, { pills: k }); s.promoter.sold += k; wallet.cash += cash; s.stats.earned += cash; s.stats.pillsSold += k;
    return { ok: true, n: k, cash };
  }

  // Arms buyer: takes ARMS_BUYER.demand guns per refill window.
  function armsLeft(s, now = Date.now()) {
    if (now - s.arms.at >= ARMS_BUYER.refill * 1000) { s.arms.sold = 0; s.arms.at = now; }
    return ARMS_BUYER.demand - s.arms.sold;
  }
  function armsSold(s, cash, now = Date.now()) { armsLeft(s, now); s.arms.sold += 1; s.stats.gunsSold += 1; s.stats.earned += cash; }

  // ---- buying ----
  function buy(s, wallet, id, n = 1, { counter = 'parts' } = {}) {
    const m = MATERIALS[id];
    if (!m || !(m.price > 0)) return { ok: false, reason: 'Not for sale' };
    const list = counter === 'parts' ? PARTS_COUNTER : HARDWARE.map((h) => h.id);
    if (!list.includes(id)) return { ok: false, reason: 'Not sold here' };
    const cost = m.price * n;
    if (!(wallet.cash >= cost)) return { ok: false, reason: 'Not enough cash' };
    if (fits(s, id) < n) return { ok: false, reason: 'Backpack full' };
    wallet.cash -= cost; s.bag[id] = (s.bag[id] || 0) + n;
    return { ok: true, cost };
  }
  function buyBag(s, wallet, level) {
    const b = BAGS[level];
    if (!b) return { ok: false, reason: 'Unknown bag' };
    if (level <= s.bagLevel) return { ok: false, reason: 'You already have a bigger bag' };
    if (level > s.bagLevel + 1) return { ok: false, reason: `Get the ${BAGS[s.bagLevel + 1].name} first` };
    if (!(wallet.cash >= b.price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= b.price; s.bagLevel = level;
    return { ok: true, bag: b };
  }
  function buyLockup(s, wallet) {
    const next = LOCKUP.levels[s.lockup];
    if (!next) return { ok: false, reason: 'Fully upgraded' };
    if (!(wallet.cash >= next.price)) return { ok: false, reason: `Needs $${next.price.toLocaleString()}` };
    wallet.cash -= next.price; s.lockup += 1;
    return { ok: true, level: s.lockup, name: next.name };
  }

  // ---- locker (home) ----
  function store(s, id, n) {
    const k = Math.min(n, s.bag[id] || 0), used = weightOf(s.locker);
    const w = MATERIALS[id]?.w || 0, fitN = w ? Math.min(k, Math.floor((LOCKER_CAP - used) / w)) : k;
    if (fitN <= 0) return 0;
    take(s.bag, { [id]: fitN }); s.locker[id] = (s.locker[id] || 0) + fitN; return fitN;
  }
  function withdraw(s, id, n) {
    const k = Math.min(n, s.locker[id] || 0, fits(s, id));
    if (k <= 0) return 0;
    take(s.locker, { [id]: k }); s.bag[id] = (s.bag[id] || 0) + k; return k;
  }
  // Crafting at home can pull from the locker too: combined view.
  const combined = (s) => { const out = { ...s.bag }; for (const [k, n] of Object.entries(s.locker)) out[k] = (out[k] || 0) + n; return out; };
  // Spend from bag first, then locker.
  function spendBoth(s, cost) {
    if (!has(combined(s), cost)) return false;
    for (const [k, n] of Object.entries(cost)) { const fromBag = Math.min(n, s.bag[k] || 0); take(s.bag, { [k]: fromBag }); if (n - fromBag > 0) take(s.locker, { [k]: n - fromBag }); }
    return true;
  }

  // ---- starter fronts ----
  const FBY = Object.fromEntries(STARTER_FRONTS.map((f) => [f.id, f]));
  function frontPending(s, id, now = Date.now()) { const f = FBY[id], r = s.fronts[id]; if (!f || !r) return 0; return Math.floor(f.perHour * Math.min(f.capHours, Math.max(0, now - r.since) / 3600000)); }
  function buyFront(s, wallet, id, now = Date.now()) {
    const f = FBY[id];
    if (!f) return { ok: false, reason: 'Unknown' };
    if (s.fronts[id]) return { ok: false, reason: 'Already yours' };
    if (!(wallet.cash >= f.price)) return { ok: false, reason: 'Not enough cash' };
    wallet.cash -= f.price; s.fronts[id] = { owned: true, since: now };
    return { ok: true };
  }
  function collectFront(s, wallet, id, now = Date.now()) {
    const n = frontPending(s, id, now);
    if (n <= 0) return { ok: false, reason: 'Nothing to collect yet' };
    wallet.cash += n; s.fronts[id].since = now; s.stats.earned += n;
    return { ok: true, cash: n };
  }

  const api = Object.freeze({ MATERIALS, IDS, HARDWARE, PARTS_COUNTER, BAGS, LOCKER_CAP, GATHER, PROCESS, PROMOTER, ARMS_BUYER, HARDWARE_SITE, BAG_SHOPS, LOCKUP, HOME_BENCH,
    STARTER_FRONTS, GBY, PBY, clean, cleanBag, weightOf, cap, room, fits, has, take, give, costText, missing, openAt, hoursText, stockNow, refillIn, gather,
    process, batches, promoterLeft, sellPills, armsLeft, armsSold, buy, buyBag, buyLockup, store, withdraw, combined, spendBoth, frontPending, buyFront, collectFront });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftSupplyData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
