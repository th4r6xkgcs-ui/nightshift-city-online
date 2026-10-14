/* Story campaign (Claude-owned, v0.64): "Nightshift" — from fresh off the bus to running the city.
 * Pure and Node-testable; story.js runs it. Built for a shared world (multiplayer later):
 *  - the world never pauses: no cutscenes; characters text you, objectives happen in the live city;
 *  - progress is per player (chapter/step), objectives listen to shared events ('ns:event') or read public state;
 *  - bosses are ordinary world squads (gangs.js), so other players could join the fight later.
 * Step kinds: goto {x,y,r} · squad {at, tag, n, gang, boss?, meleeOnly?} (defeat everyone) · event {type, count}
 *   · state {key, need} (polled numbers: cash, props, corners, medals, heatPeak, inCar) · escape (reach ★N then lose it)
 * Each chapter: from (contact), intro text, steps[], reward {cash, melee?, nitro?}. */
(function (root) {
  'use strict';
  const CROWN = { id: 'crown', name: 'The Crown', short: 'CRW', color: '#e2c24a', glow: '#ffe08a', ci: 2 };
  const CONTACTS = {
    rico: { name: 'Rico', icon: '🧢', role: 'your way in' },
    nia: { name: 'Nia', icon: '🔧', role: 'mechanic, drives like a demon' },
    hale: { name: 'Capt. Hale', icon: '🚔', role: 'Central precinct' },
    vex: { name: 'Vex', icon: '👑', role: 'runs the Crown' },
    biz: { name: 'Business', icon: '🏪', role: 'your properties' },
  };
  // sidewalk spot in front of block (bx,by): always walkable (bottom sidewalk y+254..278)
  const walk = (bx, by, dx = 220) => ({ x: bx * 440 + dx, y: by * 340 + 266 });
  const CHAPTERS = [
    { id: 'bus', n: 1, title: 'Fresh off the bus', from: 'rico',
      intro: 'Yo, you made it. Welcome to Nightshift City. Meet me on the corner by the club, two blocks from your place. Come alone.',
      steps: [
        { kind: 'goto', at: walk(2, 1, 300), r: 70, label: 'Meet Rico by the club', text: 'See those two by the garage? They\'ve been shaking down the mechanic all week. No guns, just hands. Show me what you got. Tap 👊 (or push the aim stick with no gun).' },
        { kind: 'squad', at: walk(3, 1, 120), tag: 'story-bus', n: 2, gang: 'diablos', meleeOnly: true, hp: 34, label: 'Knock out the two guys outside the garage', text: 'Ha! Clean. Take this bat — it was my cousin\'s. Hold 👊 to switch weapons. Sneak up behind someone who isn\'t looking for a takedown.' },
      ], reward: { cash: 250, melee: 'bat' } },
    { id: 'wheels', n: 2, title: 'Wheels', from: 'nia',
      intro: 'Rico says you need wheels. I\'m Nia, I fix cars and I race them. First rule: you can\'t run this city on foot. Grab a car — yours, or one nobody\'s watching.',
      steps: [
        { kind: 'state', key: 'inCar', need: 1, label: 'Get behind the wheel', text: 'Now the fun part. Get some speed, then hold BRAKE while you steer. The back steps out — that\'s a drift. Chain it, the city pays.' },
        { kind: 'event', type: 'drift', count: 1, min: 250, label: 'Land a 250+ point drift', text: 'Okay, okay, you can drive. Tank\'s probably empty though. Every gas station in the new blocks works now — pull under the canopy and tap FUEL.' },
        { kind: 'event', type: 'service', count: 1, label: 'Use a gas station (FUEL)', gps: 'gas', text: 'Filled you up with a bottle of nitro on me. NOS button shows up while you drive — hold it. Don\'t wrap it round a pole.' },
      ], reward: { cash: 500, nitro: true } },
    { id: 'shop', n: 3, title: 'Open for business', from: 'rico',
      intro: 'Street money comes and goes. Buildings make money while you sleep. Every shop out past the old blocks is for sale — save up and buy your first one. Cheapest ones are in the Flats and Ironworks.',
      steps: [
        { kind: 'state', key: 'props', need: 1, label: 'Buy your first property', gps: 'shop', text: 'Look at you, a business owner. Bad news: owners get robbed. Hang around your store — when somebody tries it, you handle it.' },
        { kind: 'event', type: 'defended', count: 1, trigger: 'robbery', label: 'Stop a robbery at your store', text: 'That\'s how you keep a register full. Security upgrades and a guard handle it when you\'re not around.' },
      ], reward: { cash: 1500 } },
    { id: 'cred', n: 4, title: 'Street cred', from: 'nia',
      intro: 'People are talking about you. Time to give them something to talk about. There are street races all over the city now — even Fairview and Downtown. Place in one.',
      steps: [
        { kind: 'event', type: 'race', count: 1, medal: true, gps: 'race', label: 'Place in any street race (any medal)', text: 'Not bad! Problem: the Yellow Tape Boys bet against you and lost. Their enforcer Knuckles is looking for you in Ironworks. He doesn\'t use guns. He doesn\'t need to.' },
        { kind: 'squad', at: walk(13, 6), tag: 'story-knuckles', n: 3, gang: 'tape', meleeOnly: true, hp: 45, boss: { name: 'KNUCKLES', hp: 230, meleeOnly: true }, label: 'Beat Knuckles in Ironworks', text: 'You beat Knuckles. With your hands. Ironworks is going to remember that. Keep the brass knuckles, he won\'t need them.' },
      ], reward: { cash: 2000, melee: 'brass' } },
    { id: 'turf', n: 5, title: 'Plant a flag', from: 'rico',
      intro: 'Money, cars, rep. Now you need a corner. Pick a gang block, clear it, and hold the dashed ring until it\'s yours. Hire people to watch it after.',
      steps: [
        { kind: 'state', key: 'corners', need: 1, label: 'Take a gang corner', text: 'Your flag\'s flying. Somebody downtown noticed. Watch your phone.' },
      ], reward: { cash: 2500 } },
    { id: 'heat', n: 6, title: 'Hale', from: 'hale',
      intro: 'This is Captain Hale, Central precinct. I know your name, your car and your corner. Everybody in this city pays me. You don\'t. Let\'s see how fast you run.',
      steps: [
        { kind: 'escape', stars: 3, label: 'Hit ★★★, then lose the cops', text: 'Fine. You\'re slippery. Do us both a favour and make it someone else\'s problem — the Crown is running half my precinct anyway.' },
      ], reward: { cash: 3000 } },
    { id: 'lts', n: 7, title: 'The lieutenants', from: 'vex',
      intro: 'Vex here. I own this city — the precinct, the gangs, the banks. You\'ve been stepping on my people. My lieutenants Marrow and Silk will explain the rules. Harbor and Downtown. Enjoy.',
      steps: [
        { kind: 'squad', at: walk(13, 13, 300), tag: 'story-marrow', n: 4, gang: CROWN, boss: { name: 'MARROW', hp: 320 }, label: 'Take down Marrow in the Harbor', text: 'Marrow\'s done. Rico here — Silk runs the Crown\'s money out of Downtown. Hit her and Vex has to come out himself.' },
        { kind: 'squad', at: walk(8, 2, 300), tag: 'story-silk', n: 4, gang: CROWN, boss: { name: 'SILK', hp: 340 }, label: 'Take down Silk Downtown', text: '…You\'re still alive. Interesting. Come to my tower. Bring everyone you have.' },
      ], reward: { cash: 6000 } },
    { id: 'crown', n: 8, title: 'The Crown', from: 'vex',
      intro: 'Downtown plaza, the big glass tower. I\'ll be waiting with the whole Crown. Win and the city is yours.',
      steps: [
        { kind: 'squad', at: walk(7, 2, 300), tag: 'story-vex', n: 6, gang: CROWN, boss: { name: 'VEX', hp: 650 }, label: 'Beat Vex at the Downtown tower', text: 'It\'s over. Vex is gone and the Crown is scattered. Rico here — the whole city is talking. You run Nightshift now. Keep it.' },
      ], reward: { cash: 15000, melee: 'machete' } },
  ];
  const BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

  function clean(raw) {
    const s = { version: 1, chapter: 0, step: 0, started: false, base: {}, done: [], finished: false };
    if (Number.isSafeInteger(raw?.chapter) && raw.chapter >= 0 && raw.chapter <= CHAPTERS.length) s.chapter = raw.chapter;
    if (Number.isSafeInteger(raw?.step) && raw.step >= 0 && s.chapter < CHAPTERS.length && raw.step < CHAPTERS[s.chapter].steps.length) s.step = raw.step;
    s.started = raw?.started === true; s.finished = s.chapter >= CHAPTERS.length;
    if (raw?.base && typeof raw.base === 'object') for (const [k, v] of Object.entries(raw.base)) if (Number.isFinite(v)) s.base[k] = v;
    if (Number.isFinite(raw?.count)) s.count = Math.max(0, raw.count);
    if (raw?.peak === true) s.peak = true;
    if (Array.isArray(raw?.done)) s.done = raw.done.filter((id) => BY_ID[id]).slice(0, CHAPTERS.length);
    return s;
  }
  const current = (s) => (s.chapter < CHAPTERS.length ? CHAPTERS[s.chapter] : null);
  const stepOf = (s) => current(s)?.steps[s.step] || null;
  // advance one step; returns { chapterDone, chapter, finished }
  function advance(s) {
    const ch = current(s); if (!ch) return { finished: true };
    s.step++; s.count = 0; s.peak = false; s.base = {};
    if (s.step >= ch.steps.length) { s.done.push(ch.id); s.chapter++; s.step = 0; s.finished = s.chapter >= CHAPTERS.length; return { chapterDone: true, chapter: ch, finished: s.finished }; }
    return { chapterDone: false, chapter: ch };
  }
  // progress of a polled 'state' step: [cur, need]
  function stateProgress(st, values, s) {
    const v = values[st.key] || 0, b = st.delta ? (s.base[st.key] ?? v) : 0;
    return [Math.max(0, v - b), st.need];
  }
  // escape step: peak flag set once heat >= stars; done when heat back to 0 after the peak
  function escapeStep(s, heat, stars) { if (heat >= stars - 0.05) s.peak = true; return !!s.peak && heat <= 0.01; }
  const matches = (st, ev) => st.kind === 'event' && ev && ev.type === st.type && (!st.min || (ev.points || 0) >= st.min) && (!st.medal || !!ev.medal);

  const api = Object.freeze({ CHAPTERS, BY_ID, CONTACTS, CROWN, walk, clean, current, stepOf, advance, stateProgress, escapeStep, matches });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftStoryData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
