/* Option 3 MASTER review hook (Claude-owned). Shows the three hand-authored master sprites inside the real game so
 * they can be judged at normal gameplay zoom BEFORE any animation work. OFF by default (game unchanged); turn on with
 * ?masters in the URL or localStorage 'ns-o3-master' = '1'. Only the authored poses are shown — everything else keeps
 * the current art:
 *   - player: art/o3-master/master_player_streetwear.png (144x192) when standing still facing S with no gun drawn;
 *   - Vanta GT: art/o3-master/master_vanta_gt_top.png (168x90, nose right) in factory purple + factory setup, any heading;
 *   - husky: art/o3-master/master_husky.png (120x96, facing right) when standing, facing E / NE / SE.
 * Shared grid: 3 art px per world px. API: NightshiftO3Masters.{enabled, setEnabled, player, car, key} */
(function (root) {
  'use strict';
  if (!root.document) return;
  let on = false; try { on = /[?&]masters\b/.test(root.location?.search || '') || root.localStorage?.getItem('ns-o3-master') === '1'; } catch { /* off */ }
  const img = (n) => root.NightshiftArt?.image?.('o3-master/' + n) || null;
  const crisp = (ctx, im, x, y, w, h) => { const p = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, x, y, w, h); ctx.imageSmoothingEnabled = p; };
  const K = 3; // art px per world px
  const FILES = ['master_player_streetwear.png', 'master_vanta_gt_top.png', 'master_husky.png'], st = { player: 0, car: 0, husky: 0, last: null };
  const warm = () => { if (on) FILES.forEach(img); };
  warm(); const wt = setInterval(() => { warm(); if (FILES.every((f) => !on || img(f))) clearInterval(wt); }, 200); setTimeout(() => clearInterval(wt), 20000);

  // player: 144x192 cell, feet origin (72,177); the game's character anchor puts the feet at (x, y + 14)
  function player(ctx, x, y, dir, anim, hold) {
    if (on) st.last = { dir, anim, hold };
    if (!on || dir !== 2 || hold || anim !== 'idle') return false; const im = img('master_player_streetwear.png'); if (!im) return false;
    const fx = Math.round(x), fy = Math.round(y) + 14;
    ctx.save(); ctx.fillStyle = '#05080f55'; ctx.beginPath(); ctx.ellipse(fx + 1, fy + 0.5, 12, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    crisp(ctx, im, fx - 72 / K, fy - 177 / K, 144 / K, 192 / K); st.player++; return true;
  }

  // Vanta GT: replace the baked top-down sprite when it is the factory purple build
  const FACTORY = '#8a3fd6';
  function factoryStyle(st, spec) { const SD = root.NightshiftCarStyleData; if (!st || !SD) return true; try { return JSON.stringify(SD.cleanStyle(st)) === JSON.stringify(SD.cleanStyle(spec.o3)); } catch { return false; } }
  function car(id, color, st, spec) {
    if (!on || id !== 'vanta' || String(color).toLowerCase() !== FACTORY || !spec || !factoryStyle(st, spec)) return null;
    const im = img('master_vanta_gt_top.png'); if (!im) return null;
    const pad = 6, cv = document.createElement('canvas'); cv.width = (spec.len + pad * 2) * K; cv.height = (spec.wid + pad * 2) * K;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(im, Math.round((cv.width - im.naturalWidth) / 2), Math.round((cv.height - im.naturalHeight) / 2));
    st.car++; return { cv, w: spec.len + pad * 2, h: spec.wid + pad * 2, L: spec.len, W: spec.wid, image: true, master: true };
  }
  const key = (id) => (id === 'vanta' ? '|m' + (on ? 1 : 0) + (on && img('master_vanta_gt_top.png') ? 1 : 0) : '');

  // husky: wrap the Option 3 pet draw (standing, facing right-ish only)
  const P0 = root.NightshiftO3Pet;
  if (P0 && typeof P0.draw === 'function' && !P0.__masters) {
    const d0 = P0.draw;
    P0.draw = function (ctx, id, p, t, opts = {}) {
      if (on && id === 'husky' && p && Number.isFinite(p.x) && !p.moving && !opts.sitting && [0, 1, 7].includes(P0.dirOf(p.angle))) {
        const im = img('master_husky.png');
        if (im) { ctx.save(); ctx.fillStyle = '#05080f44'; ctx.beginPath(); ctx.ellipse(Math.round(p.x) + 1, Math.round(p.y) + 1, 13, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); crisp(ctx, im, Math.round(p.x) - 60 / K, Math.round(p.y) - 88 / K, 120 / K, 96 / K); st.husky++; return true; }
      }
      return d0.apply(this, arguments);
    };
    P0.__masters = true;
  }

  root.NightshiftO3Masters = Object.freeze({ get enabled() { return on; }, setEnabled(v) { on = !!v; try { root.localStorage?.setItem('ns-o3-master', on ? '1' : '0'); } catch { /* n/a */ } warm(); return on; }, player, car, key, stats: () => ({ ...st }) });
})(typeof window !== 'undefined' ? window : globalThis);
