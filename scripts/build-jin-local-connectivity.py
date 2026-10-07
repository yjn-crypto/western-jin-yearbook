#!/usr/bin/env python3
"""Repair only the three user-reviewed nearby fragments in saved Jin maps.

Run with the bundled Python and PYTHONPATH=work/_gis_deps. This publishes a
small geometry overlay; original annual maps, county points and source atlases
are retained. The short passages are presentation inferences, not traced
historical boundaries.
"""
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

from shapely import normalize, set_precision
from shapely.geometry import LineString, mapping, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / 'data/jin-maps/three-basemap-annual'
GRID = .000001
NOTE = '本輪在各自適用年份作以下局部修正：新野南側無本郡縣治依據的細小擬合殘片歸襄陽；義陽朝陽縣向東連接本郡，淮陵兩部經下邳東南角短接。僅作局部連通展示推定，郡界以間斷曲線表示；縣屬、治所及已有有據飛地不變。'


def clean(g):
    return normalize(set_precision(g, GRID))


def polygons(g):
    return sorted(list(g.geoms) if g.geom_type == 'MultiPolygon' else [g], key=lambda p: -p.area)


def lines(g):
    if g.geom_type in ('LineString', 'MultiLineString'):
        return g
    return unary_union([lines(p) for p in getattr(g, 'geoms', []) if p.geom_type in ('LineString', 'MultiLineString', 'GeometryCollection')])


def passage(recipient, donor, width):
    """A short, gently bowed passage within the two existing commanderies."""
    main, island = polygons(recipient)
    a, b = nearest_points(island, main)
    dx, dy = b.x - a.x, b.y - a.y
    distance = a.distance(b)
    coordinates = []
    for i in range(33):
        t = i / 32
        bend = .006 * math.sin(math.pi * t) ** 2
        coordinates.append((a.x + dx * t - dy / distance * bend,
                            a.y + dy * t + dx / distance * bend))
    corridor = LineString(coordinates).buffer(width, quad_segs=16)
    transfer = clean(corridor.intersection(donor))
    return clean(unary_union([recipient, transfer])), clean(donor.difference(transfer)), transfer


