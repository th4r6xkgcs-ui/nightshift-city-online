/* Player guide (Claude-owned). Makes the game less confusing:
 *  1) First-time walkthrough: spotlight coach marks on the real controls (sticks, action button, status,
 *     goal, phone, minimap, MORE, help) the first time you step outside. Skippable, replayable.
 *  2) "?" help button in the dock: a "What can I do?" panel with every activity grouped by purpose, a
 *     one-line how-to and a GPS / OPEN button for each.
 *  3) MORE grid: icons + short captions so BIZ / BOX / CTRL / STREET etc. make sense.
 * Save: nightshift-guide-v1. API: NightshiftGuide.{tour, open, close, paused} */
(function (root) {
  'use strict';
  if (!root.document) return;
  /* eslint-disable no-undef */
  const P = () => { try { return player; } catch { return null; } };
  /* eslint-enable no-undef */
  const KEY = 'nightshift-guide-v1';
  let state = { toured: false };
  try { state = { toured: !!JSON.parse(localStorage.getItem(KEY) || '{}').toured }; } catch { /* fresh */ }
  if (/[?&]notour\b/.test(root.location?.search || '')) state.toured = true; // automated tests
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private */ } };
  const $ = (s) => document.querySelector(s);
  const el = (t, a = {}, txt) => { const e = document.createElement(t); Object.assign(e, a); if (txt !== undefined) e.textContent = txt; return e; };
  const say = (t) => { try { root.say?.(t); } catch { /* n/a */ } };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------- 3) MORE grid icons + captions ----------
  const MORE = { inventory: ['🎒', 'Your pockets'], business: ['🏪', 'Shops & properties'], craft: ['🛠️', 'Make items'], job: ['📦', 'Courier job'], property: ['🏠', 'Go home'],
    rob: ['🫳', 'Rob someone'], surrender: ['🏳️', 'Hands up to cops'], vehicle: ['🚗', 'Your cars'], sound: ['🔊', 'Sound on/off'], cityMap: ['🗺️', 'Big map + GPS'], saves: ['💾', 'Backup save'],
    progress: ['📈', 'Reputation'], search: ['🔍', 'Search crate'], controls: ['🎮', 'Controls'], journal: ['📓', 'City journal'], street: ['🧥', 'Gangs & corners'], loot: ['💰', 'Pick up loot'], glove: ['🧤', 'Car glovebox'] };
  const css = el('style');
  css.textContent = `
  body #actions.expanded>button{min-height:74px!important;height:auto!important;padding:6px 4px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px;line-height:1.1}
  body #actions.expanded>button[hidden]{display:none!important}
  ${Object.entries(MORE).map(([id, [ic, cap]]) => `#actions.expanded>#${id}::before{content:'${ic}';font-size:20px;line-height:1}#actions.expanded>#${id}::after{content:'${cap}';font:500 9px ui-sans-serif,system-ui,sans-serif;letter-spacing:0;color:#9fb0c8;text-transform:none}`).join('\n')}
  #actions.expanded>button[aria-label="Customize character"]::before{content:'👕';font-size:20px;line-height:1}#actions.expanded>button[aria-label="Customize character"]::after{content:'Change your look';font:500 9px ui-sans-serif,system-ui,sans-serif;color:#9fb0c8}
  @media (max-height:500px){body #actions.expanded>button{min-height:54px!important;padding:3px 4px!important;gap:0!important}body #actions.expanded>button::before{font-size:16px!important}body #actions.expanded>button::after{font-size:8.5px!important}}
  /* coach marks */
  #gdSpot{position:fixed;z-index:90;border-radius:16px;pointer-events:none;box-shadow:0 0 0 9999px #03060ccc,0 0 0 3px #ffcf5a,0 0 24px #ffcf5a88;transition:all .25s ease}
  #gdTip{position:fixed;z-index:91;max-width:min(320px,86vw);background:linear-gradient(180deg,#1a2234,#0e1422);border:1px solid #ffcf5a88;border-radius:16px;padding:12px 14px;color:#eef3fb;
    font:500 14px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;box-shadow:0 20px 50px #000c}
  #gdTip b{display:block;font:700 15px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif;color:#ffcf5a;margin-bottom:4px;letter-spacing:.03em}
  #gdTip .r{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px} #gdTip .n{color:#9aa9c0;font-size:12px}
  #gdTip button{all:unset;cursor:pointer;padding:8px 14px;border-radius:10px;font:700 12px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif;letter-spacing:.05em}
  #gdTip .nx{background:#ffcf5a;color:#241800} #gdTip .sk{color:#9aa9c0}
  #gdTip[hidden],#gdSpot[hidden]{display:none}
  /* help panel */
  #gdPanel{position:fixed;z-index:47;inset:5% 5%;overflow:auto;background:linear-gradient(180deg,#151c2cf7,#0b0f19fa);border:1px solid #ffffff24;border-radius:18px;padding:14px 16px;color:#eef3fb;font:500 13px/1.35 ui-sans-serif,system-ui,-apple-system,sans-serif}
  #gdPanel[hidden]{display:none} #gdPanel h2{margin:0;font:700 18px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em} #gdPanel h3{margin:14px 0 6px;font:700 12px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif;letter-spacing:.12em;color:#ffcf5a}
  #gdPanel .top{display:flex;justify-content:space-between;align-items:center;gap:8px} #gdPanel .sub{color:#9aa9c0;font-size:12px;margin-top:2px}
  #gdPanel button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:10px;font:700 11px 'Chakra Petch',ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;padding:8px 12px}
  #gdPanel .x{border:1px solid #ffffff40} #gdPanel .tour{background:#ffcf5a22;border:1px solid #ffcf5a88;color:#ffe7a8;margin-top:8px}
  #gdPanel .it{display:flex;gap:10px;align-items:center;background:#ffffff08;border:1px solid #ffffff14;border-radius:12px;padding:8px 10px;margin-top:6px}
  #gdPanel .ic{font-size:22px;width:28px;text-align:center} #gdPanel .tx{flex:1;min-width:0} #gdPanel .nm{font-weight:700} #gdPanel .hw{color:#9aa9c0;font-size:12px}
  #gdPanel .go{background:linear-gradient(#ffe39a,#e0a93a);color:#241800;white-space:nowrap}
  @media (max-width:420px){#nsDock button{width:35px!important;height:35px!important;font-size:16px!important}#nsDock{gap:5px!important}#nsL{width:min(228px,54vw)!important}}`;
  document.head.appendChild(css);

  // ---------- 2) help panel ----------
  const panel = el('div', { id: 'gdPanel', hidden: true, role: 'dialog', ariaLabel: 'What can I do?' });
  document.body.append(panel);
  const nearest = (list) => { const p = P() || { x: 0, y: 0 }; return (list || []).filter(Boolean).sort((a, b) => dist(a, p) - dist(b, p))[0] || null; };
  const gps = (pos, label) => { if (!pos) { say('Not available yet'); return; } const ok = root.NightshiftMap?.navigate?.({ x: pos.x, y: pos.y, label, id: 'guide-help' }); say(ok ? `📍 GPS set · ${label}` : 'GPS unavailable here'); if (ok) close(); };
  const open2 = (fn) => () => { close(); setTimeout(() => { try { fn(); } catch { /* module missing */ } }, 50); };
  function sections() {
    const R = root, ven = R.NightshiftVenues?.places?.() || [];
    const SD = R.NightshiftSupplyData, sp = (id) => SD?.GBY?.[id] || SD?.PBY?.[id];
    return [
      ['🔫 GUNS & CRAFTING (start here)', [
        ['🔩', 'Scrapyard', 'Collect pipe, scrap metal and springs. Stand in the yard and press COLLECT.', 'GPS', () => gps(sp('scrapyard'), 'Scrapyard')],
        ['🛠️', 'Home workbench', 'In your apartment. Craft crude guns: the Pipe Pistol is your first. Crude guns fall apart.', 'GPS', () => gps({ x: 950, y: 735 }, 'Your apartment')],
        ['🔫', 'Gun shop parts counter', 'Barrels, triggers, frames, bolts, springs, lenses. Plus ammo and armor.', 'GPS', () => gps(R.NightshiftWeapons?.door?.(), 'Gun shop')],
        ['👑', 'Legendary guns', 'Five legendaries (Whisper SMG, Gilded Hawk, Dragonbreath, Reaper .50, Tigerstripe AR) need a 📜 blueprint first: safes, gun lockers, trap houses, Broker bonuses.', null],
        ['🔧', 'Lockup workshop', 'Buy it ($6,000) to craft real guns, attachments and repairs. Upgrade for SMGs, rifles, the AR.', 'GPS', () => gps(SD?.LOCKUP, 'Lockup')],
        ['🚚', 'Arms buyer', 'Nights, north-east. Sells your spare guns for cash.', 'GPS', () => gps(SD?.ARMS_BUYER, 'Arms buyer')],
        ['🎒', 'Backpack', 'Space is limited: make trips, stash at home, buy bigger bags. Shows where everything comes from.', 'OPEN', open2(() => R.NightshiftSupply.openBag())],
      ]],
      ['🌿 PRODUCT: collect → process → sell', [
        ['🌿', 'Weed', 'Pick leaf at the GROW PLOTS → bag it at the TRIM HOUSE → sell to dealers.', 'GPS', () => gps(sp('plots'), 'Grow plots')],
        ['❄️', 'Coke', 'Snow from the SMUGGLER BOAT (night) + chemicals → MOTEL KITCHEN → dealers pay most.', 'GPS', () => gps(sp('boat'), 'Smuggler boat')],
        ['💊', 'Pills', 'Chemicals from the PHARMACY DUMPSTER → TRAILER LAB → the PROMOTER at the Neon Room (nights).', 'GPS', () => gps(sp('pharmacy'), 'Pharmacy dumpster')],
      ]],
      ['💵 MAKE MONEY', [
        ['📊', 'Ledger', 'Where your money comes from and where it goes, $ per hour, and rough rates for every hustle you haven\'t tried. Phone → LEDGER.', 'OPEN', open2(() => R.NightshiftLedger.open())],
        ['📱', 'Phone jobs', 'Taxi fares, repos, hits and VIP drops. Open the 📱 phone.', 'OPEN', open2(() => R.NightshiftJobs.open())],
        ['🌆', 'City events', 'Every few minutes something pops up. Rico texts you; follow the cyan arrow.', null],
        ['📦', 'Courier deliveries', 'MORE → JOB, then follow the GPS to pickup and drop-off.', null],
        ['🎣', 'Fishing', 'Cast at the Docks Pier or West Canal. Sell the catch or eat it.', 'GPS', () => gps(nearest(R.NightshiftFishingData?.SPOTS), 'Fishing spot')],
        ['🏦', 'Bank heists', 'Needs a gun. Drill the vault, then lose the cops or run home.', 'GPS', () => gps(nearest(R.NightshiftHeists?.vaults?.()), 'Bank vault')],
        ['⚗️', 'Drug lab', 'Own the Weed Farm or Coke House (MORE → BIZ), cook at the LAB, sell at clubs.', null],
        ['🪩', 'Clubs', 'Sell lab product at a premium, best after 21:00.', 'GPS', () => gps(nearest(ven.filter((v) => v.kind === 'club')), 'Club')],
        ['💹', 'Stock market', 'Buy low, sell high. Read the news. Phone → MARKET.', 'OPEN', open2(() => R.NightshiftMarket.open())],
        ['📈', 'Front businesses', 'Passive income while you are away, from an $800 shoeshine stand up. Phone → EMPIRE.', 'OPEN', open2(() => R.NightshiftEmpire.open())],
      ]],
      ['🚗 CARS', [
        ['🔓', 'Steal a car', 'Stand next to any locked car and hold USE until the lock pops. Cops notice.', null],
        ['🔧', "Rusty's chop shop", 'Drive a stolen car into the striped bay behind the scrapyard: chop it for cash, strip it for parts, or re-VIN it and keep it. Check his 🔥 hot list.', 'GPS', () => gps(R.NightshiftChop?.BAY, "Rusty's chop shop")],
        ['🔑', 'Car collection', 'Ten models from a $5k hatch to a $290k hypercar at Prestige Motors (Palm Grove). Rare ones get left on the street: steal one and Rusty re-VINs it. 📱 → 🚗 MY CARS.', 'OPEN', open2(() => R.NightshiftCars.open())],
        ['🌃', 'Night car meet', 'Westside Courts, 21:00–03:00. Stop a car you own in the ring and SHOW it against five rivals: model, kit, tuning, paint and condition score. Top three win cash and trophies.', 'GPS', () => gps(R.NightshiftCarMeet?.ring, 'Car meet')],
        ['🏁', 'Body kits', 'Prestige Motors in Palm Grove (suburbs) fits GT, muscle, rally and luxury kits to cars you own.', null],
        ['🏎️', 'Show-off garage', 'Buy the dream house in Palm Grove: up to four of your cars park inside, with a show-off score.', null],
      ]],
      ['🗺️ BEYOND THE CITY (bus 🚌)', [
        ['🚌', 'Bus stops', 'Midtown and West End. Ride to the countryside or the suburbs for a few dollars.', 'GPS', () => gps(nearest(R.NightshiftZones?.CITY_STOPS), 'Bus stop')],
        ['🌾', 'Harlow Fields farm', 'Lease plots, plant, water and harvest crops. Keep hens and cows. Grind flour at the mill.', null],
        ['🍳', 'Cooking & buffs', 'Cook at your kitchen (or the farmhouse): meals give buffs like faster running or more XP. Eat from the 🎒.', 'GPS', () => gps({ x: 950, y: 735 }, 'Your apartment')],
        ['🍽️', 'Diner back door', 'The diner buys your cooked meals and fresh produce.', 'GPS', () => gps({ x: 1600, y: 948 }, 'Diner back door')],
        ['🔦', 'Break-ins', 'Suburb houses, the gated estate, and two city warehouses (nights). Pick the back-door lock (tap in the gold) or kick it in (instant alarm). Dark inside: guards show as red echoes. Crack safes for +30% or drill them (loud). Loot is only yours once you walk out. Unaware guards take 2.5× damage.', 'GPS', () => gps(nearest(R.NightshiftBreakin?.WAREHOUSES), 'Warehouse back door')],
        ['🎯', 'Hitman contracts', 'After your first break-in the Broker texts you. Take a contract, find the mark (gold ▼) inside a house, warehouse or the estate, walk out. Quiet pays +50%.', 'OPEN', open2(() => R.NightshiftHitman.open())],
        ['🏚️', 'Trap houses', 'Rival crews\' stash houses in the city, open any hour: armed crew, product, piles of cash. Counting rooms and gun lockers can hold legendary 📜 blueprints.', 'GPS', () => gps(nearest(R.NightshiftBreakin?.STASHES), 'Trap house')],
        ['💍', 'Golden Pawn', 'In Palm Grove. Fences the jewellery, electronics and art you steal.', null],
        ['🐕', 'Pets', 'Paws & Claws in Palm Grove. Pets follow you everywhere and give a perk while fed. Dogs sniff out stashes.', null],
        ['🏡', 'Dream house', 'Palm Grove, $85,000. Furnish 15 slots, raise your Style tier: deals pay more. Sleep for an XP boost.', null],
      ]],
      ['💪 GET STRONGER', [
        ['⭐', 'Skills', 'Everything you do levels a skill. Tap ⭐ to see perks.', 'OPEN', open2(() => R.NightshiftSkills.open())],
        ['🏋️', 'Gym', 'Timing reps for Speed and Toughness. Half price in the morning.', 'GPS', () => gps(nearest(ven.filter((v) => v.kind === 'gym')), 'Iron Works Gym')],
        ['🔧', 'Car tuning', 'Engine, handling, armor upgrades at a garage.', 'GPS', () => gps(nearest(R.NightshiftTuning?.sites?.()), 'Tuning garage')],
        ['🛋️', 'Furnish your apartment', 'Walk up to a ✦ sparkle at home and press DECOR. Furniture is yours for both homes; a nicer place makes clients pay more.', 'GPS', () => gps({ x: 950, y: 735 }, 'Your apartment')],
        ['🏠', 'Home upgrades', 'Use the LAPTOP in your apartment for perks.', 'GPS', () => gps({ x: 950, y: 735 }, 'Your apartment')],
      ]],
      ['🎲 HAVE FUN', [
        ['🎰', 'Casino', 'Slots, roulette and blackjack at the Lucky 7.', 'GPS', () => gps(R.NightshiftCasino?.door?.(), 'Lucky 7 Casino')],
        ['🏁', 'Street races', 'Drive into a 🏁 ring and stop. Win medals.', 'GPS', () => gps(nearest(R.NightshiftRaces?.starts?.()), 'Race start')],
        ['🥊', 'Fight club', 'In the gym: STRIKE on green, BLOCK on red, wait on yellow.', 'GPS', () => gps(nearest(ven.filter((v) => v.kind === 'gym')), 'Fight club')],
        ['📦', 'Hidden stashes', '30 hidden bags. Look for a gold sparkle, or buy a rumor on the phone.', null],
        ['👕', 'Your look', 'Use the wardrobe at home or MORE → STYLE.', null],
      ]],
    ];
  }
  function render() {
    panel.textContent = '';
    const top = el('div', { className: 'top' }), x = el('button', { className: 'x', type: 'button' }, 'CLOSE'); x.onclick = close;
    top.append(el('h2', {}, '❓ WHAT CAN I DO?'), x);
    const tour = el('button', { className: 'tour', type: 'button' }, '▶ REPLAY THE CONTROLS TOUR'); tour.onclick = () => { close(); setTimeout(startTour, 150); };
    panel.append(top, el('div', { className: 'sub' }, 'Follow your 🎯 goal card for a guided path, or pick anything below. The yellow arrow and the minimap always show where to go.'), tour);
    for (const [title, items] of sections()) {
      panel.append(el('h3', {}, title));
      for (const [ic, nm, how, btn, fn] of items) {
        const row = el('div', { className: 'it' }), tx = el('div', { className: 'tx' });
        tx.append(el('div', { className: 'nm' }, nm), el('div', { className: 'hw' }, how));
        row.append(el('div', { className: 'ic' }, ic), tx);
        if (btn) { const b = el('button', { className: 'go', type: 'button' }, btn); b.onclick = fn; row.append(b); }
        panel.append(row);
      }
    }
  }
  function open() { try { root.releaseControls?.(); } catch { /* n/a */ } render(); panel.hidden = false; }
  function close() { panel.hidden = true; }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  // dock button
  function addHelpButton() {
    const dock = $('#nsDock'); if (!dock || dock.querySelector('.gd')) return !!dock;
    const b = el('button', { type: 'button', className: 'gd', ariaLabel: 'Help: what can I do?', title: 'Help' }); b.append(el('span', {}, '❓')); b.onclick = open; dock.append(b);
    return true;
  }
  const helpTimer = setInterval(() => { if (addHelpButton()) clearInterval(helpTimer); }, 300);

  // ---------- 1) coach-mark tour ----------
  const STEPS = [
    ['#pad', 'MOVE', 'Drag the left stick to walk. Push it all the way to run.'],
    ['#aimPad', 'AIM & FIRE', 'Drag the right stick to aim. You shoot while it is held. In a car this stick does nothing; use BRAKE.'],
    ['#use', 'ACTION BUTTON', 'This button changes with what is near you: EXIT, CAR, SHOP, FISH, HEIST… If it glows, tap it.'],
    ['#nsStatus', 'YOU', 'Health, armor, cash and ammo. In a car it shows speed, fuel and damage.'],
    ['#glCard', 'YOUR NEXT GOAL', 'Not sure what to do? Do this. A yellow arrow points to it. Tap the card for all goals.'],
    ['#nsDock', 'YOUR APPS', '⭐ skills · 🎒 backpack (what you carry + where to get everything) · rank · 📅 dailies · 📱 phone · ❓ help.'],
    ['#wpPill', 'YOUR GUN', 'What\'s in your hand and how worn it is. You start unarmed: your first goal walks you through crafting a Pipe Pistol.'],
    ['#mmWrap', 'MINIMAP', 'Markers show jobs, events, goals and cops. Tap it for the big map and GPS.'],
    ['#more', 'MORE', 'Everything else: bag, car, map, businesses, crafting, saves. Turn on 🔊 SOUND here for music, radio and city sounds.'],
  ];
  const spot = el('div', { id: 'gdSpot', hidden: true }), tip = el('div', { id: 'gdTip', hidden: true });
  document.body.append(spot, tip);
  let step = -1, steps = [];
  const shown = (s) => { const e = $(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' ? r : null; };
  function startTour() { steps = STEPS.slice(); step = 0; showStep(); }
  function endTour() { step = -1; spot.hidden = true; tip.hidden = true; state.toured = true; persist(); say('Tip: tap ❓ any time to see everything you can do.'); }
  function showStep() {
    const [sel, title, text] = steps[step], r = shown(sel);
    if (!r) { if (++step < steps.length) showStep(); else endTour(); return; }
    const pad = 6; Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' }); spot.hidden = false;
    tip.textContent = ''; tip.append(el('b', {}, title), el('div', {}, text));
    const row = el('div', { className: 'r' }), sk = el('button', { className: 'sk', type: 'button' }, 'SKIP'), nx = el('button', { className: 'nx', type: 'button' }, step === steps.length - 1 ? 'GOT IT' : 'NEXT');
    sk.onclick = endTour; nx.onclick = () => { if (++step < steps.length) showStep(); else endTour(); };
    row.append(el('span', { className: 'n' }, `${step + 1} / ${steps.length}`), sk, nx); tip.append(row); tip.hidden = false;
    // place the tip beside the highlight, inside the screen
    const tw = tip.offsetWidth, th = tip.offsetHeight, W = innerWidth, H = innerHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 14;
    if (y + th > H - 8) y = r.top - th - 14;
    if (y < 8) { y = Math.max(8, r.top); x = r.right + 14 > W - tw - 8 ? r.left - tw - 14 : r.right + 14; }
    tip.style.left = Math.round(Math.max(8, Math.min(W - tw - 8, x))) + 'px'; tip.style.top = Math.round(Math.max(8, Math.min(H - th - 8, y))) + 'px';
  }
  addEventListener('resize', () => { if (step >= 0) showStep(); });
  // First time outside: run the tour once the HUD is up and no menu is open.
  // (Only after ~1.5 s continuously outside, so it never fires inside the apartment during the spawn hand-off.)
  let wasHome = false, outsideSince = 0;
  const isHome = () => !!root.NightshiftHome?.kind?.();
  setInterval(() => {
    const now = performance.now();
    if (isHome()) { wasHome = true; outsideSince = 0; return; }
    if (!outsideSince) outsideSince = now;
    const ready = wasHome || (root.NightshiftLife?.spawned?.() === false && now > 6000);
    if (!state.toured && step < 0 && ready && now - outsideSince > 1500 && !root.NightshiftHud?.menuOpen?.() && P()) {
      wasHome = false; setTimeout(() => { if (!state.toured && step < 0 && !isHome()) startTour(); }, 400);
    }
  }, 500);

  root.NightshiftGuide = Object.freeze({ tour: startTour, open, close, paused: () => !panel.hidden || step >= 0 });
})(typeof globalThis !== 'undefined' ? globalThis : this);
