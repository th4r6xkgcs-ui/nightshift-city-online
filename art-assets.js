/* Image art pipeline (Claude-owned, v0.67). Lets real image files replace the code-drawn art piece by piece.
 * Drop PNGs into art/ (see ART_SPEC.md "Image assets"), rebuild, and the game uses them automatically:
 *   art/top/cars/<carId>.png           city cars, top-down, nose pointing RIGHT (+x)       -> cars.js
 *   art/top/buildings/<archetype>-<n>.png  roofs + front facade, fits the building footprint -> modern-city.js
 *   art/side/weapons/<gunId>.png       side view, muzzle RIGHT                            -> weapon-art.js
 *   art/garage/...                     Route 9 side view (already in use)                 -> highway-side.js
 * The build writes art-manifest.js (NightshiftArtManifest = [...paths]) so nothing is requested that doesn't exist.
 * Anything without an image keeps its code-drawn art. API: NightshiftArt.{has, image, version, variants, tinted} */
(function (root) {
  'use strict';
  if (!root.document) return;
  const LIST = new Set(root.NightshiftArtManifest || []);
  const cache = new Map(); let version = 0;
  const has = (p) => LIST.has(p);
  function image(p) {
    if (!LIST.has(p)) return null; let im = cache.get(p);
    if (!im) { im = new Image(); im.decoding = 'async'; im.onload = () => { version++; }; im.src = 'art/' + p; cache.set(p, im); }
    return im.complete && im.naturalWidth ? im : null;
  }
  const variants = (prefix) => [...LIST].filter((p) => p.startsWith(prefix)).sort();
  // hue tint that keeps glass, tyres and chrome neutral (same trick as the highway)
  const tintCache = new Map();
  function tinted(im, color, key) {
    if (!im || !color) return im; const k = key + color; let cv = tintCache.get(k); if (cv) return cv;
    if (tintCache.size > 80) tintCache.delete(tintCache.keys().next().value);
    cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const c = cv.getContext('2d');
    c.drawImage(im, 0, 0); c.globalCompositeOperation = 'hue'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'destination-in'; c.drawImage(im, 0, 0);
    tintCache.set(k, cv); return cv;
  }
  // warm everything up front so first draws hit the cache
  for (const p of LIST) if (/^(top|side)\//.test(p)) image(p);
  root.NightshiftArt = Object.freeze({ has, image, variants, tinted, get version() { return version; }, list: () => [...LIST] });
})(typeof globalThis !== 'undefined' ? globalThis : this);
