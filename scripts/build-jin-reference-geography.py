#!/usr/bin/env python3
"""Add neutral administrative reference geography without changing Jin control.

The older vector maps provide a shared geographical backdrop. Only their parts
outside the annual prefectural union are emitted. Reference units have no active
entity links and no kingdom colours; obsolete names and coordinates disclose
their reference date. County polygons remain internal to the annual fitter.
Requires the same Shapely runtime as build-jin-annual-geography.py.
"""
from __future__ import annotations

import collections
import hashlib
import importlib.util
import json
from pathlib import Path

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('annual', ROOT / 'scripts/build-jin-annual-geography.py')
annual = importlib.util.module_from_spec(spec)
spec.loader.exec_module(annual)


def historical_state(sid, year, entities):
    """Avoid placing Ning/Xiang/Jiang/Qin/Ping before their dated establishment."""
    merged = {'s13': 's12', 's18': 's16', 's19': 's17', 's10': 's08', 's06': 's05'}
    entity = entities['state'].get(sid, {}).get('entity')
    if entity and not annual.phase(entity, year) and sid in merged:
        return merged[sid]
    return sid


def read_snapshots(entities):
    snapshots = {}
    candidates = collections.defaultdict(list)
    for pid, entity in entities['prefecture'].items():
        for name in entity['names']:
            candidates[name].append(pid)
    # Stable IDs in the 289 result also restore links for neutral 308 reference
    # points. These IDs describe provenance, never a clickable active entity.
    county_links = {}
    by_point_name = collections.defaultdict(list)
    old = json.loads((ROOT / 'data/jin-maps/289_map.geojson').read_text())
    for f in old['features']:
        p = f['properties']
        if p.get('layer') == 'county_seats' and p.get('entity_id') in entities['county']:
            county_links[str(p.get('source_id'))] = p['entity_id']
            by_point_name[annual.county_key(p['name'])].append((shape(f['geometry']), p['entity_id']))
    for refyear in (289, 308):
        old = json.loads((ROOT / f'data/jin-maps/{refyear}_map.geojson').read_text())
        refs, points = [], []
        occupied = Polygon()
        for index, f in enumerate(old['features']):
            p = f['properties']
            layer = p.get('layer')
            g = shape(f['geometry'])
            if layer not in ('prefecture_areas', 'unresolved_areas'):
                continue
            name = annual.key(p.get('base_name') or p.get('name'))
            pid = p.get('entity_id')
            if pid not in entities['prefecture']:
                options = candidates.get(name, [])
                matched = [eid for eid in options if annual.key(entities['prefecture'][eid]['state']['name']) == annual.key(p.get('state_name'))]
                pid = matched[0] if len(matched) == 1 else options[0] if len(options) == 1 else None
            sid = entities['prefecture'][pid]['state']['id'] if pid else next((eid for eid, e in entities['state'].items() if annual.key(e['entity']['name']) == annual.key(p.get('state_name'))), None)
            # The original image is schematic. Preserve each named compartment
            # once; overlaps at mixed CHGIS/image joins are never duplicated.
            g = annual.polygonal(g.difference(occupied))
            if g.is_empty:
                continue
            occupied = unary_union([occupied, g])
            refs.append(dict(id=f'ref-{refyear}-{index}', pid=pid, sid=sid, name=p.get('base_name') or p.get('name') or '', geometry=g,
                             refyear=refyear, source=p.get('source'), source_id=p.get('source_id'), unresolved=layer == 'unresolved_areas'))
        for index, f in enumerate(old['features']):
            p = f['properties']
            if p.get('layer') not in ('county_seats', 'prefecture_seats'):
                continue
            g = shape(f['geometry'])
            level = 'county' if p['layer'] == 'county_seats' else 'prefecture'
            eid = p.get('entity_id') if p.get('entity_id') in entities[level] else None
            if not eid and level == 'county':
                eid = county_links.get(str(p.get('source_id')))
                matches = by_point_name.get(annual.county_key(p.get('name')), [])
                if not eid and matches:
                    point, candidate = min(matches, key=lambda item: item[0].distance(g))
                    if point.distance(g) < .04:
                        eid = candidate
            if not eid and level == 'prefecture':
                options = candidates.get(annual.key(p.get('name')), [])
                if len(options) == 1:
                    eid = options[0]
            points.append(dict(id=f'point-{refyear}-{index}', eid=eid, geometry=g, level=level, refyear=refyear, properties=p))
        snapshots[refyear] = dict(refs=refs, points=points)
    return snapshots


