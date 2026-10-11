# Codex client coordination — city data and traffic v0.19

Work branch: codex/city-traffic-v19, based on codex/mobile-quality-v18. This is a stacked client delta; integrate v0.18 first. Existing branches and PRs remain unmerged. Shared project docs are unchanged during concurrent work.

Claude coordination: reviewed claude/server-scaffold commit aec8ac825dab21a106c28fc9d4ed1289dfdbf16f and SERVER_HANDOFF.md. No server/, shared/, server workflow or SERVER_HANDOFF.md changes. The client now exposes city-data.js as a CommonJS module as requested by the server handoff. Claude owns enforcement and protocol integration; no multiplayer connection/deployment is claimed here.

## Catalog contract
Node: const {layout}=require('../city-data.js'); Browser: NightshiftCityData.layout(). Run node scripts/export-city.cjs for clean JSON (npm run export:city includes npm console headers). Layout v1 includes world size, player margin, building padding, fresh spawn, clinic coordinates/radius, apartment coordinates/radius and stable building-N IDs with x/y/w/h/name/entrance.
Client world.js now delegates its building generation to this same module, eliminating a copied server map. The catalog does not implement server collision, interiors, transactions or online safe-zone rules. Geometry is fixed client data; server must validate movement and proximity. Spawn and clinic recovery coordinates deliberately differ. Layout snapshots are fresh objects.

## Traffic
Added short-range forward braking, bounded acceleration and obstacle snapshots for pedestrians, parked/driven cars and traffic. Cars stop for the player on foot and resume when clear. Signals keep a hard stop boundary. Oriented rectangle overlap checks allow separate opposing lanes to pass, replacing broad circle rejection. Existing collision consequences remain when the player drives/walks into traffic. Authored loops remain; this is not full intersection right-of-way, dynamic route planning or avoidance of arbitrary moving obstacles.

## Touched and tested
city-data.js, world.js, traffic-safety.js, traffic.js, scripts/export-city.cjs; narrow version/script wiring in game.js/index.html/package.json; tests/city-data.cjs, tests/traffic-safety.cjs, tests/home.cjs, tests/smoke.cjs, tests/run.cjs; this handoff.
npm run check PASS: 38 suites + root syntax checks. Catalog tested against live client geometry, clear entrances/spawn, padding, stable IDs and fresh snapshots. Traffic tests cover front/rear/parallel-lane clearance, oriented overlap, pedestrian braking/restart and red signal stopping. Existing movement, crafting, inventory, death/persistence regressions pass. git diff --check PASS. No real browser/iPhone QA; hosting publication pending.
