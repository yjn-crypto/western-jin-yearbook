#!/usr/bin/env python3
"""Build 51 annual maps with CHGIS points and the reviewed image footprint.

The uploaded original administrative image supplies the display space, shores,
province masks, and default prefecture compartments. Dated CHGIS points are
selected independently and retain source coordinates. Low-resolution annual
video evidence supplies only clear internal non-Jin political control changes;
it never replaces the original coast or extends provinces outside the image.
County fitted cells are internal inputs only. Every fitted amendment is marked.
Older annual and 289/308 snapshot data are preserved for reversible switching.
Requires Shapely >= 2.1, as does build-jin-annual-geography.py.
"""
from __future__ import annotations

import argparse
import collections
import gzip
import hashlib
import importlib.util
import json
import math
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from shapely import make_valid, normalize, set_precision, voronoi_polygons
from shapely.geometry import MultiPoint, MultiPolygon, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reference', ROOT / 'scripts/build-jin-reference-geography.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
annual = reference.annual
spec = importlib.util.spec_from_file_location('stable_provinces', ROOT / 'scripts/stable-jin-province-model.py')
stable_provinces = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stable_provinces)
spec = importlib.util.spec_from_file_location('point_priority', ROOT / 'scripts/jin-chgis-point-priority.py')
point_priority = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = point_priority
spec.loader.exec_module(point_priority)

GRID = .000001
EPSILON = .00002
AREA_LAYERS = {'territory', 'province_areas', 'province_boundaries', 'prefecture_areas',
               'prefecture_boundaries', 'member_boundaries', 'kingdom_areas',
               'county_areas', 'county_boundaries'}
_WORKER_INPUTS = None
_CHGIS_AREAS = None
PRESENTATION = dict(width=2400, height=1986,
                    extent=[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462],
                    plot=[80,140,2320,1906], source_priority=True)
SOURCE_POLICY = dict(version='2026-10-02.4',
    source_priority=['current_CHGIS_points_and_areas','reviewed_original_image_areas','annual_video_control_changes'],
    point_policy='dated_CHGIS_source_coordinates_preserved_then_reviewed_original_fallback',
    area_policy='original_province_prefecture_and_coastline_unless_dated_affiliation_conflict',
    footprint_source='reviewed_original_province_areas_union',
    control_source='annual_video_named_internal_control_changes_only',
    video_edge_overlap_filter=dict(original_domain_inset_degrees=.12,min_interior_overlap_degrees_squared=.5,
                                  meaning='coarse_registration_edge_overlap_filter_not_historical_accuracy'),
    video_outer_jin_boundary_used=False, original_domain_extended=False,
    excluded_external_areas=['西域','日本','朝鲜半岛','西伯利亚'],
    county_boundaries_displayed=False)


def initialize_worker(political_features, data, snapshots, points, chgis_areas):
    global _WORKER_INPUTS
    _WORKER_INPUTS = political_features, data, snapshots, points, chgis_areas


def generate_worker(year):
    political, data, snapshots, points, chgis_areas = _WORKER_INPUTS
    trial, report = complete_year(year, political, data, snapshots[289 if year <= 290 else 308], points, chgis_areas)
    return year, trial, report


def clean(geometry):
    # Carry one GEOS precision model through every overlay. Shared boundaries
    # stay on the same sub-metre grid instead of acquiring independently
    # serialized floating-point seam fragments. This is far below video error.
    if geometry.is_empty:
        return Polygon()
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    if geometry.geom_type not in ('Polygon', 'MultiPolygon'):
        # An overlay may return one already-valid MultiPolygon plus boundary
        # lines. Re-unioning that national polygon after every reference join
        # is quadratic work; discard line-only remnants without recomputing it.
        polygon_parts = [g for g in getattr(geometry, 'geoms', []) if g.geom_type in ('Polygon', 'MultiPolygon')]
        if not polygon_parts:
            return Polygon()
        if len(polygon_parts) == 1:
            geometry = polygon_parts[0]
        else:
            parts = [p for g in polygon_parts for p in ([g] if g.geom_type == 'Polygon' else g.geoms)]
            geometry = MultiPolygon(parts)
            if not geometry.is_valid:
                geometry = unary_union(parts)
    return set_precision(geometry, GRID, mode='valid_output')


def components(geometry):
    if geometry.is_empty:
        return []
    return [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)


def is_jin(properties):
    if 'is_jin' in properties:
        return bool(properties['is_jin'])
    if 'is_western_jin' in properties:
        return bool(properties['is_western_jin'])
    return properties.get('regime') in ('西晋', '西晉', 'Western Jin', 'western-jin')


def is_affiliate(properties):
    return bool(properties.get('is_jin_affiliate')) or properties.get('kind') == 'nominal-affiliate'


def internal_control_feature(properties):
    """Named changes in the study area, not neighbouring atlas countries."""
    name = properties.get('regime') or properties.get('name') or ''
    return (name in ('孙吴','孫吳','吴','吳','成','成汉','成漢','汉','漢','汉赵','漢趙')
            or name.startswith(('汉（','漢（'))
            or any(word in name for word in ('起兵','侵入','控制范围','控制範圍')))


def political_control_in_original_domain(year, political, domain):
    """Keep original shore; subtract only clear named internal changes."""
    selected, occupied, excluded, assessments = [], Polygon(), [], []
    interior = domain.buffer(-.12)
    for f in political:
        p = f.get('properties', {})
        if is_jin(p):
            continue
        name = p.get('regime') or p.get('name')
        candidate = clean(shape(f['geometry']).intersection(domain))
        interior_area = candidate.intersection(interior).area if not candidate.is_empty else 0
        significant_internal_change = candidate.area > .5 and interior_area > .5
        keep = not is_affiliate(p) and (internal_control_feature(p) or significant_internal_change)
        assessments.append(dict(regime=name, overlap_original_domain_degrees_squared=round(candidate.area,7),
            overlap_original_domain_interior_degrees_squared=round(interior_area,7), retained=keep,
            assessment='named_internal_control_change' if internal_control_feature(p) else
                       'large_internal_overlap_kept_clipped_to_original_domain' if significant_internal_change and keep else
                       'nominal_outside_affiliate_excluded' if is_affiliate(p) else
                       'outside_scope_or_low_precision_edge_overlap_original_area_preferred'))
        if not keep:
            excluded.append(name)
            continue
        part = clean(candidate.difference(occupied))
        if part.is_empty or part.area <= EPSILON:
            continue
        q = dict(p, source_priority='annual_video_control_changes',
                 area_source_priority='reviewed_original_footprint_with_video_internal_control',
                 footprint_source=SOURCE_POLICY['footprint_source'],
                 control_source=SOURCE_POLICY['control_source'],
                 source_policy=SOURCE_POLICY['version'],
                 boundary_evidence='原图汉晋天下域内具名控制色块；外缘与海岸按原图截齐，域内分界为视频配准推定')
        selected.append(dict(type='Feature', properties=q, geometry=mapping(part)))
        occupied = clean(unary_union([occupied, part]))
    jin = clean(domain.difference(occupied))
    raw_jin = [f for f in political if is_jin(f.get('properties', {}))]
    evidence = dict(raw_jin[0].get('properties', {})) if raw_jin else {}
    evidence.update(year=year, regime='西晋', name='西晋', is_jin=True, is_western_jin=True,
                    source='原上传图片矢量GIS完整疆域；年度具名内部控制变化参照史图馆',
                    source_priority='reviewed_original_image_areas',
                    footprint_source=SOURCE_POLICY['footprint_source'],
                    control_source=SOURCE_POLICY['control_source'],
                    source_policy=SOURCE_POLICY['version'],
                    video_outer_boundary_used=False,
                    boundary_evidence='原图完整州域减本年明确内部非晋控制区；视频晋色外缘不参与海岸或国土轮廓')
    selected.append(dict(type='Feature', properties=evidence, geometry=mapping(jin)))
    return selected, jin, occupied, excluded, assessments


def load_annual(year):
    index = json.loads((ROOT / 'data/jin-maps/annual-geography.json').read_text())
    geometries = dict(index['geometries'])
    entry = index['years'][str(year)]
    for url in entry.get('geometry_urls', []):
        geometries.update(json.loads((ROOT / url).read_text())['geometries'])
    source = json.loads((ROOT / entry['data_url']).read_text())
    features = [dict(type='Feature', geometry=f.get('geometry') or geometries[f['geometry_id']],
                     properties=dict(f['properties'])) for f in source['features']]
    return features, source['coverage'], index.get('meta', {})


