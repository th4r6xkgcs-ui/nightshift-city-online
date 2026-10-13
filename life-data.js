/* City life (Claude-owned). Pure and Node-testable; life.js runs it in game.
 * - Car radio: 3 stations with procedural music patterns and a news/DJ ticker that reacts to what the
 *   player actually did (heists, events, fights, stashes, ranks) and to the clock and weather.
 * - Contacts: named people who text the player tips that are true in game (club nights, gym mornings,
 *   market news, city events).
 * - Day rhythm: modifiers other modules read (club premium at night, cheap gym mornings).
 * All content is fictional. */
(function (root) {
  'use strict';
  // ---- clock helpers (game minute 0..1439 from NightshiftEnvironment) ----
  const norm = (m) => ((Math.floor(Number(m) || 0) % 1440) + 1440) % 1440;
  const isNight = (m) => { const t = norm(m); return t >= 1260 || t < 240; }; // 21:00–04:00
  const isMorning = (m) => { const t = norm(m); return t >= 360 && t < 720; }; // 06:00–12:00
  const RHYTHM = { clubNightBonus: 0.2, gymMorningFee: 0.5 };
  const clubPremiumBonus = (m) => (isNight(m) ? RHYTHM.clubNightBonus : 0);
  const gymFeeMult = (m) => (isMorning(m) ? RHYTHM.gymMorningFee : 1);
  const hhmm = (m) => { const t = norm(m); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

  // ---- radio ----
  // scale: semitone offsets; prog: chord roots (scale degrees); bpm; wave
  const STATIONS = [
    { id: 'nfm', name: 'NIGHTSHIFT FM', freq: '88.7', dj: 'DJ Lux', style: 'synthwave', bpm: 96, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], lead: 'sawtooth', color: '#ff4fd8' },
    { id: 'dock', name: 'DOCK 99.1', dj: 'Marlo', freq: '99.1', style: 'lo-fi', bpm: 78, root: 48, scale: [0, 2, 4, 7, 9], prog: [0, 3, 1, 4], lead: 'triangle', color: '#4fe3ff' },
    { id: 'neon', name: 'NEON WAVE', dj: 'Kit & Kaz', freq: '104.5', style: 'club', bpm: 122, root: 41, scale: [0, 3, 5, 7, 10], prog: [0, 0, 3, 2], lead: 'square', color: '#ffd970' },
  ];
  const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  // One bar (16 steps) of music for a station: [{step, kind, midi, len}] — kinds: bass, pad, lead, hat, kick.
  function bar(stationId, index) {
    const s = STATION[stationId]; if (!s) return [];
    const deg = s.prog[index % s.prog.length], note = (d, oct = 0) => s.root + s.scale[((d % s.scale.length) + s.scale.length) % s.scale.length] + 12 * (oct + Math.floor(d / s.scale.length));
    const out = [{ step: 0, kind: 'pad', midi: [note(deg, 1), note(deg + 2, 1), note(deg + 4, 1)], len: 16 }];
    const bassSteps = s.style === 'club' ? [0, 4, 8, 12] : s.style === 'lo-fi' ? [0, 6, 10] : [0, 3, 6, 8, 11, 14];
    for (const st of bassSteps) out.push({ step: st, kind: 'bass', midi: note(deg), len: 2 });
    const kicks = s.style === 'club' ? [0, 4, 8, 12] : s.style === 'lo-fi' ? [0, 7, 10] : [0, 8];
    for (const st of kicks) out.push({ step: st, kind: 'kick', len: 1 });
    for (let st = s.style === 'lo-fi' ? 2 : 2; st < 16; st += s.style === 'club' ? 4 : 4) out.push({ step: st, kind: 'hat', len: 1 });
    // a sparse seeded melody: same bar index → same tune (stations feel like real songs looping)
    const phrase = Math.floor(index / 8);
    for (let st = 0; st < 16; st += 2) {
      const r = hash(`${s.id}:${phrase}:${index % 8}:${st}`);
      if (r < (s.style === 'lo-fi' ? 0.3 : 0.42)) out.push({ step: st, kind: 'lead', midi: note(deg + Math.floor(r * 100) % 5, 2), len: r < 0.15 ? 4 : 2 });
    }
    return out.sort((a, b) => a.step - b.step);
  }
  const stepSeconds = (stationId) => 60 / (STATION[stationId]?.bpm || 100) / 4;

  // ---- contacts ----
  const CONTACTS = {
    rico: { name: 'Rico', icon: '🧢', role: 'street tips' },
    vee: { name: 'Vee', icon: '💃', role: 'club promoter' },
    coach: { name: 'Coach Iron', icon: '🥊', role: 'Iron Works Gym' },
    sam: { name: 'Broker Sam', icon: '📈', role: 'market' },
    dex: { name: 'Dex', icon: '🔧', role: 'gun shop' },
    mom: { name: 'Mom', icon: '❤️', role: 'family' },
    broker: { name: 'The Broker', icon: '🎯', role: 'contracts' },
  };

  // ---- news ----
  const FLAVOR = [
    'City council approves new streetlights for Southside — residents say "about time."',
    'Traffic report: the Midtown loop is jammed again. Take the docks road.',
    'A stray cat has reportedly been elected unofficial mayor of the West End fish market.',
    'Harbor authority reports record container traffic this week.',
    'Local diner introduces a 2 a.m. "night shift breakfast". Lines around the block.',
    'Police remind drivers: red lights are not suggestions.',
    'Weather desk: humid night ahead, scattered showers after dark.',
    'Neon Room announces a surprise guest DJ this weekend.',
    'Iron Works Gym hosts free stretching classes every morning.',
    'Pawn shops report a surge in vintage watches. Ask no questions, they say.',
    'Metro Cabs drivers threaten slowdown over new meter rules.',
    'Someone spray-painted a giant golden fish on the canal wall. Art critics are divided.',
  ];
  const money = (n) => '$' + Math.round(n).toLocaleString();
  // diff = { heists, heistBest, events, fights, ladderUp, stashes, rankName, koi, escapes } (new since last check)
  // world = { minute, rain, district, heat, marketText }
  function headlines(diff = {}, world = {}) {
    const out = [], where = world.district || 'the city';
    if (diff.heists > 0) out.push({ pri: 5, text: `BREAKING: bank vault hit in ${where}. Police say the crew got away with around ${money(diff.heistBest || 7000)}.` });
    if (diff.events > 0) out.push({ pri: 3, text: diff.eventType === 'truck' ? 'An armored truck was cracked open in broad daylight. The company "is reviewing procedures".' : `Witnesses saw someone sprint off with a mystery package in ${where}.` });
    if (diff.fights > 0) out.push({ pri: 3, text: 'Word from the underground: a new name is climbing the Iron Works fight ladder.' });
    if (diff.ladderUp >= 5) out.push({ pri: 5, text: 'Iron Mara has been dethroned. The back room has a new champion.' });
    if (diff.stashes > 0) out.push({ pri: 2, text: 'Rumors say someone is cleaning out the old smuggler stashes around town.' });
    if (diff.rankName) out.push({ pri: 4, text: `People on the street are calling you a ${diff.rankName} now.` });
    if (diff.koi > 0) out.push({ pri: 4, text: 'An angler reportedly landed the legendary golden koi. Fishermen are furious.' });
    if (diff.escapes > 0) out.push({ pri: 2, text: `Police called off a pursuit in ${where} after losing the suspect.` });
    if ((world.heat || 0) >= 3) out.push({ pri: 4, text: `Police scanner: units converging on ${where}. Suspect considered armed.` });
    if (world.marketText) out.push({ pri: 1, text: `Markets: ${world.marketText.replace(/^\S+\s/, '')}.` });
    const m = norm(world.minute);
    if (isNight(m)) out.push({ pri: 1, text: `It's ${hhmm(m)} and the clubs are packed. Product moves fast after dark.` });
    else if (isMorning(m)) out.push({ pri: 1, text: `Good morning, it's ${hhmm(m)}. Iron Works sets are half price until noon.` });
    if (world.rain) out.push({ pri: 1, text: 'Rain is coming down. Roads are slick, watch those corners.' });
    return out.sort((a, b) => b.pri - a.pri);
  }
  const flavor = (i) => FLAVOR[((i % FLAVOR.length) + FLAVOR.length) % FLAVOR.length];

  // ---- texts that are tied to real mechanics ----
  // The game clock runs 8 real minutes per day, so tip texts are rate-limited in real time.
  const TEXT_GAP_MS = 30 * 60 * 1000;
  // state: { lastNightAt, lastMorningAt, lastMarketWindow }, now: { at (real ms), minute, marketWindow, marketText, holding }
  function texts(state, now) {
    const out = [], m = norm(now.minute), at = Number(now.at) || 0;
    if (isNight(m) && at - (state.lastNightAt || 0) >= TEXT_GAP_MS) { state.lastNightAt = at; out.push({ from: 'vee', text: `Club night is ON. Velvet and Neon Room pay +${Math.round(RHYTHM.clubNightBonus * 100)}% for product until 4am.` }); }
    if (isMorning(m) && at - (state.lastMorningAt || 0) >= TEXT_GAP_MS) { state.lastMorningAt = at; out.push({ from: 'coach', text: 'Morning special: gym sets half price till noon. Fight club is open in the back.' }); }
    if (now.marketText && now.marketWindow !== state.lastMarketWindow && (now.holding || now.marketWindow % 3 === 0)) { state.lastMarketWindow = now.marketWindow; out.push({ from: 'sam', text: `Heads up: ${now.marketText.replace(/^\S+\s/, '')}. Check 💹 MARKET.` }); }
    return out;
  }
  const EVENT_TEXT = {
    briefcase: [['rico', 'Somebody dropped a briefcase on the street. Grab it before the cops do 💼']],
    truck: [['rico', 'Armored truck broke down. Crack it, but the cops will roll up fast 🚚']],
    package: [['rico', 'Got a package that needs to move across town, fast. You in? 🎁']],
    sprint: [['rico', 'Pop-up street sprint starting. Bring a car 🏁']],
  };
  function cleanState(raw) {
    const s = { version: 1, station: 'nfm', radio: true, log: [], unread: 0, lastNightAt: 0, lastMorningAt: 0, lastMarketWindow: -1, seen: {}, welcomed: false, where: 'home' };
    if (STATION[raw?.station]) s.station = raw.station;
    s.radio = raw?.radio !== false;
    if (Array.isArray(raw?.log)) s.log = raw.log.filter((x) => x && CONTACTS[x.from] && typeof x.text === 'string' && Number.isFinite(x.at)).slice(-40).map((x) => ({ from: x.from, text: x.text.slice(0, 200), at: x.at }));
    for (const k of ['lastNightAt', 'lastMorningAt']) if (Number.isFinite(raw?.[k]) && raw[k] > 0) s[k] = raw[k];
    s.unread = Number.isSafeInteger(raw?.unread) && raw.unread > 0 ? Math.min(99, raw.unread) : 0;
    s.welcomed = raw?.welcomed === true;
    s.where = raw?.where === 'city' ? 'city' : 'home'; // where you were when the game last saved
    if (Number.isSafeInteger(raw?.lastMarketWindow)) s.lastMarketWindow = raw.lastMarketWindow;
    for (const [k, v] of Object.entries(raw?.seen || {})) if (/^[a-zA-Z]{1,20}$/.test(k) && Number.isFinite(v) && v >= 0) s.seen[k] = v;
    return s;
  }

  const api = Object.freeze({ norm, isNight, isMorning, RHYTHM, clubPremiumBonus, gymFeeMult, hhmm, STATIONS, STATION, midiHz, bar, stepSeconds, CONTACTS, FLAVOR, headlines, flavor, texts, TEXT_GAP_MS, EVENT_TEXT, cleanState });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightshiftLifeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
