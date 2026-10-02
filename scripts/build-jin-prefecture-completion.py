#!/usr/bin/env python3
"""Complete only the 289/308 trial prefectures inside a supplied Jin mask.

The supplied political polygons, already georeferenced to WGS84, decide where
Jin ends. Existing annual county cells remain inputs; they are never displayed
or asserted to be observed county boundaries. Gaps are assigned to still-active
prefectures by dated county membership and the older administrative image,
then by neighbouring prefectures in the same dated province. Every added part
is disclosed as an inferred cartographic allocation, not a historical finding.
The original annual and 289/308 snapshot data are never rewritten.
Requires Shapely >= 2.1, as does build-jin-annual-geography.py.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path

from shapely import normalize, set_precision, voronoi_polygons
from shapely.geometry import MultiPoint, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reference', ROOT / 'scripts/build-jin-reference-geography.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
annual = reference.annual

GRID = .000001
EPSILON = .00000002
AREA_LAYERS = {'territory', 'province_areas', 'province_boundaries', 'prefecture_areas',
               'prefecture_boundaries', 'member_boundaries', 'kingdom_areas',
               'county_areas', 'county_boundaries'}


def clean(geometry):
    # Preserve the exact same noded coordinates through all partitions. Repeated
    # rounding of independently clipped neighbours can itself create hairline
    # overlaps or white seams. Precision reduction belongs to input extraction,
    # before the political masks and all administrative parts are partitioned.
    return annual.polygonal(geometry)


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


def complete_year(year, political_features, data=None, snapshot=None):
    """Public reusable API: inputs are WGS84 Feature dictionaries for one year."""
    if year not in (289, 308):
        raise ValueError('This reversible trial is limited to 289 and 308.')
    source, source_coverage, meta = load_annual(year)
    data = data or annual.load_js(ROOT / 'data/jin-data.js')
    entities = annual.all_entities(data)
    rows = annual.rows_for(data, year)
    snapshot = snapshot or reference.read_snapshots(entities)[year]
    political = [f for f in political_features if int(f.get('properties', {}).get('year', year)) == year]
    for f in political:
        g = shape(f['geometry'])
        if g.is_empty:
            continue
        west, south, east, north = g.bounds
        if not all(math.isfinite(v) for v in g.bounds) or not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
            raise ValueError('Political polygons must already be georeferenced WGS84 longitude/latitude, not video pixels.')
    jin_parts = [shape(f['geometry']) for f in political if is_jin(f.get('properties', {}))]
    if not jin_parts:
        raise ValueError(f'No political polygon identifies {year} Jin territory.')
    jin = clean(unary_union(jin_parts))
    # Other independent polity polygons take priority. A nominal Western
    # Regions affiliate is a distinct outside layer, not an enemy polygon that
    # should cut real Hexi/Jin land away: main Jin takes priority over affiliates.
    other_parts = [shape(f['geometry']) for f in political
                   if not is_jin(f.get('properties', {})) and not is_affiliate(f.get('properties', {}))]
    others = clean(unary_union(other_parts)) if other_parts else Polygon()
    affiliate_parts = [shape(f['geometry']) for f in political if is_affiliate(f.get('properties', {}))]
    affiliates = clean(unary_union(affiliate_parts)) if affiliate_parts else Polygon()
    political_overlap = clean(jin.intersection(others))
    affiliate_overlap = clean(jin.intersection(affiliates))
    overlap_pairs = []
    for f in political:
        p = f.get('properties', {})
        if is_jin(p):
            continue
        overlap = clean(jin.intersection(shape(f['geometry'])))
        if overlap.area > EPSILON:
            overlap_pairs.append(dict(regime=p.get('regime') or p.get('name'), kind=p.get('kind'),
                area_degrees_squared=round(overlap.area, 8),
                precedence='main_jin' if is_affiliate(p) else 'other_independent_regime'))
    jin = clean(jin.difference(others))
    if jin.is_empty:
        raise ValueError(f'{year} Jin mask is empty after other polity precedence.')

    prototypes, original, final = {}, {}, {}
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
        # Annual prefectures were already partitioned without overlap by their
        # original generator. Clip them together, rather than rebuilding the
        # entire national union after each small prefecture.
        part = clean(original[pid].intersection(jin))
        final[pid] = part
    # The stored annual geometries are individually rounded at serialization;
    # neighbouring edges can therefore retain tiny overlapping slivers. Remove
    # them using only nearby earlier prefectures, preserving their established
    # priority without repeatedly constructing a full national union.
    pref_ids = list(final)
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
    if not prototypes:
        raise ValueError(f'No active annual prefectures provide administrative seeds in {year}.')

    # A point is used only when its dated yearbook row has an active parent.
    # The original point is a reference coordinate; membership is annual.
    county_seeds = []
    for point in snapshot['points']:
        if point['level'] != 'county':
            continue
        county = rows['county'].get(point['eid'])
        if county and county['prefecture_id'] in prototypes:
            county_seeds.append((county['prefecture_id'], point['geometry'], point['eid']))
    prefecture_seats = {f['properties']['entity_id']: shape(f['geometry']) for f in source
                        if f['properties']['layer'] == 'prefecture_seats' and f['properties']['entity_id'] in prototypes}
    # Prefer source pref shapes for nearby allocation, even when the mask clips
    # a prefecture to zero; don't spread that geometry across the map.
    seed_shapes = dict(original)
    assignments, allocation_parts = [], collections.defaultdict(list)
    county_cells_used = 0

    def assign(gap, ref=None):
        if gap.is_empty:
            return
        ref_pid = ref['pid'] if ref else None
        sid = reference.historical_state(ref['sid'], year, entities) if ref else None
        seeds = [(pid, point) for pid, point, cid in county_seeds if gap.covers(point)]
        parent_ids = {pid for pid, point in seeds}
        if seeds and (ref_pid not in prototypes or parent_ids != {ref_pid}):
            parts = partition_by_seeds(gap, seeds)
            method = 'dated_county_parent_reference_seat_partition'
            evidence = '本年年表县的父郡关系；289/308参考县治分区。分区不是史料县界。'
        elif ref_pid in prototypes:
            parts = {ref_pid: gap}
            method = 'active_prefecture_reference_compartment'
            evidence = '原图对应郡本年仍有效；把该郡轮廓与年度郡面之间的缺口附回同郡。'
        else:
            candidates = [pid for pid, p in prototypes.items() if sid and p.get('state_id') == sid]
            same_state = bool(candidates)
            if not candidates:
                candidates = list(prototypes)
            anchor = gap.representative_point()
            nearby = sorted(candidates, key=lambda pid: seed_shapes[pid].distance(gap))
            adjacent = [pid for pid in nearby if seed_shapes[pid].distance(gap) < GRID * 3]
            if not adjacent:
                # A missing/abolished reference compartment can be large. Keep
                # its inferred attribution local using up to three nearby seeds.
                adjacent = sorted(nearby, key=lambda pid: scaled_distance(
                    anchor, nearest_points(anchor, seed_shapes[pid])[1]))[:3]
            chosen_seeds = []
            for pid in adjacent:
                # Boundary anchors keep a small neighbouring gap local. A
                # prefecture seat can lie far across a long narrow province.
                seed = nearest_points(anchor, seed_shapes[pid])[1]
                chosen_seeds.append((pid, seed))
            parts = partition_by_seeds(gap, chosen_seeds)
            method = 'same_dated_state_neighbor_fit' if same_state else 'nearest_active_prefecture_fit'
            evidence = ('原郡本年不存在、原图待定或缺乏可定位县；优先本年同州邻郡，邻接范围按位置拟合。'
                        if same_state else '无可用原州归属或县治：附给最近仍有效郡，归属明确标为推定。')
        used = Polygon()
        for pid in sorted(parts):
            part = clean(parts[pid].difference(used))
            if part.is_empty:
                continue
            final[pid] = clean(unary_union([final[pid], part]))
            allocation_parts[pid].append(part)
            used = clean(unary_union([used, part]))
            assignments.append(dict(reference_id=ref['id'] if ref else None,
                                    reference_name=(ref['name'] or '原图未命名区') if ref else '视频晋域与行政参照之间的余部',
                                    reference_prefecture_id=ref_pid,
                                    assigned_prefecture_id=pid, assigned_prefecture_name=prototypes[pid]['name'],
                                    state_id=prototypes[pid].get('state_id'), method=method,
                                    evidence=evidence, certainty='inferred',
                                    area_degrees_squared=round(part.area, 7)))
        residual = clean(gap.difference(used))
        if not residual.is_empty:
            # Numerical partition residuals are not unpainted holes.
            pid = min(prototypes, key=lambda eid: seed_shapes[eid].distance(residual))
            final[pid] = clean(unary_union([final[pid], residual]))
            allocation_parts[pid].append(residual)
            assignments.append(dict(reference_id=ref['id'] if ref else None, reference_name='拟合分区余部',
                                    assigned_prefecture_id=pid, assigned_prefecture_name=prototypes[pid]['name'],
                                    state_id=prototypes[pid].get('state_id'), method='numerical_partition_residual',
                                    evidence='剩余碎片按最近有效郡附属，避免数值缝隙漏色。', certainty='inferred',
                                    area_degrees_squared=round(residual.area, 9)))

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
        if excess.is_empty:
            continue
        part = clean(excess.intersection(remaining_gap))
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
        # Treat a reference compartment as one administrative allocation.
        # Subpixel seam fragments should not trigger thousands of independent
        # nearest-neighbour fits or pretend to be distinct historical units.
        assign(gap, ref)
        remaining_gap = clean(remaining_gap.difference(gap))
    for part in components(remaining_gap):
        # Even land beyond the old schematic map needs a current province
        # candidate. Choose the nearest reference compartment, then retain its
        # dated parent province as a constraint. Exact ownership is not claimed.
        closest_ref = min(snapshot['refs'], key=lambda ref: ref['geometry'].distance(part)) if snapshot['refs'] else None
        assign(part, closest_ref)

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
        p = dict(prototypes[pid], year=year, geometry_status='video_mask_prefecture_completion',
                 political_mask_source='史图馆年末视频帧的配准试验', political_control_reference='video_mask',
                 geometric_certainty='inferred', coordinate_role='administrative_area_schematic')
        added = clean(unary_union(allocation_parts[pid])) if allocation_parts[pid] else Polygon()
        if not added.is_empty:
            methods = sorted({a['method'] for a in assignments if a['assigned_prefecture_id'] == pid})
            p.update(completion_inferred=True, completion_methods=methods,
                     completion_area_degrees_squared=round(added.area, 7),
                     boundary_evidence='缺口依本年县属、旧图郡域和同州邻郡补齐；新增段为拟合，非独立考证的真实边界',
                     notes=list(p.get('notes', []))+['视频晋域内的原白洞已归入本年有效郡；补齐段标为推定，不显示拟合县界。'])
        add(g, p)
        add(g, dict(p, layer='member_boundaries' if p.get('fief_id') else 'prefecture_boundaries', coordinate_role='boundary'))
        state_parts[p['state_id']].append(g)
    for sid, parts in sorted(state_parts.items()):
        g = clean(unary_union(parts))
        p = dict(source_states.get(sid, {}), layer='province_areas', year=year,
                 source='当年有效郡＋视频晋域内推定补齐范围', geometry_status='completed_annual_prefecture_union',
                 geometric_certainty='inferred', coordinate_role='administrative_area_schematic')
        add(g, p)
        add(g, dict(p, layer='province_boundaries', coordinate_role='boundary'))
        add(g, dict(layer='territory', name='西晋视频年末控制范围', state_id=sid, level='territory', year=year,
                    source='史图馆配准试验；同年郡面补齐', geometric_certainty='inferred',
                    geometry_status='video_mask_administrative_partition', coordinate_role='territory_reference'))
    for f in source:
        p = f['properties']
        if p['layer'] != 'kingdom_areas':
            continue
        members = [pid for pid in p.get('member_entity_ids', []) if pid in final and not final[pid].is_empty]
        if not members:
            continue
        add(clean(unary_union([final[pid] for pid in members])), dict(p, member_entity_ids=members,
            geometry_status='completed_prefecture_kingdom_union',
            source=str(p.get('source', ''))+'；成员郡界按视频晋域补齐',
            notes=list(p.get('notes', []))+['成员郡的补齐段属于推定行政范围；封国边界继承相同不确定性。']))

    # Keep actual annual seats inside Jin. Reference seats and outlines may
    # remain in other polities but never inherit an active entity or fief fill.
    active_points = set()
    for f in source:
        p = f['properties']
        if p['layer'] in AREA_LAYERS:
            continue
        g = shape(f['geometry'])
        if g.geom_type == 'Point':
            if not jin.covers(g):
                continue
            active_points.add((p.get('level'), tuple(g.coords[0])))
        add(g, dict(p))
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
                    reference_reason='视频中其他政权的领土；仅保留旧图政区地理参照，不宣称仍属于西晋或本年仍设此郡',
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
        if p['is_jin']:
            g = clean(shape(f['geometry']).intersection(jin))
        elif is_affiliate(p):
            g = clean(shape(f['geometry']).difference(jin))
        else:
            g = clean(shape(f['geometry']))
        add(g, p)
        add(g, dict(p, layer='regime_boundaries', coordinate_role='political_boundary'))

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
                area_inside_video_jin_degrees_squared=round(retained.area, 7),
                explanation='视频配准试验晋域与此前失陷规则相交；依用户要求着色补齐，但保留两源冲突，不据此宣称考证结论。'))
    clipped_prefectures = []
    for pid, g in original.items():
        clipped = clean(g.difference(jin))
        if clipped.area > .0005:
            clipped_prefectures.append(dict(entity_id=pid, name=prototypes[pid]['name'],
                area_outside_video_jin_degrees_squared=round(clipped.area, 7),
                explanation='此前年度郡面与视频晋域不重合；可能是控制范围差异、配准误差或原图示意差异。'))
    report = dict(year=year, source_original_gap=before,
                  political_input_overlap_area_degrees_squared=round(political_overlap.area, 9),
                  nominal_affiliate_overlap_jin_area_degrees_squared=round(affiliate_overlap.area, 9),
                  input_political_overlap_pairs=sorted(overlap_pairs, key=lambda row: row['area_degrees_squared'], reverse=True),
                  political_precedence='独立他国优先于晋；主晋优先于西域名义附属范围，附属范围不合入中国州郡',
                  jin_area_degrees_squared=round(jin.area, 7),
                  initial_annual_prefecture_area_inside_jin_degrees_squared=round(initial_occupied.area, 7),
                  completed_area_degrees_squared=round(jin.area-initial_occupied.area, 7),
                  filled_old_reference_gaps_degrees_squared=round(completed_inside_old.area, 7),
                  added_beyond_old_reference_degrees_squared=round(expanded_beyond_old.area, 7),
                  unfilled_jin_area_degrees_squared=round(unfilled.area, 9),
                  outside_jin_prefecture_area_degrees_squared=round(outside.area, 9),
                  prefecture_overlap_area_degrees_squared=round(max(0, overlap), 9),
                  stored_annual_overlap_removed_degrees_squared=round(initial_overlap_removed, 9),
                  allocation_count=len(assignments), internally_used_county_cells=county_cells_used,
                  methods=dict(collections.Counter(row['method'] for row in assignments)),
                  prior_control_conflicts=control_conflicts,
                  annual_prefecture_parts_clipped=sorted(clipped_prefectures,
                      key=lambda row: row['area_outside_video_jin_degrees_squared'], reverse=True),
                  assignments=assignments,
                  limitation='面积为WGS84平方度，仅用于本次几何前后对照；归属拟合不是独立行政边界考证。')
    coverage = dict(source_coverage, prefecture_areas=sum(f['properties']['layer']=='prefecture_areas' for f in features),
                    counties_located=sum(f['properties']['layer']=='county_seats' for f in features),
                    states_drawn=len(state_parts), feature_count=len(features), source_annual_feature_count=source_coverage.get('feature_count'),
                    kingdom_areas=sum(f['properties']['layer']=='kingdom_areas' for f in features),
                    completion_allocation_count=len(assignments), completion_unfilled_area=round(unfilled.area, 9))
    return dict(type='FeatureCollection', year=year, trial=True, coverage=coverage, meta=meta,
                provenance=dict(method='video_mask_yearbook_prefecture_completion',
                                original_annual_data_preserved=True, county_boundaries_displayed=False,
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
                geom = set_precision(shape(f['geometry']), .000001, mode='valid_output')
                if geom.is_empty:
                    raw_cache[raw] = None
                else:
                    value = rounded(mapping(normalize(geom)))
                    canonical = json.dumps(value, separators=(',', ':'), sort_keys=True)
                    gid = 'g' + hashlib.sha256(canonical.encode()).hexdigest()[:16]
                    registry.setdefault(gid, value)
                    raw_cache[raw] = gid
            gid = raw_cache[raw]
            if gid:
                features.append(dict(geometry_id=gid, properties=f['properties']))
        slices[year] = dict(type='JinVideoGeometryGraph', version=1, year=year,
                           trial=True, features=features, coverage=trial['coverage'], meta=trial['meta'],
                           provenance=dict(trial['provenance'], public_coordinate_precision=6,
                                           public_geometry_topology_snap_degrees=.000001,
                                           self_contained_geojson_is_local_delivery=True))
    # Cheap point coordinates belong in each slice. Larger polygons are shared
    # through content-named files, avoiding stale cache collisions on revisions.
    inline = {gid: g for gid, g in registry.items() if g['type'] == 'Point'}
    remaining = {gid: g for gid, g in registry.items() if gid not in inline}
    shards, shard_for, current, current_size = [], {}, {}, 40
    limit = 575000
    def flush():
        nonlocal current, current_size
        if not current:
            return
        payload = dict(version=1, geometries=current)
        raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n'
        ident = hashlib.sha256(raw.encode()).hexdigest()[:8]
        name = f'geometry-{len(shards)+1:03d}-{ident}.json'
        path = output / name
        annual.write_json(path, payload)
        if path.stat().st_size > 600000:
            raise ValueError(f'Browser geometry shard exceeds 600 KB: {path}')
        url = str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)
        shards.append(dict(url=url, bytes=path.stat().st_size, geometry_count=len(current)))
        for gid in current:
            shard_for[gid] = url
        current, current_size = {}, 40
    output.mkdir(parents=True, exist_ok=True)
    for gid, geometry in sorted(remaining.items()):
        size = len(json.dumps({gid: geometry}, separators=(',', ':')).encode()) + 1
        if size > limit:
            raise ValueError(f'A single browser geometry exceeds the shard budget: {gid}, {size} bytes')
        if current and current_size + size > limit:
            flush()
        current[gid] = geometry
        current_size += size
    flush()
    manifest = dict(type='JinVideoGeometryGraphIndex', version=1, crs='EPSG:4326',
                    coordinate_precision=6, geometry_shards=shards, years={})
    for year, sliced in sorted(slices.items()):
        gids = {f['geometry_id'] for f in sliced['features']}
        sliced['geometries'] = {gid: inline[gid] for gid in sorted(gids) if gid in inline}
        urls = sorted({shard_for[gid] for gid in gids if gid in shard_for})
        sliced['geometry_urls'] = urls
        path = output / f'{year}.json'
        annual.write_json(path, sliced)
        download_bytes = path.stat().st_size + sum(s['bytes'] for s in shards if s['url'] in urls)
        manifest['years'][str(year)] = dict(data_url=str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
                                          bytes=path.stat().st_size, geometry_urls=urls,
                                          download_bytes=download_bytes, coverage=sliced['coverage'])
        print(f'{year}: public graph + required geometries {download_bytes / 1_000_000:.2f} MB, '
              f'{len(urls)} shards (each <600 KB)', flush=True)
    annual.write_json(output / 'graph.json', manifest)
    # Only files owned by this generator are removed; the source videos,
    # political masks, and old maps live elsewhere and are untouched.
    keep = {Path(s['url']).name for s in shards}
    for path in output.glob('geometry-*.json'):
        if path.name not in keep:
            path.unlink()
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--territories', type=Path, required=True,
                        help='WGS84 FeatureCollection with year + regime + is_jin political polygons')
    parser.add_argument('--years', type=int, nargs='+', default=[289, 308])
    parser.add_argument('--output', type=Path, default=ROOT / 'data/jin-maps/video-trial-289-308')
    parser.add_argument('--local-output', type=Path, default=ROOT / 'work/jin-video/final-gis',
                        help='Self-contained real GeoJSON for local GIS delivery, separate from public JSON graphs')
    args = parser.parse_args()
    territories = json.loads(args.territories.read_text())
    if territories.get('type') != 'FeatureCollection':
        raise ValueError('Political input must be a GeoJSON FeatureCollection in WGS84.')
    data = annual.load_js(ROOT / 'data/jin-data.js')
    snapshots = reference.read_snapshots(annual.all_entities(data))
    reports, trials = {}, {}
    for year in args.years:
        print(f'{year}: completing dated prefectures inside the georeferenced video Jin mask', flush=True)
        trial, report = complete_year(year, territories['features'], data, snapshots[year])
        trials[year] = trial
        annual.write_json(args.local_output / f'{year}.geojson', trial)
        annual.write_json(args.output / f'{year}-completion-report.json', report, compact=False)
        reports[str(year)] = {key: value for key, value in report.items() if key != 'assignments'}
        print(f'{year}: completed {report["completed_area_degrees_squared"]} square degrees; '
              f'{report["allocation_count"]} inferred allocations; no uncovered Jin interior', flush=True)
    annual.write_json(args.output / 'completion-report.json', reports, compact=False)
    pack_browser_graphs(trials, args.output)


if __name__ == '__main__':
    main()
