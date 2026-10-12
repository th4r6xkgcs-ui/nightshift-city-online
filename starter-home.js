/* Starter apartment (Claude-owned). Loads BEFORE the game modules (build-online EARLY_SCRIPTS).
 * Every player owns the Midtown apartment from the start, because that is where the game begins
 * (life.js spawns you inside it). Writes the ownership flag into the activities save before
 * activities.js reads it; keeps the courier job progress untouched. */
(function (root) {
  'use strict';
  // Compatibility for older iPhones/Safari (pre iOS 15.4/16): tiny polyfills for APIs the game uses.
  try {
    for (const C of [Array, String, root.Int8Array, root.Uint8Array, root.Float32Array].filter(Boolean)) {
      if (!C.prototype.at) Object.defineProperty(C.prototype, 'at', { configurable: true, writable: true, value(i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return i < 0 || i >= this.length ? undefined : this[i]; } });
    }
    if (!Object.hasOwn) Object.defineProperty(Object, 'hasOwn', { configurable: true, writable: true, value: (o, k) => Object.prototype.hasOwnProperty.call(o, k) });
    if (!Array.prototype.findLast) Object.defineProperty(Array.prototype, 'findLast', { configurable: true, writable: true, value(fn, t) { for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return this[i]; return undefined; } });
    const P2 = root.CanvasRenderingContext2D?.prototype;
    if (P2 && !P2.roundRect) P2.roundRect = function (x, y, w, h, r) { r = Math.max(0, Math.min(Array.isArray(r) ? r[0] || 0 : Number(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2)); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this; };
    if (P2 && !P2.ellipse) P2.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { this.save(); this.translate(x, y); this.rotate(rot || 0); this.scale(rx || 1, ry || 1); this.arc(0, 0, 1, a0, a1, ccw); this.restore(); };
  } catch { /* best effort */ }
  const KEY = 'nightshift-city-activities-v1';
  try {
    const ls = root.localStorage; if (!ls) return;
    let d = {}; try { d = JSON.parse(ls.getItem(KEY) || '{}') || {}; } catch { d = {}; }
    if (d.owned !== true) { d.owned = true; ls.setItem(KEY, JSON.stringify(d)); }
    root.NightshiftStarterHome = Object.freeze({ owned: true });
  } catch { /* storage blocked: the HOME purchase flow still works */ }
})(typeof globalThis !== 'undefined' ? globalThis : this);
