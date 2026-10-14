/* NPC minds (Claude-owned). Pure + Node-testable; npc-mind.js runs it in game.
 * Every neighbourhood has a fixed, seeded cast of residents (same people for every player, so it carries into
 * multiplayer). When a pedestrian appears they "become" one of their district's residents, so you keep running into
 * the same people around their part of town.
 *  - identity: name, age, job, two traits, a like, a home district, a secret (and sometimes a gang tie)
 *  - opinion of YOU (-100..100), built from what they've seen you do, kept in a small memory log; gossip spreads it
 *  - reaction: what they do when something happens (flee, hide, film it, call the cops, confront you, cheer)
 *  - talk: a greeting that fits their mood + opinion, and a rumour/tip about the live world; secrets at 40+
 * Opinion state is per player (local save); identities are pure functions of (district, index). */
(function (root) {
  'use strict';
  const FIRST = ['Marisol', 'Dante', 'Keisha', 'Tomas', 'Yuki', 'Andre', 'Priya', 'Luis', 'Nadia', 'Marcus', 'Elena', 'Jamal', 'Sofia', 'Darius', 'Mei', 'Rafael', 'Imani', 'Viktor', 'Leah', 'Omar', 'Carmen', 'Kenji', 'Tasha', 'Hector', 'Ana', 'Malik', 'Grace', 'Ivan', 'Zara', 'Felix', 'Rosa', 'Theo', 'Aaliyah', 'Diego', 'Hana', 'Curtis', 'Lena', 'Ray', 'Bianca', 'Sam', 'Noor', 'Eddie', 'Jasmine', 'Paulo', 'Kim', 'Reggie', 'Chloe', 'Arturo', 'Destiny', 'Wes'];
  const LAST = ['Vega', 'Okafor', 'Reyes', 'Nakamura', 'Brooks', 'Patel', 'Morales', 'Novak', 'Washington', 'Chen', 'Silva', 'Haddad', 'Kowalski', 'Price', 'Ortiz', 'Mendez', 'Park', 'Coleman', 'Duarte', 'Ferreira', 'Ivanova', 'Jackson', 'Kaur', 'Lopez', 'Moreau', 'Nguyen', 'Osei', 'Russo', 'Santos', 'Torres', 'Tran', 'Walker', 'Young', 'Bell', 'Cruz', 'Diaz', 'Grant', 'Hayes', 'Khan', 'Mills'];
  const JOBS = {
    any: ['barista', 'line cook', 'delivery rider', 'rideshare driver', 'nurse', 'student', 'security guard', 'bartender', 'retail clerk', 'teacher', 'street vendor', 'personal trainer', 'nail tech', 'night janitor'],
    Downtown: ['day trader', 'lawyer', 'office temp', 'hotel concierge', 'bank teller', 'IT guy', 'paralegal', 'realtor'],
    'Old Town': ['tattoo artist', 'barber', 'record-store clerk', 'bodega owner', 'retired boxer', 'church volunteer'],
    Market: ['fishmonger', 'food-truck cook', 'florist', 'market porter', 'phone-repair tech', 'butcher'],
    Harbor: ['dockworker', 'crane operator', 'trucker', 'fisherman', 'customs clerk', 'welder'],
    Ironworks: ['welder', 'forklift driver', 'machinist', 'scrapyard hand', 'night-shift foreman'],
    Heights: ['architect', 'dentist', 'yoga teacher', 'startup founder', 'art dealer', 'retired judge'],
    Fairview: ['mechanic', 'school bus driver', 'hairdresser', 'mail carrier', 'youth coach', 'line cook'],
    'The Flats': ['DJ', 'club promoter', 'bouncer', 'model', 'sneaker reseller', 'producer'],
  };
  // bravery: how likely to stand their ground; gossip: how fast they spread news; temper: how quick to confront.
  const TRAITS = {
    brave: { label: 'Brave', bravery: 0.35 }, timid: { label: 'Timid', bravery: -0.35 }, nosy: { label: 'Nosy', gossip: 0.35, bravery: 0.1 },
    chatty: { label: 'Chatty', gossip: 0.3 }, honest: { label: 'Straight-laced', snitch: 0.3 }, shady: { label: 'Shady', snitch: -0.4, crime: 0.3 },
    hothead: { label: 'Hothead', temper: 0.5, bravery: 0.15 }, chill: { label: 'Chill', temper: -0.3 }, greedy: { label: 'Greedy', greed: 0.5 },
    loyal: { label: 'Loyal', loyal: 0.4 }, paranoid: { label: 'Paranoid', snitch: 0.15, bravery: -0.15 }, romantic: { label: 'Hopeless romantic' },
  };
  const TRAIT_IDS = Object.keys(TRAITS);
  const LIKES = ['late-night tacos', 'old-school hip hop', 'street racing', 'boxing on TV', 'the Harbor sunsets', 'cheap lottery tickets', 'vintage sneakers', 'karaoke', 'their dog', 'telenovelas', 'fixing up old cars', 'pickup basketball', 'conspiracy podcasts', 'the night market', 'jazz bars', 'fishing off the pier', 'anime', 'gym selfies'];
  const GANGS = ['market', 'diablos', 'kings', 'tape', 'saints', 'rats'];
  const DISTRICTS = ['Downtown', 'Old Town', 'Market', 'Harbor', 'Ironworks', 'Heights', 'Fairview', 'The Flats'];
  const PER_DISTRICT = 40;
  // Secrets; {d} = a district, {n} = a number. kind drives what the card can do with it.
  const SECRETS = [
    { kind: 'stash', text: 'knows where somebody hid a bag of cash in {d}', me: "I know where somebody hid a bag of cash in {d}" },
    { kind: 'debt', text: 'owes the Crown ${n} and is running out of time', me: "I owe the Crown ${n} and I'm running out of time" },
    { kind: 'witness', text: 'saw who torched the warehouse in {d} and never told anyone', me: "I saw who torched the warehouse in {d}. Never told a soul" },
    { kind: 'informant', text: 'quietly feeds tips to Capt. Hale', me: "I feed Capt. Hale a tip now and then. Keep that quiet" },
    { kind: 'side', text: 'sells "vitamins" out of their locker on the side', me: "I sell \"vitamins\" out of my locker on the side" },
    { kind: 'race', text: 'runs illegal street races on Route 9 some nights', me: "I run street races on Route 9 some nights" },
    { kind: 'ex', text: 'used to run with Vex before she took over the Crown', me: "I used to run with Vex, before the Crown" },
    { kind: 'cops', text: 'knows the night patrol skips {d} between 2 and 4', me: "The night patrol skips {d} between 2 and 4. Every night" },
    { kind: 'love', text: 'is secretly seeing someone from a rival crew', me: "I'm seeing someone from a rival crew. Nobody knows" },
    { kind: 'gun', text: 'keeps an unregistered piece under the counter at work', me: "I keep a piece under the counter at work" },
  ];
  // What they remember. delta = opinion change for the one who saw/suffered it; gang members see crime differently.
  const MEMORY = {
    'robbed-me': { delta: -60, text: 'You robbed them', heat: true },
    'hit-by-car': { delta: -45, text: 'You ran them down', heat: true },
    'shot-me': { delta: -70, text: 'You shot them', heat: true },
    'saw-kill': { delta: -30, gang: 6, text: 'Saw you kill someone' },
    'saw-gangkill': { delta: -10, gang: 18, text: 'Saw you drop a gang member' },
    'saw-copkill': { delta: -40, gang: 22, text: 'Saw you take down a cop' },
    'saw-shooting': { delta: -10, gang: 4, text: 'Saw you shooting in the street' },
    'saw-robbery': { delta: -14, gang: 4, text: 'Saw you rob someone' },
    'saw-fight': { delta: -4, gang: 4, text: 'Saw you brawling' },
    'beat-me': { delta: -50, text: 'You beat them up', heat: true },
    'saw-hitrun': { delta: -18, gang: 2, text: 'Saw you plough into someone' },
    'saw-help': { delta: 12, text: 'Saw you help someone out' },
    'saved': { delta: 40, text: 'You saved them' },
    'tipped': { delta: 12, text: 'You slipped them some cash' },
    'talked': { delta: 3, text: 'You stopped to talk' },
    'threatened': { delta: -25, text: 'You threatened them' },
    'heard': { delta: 0, text: 'Heard about you' },
  };
  const BANDS = [[60, 'Fan', '#7cdeb5'], [25, 'Friendly', '#9fd4ff'], [-15, 'Neutral', '#cfd6e6'], [-45, 'Wary', '#ffd970'], [-101, 'Hates you', '#ff6a6a']];

  function rng(seed) { let x = (seed >>> 0) || 1; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** The fixed resident #i of a district. Same for everyone. */
  function resident(district, i) {
    const d = DISTRICTS.includes(district) ? district : 'Downtown', idx = ((i % PER_DISTRICT) + PER_DISTRICT) % PER_DISTRICT;
    const r = rng(hash(d + '#' + idx) ^ 0x5bd1e995);
    const first = pick(r, FIRST), last = pick(r, LAST), age = 18 + Math.floor(r() * 52);
    const jobs = r() < 0.55 && JOBS[d] ? JOBS[d] : JOBS.any, job = age > 66 && r() < 0.6 ? 'retired' : pick(r, jobs);
    const t1 = pick(r, TRAIT_IDS); let t2 = pick(r, TRAIT_IDS); for (let k = 0; t2 === t1 || (t1 === 'brave' && t2 === 'timid') || (t1 === 'timid' && t2 === 'brave') || (t1 === 'chill' && t2 === 'hothead') || (t1 === 'hothead' && t2 === 'chill') || (t1 === 'honest' && t2 === 'shady') || (t1 === 'shady' && t2 === 'honest'); k++) { t2 = TRAIT_IDS[(TRAIT_IDS.indexOf(t2) + 1 + k) % TRAIT_IDS.length]; }
    const traits = [t1, t2], sum = (k) => traits.reduce((a, t) => a + (TRAITS[t][k] || 0), 0);
    const gang = (traits.includes('shady') ? r() < 0.45 : r() < 0.1) ? pick(r, GANGS) : null;
    const sec = pick(r, SECRETS), sd = pick(r, DISTRICTS), sn = String((2 + Math.floor(r() * 18)) * 500), fill = (t) => t.replace('{d}', sd).replace('{n}', sn), secret = { kind: sec.kind, text: fill(sec.text), me: fill(sec.me) };
    return {
      id: d.toLowerCase().replace(/\s+/g, '-') + '-' + idx, district: d, idx, name: first + ' ' + last, first, age, job, traits, like: pick(r, LIKES), gang, secret,
      bravery: clamp(0.4 + sum('bravery') + (gang ? 0.2 : 0) + (age < 30 ? 0.05 : 0) + (r() - 0.5) * 0.2, 0, 1),
      gossip: clamp(0.35 + sum('gossip') + (r() - 0.5) * 0.2, 0, 1), temper: clamp(0.25 + sum('temper') + (r() - 0.5) * 0.2, 0, 1),
      snitch: clamp(0.4 + sum('snitch') - (gang ? 0.35 : 0) + (r() - 0.5) * 0.2, 0, 1), greed: clamp(0.3 + sum('greed') + (r() - 0.5) * 0.2, 0, 1),
    };
  }

  // ---------- opinion + memory (per player) ----------
  const fresh = () => ({ v: 1, ops: {}, met: {}, day: 0 });
  function clean(s) { const o = s && typeof s === 'object' ? s : {}; return { v: 1, ops: o.ops && typeof o.ops === 'object' ? o.ops : {}, met: o.met && typeof o.met === 'object' ? o.met : {}, day: Number.isFinite(o.day) ? o.day : 0 }; }
  function rec(state, id) { return state.ops[id] || (state.ops[id] = { o: 0, mem: [], talkDay: -1, tipDay: -1, secret: false }); }
  function opinion(state, id) { return state.ops[id]?.o || 0; }
  function band(o) { for (const [min, label, color] of BANDS) if (o >= min) return { label, color }; return { label: 'Hates you', color: '#ff6a6a' }; }
  /** Record a memory; returns the opinion delta applied. Repeats within 60 s don't stack (a gunfight is one memory). */
  function remember(state, who, kind, now = 0, extra = '') {
    const m = MEMORY[kind]; if (!m || !who) return 0; const r = rec(state, who.id);
    const last = r.mem[r.mem.length - 1]; if (last && last.k === kind && now - last.t < 60000 && kind !== 'tipped') return 0;
    let delta = m.delta; if (who.gang && Number.isFinite(m.gang)) delta = m.gang;
    if (kind === 'saw-gangkill' && who.gang && extra === who.gang) delta = -50; // you killed their own
    if (who.traits.includes('loyal') && delta > 0) delta = Math.round(delta * 1.3);
    if (who.traits.includes('greedy') && kind === 'tipped') delta = Math.round(delta * 1.5);
    r.o = clamp(Math.round(r.o + delta), -100, 100); r.mem.push({ k: kind, t: now, x: extra }); if (r.mem.length > 6) r.mem.shift();
    return delta;
  }
  /** Gossip: when two residents talk, the teller passes on their strongest feeling about you (diluted). */
  function spread(state, teller, listener, now = 0) {
    const a = state.ops[teller.id]; if (!a || Math.abs(a.o) < 20) return 0; const strength = 0.25 + teller.gossip * 0.35;
    const b = rec(state, listener.id), before = b.o; b.o = clamp(Math.round(b.o + (a.o - b.o) * strength * 0.5), -100, 100);
    if (b.o !== before) { const last = b.mem[b.mem.length - 1]; if (!last || last.k !== 'heard') { b.mem.push({ k: 'heard', t: now, x: teller.first }); if (b.mem.length > 6) b.mem.shift(); } }
    return b.o - before;
  }

  // ---------- reactions ----------
  /** What a resident does when something happens near them. ctx: { kind:'shots'|'kill'|'robbery'|'fight'|'car'|'seen', dist, armed, heat, op }
   *  -> 'cheer'|'film'|'call'|'confront'|'hide'|'flee'|'wave'|'glare'|'ignore' */
  function react(who, ctx, r = Math.random) {
    const op = ctx.op ?? 0, near = (ctx.dist ?? 999) < 140, b = who.bravery;
    if (ctx.kind === 'seen') {
      if (op >= 60) return 'wave'; if (op <= -60) return b > 0.6 && !ctx.armed && who.temper > 0.45 ? 'confront' : 'flee';
      if (op <= -30) return near && b < 0.5 ? 'flee' : 'glare'; if (op >= 25) return r() < 0.5 ? 'wave' : 'ignore'; return 'ignore';
    }
    if (ctx.kind === 'kill' && who.gang && ctx.gangKill && ctx.gang !== who.gang) return r() < 0.6 ? 'cheer' : 'ignore';
    const violent = ctx.kind === 'kill' || ctx.kind === 'shots';
    if (violent && near) return b > 0.75 && !ctx.armed ? 'film' : b > 0.5 ? 'hide' : 'flee';
    if (violent) { if (b > 0.55 && who.traits.includes('nosy')) return 'film'; if (who.snitch > 0.55 && op < 40) return 'call'; return b > 0.45 ? 'hide' : 'flee'; }
    if (ctx.kind === 'robbery') { if (who.snitch > 0.5 && op < 30) return 'call'; return b > 0.6 && who.temper > 0.5 && !ctx.armed ? 'confront' : 'flee'; }
    if (ctx.kind === 'fight') return who.temper > 0.6 ? 'cheer' : b > 0.6 ? 'film' : 'ignore';
    if (ctx.kind === 'car') return 'flee';
    return 'ignore';
  }

  // ---------- mood + talk ----------
  function mood(who, op, ctx = {}) {
    if (ctx.scared) return { id: 'scared', label: 'Shaken up', icon: '😨' };
    if (op <= -45) return { id: 'angry', label: 'Angry at you', icon: '😠' };
    const h = ctx.hour ?? 20;
    if (who.secret.kind === 'debt' && h >= 21) return { id: 'stressed', label: 'Stressed about money', icon: '😰' };
    if (h >= 2 && h < 6) return { id: 'tired', label: 'Exhausted', icon: '🥱' };
    if (ctx.rain > 0.4) return { id: 'grumpy', label: 'Soaked and grumpy', icon: '🌧️' };
    if (op >= 25) return { id: 'happy', label: 'Happy to see you', icon: '😊' };
    if (who.traits.includes('chill')) return { id: 'chill', label: 'Taking it easy', icon: '😌' };
    if (who.traits.includes('paranoid')) return { id: 'edgy', label: 'Keeps looking over their shoulder', icon: '👀' };
    return { id: 'ok', label: 'Going about their night', icon: '🙂' };
  }
  const GREET = {
    Fan: ['Ayy, it\'s you! Whole block talks about you.', 'Anything you need, just say it.', 'Yo! Legend in the flesh.'],
    Friendly: ['Hey, good to see you around.', 'You again! How\'s the night treating you?', 'What\'s good?'],
    Neutral: ['Can I help you?', 'Hm? Oh. Hey.', 'Yeah?'],
    Wary: ['...What do you want.', 'I don\'t want any trouble.', 'Make it quick.'],
    'Hates you': ['Get away from me.', 'You\'ve got some nerve.', 'I know what you did.'],
  };
  const JOBLINE = { nurse: 'Double shift at the clinic. Seen too many gunshot wounds this week.', 'delivery rider': 'Twelve drops left and my battery\'s dying.', bartender: 'Bar\'s dead till midnight, then it\'s chaos.', 'rideshare driver': 'Drove a guy to the docks with a duffel bag. Didn\'t ask.', dockworker: 'Containers come in at night that never show up on the manifest.', 'security guard': 'They pay me to watch a parking lot. So I watch.', barber: 'Everybody talks in the chair. Everybody.', 'tattoo artist': 'Did three Crown tattoos this week. Business is booming.', mechanic: 'Nia sends me the cars she can\'t be bothered with.', 'day trader': 'Market\'s up, I\'m down. Story of my life.', student: 'Finals tomorrow. Obviously I\'m out here.', DJ: 'I\'m on at the club at one. Come through.' };
  function greet(who, op, r = Math.random) { const b = band(op).label; return pick(r, GREET[b] || GREET.Neutral); }
  function smallTalk(who, r = Math.random) { const l = JOBLINE[who.job]; return l && r() < 0.6 ? l : `Honestly? I'm just here for the ${who.like}.`; }
  /** A rumour pointing at something real. world: { districts:[...], gangs:{id:name}, wanted, story:{chapter,title} } */
  function rumor(who, world = {}, r = Math.random) {
    const d = pick(r, world.districts?.length ? world.districts : DISTRICTS), gname = (g) => world.gangs?.[g] || g;
    const lines = [
      `Cops have been sitting on ${d} all week. I'd stay clear if I were you.`,
      `Heard the ${gname(pick(r, GANGS))} are short on soldiers. Someone could move in on their corners.`,
      `There's a store in ${d} with a busted alarm. Just saying.`,
      `Somebody was racing a Gallardo on Route 9 last night. Over 300 on the board.`,
      `Night market\'s got a guy selling parts out the back. No questions.`,
      world.wanted > 0 ? 'You\'re hot right now. Get off the street or change cars.' : 'Quiet night. Too quiet.',
      world.story ? `People are saying ${world.story}. Wild times.` : 'Vex has the whole Crown on edge lately.',
    ];
    if (who.gang) lines.push(`If you're cool with the ${gname(who.gang)}, you're cool with me.`);
    return pick(r, lines);
  }
  function secretLine(who) { return `${who.first} ${who.secret.text}.`; }
  const canSecret = (op, charisma = 0) => op >= 40 - Math.min(20, charisma * 2);

  /** What the card shows (pure). */
  function describe(who, state, ctx = {}) {
    const r0 = state.ops[who.id], op = r0?.o || 0, bd = band(op);
    return {
      name: who.name, age: who.age, job: who.job, from: who.district, traits: who.traits.map((t) => TRAITS[t].label), like: who.like,
      gang: who.gang, op, band: bd.label, color: bd.color, mood: mood(who, op, ctx),
      memories: (r0?.mem || []).slice().reverse().map((m) => MEMORY[m.k].text + (m.k === 'heard' && m.x ? ` (from ${m.x})` : '')),
      secret: r0?.secret ? secretLine(who) : null, secretLocked: !r0?.secret, met: !!state.met[who.id],
    };
  }
  /** Intimidate: timid/greedy/low-bravery people fold (give cash or spill the secret); brave/hotheads push back. */
  function intimidate(who, armed, r = Math.random) {
    const chance = clamp(0.25 + (1 - who.bravery) * 0.55 + (armed ? 0.2 : 0) - who.temper * 0.25, 0.05, 0.95);
    if (r() < chance) return who.secret.kind === 'stash' || who.secret.kind === 'cops' || r() < 0.5 ? 'secret' : 'cash';
    return who.temper > 0.55 ? 'fight' : 'refuse';
  }

  const api = { FIRST, LAST, JOBS, TRAITS, LIKES, SECRETS, MEMORY, DISTRICTS, PER_DISTRICT, BANDS, hash, rng, resident, fresh, clean, rec, opinion, band, remember, spread, react, mood, greet, smallTalk, rumor, secretLine, canSecret, describe, intimidate };
  root.NightshiftMindData = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
