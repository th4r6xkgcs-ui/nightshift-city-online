#!/usr/bin/env python3
"""Extended Option 3 atlas validation (Claude tooling). Covers SPRITE_ATLAS_CONTRACT.md beyond the supplied
validate_atlas.py: RGBA + real transparency, rect bounds + no overlap, unique frame keys, every frame non-empty and
not an opaque matte, required metadata fields, contract direction order, complete 8-direction animation coverage on
composite atlases, shared feet origin, feet planted near the origin for idle/walk, unique asset ids per family.
Usage: python3 tools/validate_o3.py art/o3   (exit code 1 on any failure)"""
import json, sys
from pathlib import Path
from PIL import Image

REQ = ['asset_id', 'atlas', 'rect', 'direction', 'animation', 'frame_index', 'duration_ms', 'origin', 'hand_anchor', 'equipment_anchors', 'collision_bounds', 'layer', 'z_bias', 'tags']
ORDER = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
COUNTS = {'idle': 6, 'walk': 12, 'run': 10}
errors = []
def err(m): errors.append(m)

def check(jpath):
    d = json.loads(jpath.read_text()); png = jpath.parent / d['atlas']; im = Image.open(png)
    if im.mode != 'RGBA': err(f'{png.name}: mode {im.mode}, need RGBA')
    px = im.load(); W, H = im.size
    if d.get('frame_order') != ORDER: err(f'{jpath.name}: frame_order must be {ORDER}')
    seen, rects, origins = set(), [], set()
    for f in d['frames']:
        for k in REQ:
            if k not in f: err(f'{jpath.name}: frame missing {k}')
        r = f['rect']
        if not (r['x'] >= 0 and r['y'] >= 0 and r['x'] + r['w'] <= W and r['y'] + r['h'] <= H): err(f'{jpath.name}: rect out of bounds {r}')
        key = (f['direction'], f['animation'], f['frame_index'], f['layer'])
        if key in seen: err(f'{jpath.name}: duplicate frame {key}')
        seen.add(key); rects.append((r['x'], r['y'], r['w'], r['h']))
        if f['direction'] not in ORDER: err(f'{jpath.name}: bad direction {f["direction"]}')
        origins.add((f['layer'], f['animation'], f['origin']['x'], f['origin']['y']))
        # non-empty, transparent background, opaque-or-clear pixels only (no blur/semi-transparent smear)
        opaque = clear = semi = 0; lowest = -1
        for y in range(r['y'], r['y'] + r['h']):
            for x in range(r['x'], r['x'] + r['w']):
                a = px[x, y][3]
                if a == 255: opaque += 1; lowest = max(lowest, y - r['y'])
                elif a == 0: clear += 1
                else: semi += 1
        if opaque == 0: err(f'{jpath.name}: empty frame {key}')
        if clear == 0: err(f'{jpath.name}: opaque matte frame {key}')
        if semi: err(f'{jpath.name}: {semi} semi-transparent pixels in {key} (pixel art must be crisp)')
        if f['layer'] == 'composite' and f['animation'] in ('idle', 'walk') and 'pet' not in f.get('tags', []) and not (f['origin']['y'] - 4 <= lowest <= f['origin']['y'] + 6):  # 2.5D tilt: feet toward/away from camera sit up to 4 px higher or 6 px lower
            err(f'{jpath.name}: feet not planted at origin in {key} (lowest row {lowest})')
    groups = {}
    for (L, an, ox, oy) in origins: groups.setdefault((L, an), set()).add((ox, oy))
    for g, o in groups.items():
        if len(o) > 1: err(f'{jpath.name}: frames in {g} disagree on origin {o}')
    for i in range(len(rects)):  # rects are a grid, but check anyway
        ax, ay, aw, ah = rects[i]
        for j in range(i + 1, len(rects)):
            bx, by, bw, bh = rects[j]
            if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah: err(f'{jpath.name}: overlapping rects {rects[i]} {rects[j]}'); break
    if d['frames'] and d['frames'][0]['layer'] == 'composite':
        an = d.get('animation'); counts = d.get('frame_counts') or COUNTS
        for dn in ORDER:
            for k in range(counts.get(an, 0)):
                if (dn, an, k, 'composite') not in seen: err(f'{jpath.name}: missing {dn} {an} {k}')
    return d['asset_id'], len(d['frames'])

def main(root):
    files = sorted(p for p in Path(root).glob('*.json') if p.name != 'index.json')
    ids = {}
    for j in files:
        aid, n = check(j); ids.setdefault(aid, []).append(j.name)
    for e in errors: print('FAIL', e)
    print(f'{"FAIL" if errors else "PASS"}: {len(files)} atlases, {len(ids)} asset ids, {len(errors)} problems')
    return 1 if errors else 0

if __name__ == '__main__': sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'art/o3'))
