/* Option 3 runtime (Claude-owned): puts o3-character.js art into the game, the studio and the weapon hold.
 *  - wants(outfit): Option 3 is on (default; localStorage ns-o3=0 turns it off) and every piece has Option 3 art.
 *  - draw(): the same frames the atlas exporter writes, drawn at 2 art px per world px; the feet stay where the
 *    old renderer put them (y + 14), so collisions, seats, cover and shadows don't move.
 *  - frame(): canvases for the Character Studio, tagged with their own cell geometry (taller than the old cell).
 *  - cache: up to 420 frames (~20 MB worst case), one build per animation frame (~7 ms), nearest cached frame
 *    meanwhile; the player's current outfit is pre-built in idle time (all 8 directions, idle/walk/run).
 *  - the held gun follows the Option 3 hands (NightshiftCharacters.holdHand override while you're drawn in O3).
 * API: NightshiftO3.{wants, draw, frame, enabled, setEnabled, stats, CELL} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const E = root.NightshiftO3Engine, C3 = root.NightshiftO3Character; if (!E || !C3) return;
  const CELL = { w: 48, h: 64, ax: 24, ay: 45 }; // world px; feet at (24, 59) = anchor + 14
  let enabled = true; try { enabled = localStorage.getItem('ns-o3') !== '0'; } catch { /* default on */ }
  const cache = new Map(), st = { built: 0, hits: 0, misses: 0, fallbacks: 0, prewarmed: 0, ms: 0 };
  let budgetFrame = -1, budgetLeft = 1;
  const keyOf = (o) => (root.NightshiftWardrobeData?.keyOf ? root.NightshiftWardrobeData.keyOf(o) : JSON.stringify(o));
  const wants = (o) => enabled && !!o && C3.supports(o);
  function build(o, dir, anim, f, hold) {
    const t0 = performance.now(), r = C3.render(o, dir, anim, f, hold), cv = document.createElement('canvas'); cv.width = E.FW; cv.height = E.FH;
    const x = cv.getContext('2d'), img = x.createImageData(E.FW, E.FH); img.data.set(E.toRGBA(r.composite)); x.putImageData(img, 0, 0);
    cv.anchors = r.anchors; cv.cell = CELL; cv.o3 = true; st.built++; st.ms = st.ms * 0.9 + (performance.now() - t0) * 0.1; return cv;
  }
  function get(o, dir, anim, f, hold = '', force = false) {
    const n = C3.ANIMS[anim] || 1, k = ((f % n) + n) % n, base = keyOf(o) + '|' + dir + anim + '|' + (hold || ''), key = base + k; let cv = cache.get(key);
    if (cv) { st.hits++; cache.delete(key); cache.set(key, cv); return cv; }
    const now = performance.now() | 0; if (now !== budgetFrame) { budgetFrame = now; budgetLeft = 1; }
    if (force || budgetLeft > 0) { budgetLeft--; cv = build(o, dir, anim, k, hold); cache.set(key, cv); if (cache.size > 420) cache.delete(cache.keys().next().value); return cv; }
    st.misses++; for (let d = 1; d < n; d++) { const alt = cache.get(base + ((k + n - d) % n)); if (alt) return alt; }
    return null;
  }
  // a fresh animation frame resets the build budget (performance.now() changes every rAF)
  (function tick() { budgetFrame = -1; requestAnimationFrame(tick); })();

  let playerO3 = false, lastPlayer = null;
  function draw(ctx, o, x, y, dir, anim, f, hold = '', isPlayer = false) {
    if (isPlayer && root.NightshiftO3Masters?.player?.(ctx, x, y, dir, anim, hold)) { playerO3 = false; return true; } // master review pose (off by default)
    const cv = get(o, dir, anim, f, hold); if (!cv) { st.fallbacks++; return false; }
    if (isPlayer) { playerO3 = true; lastPlayer = { o, dir, anim, f, hold, cv }; }
    const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05080f55'; ctx.beginPath(); ctx.ellipse(Math.round(x) + 1, Math.round(y) + 14.2, 10, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(cv, Math.round(x) - CELL.ax, Math.round(y) - CELL.ay, CELL.w, CELL.h); ctx.imageSmoothingEnabled = prev; return true;
  }
  function frame(o, dir, anim, f, scale = 2, hold = '') { return get(o, dir, anim, f, hold, true); }

  // gun hand: convert the Option 3 right-hand anchor (art px, origin feet) to the world offsets weapon-art expects
  function install() {
    const C = root.NightshiftCharacters; if (!C || C.__o3) return !!C?.__o3;
    const hh0 = C.holdHand;
    C.holdHand = function (d, hold, low) {
      const p = lastPlayer; if (!playerO3 || !p || !wants(p.o)) return hh0.apply(this, arguments);
      const cv = get(p.o, d, low === 'crouch' ? 'crouch' : 'idle', 0, hold || 'short'); const a = cv?.anchors; if (!a) return hh0.apply(this, arguments);
      const back = d === 5 || d === 6 || d === 7; return { x: (a.hand_r[0] - E.OX) / 2, y: (a.hand_r[1] - E.OY) / 2 + 14, back };
    };
    C.__o3 = true; return true;
  }
  if (!install()) { const t = setInterval(() => { if (install()) clearInterval(t); }, 100); setTimeout(() => clearInterval(t), 15000); }

  // prewarm the player's look in idle time
  const idle = root.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 60));
  let warmQ = [], warmKey = '';
  function warm(deadline) {
    try {
      const o = root.NightshiftWardrobe?.outfit?.() || root.NightshiftWardrobe?.state?.outfit;
      if (o && wants(o)) { const k = keyOf(o); if (k !== warmKey) { warmKey = k; warmQ = []; for (const a of ['idle', 'walk', 'run']) for (let d = 0; d < 8; d++) for (let f = 0; f < C3.ANIMS[a]; f++) warmQ.push([d, a, f]); } }
      while (warmQ.length && deadline.timeRemaining() > 8) { const [d, a, f] = warmQ.shift(), key = keyOf(o) + '|' + d + a + '|' + f; if (!cache.has(key)) { cache.set(key, build(o, d, a, f, '')); st.prewarmed++; } }
    } catch (e) { console.error(e); }
    idle(warm);
  }
  idle(warm);

  root.NightshiftO3 = Object.freeze({
    wants, draw, frame, CELL,
    get enabled() { return enabled; }, setEnabled(v) { enabled = !!v; try { localStorage.setItem('ns-o3', enabled ? '1' : '0'); } catch { /* n/a */ } cache.clear(); return enabled; },
    stats: () => ({ ...st, cached: cache.size, ms: Math.round(st.ms * 10) / 10 }), clear: () => cache.clear(),
  });
})(typeof window !== 'undefined' ? window : globalThis);