def build():
    source_geometries, loaded = {}, set()
    output = {'version': 1, 'reviewed_at': '2026-10-07', 'scope': 'western_jin',
              'policy': NOTE, 'geometries': {}, 'years': {}}
    audit = []

    def save(g):
        geo = mapping(normalize(g))
        raw = json.dumps(geo, separators=(',', ':'), ensure_ascii=False)
        gid = 'local-' + hashlib.sha256(raw.encode()).hexdigest()[:16]
        output['geometries'][gid] = geo
        return gid

    for year in range(266, 317):
        data = json.loads((MAPS / f'{year}.json').read_text())
        source_geometries.update(data['geometries'])
        for url in data['geometry_urls']:
            if url not in loaded:
                source_geometries.update(json.loads(gzip.decompress((ROOT / url).read_bytes()))['geometries'])
                loaded.add(url)
        areas = {f['properties']['entity_id']: f for f in data['features'] if f['properties']['layer'] == 'prefecture_areas'}
        original = {pid: shape(source_geometries[f['geometry_id']]) for pid, f in areas.items()}
        updated = dict(original)
        changes = []
        if 'p166' in original and original['p166'].geom_type == 'MultiPolygon':
            main, *fragments = polygons(original['p166'])
            scraps = unary_union(fragments)
            updated['p166'] = main
            updated['p163'] = clean(unary_union([original['p163'], scraps]))
            changes.append({'type': 'xinye_fit_slivers_to_xiangyang', 'from': 'p166', 'to': 'p163', 'area_degrees2': scraps.area})
        if original['p165'].geom_type == 'MultiPolygon':
            updated['p165'], updated['p166'], transfer = passage(updated['p165'], updated['p166'], .023)
            changes.append({'type': 'chaoyang_to_yiyang_short_passage', 'from': 'p166', 'to': 'p165', 'area_degrees2': transfer.area})
        if 'p158' in original and original['p158'].geom_type == 'MultiPolygon':
            updated['p158'], updated['p150'], transfer = passage(updated['p158'], updated['p150'], .027)
            # The passage cuts off Xiapi's empty southeast tip; include that
            # small corner in Huailing instead of leaving a new Xiapi island.
            xiapi_main, *xiapi_corner = polygons(updated['p150'])
            updated['p150'] = xiapi_main
            updated['p158'] = clean(unary_union([updated['p158'], *xiapi_corner]))
            transfer = clean(unary_union([transfer, *xiapi_corner]))
            changes.append({'type': 'huailing_across_xiapi_southeast_corner', 'from': 'p150', 'to': 'p158', 'area_degrees2': transfer.area})
        if not changes:
            continue

        changed = {change[key] for change in changes for key in ('from', 'to')}
        patch = {'replace': {}, 'remove': [], 'add': [], 'note': NOTE}
        for pid in sorted(changed):
            assert updated[pid].is_valid and updated[pid].geom_type == 'Polygon', (year, pid, updated[pid].geom_type)
            patch['replace'][areas[pid]['geometry_id']] = save(updated[pid])
        old_union = unary_union([original[pid] for pid in changed])
        new_union = unary_union([updated[pid] for pid in changed])
        edited_mask = unary_union([original[pid].symmetric_difference(updated[pid]) for pid in changed]).buffer(GRID * 3)
        area_error = old_union.symmetric_difference(new_union).area
        overlap = sum(updated[pid].area for pid in changed) - new_union.area
        assert area_error < 1e-8 and abs(overlap) < 1e-8, (year, area_error, overlap)
        assert len({areas[pid]['properties']['state_id'] for pid in ('p163', 'p165')}) == 1
        if 'p158' in changed:
            assert areas['p150']['properties']['state_id'] == areas['p158']['properties']['state_id']

        # Keep all original county coordinates and prevent any new reassignment
        # of points that were covered by their own commandery before the patch.
        affected_county_points = 0
        for feature in data['features']:
            p = feature['properties']
            if p['layer'] != 'county_seats' or p.get('prefecture_id') not in changed:
                continue
            pid = p['prefecture_id']
            point = shape(source_geometries[feature['geometry_id']])
            if original[pid].covers(point):
                assert updated[pid].covers(point), (year, pid, p['name'])
                affected_county_points += 1

        # Update the same fief colour geometry, including a larger multi郡 union.
        for feature in data['features']:
            p = feature['properties']
            if p['layer'] == 'kingdom_areas' and changed.intersection(p['member_entity_ids']):
                g = shape(source_geometries[feature['geometry_id']])
                for pid in sorted(changed.intersection(p['member_entity_ids'])):
                    g = g.difference(original[pid].difference(updated[pid]))
                    g = unary_union([g, updated[pid].difference(original[pid])])
                patch['replace'][feature['geometry_id']] = save(clean(g))
            if p['layer'] == 'labels' and p.get('level') == 'prefecture' and p.get('entity_id') in changed:
                point = shape(source_geometries[feature['geometry_id']])
                if not updated[p['entity_id']].covers(point):
                    patch['replace'][feature['geometry_id']] = save(updated[p['entity_id']].representative_point())

        # Replace only affected shared boundary pairs. Unchanged edge portions
        # retain their original source / inferred style; new portions are dashed.
        pairs = defaultdict(list)
        for feature in data['features']:
            p = feature['properties']
            ids = p.get('adjacent_entity_ids', [])
            if p['layer'] in ('prefecture_boundaries', 'province_boundaries') and len(ids) == 2 and changed.intersection(ids):
                pairs[tuple(sorted(ids))].append(feature)
        for left in sorted(changed):
            for right in updated:
                if left != right and updated[left].boundary.intersection(updated[right].boundary).length > .00001:
                    pairs.setdefault(tuple(sorted((left, right))), [])
        for (left, right), old_features in pairs.items():
            # Reference neighbours cannot be crossed by any of these three
            # explicitly selected interior patches, so retain their old lines.
            if left not in updated or right not in updated:
                continue
            if areas[left]['properties']['state_id'] != areas[right]['properties']['state_id']:
                continue
            shared = lines(updated[left].boundary.intersection(updated[right].boundary))
            if not shared.intersects(edited_mask) and not any(shape(source_geometries[f['geometry_id']]).intersects(edited_mask) for f in old_features):
                continue
            kept = []
            for feature in old_features:
                old_line = shape(source_geometries[feature['geometry_id']])
                retained = lines(unary_union([old_line.difference(edited_mask), old_line.intersection(shared).intersection(edited_mask)]))
                if retained.is_empty:
                    patch['remove'].append(feature['geometry_id'])
                elif not retained.equals(old_line):
                    patch['replace'][feature['geometry_id']] = save(retained)
                    kept.append(retained)
                else:
                    kept.append(old_line)
            fresh = lines(shared.intersection(edited_mask).difference(unary_union(kept)))
            if fresh.length > .00001:
                lp, rp = areas[left]['properties'], areas[right]['properties']
                same_state = lp['state_id'] == rp['state_id']
                lf, rf = lp.get('fief_id'), rp.get('fief_id')
                p = dict(layer='prefecture_boundaries' if same_state else 'province_boundaries',
                         level='prefecture' if same_state else 'state', year=year, name='郡国界' if same_state else '州界',
                         adjacent_entity_ids=[left, right], adjacent_state_ids=[lp['state_id'], rp['state_id']],
                         adjacent_fief_ids=[lf, rf], between_fiefs=lf != rf and bool(lf or rf),
                         within_same_fief=bool(lf and lf == rf), includes_retained_reference=False,
                         geometry_status='user_reviewed_local_connectivity_fit', source=NOTE,
                         coordinate_role='boundary')
                if same_state:
                    p.update(boundary_inferred=True, boundary_style='curved_interrupted',
                             boundary_evidence='僅為近距離擬合分片連通而調整的局部郡界，無精確史載界址。')
                else:
                    p.update(boundary_evidence='州界位置沿用；僅將原新野殘片所在段的相鄰郡更新為襄陽。')
                patch['add'].append({'geometry_id': save(fresh), 'properties': p})

        # Stable province lines are copied exactly, only splitting the old
        # Xinye/Xiangyang owner annotation where the reviewed slivers change.
        for feature in data['features']:
            p = feature['properties']
            if p['layer'] != 'province_boundaries' or 'p166' not in p.get('adjacent_entity_ids', []):
                continue
            line = shape(source_geometries[feature['geometry_id']])
            reassigned = lines(line.intersection(scraps.buffer(GRID * 2)))
            if reassigned.is_empty:
                continue
            retained = lines(line.difference(reassigned))
            if retained.is_empty:
                patch['remove'].append(feature['geometry_id'])
            else:
                patch['replace'][feature['geometry_id']] = save(retained)
            new_props = dict(p, adjacent_entity_ids=['p163' if pid == 'p166' else pid for pid in p['adjacent_entity_ids']],
                             boundary_evidence='州界位置沿用；僅將原新野殘片所在段的相鄰郡更新為襄陽。')
            fids = [areas[pid]['properties'].get('fief_id') for pid in new_props['adjacent_entity_ids']]
            new_props.update(adjacent_fief_ids=fids, between_fiefs=fids[0] != fids[1] and bool(fids[0] or fids[1]),
                             within_same_fief=bool(fids[0] and fids[0] == fids[1]))
            patch['add'].append({'geometry_id': save(reassigned), 'properties': new_props})

        # Patches never change coastlines, provinces, county layers or explicit
        # distant fief members (e.g. Runan's Yundu).
        for feature in data['features']:
            if feature['geometry_id'] in patch['replace'] or feature['geometry_id'] in patch['remove']:
                assert feature['properties']['layer'] in ('prefecture_areas', 'kingdom_areas', 'labels', 'prefecture_boundaries', 'province_boundaries'), (year, feature['properties'])
        original_province_lines = [shape(source_geometries[f['geometry_id']]) for f in data['features'] if f['properties']['layer'] == 'province_boundaries' and (f['geometry_id'] in patch['replace'] or f['geometry_id'] in patch['remove'])]
        new_province_lines = [shape(output['geometries'][patch['replace'][f['geometry_id']]]) if f['geometry_id'] in patch['replace'] else shape(source_geometries[f['geometry_id']])
                              for f in data['features'] if f['properties']['layer'] == 'province_boundaries' and f['geometry_id'] in patch['replace'] and f['geometry_id'] not in patch['remove']]
        new_province_lines.extend(shape(output['geometries'][f['geometry_id']]) for f in patch['add'] if f['properties']['layer'] == 'province_boundaries')
        province_line_difference = unary_union(original_province_lines).hausdorff_distance(unary_union(new_province_lines)) if original_province_lines else 0
        assert province_line_difference < GRID * 2, (year, province_line_difference)
        output['years'][str(year)] = patch
        audit.append({'year': year, 'changes': changes, 'connected_entities': sorted(changed),
                      'union_area_difference': area_error, 'overlap_area': overlap,
                      'county_points_preserved_in_own_area': affected_county_points,
                      'county_coordinates_changed': 0, 'province_or_coast_geometry_changed': False,
                      'province_boundary_max_shift_degrees': province_line_difference,
                      'geometry_replacements': len(patch['replace']), 'removed_lines': len(patch['remove']),
                      'new_boundary_features': len(patch['add'])})

    raw = json.dumps(output, ensure_ascii=False, separators=(',', ':'))
    (ROOT / 'data/jin-local-connectivity-20261007.js').write_text('window.JIN_LOCAL_CONNECTIVITY = ' + raw + ';\n')
    (ROOT / 'reports/jin-local-connectivity-check-20261007.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'years_patched': len(audit), 'unique_geometries': len(output['geometries']),
                      'data_bytes': len(raw.encode()), 'all_target_entities_connected': True,
                      'county_points_moved': 0, 'province_or_coast_geometry_changed': False}))


if __name__ == '__main__':
    build()
