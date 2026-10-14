// v0.71 (Claude): combat feel tuning (presentation only) — every weapon class has a sound + kick, shotgun hits
// hardest, enemy fire fades and dulls with distance, nothing in it touches damage.
const assert = require('node:assert/strict');
const F = require('../combat-feel.js');
const W = require('../weapons-data.js');
const classes = new Set((W.WEAPONS || []).map((w) => w.cls).filter((c) => c && c !== 'none'));
for (const c of classes) assert.ok(F.TUNE[c], 'tuned: ' + c);
for (const [c, t] of Object.entries(F.TUNE)) { assert.ok(t.kick > 0 && t.kick <= 8, c + ' kick'); assert.ok(t.dur > 0.05 && t.dur < 0.6, c + ' sound length'); assert.ok(t.vol > 0 && t.vol <= 0.8, c + ' volume'); }
assert.ok(F.TUNE.shotgun.kick > F.TUNE.rifle.kick && F.TUNE.rifle.kick > F.TUNE.smg.kick, 'shotgun > rifle > smg recoil');
const near = F.distant(100), mid = F.distant(600), far = F.distant(1300);
assert.ok(near.gain > mid.gain && mid.gain > far.gain && far.gain === 0, 'quieter with distance, silent past ~1100 px');
assert.ok(near.cutoff > mid.cutoff, 'duller with distance');
const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'combat-feel.js'), 'utf8');
assert.ok(!/\.hp\s*-=|\.hp\s*=\s*[^=]/.test(src.replace(/p\.hp > 0 && p\.hp < 35/g, '')), 'presentation only: never writes hp');
console.log('PASS: v0.71 combat feel (' + [...classes].join(', ') + ' tuned; distance falloff; presentation only)');