def scaled_distance(left, right):
    """Approximate ground distance for local seed choices, in degree units."""
    latitude = (left.y + right.y) / 2
    return math.hypot((left.x-right.x)*math.cos(math.radians(latitude)), left.y-right.y)


def partition_by_seeds(mask, seeds):
    """Deterministic non-overlapping partition; returns pid -> polygon."""
    unique = {}
    for pid, point in seeds:
        signature = (round(point.x, 8), round(point.y, 8))
        unique.setdefault(signature, (pid, point))
    seeds = list(unique.values())
    if not seeds:
        return {}
    if len(seeds) == 1:
        return {seeds[0][0]: mask}
    extension = box(*mask.bounds).buffer(max(2, mask.bounds[2]-mask.bounds[0], mask.bounds[3]-mask.bounds[1]))
    cells = voronoi_polygons(MultiPoint([point for _, point in seeds]), extend_to=extension, ordered=True)
    result = collections.defaultdict(list)
    for (pid, _), cell in zip(seeds, cells.geoms):
        part = clean(cell.intersection(mask))
        if not part.is_empty:
            result[pid].append(part)
    return {pid: clean(unary_union(parts)) for pid, parts in result.items()}


def original_gap_report(year, snapshot, features, rows, rules):
    occupied = clean(unary_union([shape(f['geometry']) for f in features if f['properties']['layer'] == 'prefecture_areas']))
    result, totals = [], collections.defaultdict(float)
    for ref in snapshot['refs']:
        gap = clean(ref['geometry'].difference(occupied))
        if gap.is_empty or gap.area < .0005:
            continue
        pid = ref['pid']
        ctl = annual.effective_control(dict(id=pid, level='prefecture', state_id=ref['sid']), year, rules) if pid else None
        category = ('unresolved_original' if ref['unresolved'] else
                    'lost_or_non_jin' if ctl and ctl['status'] in ('lost', 'enemy', 'withdrawn', 'external') else
                    'valid_prefecture_geometry_gap' if pid in rows['prefecture'] else 'no_current_prefecture_phase')
        totals[category] += gap.area
        result.append(dict(reference_id=ref['id'], name=ref['name'] or '原图未命名区', entity_id=pid,
                           category=category, control_status=ctl['status'] if ctl else None,
                           area_degrees_squared=round(gap.area, 7)))
    return dict(gap_compartments=len(result), area_degrees_squared=round(sum(totals.values()), 7),
                category_areas_degrees_squared={key: round(value, 7) for key, value in totals.items()},
                largest=sorted(result, key=lambda row: row['area_degrees_squared'], reverse=True)[:20])


def resolve_dated_snapshot(year, snapshot, rows, entities):
    """Source IDs are provenance; a re-created prefecture may have a new ID."""
    by_name = collections.defaultdict(list)
    for pid, row in rows['prefecture'].items():
        by_name[annual.key(row['base_name'])].append(pid)
    resolved, pid_for_source = [], {}
    for ref in snapshot['refs']:
        p = dict(ref)
        candidates = by_name.get(annual.key(ref.get('name')), [])
        pid = ref['pid']
        if len(candidates) == 1:
            pid = candidates[0]
        elif candidates:
            if pid not in candidates:
                # Same-name units in different locations stay unresolved rather
                # than selecting an arbitrary administrative parent.
                sid = reference.historical_state(ref['sid'], year, entities)
                local = [eid for eid in candidates if rows['prefecture'][eid]['state_id'] == sid]
                pid = local[0] if len(local) == 1 else None
        if pid != ref['pid']:
            p.update(source_prefecture_id=ref['pid'], pid=pid,
                     dated_entity_resolution='normalized_active_prefecture_base_name')
        if ref['pid'] and pid in rows['prefecture']:
            pid_for_source[ref['pid']] = pid
        resolved.append(p)
    county_by_name = collections.defaultdict(list)
    for cid, row in rows['county'].items():
        county_by_name[annual.county_key(row['base_name'])].append(cid)
    points = []
    for point in snapshot['points']:
        p = dict(point)
        if point['level'] == 'prefecture' and point['eid'] in pid_for_source:
            p.update(source_eid=point['eid'], eid=pid_for_source[point['eid']])
        elif point['level'] == 'county' and point['eid'] not in rows['county']:
            candidates = county_by_name.get(annual.county_key(point['properties'].get('name')), [])
            original = entities['county'].get(point['eid'], {})
            old_parent = original.get('prefecture', {}).get('id')
            new_parent = pid_for_source.get(old_parent)
            local = [cid for cid in candidates if rows['county'][cid]['prefecture_id'] == new_parent]
            chosen = local[0] if len(local) == 1 else candidates[0] if len(candidates) == 1 else None
            if chosen:
                p.update(source_eid=point['eid'], eid=chosen)
        points.append(p)
    return dict(snapshot, refs=resolved, points=points)


