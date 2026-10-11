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
const RPG_SCRIPTS = ['skills-data.js', 'skills.js', 'weapons-data.js', 'weapons.js', 'skill-effects.js', 'casino-data.js', 'casino.js', 'tuning-data.js', 'tuning.js', 'races-data.js', 'races.js', 'home-data.js', 'home-upgrades.js', 'fishing-data.js', 'fishing.js', 'lab-data.js', 'lab.js', 'jobs-data.js', 'jobs.js', 'goals-data.js', 'goals.js', 'dailies-data.js', 'dailies.js', 'respect-data.js', 'respect.js'];
function withRpg(html) {
  const missing = RPG_SCRIPTS.filter((s) => fs.existsSync(path.join(ROOT, s)) && !html.includes(`src="${s}"`));
  if (!missing.length || !/<script\s+src="boot\.js"/.test(html)) return html;
  const tags = missing.map((s) => `<script src="${s}" defer></script>`).join('');
  return html.replace(/<script\s+src="boot\.js"/, (m) => tags + m);
}

function readGame() {
  const file = path.join(ROOT, 'index.html');
  if (!fs.existsSync(file)) return null;
  const html = withRpg(fs.readFileSync(file, 'utf8'));
  // Only the modular game (separate script files) can be extended this way.
  if (!/<canvas id="game"/.test(html) || !/<script\s+src="/.test(html)) return null;
  return { html, ...gameAssets(html) };
}

module.exports = { gameAssets, onlineHtml, readGame, withRpg, ONLINE_SCRIPTS, RPG_SCRIPTS, ROOT };

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
  console.log(`online build: ${game.scripts.length} game scripts, ${game.styles.length} styles -> ${out}`);
}
