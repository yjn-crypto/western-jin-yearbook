#!/usr/bin/env python3
"""Retain the reviewed province masks; extend only beyond their old footprint.

Administrative province borders never come from county-cell unions.  A dated
province division transfers an entire old prefectural compartment.  Interior
province lines are true shared borders; a polity coast or enclave is not a
province boundary and is drawn by the political layer instead.
"""
from __future__ import annotations

import collections
import json
import math
from pathlib import Path

from shapely import set_precision, voronoi_polygons
from shapely.geometry import MultiPoint, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
_CACHE = {}
GRID = .000001
DOMAIN = box(82, 8, 136, 51)


def model(year, rows, entities, snapshot, annual, reference, _apply_transfers=True, original_only=False):
    refyear = snapshot['refs'][0]['refyear']
    names = {annual.key(v['entity']['name']): sid for sid, v in entities['state'].items()}
    original = json.loads((ROOT / f'data/jin-maps/{refyear}_map.geojson').read_text())
    province_features = [f for f in original['features'] if f['properties'].get('layer') == 'province_areas']
    sid_for = lambda p: p.get('entity_id') or names.get(annual.key(p.get('name')))
    sid_remap = {sid_for(f['properties']): reference.historical_state(sid_for(f['properties']), year, entities)
                 for f in province_features}
    # Dated parent changes may shift a reviewed border only along a complete
    # source prefecture, never along the annual county grid.
    transfers = []
    for ref in snapshot['refs'] if _apply_transfers else []:
        if ref['pid'] not in rows['prefecture']:
            continue
        to_sid = rows['prefecture'][ref['pid']]['state_id']
        old_sid = reference.historical_state(ref['sid'], year, entities)
        if old_sid and to_sid != old_sid:
            transfers.append((ref['id'], old_sid, to_sid))
    key = (refyear, tuple(sorted(sid_remap.items(), key=lambda x: str(x[0]))), tuple(transfers), original_only)
    if key in _CACHE:
        return _CACHE[key]
    if transfers:
        # Build all old province extensions first. A new dated division cannot
        # re-sample every province coast and move unrelated outer boundaries.
        baseline = model(year, rows, entities, snapshot, annual, reference, _apply_transfers=False,
                         original_only=original_only)
        result = dict(baseline['masks'])
        groups = collections.defaultdict(list)
        ref_by_id = {ref['id']: ref for ref in snapshot['refs']}
        for rid, old_sid, to_sid in transfers:
            groups[(old_sid, to_sid)].append(ref_by_id[rid]['geometry'])
        for (old_sid, to_sid), geometries in groups.items():
            mother = result.get(old_sid, Polygon())
            compartment = annual.polygonal(unary_union(geometries))
            # Precision seams between the complete source prefectures must not
            # leave thin mother-state circles inside a newly divided province.
            # This two-grid repair is sub-metre and is confined to the mother.
            compartment = set_precision(compartment.buffer(2*GRID).buffer(-2*GRID), GRID, mode='valid_output')
            pieces = [compartment] if compartment.geom_type == 'Polygon' else list(compartment.geoms)
            compartment = unary_union([Polygon(g.exterior, [ring for ring in g.interiors
                                       if Polygon(ring).area > .00002]) for g in pieces])
            transferred = set_precision(annual.polygonal(compartment.intersection(mother)), GRID, mode='valid_output')
            result[old_sid] = set_precision(annual.polygonal(mother.difference(transferred)), GRID, mode='valid_output')
            result[to_sid] = set_precision(annual.polygonal(unary_union([result.get(to_sid, Polygon()), transferred])), GRID, mode='valid_output')
        reviewed = annual.polygonal(unary_union(list(baseline['reviewed_masks'].values())))
        _CACHE[key] = dict(baseline, masks=result,
                           reviewed_masks={sid: annual.polygonal(g.intersection(reviewed)) for sid, g in result.items()},
                           whole_prefecture_transfers=transfers)
        print(f'{year}: dated complete prefectures transferred within fixed mother provinces', flush=True)
        return _CACHE[key]
    print(f'{year}: preparing reviewed {refyear} province masks (whole-prefecture changes only)', flush=True)
    parts, properties = collections.defaultdict(list), {}
    for f in province_features:
        p = f['properties']
        sid = sid_remap[sid_for(p)]
        if not sid:
            continue
        g = annual.polygonal(shape(f['geometry']))
        g = set_precision(g, GRID, mode='valid_output')
        parts[sid].append(g)
        properties.setdefault(sid, dict(p))
    base = {sid: annual.polygonal(unary_union(gs)) for sid, gs in parts.items()}
    # Mixed CHGIS/image seams contain minute overlaps.  Resolve them once in
    # deterministic province order, retaining the reviewed geometry elsewhere.
    occupied = Polygon()
    overlap_removed = 0
    for sid in sorted(base):
        g = base[sid]
        unique = annual.polygonal(g.difference(occupied))
        overlap_removed += max(0, g.area-unique.area)
        base[sid] = unique
        occupied = annual.polygonal(unary_union([occupied, unique]))
    if original_only:
        # The user-uploaded footprint is the display space. Low-resolution
        # video shores do not create additional province territory outside it.
        reviewed = dict(base)
        parts = [occupied] if occupied.geom_type == 'Polygon' else list(occupied.geoms)
        seam_holes = [Polygon(ring) for part in parts for ring in part.interiors
                      if Polygon(ring).area < .001]
        for hole in seam_holes:
            sid = min(base, key=lambda sid: base[sid].distance(hole))
            base[sid] = set_precision(annual.polygonal(unary_union([base[sid],hole])), GRID, mode='valid_output')
        occupied = set_precision(annual.polygonal(unary_union(list(base.values()))), GRID, mode='valid_output')
        _CACHE[key] = dict(masks=base, reviewed_masks=reviewed, properties=properties,
                           domain=set_precision(occupied, GRID, mode='valid_output'),
                           reference_year=refyear, whole_prefecture_transfers=transfers,
                           source_overlap_removed=overlap_removed,
                           model='original_province_masks_whole_prefecture_changes_shared_borders',
                           footprint_source='reviewed_original_province_areas_union',
                           original_internal_seam_holes_filled=len(seam_holes),
                           original_internal_seam_hole_area=sum(g.area for g in seam_holes),
                           extensions_beyond_original=False)
        return _CACHE[key]
    missing = annual.polygonal(DOMAIN.difference(occupied))
    # A sparse sample of the existing coast/edge supplies smooth nearest-state
    # extensions outside the old map only.  These extensions cannot change any
    # province line within the reviewed administrative footprint.
    seeds, seen = [], set()
    for sid, g in sorted(base.items()):
        boundary = g.boundary
        count = max(2, min(400, math.ceil(boundary.length/.18)))
        for i in range(count):
            p = boundary.interpolate(i/count, normalized=True)
            sig = (round(p.x, 6), round(p.y, 6))
            if sig not in seen:
                seeds.append((sid, p))
                seen.add(sig)
    cells = voronoi_polygons(MultiPoint([p for _, p in seeds]), extend_to=DOMAIN.buffer(5), ordered=True)
    print(f'{year}: extending {len(base)} stable provinces from {len(seeds)} edge anchors outside the reviewed footprint', flush=True)
    additions = collections.defaultdict(list)
    for (sid, p), cell in zip(seeds, cells.geoms):
        g = annual.polygonal(cell.intersection(missing))
        if not g.is_empty:
            additions[sid].append(g)
    result = {sid: set_precision(annual.polygonal(unary_union([g, *additions[sid]])), GRID, mode='valid_output') for sid, g in base.items()}
    occupied = Polygon()
    for sid in sorted(result):
        result[sid] = set_precision(annual.polygonal(result[sid].difference(occupied)), GRID, mode='valid_output')
        occupied = set_precision(annual.polygonal(unary_union([occupied, result[sid]])), GRID, mode='valid_output')
    # Remaining floating-point seams are attached to one adjacent state and
    # cannot produce an administrative island of another state.
    residual = set_precision(annual.polygonal(DOMAIN.difference(occupied)), GRID, mode='valid_output')
    residual_parts = [residual] if residual.geom_type == 'Polygon' else list(residual.geoms)
    for g in residual_parts:
        if g.is_empty:
            continue
        sid = min(result, key=lambda sid: result[sid].distance(g))
        result[sid] = set_precision(annual.polygonal(unary_union([result[sid], g])), GRID, mode='valid_output')
    _CACHE[key] = dict(masks=result, reviewed_masks=base, properties=properties,
                       reference_year=refyear, whole_prefecture_transfers=transfers,
                       source_overlap_removed=overlap_removed,
                       model='reviewed_province_masks_whole_prefecture_changes_shared_borders')
    print(f'{year}: stable province model ready; reviewed interior unchanged', flush=True)
    return _CACHE[key]


def shared_borders(masks, clip):
    """Each pair appears once; no closed borders around political fragments."""
    result = []
    keys = sorted(masks)
    for i, sid in enumerate(keys):
        for other in keys[i+1:]:
            left, right = masks[sid], masks[other]
            if not left.intersects(right):
                continue
            line = left.boundary.intersection(right.boundary).intersection(clip)
            if line.is_empty or line.length < .0002:
                continue
            if line.geom_type == 'GeometryCollection':
                line = unary_union([g for g in line.geoms if g.geom_type in ('LineString', 'MultiLineString')])
            if line.geom_type in ('LineString', 'MultiLineString'):
                result.append((sid, other, line))
    return result