def complete_year(year, political_features, data=None, snapshot=None, points=None, chgis_areas=None):
    """Public reusable API: inputs are WGS84 Feature dictionaries for one year."""
    if not 266 <= year <= 316:
        raise ValueError('Western Jin annual maps cover 266–316.')
    source, source_coverage, meta = load_annual(year)
    data = data or annual.load_js(ROOT / 'data/jin-data.js')
    entities = annual.all_entities(data)
    rows = annual.rows_for(data, year)
    snapshot = snapshot or reference.read_snapshots(entities)[289 if year <= 290 else 308]
    snapshot = resolve_dated_snapshot(year, snapshot, rows, entities)
    political = [f for f in political_features if int(f.get('properties', {}).get('year', year)) == year]
    for f in political:
        g = shape(f['geometry'])
        if g.is_empty:
            continue
        west, south, east, north = g.bounds
        if not all(math.isfinite(v) for v in g.bounds) or not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
            raise ValueError('Political polygons must already be georeferenced WGS84 longitude/latitude, not video pixels.')
    stable = stable_provinces.model(year, rows, entities, snapshot, annual, reference, original_only=True)
    domain = clean(stable['domain'])
    raw_video_jin = clean(unary_union([shape(f['geometry']) for f in political if is_jin(f.get('properties', {}))]))
    political, jin, others, excluded_regimes, control_assessments = political_control_in_original_domain(year, political, domain)
    political_overlap, affiliate_overlap, overlap_pairs = Polygon(), Polygon(), []
    stable_masks = {sid: clean(g.intersection(jin)) for sid, g in stable['masks'].items()}
    stable_masks = {sid: g for sid, g in stable_masks.items() if not g.is_empty}
    points = points or point_priority.get_index(data, annual=annual)
    annual_points, point_report = points.features_for(year)
    unlinked_points = points.unlinked_features_for(year)
    if chgis_areas is None:
        global _CHGIS_AREAS
        if _CHGIS_AREAS is None:
            records, _ = annual.read_chgis(Path.home() / 'Downloads/CHGIS数据.zip')
            _CHGIS_AREAS = records.get('prefecture_area', [])
        chgis_areas = _CHGIS_AREAS
    area_records = collections.defaultdict(list)
    for record in chgis_areas:
        if record['begin'] <= year <= record['end']:
            area_records[str(record['source_id'])].append(record)

    prototypes, original, final = {}, {}, {}
    current_chgis_areas = []
    initial_parts = []
    for f in source:
        p = f['properties']
        if p['layer'] != 'prefecture_areas':
            continue
        pid = p['entity_id']
        if pid not in rows['prefecture']:
            continue
        prototypes[pid] = dict(p)
        original[pid] = clean(shape(f['geometry']))
        # Stable named original compartments win over generic annual county
        # Voronoi cells. The latter are used only for explicit county-parent
        # conflicts, not as a reason to redraw every prefecture each year.
        matched = [r['geometry'] for r in snapshot['refs'] if r['pid'] == pid]
        preferred = clean(unary_union(matched)) if matched else original[pid]
        records = area_records.get(str(p.get('source_id')), []) if p.get('geometry_status') == 'CHGIS_preferred' else []
        records = [r for r in records if annual.key(rows['prefecture'][pid]['base_name']) in r.get('name_keys',{r['name_key']})]
        if records:
            record = max(records,key=lambda r:(r.get('version',0),r['begin'],-(r['end']-r['begin'])))
            preferred = clean(record['geometry'].intersection(domain))
            prototypes[pid].update(source=record['source'],source_id=record['source_id'],
                geometry_source_begin=record['begin'],geometry_source_end=record['end'],
                source_priority='current_CHGIS_areas',area_source_priority='current_CHGIS_areas',
                geometry_status='CHGIS_current_preferred',boundary_evidence='本年有效CHGIS郡面；政治控制单独裁分')
            current_chgis_areas.append(dict(prefecture_id=pid,state_id=p['state_id'],record=record,geometry=preferred))
        original[pid] = preferred
        part = clean(preferred.intersection(stable_masks.get(p['state_id'], Polygon())))
        final[pid] = part
    # A previously lost/partial-control rule can suppress a still-dated parent
    # prefecture. The current video mask supplies political control; retain the
    # yearbook's valid parent rather than spreading its land across a province.
    restored = []
    refs_by_pid = collections.defaultdict(list)
    for ref in snapshot['refs']:
        if ref['pid']:
            refs_by_pid[ref['pid']].append(ref['geometry'])
    for pid, row in rows['prefecture'].items():
        if pid in prototypes or pid not in refs_by_pid:
            continue
        g = clean(unary_union(refs_by_pid[pid]))
        p = annual.common_properties(row, 'prefecture', dict(status='original_jin_domain', source_ids=['yearbook','reviewed-original-image']), year)
        p.update(layer='prefecture_areas', base_name=row['base_name'], source='本年有效郡期段＋原图完整郡域',
                 geometry_status='restored_dated_prefecture_original_priority', geometric_certainty='inferred')
        if row['phase'].get('is_fief') or row['name'].endswith(('國','国')):
            p.update(fief_id='annual-single-'+pid, member_role='seat', membership_evidence='confirmed')
        prototypes[pid], original[pid] = p, g
        final[pid] = clean(g.intersection(stable_masks.get(row['state_id'], Polygon())))
        restored.append(pid)
    if current_chgis_areas:
        masks = dict(stable['masks'])
        occupied_chgis = Polygon()
        for entry in sorted(current_chgis_areas,key=lambda e:e['prefecture_id']):
            sid = entry['state_id']
            whole = clean(entry['geometry'].difference(occupied_chgis))
            occupied_chgis = clean(unary_union([occupied_chgis,whole]))
            for other_sid in masks:
                if other_sid != sid and masks[other_sid].intersects(whole):
                    masks[other_sid] = clean(masks[other_sid].difference(whole))
            masks[sid] = clean(unary_union([masks.get(sid,Polygon()),whole]))
        # A valid CHGIS complete prefecture is the only additional source
        # allowed to alter its parent province mask. It does not trigger an
        # unrelated county re-aggregation or a new national footprint.
        stable = dict(stable,masks=masks)
        stable_masks = {sid:clean(g.intersection(jin)) for sid,g in masks.items()}
        stable_masks = {sid:g for sid,g in stable_masks.items() if not g.is_empty}
        final = {pid:clean(g.intersection(stable_masks.get(prototypes[pid]['state_id'],Polygon())))
                 for pid,g in original.items()}
    # Move a fitted county part only when its original named compartment and
    # current dated parent actually disagree. CHGIS point/image disagreement
    # alone is a location conflict, not proof of an administrative transfer.
    original_county_compartments = {}
    for point in snapshot['points']:
        if point['level'] != 'county' or point['eid'] not in rows['county']:
            continue
        matches = [ref for ref in snapshot['refs'] if ref['geometry'].covers(point['geometry'])]
        if len(matches) == 1:
            original_county_compartments[point['eid']] = matches[0]
    county_parent_amendments = []
    for f in source:
        p = f['properties']
        if p['layer'] != 'county_areas':
            continue
        cid = p.get('entity_id')
        county, old_ref = rows['county'].get(cid), original_county_compartments.get(cid)
        if not county or not old_ref:
            continue
        pid = county['prefecture_id']
        if pid not in final or annual.key(rows['prefecture'][pid]['base_name']) == annual.key(old_ref['name']):
            continue
        sid = rows['prefecture'][pid]['state_id']
        part = clean(shape(f['geometry']).intersection(old_ref['geometry']).intersection(stable_masks.get(sid, Polygon())))
        if part.is_empty or part.area <= EPSILON:
            continue
        for other_pid in final:
            if other_pid != pid and prototypes[other_pid].get('state_id') == sid and final[other_pid].intersects(part):
                final[other_pid] = clean(final[other_pid].difference(part))
        final[pid] = clean(unary_union([final[pid], part]))
        county_parent_amendments.append(dict(county_id=cid, county_name=county['name'],
            original_reference_name=old_ref['name'], current_prefecture_id=pid,
            current_prefecture_name=rows['prefecture'][pid]['name'], state_id=sid,
            area_degrees_squared=round(part.area,7),
            method='explicit_dated_county_parent_local_fit', certainty='inferred'))
    # The stored annual geometries are individually rounded at serialization;
    # neighbouring edges can therefore retain tiny overlapping slivers. Remove
    # them using only nearby earlier prefectures, preserving their established
    # priority without repeatedly constructing a full national union.
    pref_ids = sorted(final,key=lambda pid:(prototypes[pid].get('source_priority') != 'current_CHGIS_areas',pid))
    clipped_shapes = [final[pid] for pid in pref_ids]
    initial_clipped_area = sum(g.area for g in clipped_shapes)
    tree = STRtree(clipped_shapes)
    for index, pid in enumerate(pref_ids):
        g = final[pid]
        if g.is_empty:
            continue
        earlier = [final[pref_ids[int(i)]] for i in tree.query(g, predicate='intersects') if int(i) < index]
        if earlier:
            g = clean(g.difference(unary_union(earlier)))
            final[pid] = g
        if not g.is_empty:
            initial_parts.append(g)
    initial_occupied = clean(unary_union(initial_parts))
    initial_overlap_removed = max(0, initial_clipped_area - sum(g.area for g in initial_parts))
    print(f'{year}: {len(prototypes)} dated prefectures clipped to stable provinces; filling within each province', flush=True)
    if not prototypes:
        raise ValueError(f'No active annual prefectures provide administrative seeds in {year}.')

    # A point is used only when its dated yearbook row has an active parent.
    # The original point is a reference coordinate; membership is annual.
    county_seeds = []
    for feature in annual_points:
        p = feature['properties']
        if p['level'] != 'county':
            continue
        county = rows['county'].get(p['entity_id'])
        if county and county['prefecture_id'] in prototypes:
            county_seeds.append((county['prefecture_id'], shape(feature['geometry']), p['entity_id']))
    prefecture_seats = {f['properties']['entity_id']: shape(f['geometry']) for f in annual_points
                        if f['properties']['layer'] == 'prefecture_seats' and f['properties']['entity_id'] in prototypes}
    # Prefer source pref shapes for nearby allocation, even when the mask clips
    # a prefecture to zero; don't spread that geometry across the map.
    seed_shapes = dict(original)
    county_seed_tree = STRtree([point for pid, point, cid in county_seeds])
    reference_tree = STRtree([ref['geometry'] for ref in snapshot['refs']])
    assignments, allocation_parts = [], collections.defaultdict(list)
    county_cells_used = 0

    def assign(gap, ref=None, stable_sid=None, preferred_pid=None, numerical=False):
        if gap.is_empty:
            return
        ref_pid = ref['pid'] if ref else None
        sid = stable_sid or (reference.historical_state(ref['sid'], year, entities) if ref else None)
        candidates = [pid for pid, p in prototypes.items() if p.get('state_id') == sid and not p.get('is_context')]
        if not candidates:
            # Keep a geographic context province when the yearbook has no
            # surviving legal unit. This is coloured Jin land, not a fabricated
            # active prefecture nor an expansion of a neighbouring province.
            pid = 'context-' + sid
            entity = entities['state'].get(sid, {}).get('entity', {})
            name = '原' + entity.get('name', '州') + '范围（郡属待定）'
            prototypes.setdefault(pid, dict(layer='prefecture_areas', level='prefecture', entity_id=None,
                source_entity_id=sid, name=name, display_name=name, state_id=sid,
                state_name=entity.get('name', ''), is_context=True, show_label=False,
                source='原版稳定州范围；本年有效郡记录缺项', geometric_certainty='inferred',
                reference_reason='原州地理参考不证明本年仍设此州；原图域内未见明确非晋控制色块，郡属待定'))
            original.setdefault(pid, Polygon())
            final[pid] = clean(unary_union([final.get(pid, Polygon()), gap]))
            allocation_parts[pid].append(gap)
            assignments.append(dict(reference_id=ref['id'] if ref else None,
                assigned_prefecture_id=None, allocation_key=pid, assigned_prefecture_name=name,
                state_id=sid, method='stable_province_dated_prefecture_unresolved', certainty='inferred',
                evidence='本年无可用有效郡属；保留原州地理范围和晋色，不跨州强附邻郡。',
                area_degrees_squared=round(gap.area, 7)))
            return
        nearby_counties = [county_seeds[int(i)] for i in county_seed_tree.query(gap, predicate='covers')]
        seeds = [(pid, point) for pid, point, cid in nearby_counties if pid in candidates]
        parent_ids = {pid for pid, point in seeds}
        if numerical or gap.area <= EPSILON:
            pid = preferred_pid or min(candidates, key=lambda pid: seed_shapes[pid].distance(gap))
            parts = {pid: gap}
            method = 'same_stable_province_numerical_residual'
            evidence = '小于数值阈值的细缝附给同州最近有效郡，不另造州岛。'
        elif seeds and (ref_pid not in candidates or parent_ids != {ref_pid}):
            parts = partition_by_seeds(gap, seeds)
            method = 'dated_county_parent_within_stable_province'
            evidence = '本年有效县的父郡关系；仅在原稳定州范围内拟合郡属，县格不改变州界。'
        elif ref_pid in candidates:
            parts = {ref_pid: gap}
            method = 'active_prefecture_reference_compartment'
            evidence = '原郡本年仍有效；缺口附回同郡，范围受原稳定州边界约束。'
        else:
            nearby = sorted(candidates, key=lambda pid: seed_shapes[pid].distance(gap))
            adjacent = [pid for pid in nearby if seed_shapes[pid].distance(gap) < GRID * 3]
            if not adjacent:
                anchor = gap.representative_point()
                adjacent = sorted(nearby, key=lambda pid: scaled_distance(
                    anchor, nearest_points(anchor, seed_shapes[pid])[1]))[:3]
            anchor = gap.representative_point()
            parts = partition_by_seeds(gap, [(pid, nearest_points(anchor, seed_shapes[pid])[1]) for pid in adjacent])
            method = 'stable_province_neighbor_prefecture_fit'
            evidence = '原郡本年不存在或原图待定；仅附给同一稳定州内邻郡，新增郡界标为推定。'
        used = Polygon()
        for pid in sorted(parts):
            part = clean(parts[pid].difference(used))
            if part.is_empty:
                continue
            final[pid] = clean(unary_union([final[pid], part]))
            allocation_parts[pid].append(part)
            used = clean(unary_union([used, part]))
            assignments.append(dict(reference_id=ref['id'] if ref else None,
                reference_name=(ref['name'] or '原图未命名区') if ref else '原图完整疆域与行政参照之间的余部',
                reference_prefecture_id=ref_pid, assigned_prefecture_id=pid,
                assigned_prefecture_name=prototypes[pid]['name'], state_id=sid, method=method,
                evidence=evidence, certainty='inferred', area_degrees_squared=round(part.area, 7)))
        residual = clean(gap.difference(used))
        if not residual.is_empty:
            pid = min(candidates, key=lambda eid: seed_shapes[eid].distance(residual))
            final[pid] = clean(unary_union([final[pid], residual]))
            allocation_parts[pid].append(residual)
            assignments.append(dict(reference_id=ref['id'] if ref else None,
                reference_name='同州拟合分区数值余部', assigned_prefecture_id=pid,
                assigned_prefecture_name=prototypes[pid]['name'], state_id=sid,
                method='same_stable_province_numerical_residual', certainty='inferred',
                evidence='数值余部仍只附于同州有效郡，不另造州岛。', area_degrees_squared=round(residual.area, 9)))

    # County fitted cells are an internal source of dated administrative
    # affiliation. In current data most are already inside annual prefectures,
    # but accepting uncovered parts keeps the completion API reusable.
    remaining_gap = clean(jin.difference(initial_occupied))
    for f in source:
        p = f['properties']
        if p['layer'] != 'county_areas':
            continue
        county = rows['county'].get(p.get('entity_id'))
        if not county or county['prefecture_id'] not in prototypes:
            continue
        # Annual cells are already clipped to their parent prefecture. Check
        # that cheap local difference first; intersecting all ~1,000 cells with
        # a national multi-polygon gap would be needlessly expensive.
        excess = clean(shape(f['geometry']).difference(original[county['prefecture_id']]))
        if excess.is_empty or excess.area <= EPSILON:
            continue
        state_mask = stable_masks.get(prototypes[county['prefecture_id']]['state_id'], Polygon())
        part = clean(excess.intersection(remaining_gap).intersection(state_mask))
        if part.is_empty or part.area <= EPSILON:
            continue
        pid = county['prefecture_id']
        final[pid] = clean(unary_union([final[pid], part]))
        allocation_parts[pid].append(part)
        remaining_gap = clean(remaining_gap.difference(part))
        county_cells_used += 1
        assignments.append(dict(reference_name=county['name'], assigned_prefecture_id=pid,
                                assigned_prefecture_name=prototypes[pid]['name'], state_id=prototypes[pid].get('state_id'),
                                method='dated_county_internal_cell', certainty='inferred',
                                evidence='本年县所属郡；县域仅为内部郡界拟合单元。', area_degrees_squared=round(part.area, 7)))

    for ref in snapshot['refs']:
        gap = clean(ref['geometry'].intersection(remaining_gap))
        if gap.is_empty:
            continue
        # The stable province wins over an old prefectural join or county grid.
        # A reference compartment can intersect two provinces only at their
        # reviewed border; each side is allocated within its own province.
        for sid, mask in stable_masks.items():
            part = clean(gap.intersection(mask))
            if not part.is_empty:
                assign(part, ref, sid)
        remaining_gap = clean(remaining_gap.difference(gap))
    for sid, mask in stable_masks.items():
        tiny, substantial = collections.defaultdict(list), []
        candidates = [pid for pid,p in prototypes.items() if p.get('state_id') == sid and not p.get('is_context')]
        for part in components(clean(remaining_gap.intersection(mask))):
            if part.area <= EPSILON:
                pid = min(candidates,key=lambda pid:seed_shapes[pid].distance(part)) if candidates else None
                tiny[pid].append(part)
            else:
                substantial.append(part)
        # Geometry seams can contain thousands of sub-metre components. Keep
        # each one's local parent choice but union additions once per parent.
        for pid, parts in tiny.items():
            assign(clean(unary_union(parts)),None,sid,preferred_pid=pid,numerical=True)
        for part in substantial:
            closest_ref = snapshot['refs'][int(reference_tree.nearest(part))] if snapshot['refs'] else None
            assign(part, closest_ref, sid)
    print(f'{year}: prefecture allocations ready ({len(assignments)}); emitting shared province lines', flush=True)

    features = []
    def add(geometry, properties):
        if not geometry.is_empty:
            features.append(dict(type='Feature', geometry=mapping(geometry), properties=properties))

    state_parts = collections.defaultdict(list)
    source_states = {f['properties'].get('entity_id') or f['properties'].get('source_entity_id'): f['properties']
                     for f in source if f['properties']['layer'] == 'province_areas'}
    for pid in sorted(final):
        g = final[pid]
        if g.is_empty:
            continue
        uses_chgis_area = prototypes[pid].get('source_priority') == 'current_CHGIS_areas'
        area_priority = 'current_CHGIS_areas' if uses_chgis_area else 'reviewed_original_image_areas'
        p = dict(prototypes[pid], year=year, geometry_status='CHGIS_current_preferred' if uses_chgis_area else 'original_priority_dated_prefecture_completion',
                 source=prototypes[pid]['source'] if uses_chgis_area else '原上传图片矢量GIS郡面；本年有效统属局部调整',
                 source_priority=area_priority, area_source_priority=area_priority,
                 source_policy=SOURCE_POLICY['version'], footprint_source=SOURCE_POLICY['footprint_source'],
                 control_source=SOURCE_POLICY['control_source'],
                 political_mask_source='原图空间内史图馆具名年度控制变化', political_control_reference='internal_video_control_changes',
                 prior_control_status=prototypes[pid].get('control_status'),
                 control_status='original_jin_domain_minus_internal_control_changes',political_control_is_separate=True,
                 geometric_certainty='reference' if uses_chgis_area else 'schematic', coordinate_role='administrative_area_schematic',
                 stable_state_id=prototypes[pid]['state_id'], province_boundary_model=stable['model'])
        if p.get('control_reason'):p['prior_control_reason']=p.pop('control_reason')
        local_amendments = [a for a in county_parent_amendments if a['current_prefecture_id'] == pid]
        if local_amendments:
            p.update(county_parent_amendment_inferred=True, county_parent_amendments=local_amendments,
                     geometric_certainty='inferred')
        added = clean(unary_union(allocation_parts[pid])) if allocation_parts[pid] else Polygon()
        if not added.is_empty:
            methods = sorted({a['method'] for a in assignments if a.get('assigned_prefecture_id') == pid or a.get('allocation_key') == pid})
            p.update(completion_inferred=True, completion_methods=methods, geometric_certainty='inferred',
                     completion_area_degrees_squared=round(added.area, 7),
                     boundary_evidence='缺口依本年县属、旧图郡域和同州邻郡补齐；新增段为拟合，非独立考证的真实边界',
                     notes=list(p.get('notes', []))+['原图晋域内缺项归入本年有效郡；补齐段标为推定，不显示拟合县界。'])
        add(g, p)
        add(g, dict(p, layer='member_boundaries' if p.get('fief_id') else 'prefecture_boundaries', coordinate_role='boundary'))
        state_parts[p['state_id']].append(g)
    for sid, g in sorted(stable_masks.items()):
        p = dict(source_states.get(sid, {}), layer='province_areas', year=year,
                 source='原289/308稳定州面；年度改属沿完整原郡面调整', geometry_status='stable_reviewed_province_mask',
                 state_id=sid, stable_state_id=sid, province_boundary_model=stable['model'],
                 stable_reference_year=stable['reference_year'], geometric_certainty='inferred',
                 source_priority='reviewed_original_image_areas', source_policy=SOURCE_POLICY['version'],
                 footprint_source=SOURCE_POLICY['footprint_source'],
                 coordinate_role='administrative_area_schematic')
        row = rows['state'].get(sid)
        entity = entities['state'].get(sid, {}).get('entity', {})
        if row:
            p.update(entity_id=row['id'] if not row['phase'].get('lapsed_state_context') else None,
                     name=row['name'], display_name=row['name'], level='state',
                     is_context=bool(row['phase'].get('lapsed_state_context')))
        else:
            name = '原' + entity.get('name', '州') + '范围（郡属待定）'
            p.update(entity_id=None, source_entity_id=sid, name=name, display_name=name,
                     level='state', is_context=True,
                     reference_reason='原州地理范围只作上下文；本年年表无有效州郡记录，不宣称仍实际设州。')
        add(g, p)
    for sid, other, line in stable_provinces.shared_borders(stable['masks'], jin):
        add(line, dict(layer='province_boundaries', level='state', year=year, entity_id=None,
                       name='州际共享边界', display_name='州际共享边界', state_id=sid,
                       adjacent_state_ids=[sid, other], stable_state_id=sid,
                       province_boundary_model=stable['model'], stable_reference_year=stable['reference_year'],
                       geometry_status='shared_province_border_lines_only',
                       source='原稳定州面共享边界；政治外围另由政权界绘制', coordinate_role='boundary'))
    # Restoring an active prefecture must also restore a confirmed existing
    # multi-prefecture kingdom membership, rather than colouring it as an
    # unrelated single-prefecture country because an earlier control rule
    # suppressed its geometry in the old annual bundle.
    researched_fiefs = {}
    source_fiefs = {f['properties'].get('fief_id'):f['properties'] for f in source
                    if f['properties']['layer']=='kingdom_areas'}
    for record in annual.fief_records_for(ROOT/'data/jin-fief-research/annual-multi-commandery-kingdoms.json',year):
        if record.get('map_default') is False or record.get('mapping_policy') in ('marker_only','annotation_only','do_not_merge','unknown_transfer_year'):
            continue
        confirmed = [annual.key(n) for n in record.get('confirmed_member_commanderies',[])]
        inferred = [annual.key(n) for n in record.get('inferred_member_commanderies',[])]
        if record.get('mapping_policy') == 'seat_only_unknown_secondary_members':
            confirmed=[annual.key(record.get('seat_commandery') or record['kingdom_name'])]
            inferred=[]
        fid = record.get('id') or record.get('fief_id') or 'annual-'+annual.key(record['kingdom_name'])
        seat = annual.key(record.get('seat_commandery') or record['kingdom_name'])
        members, inferred_members = [], []
        for pid,row in rows['prefecture'].items():
            if pid not in final or final[pid].is_empty:
                continue
            names = {annual.key(row['name']),annual.key(row['base_name']),*entities['prefecture'][pid]['names']}
            if not names.intersection(confirmed+inferred):
                continue
            members.append(pid)
            uncertain = not names.intersection(confirmed)
            if uncertain:inferred_members.append(pid)
            role = 'seat' if seat in names else 'branch'
            prototypes[pid].update(fief_id=fid,member_role=role,membership_evidence='inferred' if uncertain else 'confirmed',
                                  display_name=annual.key(record['kingdom_name'])+'國' if role=='seat' else annual.key(row['name'])+'支郡')
        if members:
            props = dict(source_fiefs.get(fid,{}),layer='kingdom_areas',level='fief',year=year,
                fief_id=fid,name=annual.key(record['kingdom_name'])+'國',display_name=annual.key(record['kingdom_name'])+'國',
                member_entity_ids=members,member_names=[rows['prefecture'][pid]['name'] for pid in members],
                inferred_member_entity_ids=inferred_members,is_multi=len(members)>1,
                has_inference=bool(inferred_members) or record.get('certainty') in ('inferred','uncertain','unknown','low','medium'),
                source='年度多郡王国研究＋原图优先本年成员郡面',source_ids=record.get('source_ids',[]),
                holder=record.get('holder',''),notes=record.get('notes',[]),certainty=record.get('certainty','confirmed'),
                geometric_certainty='inferred',coordinate_role='fief_range_schematic')
            researched_fiefs[fid] = props
    # Membership amendments happen before emitting all related surfaces.
    for f in features:
        p=f['properties'];pid=p.get('entity_id')
        if pid in prototypes and p['layer'] in ('prefecture_areas','prefecture_boundaries','member_boundaries'):
            prototype=prototypes[pid]
            for key in ('fief_id','member_role','membership_evidence','display_name'):
                if key in prototype:p[key]=prototype[key]
            if p.get('fief_id') and p['layer']=='prefecture_boundaries':p['layer']='member_boundaries'
    emitted_fiefs = set()
    for f in source:
        p = f['properties']
        if p['layer'] != 'kingdom_areas':
            continue
        if p.get('fief_id') in researched_fiefs:
            p = researched_fiefs[p['fief_id']]
        members = [pid for pid in p.get('member_entity_ids', []) if pid in final and not final[pid].is_empty
                   and prototypes[pid].get('fief_id') == p.get('fief_id')]
        if not members:
            continue
        emitted_fiefs.add(p.get('fief_id'))
        add(clean(unary_union([final[pid] for pid in members])), dict(p, member_entity_ids=members,
            geometry_status='completed_prefecture_kingdom_union',
            source=str(p.get('source', ''))+'；成员郡界按原图疆域和本年内部控制变化补齐',
            notes=list(p.get('notes', []))+['成员郡的补齐段属于推定行政范围；封国边界继承相同不确定性。']))
    for fid,p in researched_fiefs.items():
        if fid not in emitted_fiefs:
            add(clean(unary_union([final[pid] for pid in p['member_entity_ids']])),dict(p,
                geometry_status='original_priority_restored_multi_prefecture_kingdom'))
            emitted_fiefs.add(fid)
    for pid in restored:
        p = prototypes[pid]
        if p.get('fief_id') and p['fief_id'] not in emitted_fiefs and not final[pid].is_empty:
            add(final[pid], dict(p, layer='kingdom_areas', member_entity_ids=[pid],
                geometry_status='restored_single_prefecture_kingdom', notes=['本年有效郡级封国；原图域内按完整原郡范围与本年内部控制变化补齐。']))
            emitted_fiefs.add(p['fief_id'])

    # Point selection is independent of political masks. A CHGIS point is not
    # deleted or snapped because coarse video colour or the image shore misses
    # it; internal non-Jin control changes only its role and active Jin link.
    active_points = set()
    for f in source:
        p = f['properties']
        if p['layer'] in AREA_LAYERS:
            continue
        g = shape(f['geometry'])
        if g.geom_type == 'Point':
            if p['layer'].endswith('_seats'):
                continue  # Seats below are rebuilt from the dated CHGIS index.
            if not box(*PRESENTATION['extent']).covers(g):
                continue
        add(g, dict(p))
    kept_dated_points, points_in_other_control, points_outside_original = 0, 0, 0
    display_box = box(*PRESENTATION['extent'])
    for f in annual_points:
        g, p = shape(f['geometry']), dict(f['properties'])
        # The fixed map space suppresses countries outside the user's scope;
        # its small margin retains genuine CHGIS coastal location conflicts.
        if not display_box.covers(g):
            continue
        kept_dated_points += 1
        p.update(source_policy=SOURCE_POLICY['version'], coordinate_source=p.get('source'),
                 source_priority=p.get('point_source_priority'),
                 control_source=SOURCE_POLICY['control_source'],
                 administrative_record_year=year, administrative_yearbook_entity_id=p.get('entity_id'))
        if others.covers(g):
            points_in_other_control += 1
            p.update(source_entity_id=p.get('entity_id'), entity_id=None,
                     layer='reference_'+p['layer'], is_reference=True,
                     control_status='non_jin_video_control', political_control_is_separate=True,
                     reference_reason='本年CHGIS治所与年表行政记录；政治控制色块为非晋，坐标保留且不计西晋实际控制建置。')
        else:
            p.update(control_status='original_jin_domain', political_control_is_separate=True)
        if not domain.covers(g):
            points_outside_original += 1
            p.update(coordinate_footprint_conflict='点坐标在原图面外；保留同年CHGIS/原图来源坐标，不移动点也不据此扩张州郡面。')
        active_points.add((p.get('level'), tuple(g.coords[0])))
        add(g, p)
    kept_unlinked_points = 0
    for f in unlinked_points:
        g, p = shape(f['geometry']), dict(f['properties'])
        if not domain.covers(g) or (p.get('level'),tuple(g.coords[0])) in active_points:
            continue
        kept_unlinked_points += 1
        p.update(source_policy=SOURCE_POLICY['version'], source_priority='current_CHGIS_unlinked_reference',
                 coordinate_source=p.get('source'), control_source=SOURCE_POLICY['control_source'],
                 control_status='non_jin_video_control' if others.covers(g) else 'original_jin_domain')
        active_points.add((p.get('level'), tuple(g.coords[0])))
        add(g, p)
    for ref in snapshot['refs']:
        g = clean(ref['geometry'].intersection(others))
        if g.is_empty:
            continue
        pid = ref['pid']
        row = rows['prefecture'].get(pid)
        title = row['name'] if row else annual.key(ref['name']) + ('郡' if ref['name'] else '')
        add(g, dict(id=ref['id'], layer='reference_prefecture_areas', level='prefecture', name=title,
                    display_name=title, base_name=ref['name'], entity_id=None, source_entity_id=pid,
                    state_id=reference.historical_state(ref['sid'], year, entities), year=year,
                    is_reference=True, reference_year=year, source=ref['source'],
                    geometry_status='non_jin_reference_administrative_geography',
                    coordinate_role='reference_administrative_area_schematic',
                    source_priority='reviewed_original_image_areas', source_policy=SOURCE_POLICY['version'],
                    footprint_source=SOURCE_POLICY['footprint_source'], control_source=SOURCE_POLICY['control_source'],
                    reference_reason='原图域内其他政权控制区；仅保留旧图政区地理参照，不宣称仍属于西晋或本年仍设此郡',
                    boundary_evidence='289/308原图行政地理参照'))
    for point in snapshot['points']:
        g = point['geometry']
        if not others.covers(g) or (point['level'], tuple(g.coords[0])) in active_points:
            continue
        p = point['properties']
        title = p.get('name', '')
        add(g, dict(id=point['id'], layer=f"reference_{point['level']}_seats", level=point['level'],
                    name=title, display_name=title, entity_id=None, source_entity_id=point['eid'], year=year,
                    is_reference=True, reference_year=year, source=p.get('source'), source_id=p.get('source_id'),
                    coordinate_role='reference_administrative_seat', show_label=point['level'] == 'county',
                    reference_reason='其他政权内的旧图治所参照；不计入西晋本年建置'))

    for f in political:
        p = dict(f.get('properties', {}))
        p.update(layer='regime_areas', level='regime', year=year, is_jin=is_jin(p),
                 name=p.get('regime') or p.get('name') or '待识别政权',
                 source=p.get('source') or '史图馆视频年末地图配准试验',
                 geometric_certainty='inferred', coordinate_role='political_control_area')
        g = clean(shape(f['geometry']))
        add(g, p)
        if not p['is_jin']:
            # Shared internal control lines only. The original outer line
            # below owns every shore and outside border, once.
            line = g.boundary.difference(domain.boundary.buffer(2*GRID))
            if not line.is_empty:
                add(line, dict(p, layer='regime_boundaries', coordinate_role='political_boundary',
                    geometry_status='internal_control_boundary_lines',
                    original_outer_boundary_excluded=True))
    add(domain.boundary, dict(layer='original_territory_boundary', level='territory', year=year,
        name='原图疆域与海岸线', display_name='原图疆域与海岸线', entity_id=None,
        source='原上传图片矢量GIS完整州面联合的疆域与海岸线',
        source_priority='reviewed_original_image_areas', source_policy=SOURCE_POLICY['version'],
        footprint_source=SOURCE_POLICY['footprint_source'], control_source=None,
        video_outer_boundary_used=False, coordinate_role='original_geographic_outline',
        geometry_status='original_footprint_boundary_only'))

    actual_union = clean(unary_union([g for g in final.values() if not g.is_empty]))
    overlap = sum(g.area for g in final.values()) - actual_union.area
    unfilled = clean(jin.difference(actual_union))
    outside = clean(actual_union.difference(jin))
    if unfilled.area > EPSILON or outside.area > EPSILON or overlap > EPSILON:
        raise ValueError(f'{year}: completion failed: unfilled={unfilled.area}, '
                         f'outside_jin={outside.area}, prefecture_overlap={overlap}')
    rules = json.loads((ROOT / 'data/jin-fief-research/annual-territory-rules.json').read_text())['rules']
    before = original_gap_report(year, snapshot, source, rows, rules)
    legacy_reference_union = clean(unary_union([ref['geometry'] for ref in snapshot['refs']]))
    completed_domain = clean(jin.difference(initial_occupied))
    completed_inside_old = clean(completed_domain.intersection(legacy_reference_union))
    expanded_beyond_old = clean(completed_domain.difference(legacy_reference_union))
    control_conflicts = []
    for ref in snapshot['refs']:
        if not ref['pid']:
            continue
        ctl = annual.effective_control(dict(id=ref['pid'], level='prefecture', state_id=ref['sid']), year, rules)
        if ctl['status'] not in ('lost', 'enemy', 'withdrawn', 'external'):
            continue
        retained = clean(ref['geometry'].intersection(jin))
        if retained.area > .0005:
            control_conflicts.append(dict(reference_prefecture_id=ref['pid'], name=ref['name'],
                prior_control_status=ctl['status'], prior_reason=ctl.get('reason'),
                area_inside_original_jin_domain_degrees_squared=round(retained.area, 7),
                explanation='原图优先范围减本年内部控制变化后与此前失陷规则相交；保留来源冲突，不据此宣称考证结论。'))
    clipped_prefectures = []
    for pid, g in original.items():
        clipped = clean(g.difference(jin))
        if clipped.area > .0005:
            clipped_prefectures.append(dict(entity_id=pid, name=prototypes[pid]['name'],
                area_outside_original_jin_domain_degrees_squared=round(clipped.area, 7),
                explanation='此前年度郡面与本轮原图优先晋域不重合；可能是本年内部控制变化或原图示意差异。'))
    report = dict(year=year, source_original_gap=before,
                  political_input_overlap_area_degrees_squared=round(political_overlap.area, 9),
                  nominal_affiliate_overlap_jin_area_degrees_squared=round(affiliate_overlap.area, 9),
                  input_political_overlap_pairs=sorted(overlap_pairs, key=lambda row: row['area_degrees_squared'], reverse=True),
                  political_precedence='原图完整疆域与海岸优先；仅原图域内具名孙吴、汉成、起兵等控制变化扣出无色区',
                  source_policy=SOURCE_POLICY, original_domain_area_degrees_squared=round(domain.area,7),
                  display_domain_extends_beyond_original=False,
                  video_jin_domain_difference_degrees_squared=round(raw_video_jin.symmetric_difference(jin).area,7),
                  excluded_outside_study_regimes=sorted(set(excluded_regimes)),
                  video_regime_scope_assessments=control_assessments,
                  original_internal_seam_holes_filled=stable.get('original_internal_seam_holes_filled',0),
                  original_internal_seam_hole_area_degrees_squared=round(stable.get('original_internal_seam_hole_area',0),9),
                  current_CHGIS_area_count=len(current_chgis_areas),
                  current_CHGIS_areas=[dict(prefecture_id=e['prefecture_id'],state_id=e['state_id'],
                    source_id=e['record']['source_id'],begin=e['record']['begin'],end=e['record']['end']) for e in current_chgis_areas],
                  point_selection=point_report,
                  retained_dated_seats=kept_dated_points, retained_unlinked_CHGIS_reference_seats=kept_unlinked_points,
                  dated_seats_in_non_jin_control=points_in_other_control,
                  dated_points_outside_original_area_retained=points_outside_original,
                  original_outer_boundary_features=1,
                  explicit_dated_county_parent_amendments=county_parent_amendments,
                  jin_area_degrees_squared=round(jin.area, 7),
                  initial_annual_prefecture_area_inside_jin_degrees_squared=round(initial_occupied.area, 7),
                  completed_area_degrees_squared=round(jin.area-initial_occupied.area, 7),
                  filled_old_reference_gaps_degrees_squared=round(completed_inside_old.area, 7),
                  added_beyond_old_reference_degrees_squared=round(expanded_beyond_old.area, 7),
                  unfilled_jin_area_degrees_squared=round(unfilled.area, 9),
                  unpainted_jin_area_degrees_squared=0,
                  numerical_overlay_tolerance_degrees_squared=EPSILON,
                  numerical_slivers_have_full_jin_background=True,
                  outside_jin_prefecture_area_degrees_squared=round(outside.area, 9),
                  prefecture_overlap_area_degrees_squared=round(max(0, overlap), 9),
                  stored_annual_overlap_removed_degrees_squared=round(initial_overlap_removed, 9),
                  allocation_count=len(assignments), internally_used_county_cells=county_cells_used,
                  province_boundary_model=stable['model'], stable_reference_year=stable['reference_year'],
                  province_boundaries_are_shared_lines_only=True,
                  province_shared_boundary_features=sum(f['properties']['layer']=='province_boundaries' for f in features),
                  source_province_overlap_removed_degrees_squared=round(stable['source_overlap_removed'], 9),
                  whole_prefecture_province_transfers=stable['whole_prefecture_transfers'],
                  restored_dated_prefecture_ids=restored,
                  unresolved_context_province_ids=[sid for sid in stable_masks if sid not in rows['state']],
                  reviewed_province_interior_change_degrees_squared=round(sum(clean(g.intersection(jin).difference(stable_masks[sid])).area for sid,g in stable['reviewed_masks'].items() if sid in stable_masks), 9),
                  methods=dict(collections.Counter(row['method'] for row in assignments)),
                  prior_control_conflicts=control_conflicts,
                  annual_prefecture_parts_clipped=sorted(clipped_prefectures,
                      key=lambda row: row['area_outside_original_jin_domain_degrees_squared'], reverse=True),
                  assignments=assignments,
                  limitation='面积为WGS84平方度，仅用于本次几何前后对照；归属拟合不是独立行政边界考证。')
    coverage = dict(source_coverage,
                    prefecture_areas=sum(f['properties']['layer']=='prefecture_areas' and not f['properties'].get('is_context') for f in features),
                    context_prefecture_areas=sum(f['properties']['layer']=='prefecture_areas' and bool(f['properties'].get('is_context')) for f in features),
                    counties_located=sum(f['properties']['layer']=='county_seats' for f in features),
                    states_drawn=sum(sid in rows['state'] and not rows['state'][sid]['phase'].get('lapsed_state_context') for sid in stable_masks),
                    context_states_drawn=sum(bool(sid not in rows['state'] or rows['state'][sid]['phase'].get('lapsed_state_context')) for sid in stable_masks),
                    feature_count=len(features), source_annual_feature_count=source_coverage.get('feature_count'),
                    kingdom_areas=sum(f['properties']['layer']=='kingdom_areas' for f in features),
                    completion_allocation_count=len(assignments), completion_unfilled_area=round(unfilled.area, 9))
    return dict(type='FeatureCollection', year=year, trial=True, coverage=coverage, meta=dict(meta,source_policy=SOURCE_POLICY),
                presentation=PRESENTATION, source_policy=SOURCE_POLICY,
                provenance=dict(method='original_priority_stable_province_dated_prefecture_completion',
                                original_annual_data_preserved=True, county_boundaries_displayed=False,
                                source_policy=SOURCE_POLICY,
                                province_boundary_model=stable['model'],
                                province_boundaries_are_shared_lines_only=True,
                completion_inferred=True), features=features), report