def main():
    data = annual.load_js(ROOT / 'data/jin-data.js')
    entities = annual.all_entities(data)
    rules = json.loads((ROOT / 'data/jin-fief-research/annual-territory-rules.json').read_text())['rules']
    bundle = json.loads((ROOT / 'data/jin-maps/annual-geography.json').read_text())
    geometries = dict(bundle['geometries'])
    for shard in bundle.get('geometry_shards', []):
        geometries.update(json.loads((ROOT / shard['url']).read_text())['geometries'])
    snapshots = read_snapshots(entities)
    store = annual.GeometryStore(.002)
    feature_store, years, report = {}, {}, {}

    def add(g, p, result):
        gid = store.add(g, simplify=False)
        if not gid:
            return
        value = dict(geometry_id=gid, properties=p)
        raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        fid = 'r' + hashlib.sha256(raw.encode()).hexdigest()[:16]
        feature_store.setdefault(fid, value)
        result.append(fid)

    for year in range(266, 317):
        source_year = 289 if year <= 290 else 308
        snapshot = snapshots[source_year]
        rows = annual.rows_for(data, year)
        for level in rows:
            for row in rows[level].values():
                row['level'] = level
        current = json.loads((ROOT / f'data/jin-maps/annual-years/{year}.json').read_text())
        active_areas = [shape(geometries[f['geometry_id']]) for f in current['features'] if f['properties']['layer'] == 'prefecture_areas']
        occupied = annual.polygonal(unary_union(active_areas))
        current_states = {f['properties'].get('source_entity_id') or f['properties'].get('entity_id') for f in current['features'] if f['properties']['layer'] == 'province_areas'}
        active_seats = [f for f in current['features'] if f['properties']['layer'] in ('county_seats', 'prefecture_seats')]
        active_ids = {f['properties'].get('entity_id') for f in active_seats}
        active_positions = {(f['properties']['level'], tuple(geometries[f['geometry_id']]['coordinates'])) for f in active_seats}
        ids, neutral_parts, reference_states, full_states = [], [], collections.defaultdict(list), collections.defaultdict(list)
        counts = collections.Counter()
        examples = []
        for ref in snapshot['refs']:
            pid, sid = ref['pid'], historical_state(ref['sid'], year, entities)
            row = rows['prefecture'].get(pid)
            # Source intervals frequently stop at a military loss. Retain the
            # researched loss reason even after that prefecture leaves rows_for;
            # a missing administrative phase is not proof of formal abolition.
            control_row = row or (dict(id=pid, level='prefecture', state_id=sid) if pid else None)
            ctl = annual.effective_control(control_row, year, rules) if control_row else None
            # Before 280, the neutral backdrop follows ordinary Jin compartments
            # only. It must not restore the Wu side of split frontier prefectures.
            if year < 280:
                if not row or not ctl or ctl['status'] in ('external', 'partial', 'contested', 'marker_only', 'nominal'):
                    continue
            full_states[sid].append(ref['geometry'])
            gap = annual.polygonal(ref['geometry'].difference(occupied))
            if gap.is_empty or gap.area < .0005:
                continue
            source_entity = entities['prefecture'].get(pid, {}).get('entity')
            phase = annual.phase(source_entity, year) if source_entity else None
            title = phase.get('name', source_entity['base_name']) if phase else annual.key(source_entity['base_name'] if source_entity else ref['name'])
            # Reference names without a current phase never inherit stale 國 or
            # 支郡 colouring/name semantics from the old fief snapshot.
            if title and not title.endswith(('郡', '國', '国', '尹')) and '／' not in title:
                title += '郡'
            reason = '失陷或非西晉實控區：保留政區地理參考，不代表本年仍屬西晉' if ctl and ctl['status'] in ('lost', 'enemy', 'withdrawn', 'external') else '原圖與年度郡面未銜接的地理參考區；非本年獨立確認的政區或界線'
            if source_entity and not phase:
                reason = '年度表本年未列此郡或有效期已結束（不等同正式撤郡）：沿用原圖地理參考，不計為本年西晉有效郡'
                if ctl and ctl['status'] in ('lost', 'enemy', 'withdrawn', 'external'):
                    reason += '；另有失陷或非晉控制記錄'
            properties = dict(id=ref['id'], layer='reference_prefecture_areas', level='prefecture', name=title, display_name=title, base_name=ref['name'],
                              entity_id=None, source_entity_id=pid, state_id=sid, is_reference=True, reference_year=source_year,
                              reference_reason=reason, administrative_status='reference_current_name' if phase else 'reference_inactive_or_unresolved',
                              coordinate_role='reference_administrative_area_schematic', source=ref['source'], geometry_status='uncolored_reference_difference',
                              boundary_evidence='289/308原圖參考郡界；未覆蓋年度已繪郡面', control_status=ctl['status'] if ctl else 'reference', show_label=bool(title))
            if ctl and ctl['status'] != 'administrative':
                properties['control_reason'] = ctl['reason']
            add(gap, properties, ids)
            neutral_parts.append(gap)
            reference_states[sid].append(gap)
            counts['reference_prefecture_areas'] += 1
            if len(examples) < 8:
                examples.append(dict(name=title or '原圖待定區', entity_id=pid, reason=reason, area_degrees_squared=round(gap.area, 5)))
        neutral = annual.polygonal(unary_union(neutral_parts)) if neutral_parts else Polygon()
        for sid, parts in sorted(reference_states.items(), key=lambda item: str(item[0])):
            if not sid:
                continue
            s = entities['state'][sid]['entity']
            name = s['name']
            full = annual.polygonal(unary_union(full_states[sid]))
            gap = annual.polygonal(unary_union(parts))
            properties = dict(id=f'reference-{source_year}-{sid}', layer='reference_province_boundaries', name=name, display_name=name, level='state',
                              entity_id=None, source_entity_id=sid, state_id=sid, is_reference=True, reference_year=source_year,
                              reference_reason='州名與州界為無色地理參考，不計入當年西晉州數', administrative_status='reference_state',
                              source='原圖郡屬回溯；年度不存在州名歸入當時母州', coordinate_role='reference_state_boundary')
            add(full.boundary.intersection(gap), properties, ids)
            if sid not in current_states:
                add(gap, dict(properties, layer='reference_province_areas', coordinate_role='reference_administrative_area_schematic'), ids)
                counts['reference_province_areas'] += 1
        seen_points = set()
        for point in snapshot['points']:
            g, eid, level = point['geometry'], point['eid'], point['level']
            signature = (level, tuple(g.coords[0]))
            if (eid and eid in active_ids) or signature in active_positions or signature in seen_points or not neutral.covers(g):
                continue
            seen_points.add(signature)
            entity = entities[level].get(eid, {}).get('entity')
            phase = annual.phase(entity, year) if entity else None
            name = phase.get('name', entity['base_name']) if phase else point['properties'].get('name', '')
            if level == 'prefecture' and not phase:
                name = annual.key(entity['base_name'] if entity else name) + '郡'
            if level == 'county' and name and not name.endswith(('縣', '县', '國', '国')):
                name += '縣'
            reason = '保留失地、原郡或未銜接區的治所位置；參考年代不等於本年坐標已考定'
            p = dict(id=point['id'], layer=f'reference_{level}_seats', level=level, name=name, display_name=name,
                     entity_id=None, source_entity_id=eid, is_reference=True, reference_year=source_year, reference_reason=reason,
                     administrative_status='reference_current_name' if phase else 'reference_inactive_or_unresolved',
                     source=point['properties'].get('source'), source_id=point['properties'].get('source_id'),
                     coordinate_role='reference_administrative_seat', coordinate_time=f'{source_year}年原圖參考治所，非本年独立考證', show_label=level == 'county')
            add(g, p, ids)
            counts[p['layer']] += 1
        years[str(year)] = dict(feature_ids=list(dict.fromkeys(ids)), coverage=dict(counts, reference_year=source_year, uncolored_area_degrees_squared=round(neutral.area, 5)))
        report[str(year)] = dict(years[str(year)]['coverage'], examples=examples)
        print(f'{year}: {counts["reference_prefecture_areas"]} neutral prefectural compartments, {counts["reference_county_seats"]} reference county seats', flush=True)
    # A single global geometry file would make the small early maps download
    # every late Jin loss compartment. Keep cheap reused geometry in the index,
    # then pack the remainder by year-use signature for lazy loading.
    usage = collections.defaultdict(set)
    for year, entry in years.items():
        for fid in entry['feature_ids']:
            usage[feature_store[fid]['geometry_id']].add(int(year))
    sizes = {gid: len(json.dumps(g, separators=(',', ':'))) + len(gid) + 8 for gid, g in store.values.items()}
    common, common_bytes = {}, 0
    for gid in sorted(store.values, key=lambda gid: (-len(usage[gid]) / sizes[gid], gid)):
        if len(usage[gid]) >= 25 and common_bytes + sizes[gid] <= 400000:
            common[gid] = store.values[gid]
            common_bytes += sizes[gid]
    rare_groups = collections.defaultdict(dict)
    for gid, g in store.values.items():
        if gid not in common:
            rare_groups[tuple(sorted(usage[gid]))][gid] = g
    shards, shard_for, current, current_bytes = [], {}, {}, 0

    def flush_shard():
        nonlocal current, current_bytes
        if not current:
            return
        url = f'data/jin-maps/reference-geometry/g{len(shards)+1:03d}.json'
        path = ROOT / url
        annual.write_json(path, dict(version=1, geometries=current))
        shards.append(dict(url=url, bytes=path.stat().st_size, geometry_count=len(current)))
        for gid in current:
            shard_for[gid] = url
        current, current_bytes = {}, 0

    for signature, group in sorted(rare_groups.items()):
        for gid, g in sorted(group.items()):
            if current and current_bytes + sizes[gid] > 600000:
                flush_shard()
            current[gid] = g
            current_bytes += sizes[gid]
    flush_shard()
    published_paths = {ROOT / shard['url'] for shard in shards}
    for path in (ROOT / 'data/jin-maps/reference-geometry').glob('g*.json'):
        if path not in published_paths:
            path.unlink()
    shard_bytes = {shard['url']: shard['bytes'] for shard in shards}
    for year, entry in years.items():
        entry['geometry_urls'] = sorted({shard_for[feature_store[fid]['geometry_id']] for fid in entry['feature_ids'] if feature_store[fid]['geometry_id'] in shard_for})
        entry['extra_geometry_bytes'] = sum(shard_bytes[url] for url in entry['geometry_urls'])
    result = dict(version=1, meta=dict(crs='EPSG:4326', purpose='Uncolored administrative reference backdrop; never Jin control or fief colours',
                                     method='289/308原圖郡面減去本年已繪郡面；州郡縣治僅為地理參考，取消縣域可視層',
                                     county_boundaries_visible=False, annual_control_and_fief_geometry_unchanged=True),
                  geometries=common, geometry_shards=shards, features=feature_store, years=years)
    target = ROOT / 'data/jin-maps/reference-geography.json'
    annual.write_json(target, result)
    annual.write_json(ROOT / 'reports/jin-reference-geography-coverage.json', dict(meta=result['meta'], years=report), compact=False)
    print(f'{len(store.values)} shared geometries; {len(feature_store)} shared features; index {target.stat().st_size:,} bytes; {len(shards)} lazy shards')


if __name__ == '__main__':
    main()
