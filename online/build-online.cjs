'use strict';
// Generates the online version of the game page from the game's own
// index.html (owned by Codex) without editing it: same markup and scripts,
// plus the shared network libraries and online/online.js after boot.js.
//   node online/build-online.cjs [outDir]   -> writes outDir/online.html
// Also exported for the Cloudflare build (worker/build.cjs).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ONLINE_SCRIPTS = ['shared/rules.js', 'shared/protocol.js', 'shared/city.js', 'shared/movement.js', 'shared/net-client.js', 'online.js'];

// Same safety rules as the game's own build: only local root .js/.css assets.
function gameAssets(html) {
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]);
  if (!scripts.length) throw new Error('No game scripts found in index.html');
  for (const n of scripts) if (!/^[a-z0-9-]+\.js$/i.test(n)) throw new Error('Unexpected game script: ' + n);
  for (const n of styles) if (!/^[a-z0-9-]+\.css$/i.test(n)) throw new Error('Unexpected stylesheet: ' + n);
  return { scripts, styles };
}

function onlineHtml(indexHtml) {
  if (!/<\/body>/i.test(indexHtml)) throw new Error('index.html has no </body>');
  const tags = ONLINE_SCRIPTS.map((s) => `<script src="${s}" defer></script>`).join('');
  return indexHtml
    .replace(/<title>([^<]*)<\/title>/i, (m, t) => `<title>${t.replace(/\s*[—-]\s*Prototype$/i, '')} — Online</title>`)
    .replace(/<\/body>/i, `${tags}</body>`);
}

// Claude's RPG layer (skills + goals). Injected before boot.js at build time so
// Codex's index.html stays untouched; skipped for any script it already lists.
const RPG_SCRIPTS = ['art-manifest.js', 'art-assets.js', 'skills-data.js', 'skills.js', 'weapons-data.js', 'weapons.js', 'skill-effects.js', 'casino-data.js', 'casino.js', 'tuning-data.js', 'tuning.js', 'races-data.js', 'races.js', 'home-data.js', 'home-upgrades.js', 'fishing-data.js', 'fishing.js', 'lab-data.js', 'lab.js', 'jobs-data.js', 'jobs.js', 'heists-data.js', 'heists.js', 'venues-data.js', 'venues.js', 'empire-data.js', 'empire.js', 'events-data.js', 'events.js', 'stashes-data.js', 'stashes.js', 'market-data.js', 'market.js', 'life-data.js', 'life.js', 'supply-data.js', 'supply-art.js', 'supply.js', 'zones.js', 'food-data.js', 'food.js', 'farm.js', 'picks-data.js', 'picks.js', 'breakin-data.js', 'breakin.js', 'safehouse-data.js', 'safehouse.js', 'hitman-data.js', 'hitman.js', 'cars-data.js', 'car-hd.js', 'cars.js', 'carmeet-data.js', 'carmeet.js', 'pets-data.js', 'o3-pet.js', 'pets.js', 'suburbs.js', 'chop-data.js', 'chop.js', 'decor-data.js', 'dreamhome.js', 'ledger.js', 'wardrobe-data.js', 'character-art.js', 'o3-engine.js', 'o3-character.js', 'character-pixel.js', 'o3-runtime.js', 'crowd.js', 'modern-city.js', 'city-art.js', 'hd-art.js', 'wanted-data.js', 'combat-vision.js', 'gangs-data.js', 'gangs.js', 'police-cars.js', 'npc-life.js', 'npc-mind-data.js', 'npc-mind.js', 'combat-core.js', 'authority.js', 'police-engage.js', 'melee-data.js', 'melee.js', 'driving-data.js', 'drive-input.js', 'driving.js', 'highway-data.js', 'highway.js', 'highway-style.js', 'highway-side.js', 'property-data.js', 'property.js', 'story-data.js', 'story.js', 'interiors.js', 'studio.js', 'weapon-kit-data.js', 'weapon-kit.js', 'weapon-hd.js', 'weapon-art.js', 'carstyle-data.js', 'car-views.js', 'carstyle.js', 'pet-art.js', 'fx.js', 'combat-fx.js', 'ui-skin.js', 'minimap.js', 'hud.js', 'guide.js', 'ambience.js', 'goals-data.js', 'goals.js', 'wayfinding.js', 'phone.js', 'dailies-data.js', 'dailies.js', 'respect-data.js', 'respect.js'];
// Claude scripts that must run before Codex's modules read their saves (inserted before the first script tag).
const EARLY_SCRIPTS = ['starter-home.js'];
const LATE_SCRIPTS = ['o3-props.js', 'prop-art.js'];
function withRpg(html) {
  const early = EARLY_SCRIPTS.filter((s) => fs.existsSync(path.join(ROOT, s)) && !html.includes(`src="${s}"`));
  if (early.length && /<script\s+src="/.test(html)) html = html.replace(/<script\s+src="/, (m) => early.map((s) => `<script src="${s}" defer></script>`).join('') + m);
  const missing = RPG_SCRIPTS.filter((s) => fs.existsSync(path.join(ROOT, s)) && !html.includes(`src="${s}"`));
  if (!/<script\s+src="boot\.js"/.test(html)) return html;
  const tags = missing.map((s) => `<script src="${s}" defer></script>`).join('');
  const art = /<script\s+src="detailed-art\.js"[^>]*><\/script>/;
  // Claude's premium art layers load before Codex's detailed-art.js so its held-weapon pass draws on top
  if (missing.length) html = art.test(html) ? html.replace(/<script\s+src="detailed-art\.js"/, (m) => tags + m) : html.replace(/<script\s+src="boot\.js"/, (m) => tags + m);
  // ...and these run right after it, replacing parts of its api before the first frame
  const late = LATE_SCRIPTS.filter((s) => fs.existsSync(path.join(ROOT, s)) && !html.includes(`src="${s}"`));
  if (late.length) { const t = late.map((s) => `<script src="${s}" defer></script>`).join(''); html = art.test(html) ? html.replace(art, (m) => m + t) : html.replace(/<script\s+src="boot\.js"/, (m) => t + m); }
  return html;
}