def pack_browser_graphs(trials, output):
    """Publish small typed JSON graphs; local GeoJSON remains self-contained.

    Repeated prefecture areas/boundaries, province areas/boundaries/territory,
    and single-prefecture kingdoms share one geometry. Topology-safe precision
    reduction is for public display only and is sub-metre at this latitude;
    political frame georeferencing is much coarser. One graph's lazy downloads
    never include geometries used exclusively by the other year.
    """
    registry, raw_cache, slices = {}, {}, {}
    def rounded(value):
        if isinstance(value, (list, tuple)):
            return [rounded(item) for item in value]
        if isinstance(value, dict):
            return {key: rounded(item) for key, item in value.items()}
        if isinstance(value, float):
            result = round(value, 6)
            return 0.0 if result == 0 else result
        return value
    for year, trial in sorted(trials.items()):
        features = []
        for f in trial['features']:
            raw = json.dumps(f['geometry'], separators=(',', ':'))
            if raw not in raw_cache:
                input_geometry = shape(f['geometry'])
                geom = input_geometry if input_geometry.geom_type == 'Point' else set_precision(input_geometry, .000001, mode='valid_output')
                if geom.is_empty:
                    raw_cache[raw] = None
                else:
                    # CHGIS source points retain every source digit. Polygon
                    # display precision never becomes a point relocation.
                    value = mapping(geom) if geom.geom_type == 'Point' else rounded(mapping(normalize(geom)))
                    canonical = json.dumps(value, separators=(',', ':'), sort_keys=True)
                    gid = 'g' + hashlib.sha256(canonical.encode()).hexdigest()[:16]
                    registry.setdefault(gid, value)
                    raw_cache[raw] = gid
            gid = raw_cache[raw]
            if gid:
                features.append(dict(geometry_id=gid, properties=f['properties']))
        slices[year] = dict(type='JinVideoGeometryGraph', version=1, year=year,
                           trial=True, features=features, coverage=trial['coverage'], meta=trial['meta'],
                           presentation=trial.get('presentation'), source_policy=trial.get('source_policy'),
                           provenance=dict(trial['provenance'], public_coordinate_precision=6,
                                           public_geometry_topology_snap_degrees=.000001,
                                           self_contained_geojson_is_local_delivery=True))
    # Cheap point coordinates belong in each slice. Larger polygons are shared
    # through content-named files, avoiding stale cache collisions on revisions.
    inline = {gid: g for gid, g in registry.items() if g['type'] == 'Point'}
    remaining = {gid: g for gid, g in registry.items() if gid not in inline}
    usage = collections.defaultdict(set)
    for year, sliced in slices.items():
        for f in sliced['features']:
            usage[f['geometry_id']].add(year)
    output.mkdir(parents=True, exist_ok=True)
    shards, shard_by_name, common_shard_for, year_shard_for = [], {}, {}, {}
    limit = 575000
    sizes = {gid: len(json.dumps({gid: geometry}, separators=(',', ':')).encode())+1
             for gid, geometry in remaining.items()}
    if max(sizes.values(), default=0) > limit:
        raise ValueError('A single display geometry exceeds the shard budget.')

    def write_shard(values, family):
        payload = dict(version=1, geometries=values)
        raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n'
        name = f'geometry-{family}-' + hashlib.sha256(raw.encode()).hexdigest()[:16] + '.json'
        if name in shard_by_name:
            return shard_by_name[name]['url']
        path = output / name
        annual.write_json(path, payload)
        if path.stat().st_size > 600000:
            raise ValueError(f'Browser geometry shard exceeds 600 KB: {path}')
        url = str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)
        entry = dict(url=url, bytes=path.stat().st_size, geometry_count=len(values), family=family)
        shards.append(entry)
        shard_by_name[name] = entry
        return url

    # Widely reused geometry is balanced across five common files. Everything
    # else is packed from the exact geometries of one year; these rare files can
    # repeat geometry across years to keep an annual view below 12 requests.
    # Equal complete file contents still share one content-addressed URL.
    common = {gid for gid in remaining if len(usage[gid]) >= 15}
    common_bins, weights = [dict() for _ in range(5)], [0]*5
    for gid in sorted(common, key=lambda gid: (-sizes[gid], gid)):
        target = min(range(5), key=lambda i: weights[i])
        common_bins[target][gid] = remaining[gid]
        weights[target] += sizes[gid]
    for values in common_bins:
        if not values:
            continue
        url = write_shard(values, 'common')
        for gid in values:
            common_shard_for[gid] = url
    for year, sliced in sorted(slices.items()):
        gids = {f['geometry_id'] for f in sliced['features']}
        mapping_for_year, values, size = {}, {}, 40
        def flush_year():
            nonlocal values, size
            if values:
                url = write_shard(values, 'rare')
                for gid in values:
                    mapping_for_year[gid] = url
                values, size = {}, 40
        for gid in sorted(gids-inline.keys()-common):
            if values and size+sizes[gid] > limit:
                flush_year()
            values[gid] = remaining[gid]
            size += sizes[gid]
        flush_year()
        year_shard_for[year] = mapping_for_year
    manifest = dict(type='JinVideoGeometryGraphIndex', version=1, crs='EPSG:4326',
                    coordinate_precision=6, geometry_shards=shards, years={},
                    geometry_packing='five_common_shards_and_exact_per_year_rare_shards',
                    common_usage_threshold_years=15, rare_geometry_copies_allowed=True,
                    geometry_duplicate_copies=sum(s['geometry_count'] for s in shards)-len(remaining))
    for year, sliced in sorted(slices.items()):
        gids = {f['geometry_id'] for f in sliced['features']}
        sliced['geometries'] = {gid: inline[gid] for gid in sorted(gids) if gid in inline}
        urls = sorted({common_shard_for[gid] for gid in gids if gid in common_shard_for} | set(year_shard_for[year].values()))
        if len(urls) > 16:
            raise ValueError(f'{year}: yearly geometry download needs {len(urls)} files, limit 16.')
        sliced['geometry_urls'] = urls
        path = output / f'{year}.json'
        annual.write_json(path, sliced)
        download_bytes = path.stat().st_size + sum(s['bytes'] for s in shards if s['url'] in urls)
        manifest['years'][str(year)] = dict(data_url=str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
                                          bytes=path.stat().st_size, geometry_urls=urls,
                                          download_bytes=download_bytes,
                                          coverage=sliced['coverage'])
        print(f'{year}: public graph + required geometries {download_bytes / 1_000_000:.2f} MB, '
              f'{len(urls)} shards (each <600 KB)', flush=True)
    annual.write_json(output / 'graph.json', manifest)
    for path in [output / 'graph.json', *[output / f'{year}.json' for year in slices],
                 *[output / Path(s['url']).name for s in shards],
                 *[output / f'{year}-completion-report.json' for year in slices],
                 output / 'completion-report.json']:
        if not path.exists():
            continue
        compressed = path.with_suffix(path.suffix + '.gz')
        with compressed.open('wb') as handle:
            handle.write(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
    # Only files owned by this generator are removed; the source videos,
    # political masks, and old maps live elsewhere and are untouched.
    keep = {Path(s['url']).name for s in shards}
    for path in output.glob('geometry-*.json'):
        if path.name not in keep:
            path.unlink()
    for path in output.glob('geometry-*.json.gz'):
        if path.name[:-3] not in keep:
            path.unlink()
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--territories', type=Path, required=True,
                        help='WGS84 FeatureCollection with year + regime + is_jin political polygons')
    parser.add_argument('--years', type=int, nargs='+', default=list(range(266,317)))
    parser.add_argument('--output', type=Path, default=ROOT / 'data/jin-maps/source-priority-annual')
    parser.add_argument('--local-output', type=Path, default=ROOT / 'work/jin-video/source-priority-final-gis',
                        help='Self-contained real GeoJSON for local GIS delivery, separate from public JSON graphs')
    parser.add_argument('--workers', type=int, default=1,
                        help='Independent yearly geometry workers; 4 for the full annual build')
    parser.add_argument('--repack-only', action='store_true',
                        help='Refresh source-policy metadata and public graphs without rerunning annual geometry')
    args = parser.parse_args()
    if args.repack_only:
        replacements={'area_inside_video_jin_degrees_squared':'area_inside_original_jin_domain_degrees_squared',
                      'area_outside_video_jin_degrees_squared':'area_outside_original_jin_domain_degrees_squared'}
        def refresh(value):
            if isinstance(value,dict):
                return {replacements.get(k,k):refresh(v) for k,v in value.items()}
            if isinstance(value,list):return [refresh(v) for v in value]
            if isinstance(value,str):
                return value.replace('视频晋域','原图疆域与本年内部控制区').replace(
                    '视频配准试验晋域与此前失陷规则相交；依用户要求着色补齐，但保留两源冲突，不据此宣称考证结论。',
                    '原图优先范围减本年内部控制变化后与此前失陷规则相交；保留来源冲突，不据此宣称考证结论。')
            return value
        trials,reports={},{}
        for year in args.years:
            trial=refresh(json.loads((args.local_output/f'{year}.geojson').read_text()))
            report=refresh(json.loads((args.local_output/f'{year}-completion-report.json').read_text()))
            trial.update(source_policy=SOURCE_POLICY,presentation=PRESENTATION)
            trial['meta']['source_policy']=SOURCE_POLICY
            trial['provenance']['source_policy']=SOURCE_POLICY
            report['source_policy']=SOURCE_POLICY
            for feature in trial['features']:
                p=feature['properties']
                if p['layer'] in ('prefecture_areas','prefecture_boundaries','member_boundaries'):
                    p.setdefault('prior_control_status',p.get('control_status'))
                    if p.get('control_reason'):p['prior_control_reason']=p.pop('control_reason')
                    p.update(control_status='original_jin_domain_minus_internal_control_changes',
                             political_control_is_separate=True)
                if p.get('source_policy'):p['source_policy']=SOURCE_POLICY['version']
            annual.write_json(args.local_output/f'{year}.geojson',trial)
            annual.write_json(args.local_output/f'{year}-completion-report.json',report,compact=False)
            public_report={k:v for k,v in report.items() if k not in ('assignments','annual_prefecture_parts_clipped','prior_control_conflicts')}
            annual.write_json(args.output/f'{year}-completion-report.json',public_report,compact=False)
            reports[str(year)]={k:v for k,v in report.items() if k!='assignments'}
            trials[year]=trial
        annual.write_json(args.output/'completion-report.json',reports,compact=False)
        pack_browser_graphs(trials,args.output)
        return
    territories = json.loads(args.territories.read_text())
    if territories.get('type') != 'FeatureCollection':
        raise ValueError('Political input must be a GeoJSON FeatureCollection in WGS84.')
    data = annual.load_js(ROOT / 'data/jin-data.js')
    snapshots = reference.read_snapshots(annual.all_entities(data))
    chgis, _ = annual.read_chgis(Path.home() / 'Downloads/CHGIS数据.zip')
    points = point_priority.get_index(data, annual=annual, chgis=chgis)
    chgis_areas = chgis.get('prefecture_area', [])
    reports, trials = {}, {}
    def save_result(year, trial, report):
        trials[year] = trial
        annual.write_json(args.local_output / f'{year}.geojson', trial)
        annual.write_json(args.local_output / f'{year}-completion-report.json', report, compact=False)
        public_report = {key: value for key, value in report.items() if key not in ('assignments','annual_prefecture_parts_clipped','prior_control_conflicts')}
        annual.write_json(args.output / f'{year}-completion-report.json', public_report, compact=False)
        reports[str(year)] = {key: value for key, value in report.items() if key != 'assignments'}
        print(f'{year}: completed {report["completed_area_degrees_squared"]} square degrees; '
              f'{report["allocation_count"]} inferred allocations; no uncovered Jin interior', flush=True)
    if args.workers > 1:
        with ProcessPoolExecutor(max_workers=args.workers, initializer=initialize_worker,
                                 initargs=(territories['features'], data, snapshots, points, chgis_areas)) as executor:
            futures = {executor.submit(generate_worker, year): year for year in args.years}
            failures = []
            for future in as_completed(futures):
                try:
                    save_result(*future.result())
                except Exception as error:
                    failures.append((futures[future], str(error)))
                    print(f'{futures[future]}: generation failed: {error}', flush=True)
        if failures:
            raise RuntimeError(f'Annual geometry failures: {failures}')
    else:
        for year in args.years:
            print(f'{year}: completing dated prefectures in the original image domain with internal political changes', flush=True)
            trial, report = complete_year(year, territories['features'], data, snapshots[289 if year <= 290 else 308], points, chgis_areas)
            save_result(year, trial, report)
    annual.write_json(args.output / 'completion-report.json', reports, compact=False)
    pack_browser_graphs(trials, args.output)


if __name__ == '__main__':
    main()
