/* Premium street props + sit-able benches (Claude-owned). Same pixel pipeline as weapon-art.js / pet-art.js.
 *  - Replaces Codex's street props (hydrant, mailbox, vending, dumpster, flowercart, barrel, crate, bench, atm) through
 *    NightshiftDetailedArt.prop (rpg-play routes its calls through the api) — drawn at 2x detail (1 grid px = 0.5 world px).
 *  - Adds city benches along the sidewalks where people idle; idle NPCs and the player sit on them.
 *  - Pets: when pet-art.js is present, pets.js draws every pet, so Codex's duplicate pet pass is switched off.
 * API: NightshiftPropArt.{build, sprite, draw, KINDS, benches} */
(function (root) {
  'use strict';
  const WA = () => root.NightshiftWeaponArt || (typeof require === 'function' ? (() => { try { return require('./weapon-art.js'); } catch { return null; } })() : null);
  const K = 0.5;
  // size (grid px), anchor = bottom centre
  const SIZE = { hydrant: [30, 48], mailbox: [46, 52], vending: [52, 76], dumpster: [80, 50], flowercart: [76, 56], barrel: [34, 42], crate: [50, 50], bench: [90, 46], atm: [50, 70], trashcan: [30, 42], planter: [58, 44] };

  function kit(b) {
    const X = WA().pix, R = (hex, hi) => X.ramp(hex, hi);
    // vertical cylinder: lit on the left third, specular band, dark right edge
    const VC = (T, x, y, w, h) => { for (let i = 0; i < w; i++) { const f = w <= 1 ? 0.3 : i / (w - 1), t = f < 0.12 ? 2 : f < 0.32 ? 3 : f > 0.8 ? 0 : 1; for (let j = 0; j < h; j++) b.put(x + i, y + j, T[t]); } };
    const E = (T, cx, cy, rx, ry, o) => { const m = []; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) m.push([x, y]); b.Pm(T, m, o); };
    return { X, R, VC, E };
  }
  const BUILD = {
    hydrant(b) { const { R, VC, E } = kit(b), red = R('#c2412f'), dk = R('#3a4249'), y0 = 46;
      b.R(dk, 5, y0 - 4, 20, 4); VC(red, 8, 14, 14, 28); E(red, 15, 14, 7, 5); b.R(red, 6, 18, 18, 3);
      b.R(R('#e7c45a'), 13, 6, 4, 4); VC(red, 2, 24, 6, 6); VC(red, 22, 24, 6, 6); b.L('#f2c84a', 3, 26, 1, 2); b.L('#f2c84a', 27, 26, 1, 2);
      b.R(R('#f4f1ea'), 8, 32, 14, 2, { flat: true }); for (let i = 0; i < 3; i++) b.L(red[0], 10 + i * 4, 37, 1, 4); },
    mailbox(b) { const { R, E } = kit(b), blu = R('#2f5f8f'); b.R(R('#20272e'), 8, 40, 4, 12); b.R(R('#20272e'), 34, 40, 4, 12);
      b.R(blu, 4, 14, 38, 28); E(blu, 23, 14, 19, 9); b.R(R('#1a2d40'), 10, 18, 26, 4); b.L('#0b0e12', 12, 19, 22, 2);
      b.R(R('#e8eef3'), 14, 28, 18, 6, { flat: true }); b.L('#2f5f8f', 16, 30, 14, 1); b.L('#c84659', 16, 32, 8, 1); b.L('#ffffff55', 6, 16, 2, 22); },
    vending(b) { const { R } = kit(b), body = R('#b53a43'), y = 4; b.R(body, 2, y, 48, 70); b.R(R('#16222c'), 6, y + 6, 30, 44);
      const cans = ['#e3b36b', '#67a691', '#b58ad0', '#e05a4a', '#3d99d6']; for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { b.R(R(cans[(r + c) % 5]), 8 + c * 5, y + 9 + r * 10, 4, 7); b.L('#ffffff88', 8 + c * 5, y + 9 + r * 10, 1, 7); } for (let r = 0; r < 4; r++) b.L('#0b0e12', 7, y + 17 + r * 10, 28, 1);
      b.L('#ffffff30', 6, y + 6, 30, 1); b.L('#9fe4ff40', 33, y + 7, 2, 40); b.R(R('#2a2f36'), 39, y + 8, 8, 20); b.L('#7cdeb5', 41, y + 10, 4, 3); for (let i = 0; i < 6; i++) b.L('#c9cfd6', 40 + (i % 2) * 3, y + 15 + Math.floor(i / 2) * 3, 2, 2);
      b.R(R('#101418'), 8, y + 56, 26, 8); b.L('#f4f1ea', 4, y + 2, 44, 2); b.L('#ffd970', 40, y + 32, 6, 1); },
    dumpster(b) { const { R } = kit(b), grn = R('#3f6b4f'); b.R(R('#20262b'), 10, 44, 8, 5); b.R(R('#20262b'), 62, 44, 8, 5);
      b.P(grn, [[6, 14], [74, 14], [70, 46], [10, 46]]); for (let i = 0; i < 5; i++) b.R(R('#335a42'), 14 + i * 13, 18, 3, 26);
      b.P(R('#1d2226'), [[3, 8], [77, 8], [76, 15], [4, 15]]); b.L('#ffffff22', 5, 9, 70, 1); b.R(R('#c9cfd6'), 20, 10, 6, 2); b.R(R('#c9cfd6'), 54, 10, 6, 2);
      b.L('#e0c060', 30, 26, 12, 1); b.L('#ff4ad8', 33, 28, 9, 2); b.L('#ff4ad8', 44, 25, 2, 6); b.L('#f4f1ea', 48, 27, 6, 1); }, // graffiti tag
    flowercart(b) { const { R, E } = kit(b), wood = R('#8f6a46'); E(R('#2a2f36'), 16, 48, 6, 6); E(R('#2a2f36'), 60, 48, 6, 6); E(R('#8f979f'), 16, 48, 2, 2); E(R('#8f979f'), 60, 48, 2, 2);
      b.R(wood, 4, 26, 68, 18); for (let i = 0; i < 4; i++) b.L(wood[0], 4, 30 + i * 4, 68, 1); b.R(R('#c9a066'), 2, 22, 72, 5); b.R(R('#5a4030'), 72, 18, 3, 20);
      const fl = ['#ed8aa0', '#f2c84a', '#e05a4a', '#b58ad0', '#f4f1ea', '#ffb347']; for (let i = 0; i < 6; i++) { b.R(R('#4a6a8a'), 6 + i * 11, 16, 9, 8); for (let k = 0; k < 4; k++) { b.L('#3d6e51', 8 + i * 11 + k * 2, 8 + (k % 2), 1, 8); E(R(fl[(i + k) % 6]), 8.5 + i * 11 + k * 2, 7 + (k % 2) * 2, 1.8, 1.8); } } },
    barrel(b) { const { R, VC } = kit(b), m = R('#a3502f'); VC(m, 4, 4, 26, 36); for (const y of [8, 20, 32]) VC(R('#6b3a28'), 4, y, 26, 2); b.R(R('#3a2a20'), 8, 2, 18, 3); b.L('#d08a5a', 8, 12, 1, 6); b.L('#5a3a22', 18, 24, 4, 3); b.L('#e8b070', 6, 6, 2, 1); },
    crate(b) { const { R } = kit(b), w = R('#a87a4a'); b.R(w, 2, 4, 46, 44); for (let i = 0; i < 5; i++) b.L(w[0], 2, 12 + i * 8, 46, 1); b.R(R('#c79a62'), 2, 4, 46, 4); b.R(R('#c79a62'), 2, 44, 46, 4);
      for (let i = 0; i < 38; i++) { b.L(w[2], 6 + i, 8 + i, 2, 1); } for (const [x, y] of [[4, 6], [44, 6], [4, 45], [44, 45]]) b.L('#59616b', x, y, 2, 2); b.L('#2b2f33', 18, 24, 14, 1); b.L('#2b2f33', 18, 27, 10, 1); },
    bench(b) { const { R } = kit(b), wood = R('#a5784c'), iron = R('#2a3036'); b.R(iron, 6, 20, 4, 24); b.R(iron, 80, 20, 4, 24); b.R(iron, 6, 40, 8, 4); b.R(iron, 76, 40, 8, 4);
      for (let i = 0; i < 3; i++) b.R(wood, 4, 4 + i * 6, 82, 4); for (let i = 0; i < 2; i++) b.R(wood, 4, 24 + i * 5, 82, 4); for (const x of [4, 82]) b.R(iron, x, 2, 4, 32); b.L('#ffffff30', 6, 5, 78, 1); b.L('#ffffff22', 6, 25, 78, 1); },
    atm(b) { const { R } = kit(b), c = R('#5c7280'); b.R(c, 4, 4, 42, 64); b.R(R('#16222c'), 9, 10, 32, 20); b.R(R('#2d6a5a'), 11, 12, 28, 15, { flat: true }); b.L('#bff5df', 13, 14, 16, 1); b.L('#8dd4b6', 13, 17, 22, 1); b.L('#8dd4b6', 13, 20, 12, 1); b.L('#ffffff40', 11, 12, 28, 1);
      b.R(R('#33444f'), 10, 34, 20, 16); for (let i = 0; i < 9; i++) b.R(R('#c9d2d8'), 12 + (i % 3) * 6, 36 + Math.floor(i / 3) * 5, 4, 3, { flat: true }); b.R(R('#20272e'), 33, 36, 9, 3); b.L('#7cdeb5', 34, 37, 2, 1); b.R(R('#20272e'), 12, 54, 26, 4); b.R(R('#f2c84a'), 4, 4, 42, 4); },
    trashcan(b) { const { R, VC } = kit(b), m = R('#3b4650'); VC(m, 4, 10, 22, 30); for (let i = 0; i < 4; i++) b.L(m[0], 8 + i * 5, 14, 1, 22); VC(R('#2a3036'), 2, 6, 26, 5); b.L('#7cdeb5', 12, 22, 6, 4); b.L('#f4f1ea', 13, 23, 4, 2); },
    planter(b) { const { R, E } = kit(b), pot = R('#7a8088'); b.R(pot, 4, 24, 50, 18); b.R(R('#9aa2aa'), 2, 20, 54, 6); for (let i = 0; i < 7; i++) E(R(['#3d6e51', '#4f8a5f', '#2f5a42'][i % 3]), 9 + i * 7, 14 + (i % 2) * 3, 6, 7); for (let i = 0; i < 4; i++) E(R(['#ed8aa0', '#f2c84a'][i % 2]), 12 + i * 12, 11 + (i % 2) * 4, 1.8, 1.8); },
  };
  function build(kind) {
    const fn = BUILD[kind], X = WA()?.pix; if (!fn || !X) return null;
    const [w, h] = SIZE[kind], b = X.Buf(null, w, h);
    b.Pm = (mat, mask, o) => { const T = mat, set = new Set(mask.map(([x, y]) => x + ',' + y)), has = (x, y) => set.has(x + ',' + y); let minX = 1e9, maxX = -1e9; for (const [x] of mask) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
      for (const [x, y] of mask) { let t = 1; if (!has(x, y - 1)) t = !o?.matte && (x - minX) < (maxX - minX) * 0.7 ? 3 : 2; else if (!has(x, y + 1) || !has(x + 1, y)) t = 0; else if (!has(x - 1, y)) t = 2; b.put(x, y, T[t]); } };
    fn(b); X.outline(b, '#0b1018');
    return { px: b.px, w, h };
  }
  const cache = new Map();
  function sprite(kind) {
    let s = cache.get(kind); if (s) return s; const p = build(kind); if (!p || typeof document === 'undefined') return null;
    const cv = document.createElement('canvas'); cv.width = p.w; cv.height = p.h; const c = cv.getContext('2d'), img = c.createImageData(p.w, p.h), X = WA().pix;
    for (let i = 0; i < p.px.length; i++) { const v = p.px[i]; if (!v) continue; const a = v.length === 9 ? parseInt(v.slice(7), 16) : 255; img.data.set([...X.hexToRgb(v.slice(0, 7)), a], i * 4); }
    c.putImageData(img, 0, 0); cache.set(kind, cv); return cv;
  }
  // Same call shape as Codex: prop(ctx, kind, x, y) with (x, y) on the ground under the prop.
  function draw(c, kind, x, y) {
    const s = sprite(kind); if (!s) return false; const [w, h] = SIZE[kind];
    c.save(); c.fillStyle = '#07152144'; c.beginPath(); c.ellipse(x + 3, y + 3, w * K * 0.5, Math.max(3, h * K * 0.12), 0, 0, Math.PI * 2); c.fill();
    const prev = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false; c.drawImage(s, Math.round(x - w * K / 2), Math.round(y + 4 - h * K), w * K, h * K); c.imageSmoothingEnabled = prev; c.restore();
    return true;
  }

  // ---------------- city benches + sitting ----------------
  // People idle along y = block*340 + 270, x = block*440 + 160..260 (citizen-routines.js goals), so benches go there.
  let benchList = null;
  function benches() {
    if (benchList) return benchList; benchList = [];
    /* eslint-disable no-undef */ let W0 = null, B = []; try { W0 = world; B = buildings; } catch { return benchList; } /* eslint-enable no-undef */
    const inside = (x, y) => B.some((b) => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6);
    for (let bx = 0; bx * 440 < W0.w; bx++) for (let by = 0; by * 340 < W0.h; by++) for (const dx of [182, 238]) {
      const x = bx * 440 + dx, y = by * 340 + 262; if (x > W0.w - 30 || y > W0.h - 30 || inside(x, y) || inside(x - 22, y) || inside(x + 22, y)) continue;
      let bad = false; try { bad = blocked(x, y) || blocked(x - 20, y) || blocked(x + 20, y); } catch { /* no game */ } // eslint-disable-line no-undef
      if (!bad) benchList.push({ x, y, seats: [x - 11, x + 11] });
    }
    return benchList;
  }
  const seatNear = (p, r = 16) => { for (const b of benches()) for (const sx of b.seats) if (Math.abs(p.x - sx) < r && Math.abs(p.y - (b.y + 6)) < 12) return { x: sx, y: b.y + 6 }; return null; };
  let still = 0, lastX = 0, lastY = 0;
  function seatTick() {
    /* eslint-disable no-undef */ let pl = null, list = []; try { pl = player; list = peds; } catch { return; } /* eslint-enable no-undef */
    for (const p of list) { if (!p) continue; if (p.moving) { p.seated = false; continue; } if (p.seated === undefined || p.seatCheck !== Math.round(p.x) + ',' + Math.round(p.y)) { p.seatCheck = Math.round(p.x) + ',' + Math.round(p.y); p.seated = !!seatNear(p, 14); } }
    if (!pl || pl.car) { if (pl) pl.seated = false; return; }
    if (Math.hypot(pl.x - lastX, pl.y - lastY) > 0.5 || pl.moving) { still = 0; pl.seated = false; } else still += 1;
    lastX = pl.x; lastY = pl.y;
    if (still >= 10 && !pl.seated && !root.NightshiftZones?.active?.()) { const s = seatNear(pl, 18); if (s) { pl.seated = true; } }
  }
  // street benches are drawn live (not into Codex's cached street layer), under people
  function drawBenches(ctx) {
    /* eslint-disable no-undef */ let cam = null; try { cam = camera; } catch { /* n/a */ } /* eslint-enable no-undef */
    for (const b of benches()) { if (cam && (b.x < cam.x - 80 || b.x > cam.x + 1400 || b.y < cam.y - 80 || b.y > cam.y + 900)) continue; draw(ctx, 'bench', b.x, b.y + 4); }
  }

  // ---------------- install over Codex detailed-art ----------------
  function install() {
    const DA = root.NightshiftDetailedArt; if (!DA || DA.__propArt) return !!DA?.__propArt;
    const orig = DA.prop;
    DA.prop = function (c, kind, x, y) { try { if (draw(c, kind, x, y)) return; } catch (e) { console.error(e); } return orig.apply(this, arguments); };
    if (root.NightshiftPetArt) DA.pet = function () { /* pets.js draws the premium pet (pet-art.js); avoid a second copy */ };
    // benches + a little more street dressing, drawn with the encounter pass (under people)
    const E = root.NightshiftEncounters;
    if (E && typeof E.draw === 'function') { const d0 = E.draw; E.draw = function () { /* eslint-disable-next-line no-undef */ try { if (!root.NightshiftZones?.active?.() && !root.NightshiftHome?.kind?.()) drawBenches(g); } catch { /* cosmetic */ } return d0.apply(this, arguments); }; }
    DA.__propArt = true; return true;
  }
  if (typeof document !== 'undefined') { if (!install()) { const t = setInterval(() => { if (install()) clearInterval(t); }, 200); setTimeout(() => clearInterval(t), 20000); } setInterval(seatTick, 100); }

  const api = Object.freeze({ build, sprite, draw, KINDS: Object.keys(BUILD), benches, seatNear });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.NightshiftPropArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