function readGame() {
  const file = path.join(ROOT, 'index.html');
  if (!fs.existsSync(file)) return null;
  const html = withRpg(fs.readFileSync(file, 'utf8'));
  // Only the modular game (separate script files) can be extended this way.
  if (!/<canvas id="game"/.test(html) || !/<script\s+src="/.test(html)) return null;
  return { html, ...gameAssets(html) };
}

module.exports = { gameAssets, onlineHtml, readGame, withRpg, ONLINE_SCRIPTS, RPG_SCRIPTS, EARLY_SCRIPTS, LATE_SCRIPTS, ROOT };

if (require.main === module) {
  const game = readGame();
  if (!game) { console.error('No full game index.html at repo root'); process.exit(1); }
  const out = process.argv[2] || path.join(ROOT, 'online', 'dist');
  fs.mkdirSync(path.join(out, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(out, 'online.html'), onlineHtml(game.html));
  for (const f of [...game.scripts, ...game.styles]) fs.copyFileSync(path.join(ROOT, f), path.join(out, f));
  fs.writeFileSync(path.join(out, 'index.html'), game.html);
  for (const s of ONLINE_SCRIPTS) {
    const src = s === 'online.js' ? path.join(__dirname, 'online.js') : path.join(ROOT, s);
    fs.copyFileSync(src, path.join(out, s));
  }
  // v0.67 (Claude): image assets (art/**) ship with the build
  const copyDir = (from, to) => { if (!fs.existsSync(from)) return 0; let n = 0; fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { if (e.isDirectory()) n += copyDir(path.join(from, e.name), path.join(to, e.name)); else if (/\.(png|jpe?g|webp)$/i.test(e.name)) { fs.copyFileSync(path.join(from, e.name), path.join(to, e.name)); n++; } } return n; };
  const arts = copyDir(path.join(ROOT, 'art'), path.join(out, 'art'));
  { const list = []; const walk = (d, rel) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/'); else if (/\.(png|jpe?g|webp)$/i.test(e.name)) list.push(rel + e.name); } }; walk(path.join(ROOT, 'art'), ''); list.sort();
    fs.writeFileSync(path.join(out, 'art-manifest.js'), '/* Generated by the build (online/build-online.cjs) from art/. */\nglobalThis.NightshiftArtManifest = ' + JSON.stringify(list) + ';\n'); }
  if (arts) console.log(`online build: ${arts} art files`);
  console.log(`online build: ${game.scripts.length} game scripts, ${game.styles.length} styles -> ${out}`);
}
