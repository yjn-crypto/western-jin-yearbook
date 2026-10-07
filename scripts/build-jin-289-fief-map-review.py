#!/usr/bin/env python3
"""Build the small, dated map overlay for the user's 289-year fief review."""
import gzip
import hashlib
import json
from copy import deepcopy
from pathlib import Path

from shapely import normalize, set_precision
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / 'data/jin-maps/three-basemap-annual'
GRID = .000001
CHEN_COUNTIES = {'c0231', 'c0232', 'c0233', 'c0234'}
NOTE = '本輪恢復已核封爵及多郡關係，採當年變更後結果；時間依王表及後續Word，僅於明確承襲的既有爵期內繼承封土，不自行補年。289年前新增支郡用括號且不另計郡，289起正式列支郡；梁陳分界以原陳國面和四縣治所局部擬合。中丘291年前仍入趙，291起才列擬定國界。底圖参考範圍的封爵展示不等同當年實際控制。'


def clean(g):
    return normalize(set_precision(g, GRID))


def load_js(path, prefix):
    text = path.read_text()
    return json.loads(text[text.index(prefix) + len(prefix):].strip().rstrip(';'))


def feature_key(feature):
    return feature['properties']['layer'] + ':' + feature['geometry_id']


def build():
    source_geometries, loaded = {}, set()
    connectivity = load_js(ROOT / 'data/jin-local-connectivity-20261007.js', 'window.JIN_LOCAL_CONNECTIVITY = ')
    relations = json.loads((ROOT / 'data/jin-fief-research/reviewed-kingdom-display-20261004.json').read_text())
    annual = json.loads((ROOT / 'data/jin-reviewed-annual-rows.json').read_text())['years']
    abolitions = json.loads((ROOT / 'data/jin-fief-abolitions-20261007.json').read_text())['records']
    reference_fiefs = json.loads((ROOT / 'data/jin-map-reference-fiefs-20261007.json').read_text())['records']
    restoration = json.loads((ROOT / 'data/jin-fief-research/reviewed-289-restorations-20261007.json').read_text())['title_periods']
    output = {'reviewed_at': '2026-10-07', 'policy': NOTE, 'geometries': {}, 'years': {}}
    report = []

    def save(g):
        geo = mapping(normalize(g))
        raw = json.dumps(geo, separators=(',', ':'), ensure_ascii=False)
        gid = 'fief-review-' + hashlib.sha256(raw.encode()).hexdigest()[:16]
        output['geometries'][gid] = geo
        return gid

    def load_year(year):
        data = json.loads((MAPS / f'{year}.json').read_text())
        source_geometries.update(data['geometries'])
        for url in data['geometry_urls']:
            if url not in loaded:
                source_geometries.update(json.loads(gzip.decompress((ROOT / url).read_bytes()))['geometries'])
                loaded.add(url)
        patch = connectivity['years'].get(str(year))
        features = deepcopy(data['features'])
        if patch:
            features = [f for f in features if f['geometry_id'] not in patch['remove']] + deepcopy(patch['add'])
        geometries = {**source_geometries, **connectivity['geometries']}
        for f in features:
            gid = patch['replace'].get(f['geometry_id'], f['geometry_id']) if patch else f['geometry_id']
            f['_shape'] = shape(f.get('geometry') or geometries[gid])
        return data, features

    _, old_features = load_year(266)
    chen_source = next(f['_shape'] for f in old_features if f['properties'].get('entity_id') == 'p026' and f['properties']['layer'] == 'prefecture_areas')
    _, late_features = load_year(313)
    zhongqiu_source = next(f for f in late_features if f['properties'].get('entity_id') == 'p033' and f['properties']['layer'] == 'prefecture_areas')
    chen_shapes, last_reference_sources, last_shapes, stable_colors = {}, {}, {}, {}
    for year in range(266, 317):
        data, features = load_year(year)
        rows = {r['id']: r for r in annual[str(year)]}
        patch = {'remove': [], 'replace': {}, 'add': [], 'entities': {}, 'references': {}, 'reference_seats': {}, 'boundary_fiefs': {},
                 'county_reassignments': {}, 'remove_fiefs': [], 'add_fiefs': [], 'colors': {}, 'note': NOTE}
        areas = {f['properties']['entity_id']: f for f in features if f['properties']['layer'] == 'prefecture_areas'}
        refs = {f['properties']['id']: f for f in features if f['properties']['layer'] == 'reference_prefecture_areas'}
        for pid, f in areas.items():
            source_ids = {s['source_id'] for s in f['properties'].get('geometry_sources', [])}
            last_reference_sources[pid] = source_ids
            last_shapes[pid] = f['_shape']
        entity_refs = {}
        active_relations = sorted([r for r in relations['records'] if r['begin'] <= year <= r['end']], key=lambda r: -r['begin'])
        changed_ids, touched_fiefs = set(), set()

        def region(pid):
            if pid in areas:
                return areas[pid]
            if pid in entity_refs:
                return entity_refs[pid]
            ids = last_reference_sources.get(pid, set())
            if len(ids) != 1:
                return None
            source_id = next(iter(ids))
            source_ref = refs.get('unassigned-reference-' + source_id)
            if source_ref is None:
                return None
            part = clean(last_shapes[pid].intersection(source_ref['_shape']))
            if part.is_empty:
                return None
            remainder = clean(source_ref['_shape'].difference(part))
            if remainder.area < .000001:
                entity_refs[pid] = source_ref
                return source_ref
            # Several later commanderies can share one 281 source compartment.
            # Restore only this member's saved footprint within that reference.
            source_ref['_shape'] = remainder
            patch['replace'][feature_key(source_ref)] = save(remainder)
            rid = 'review-reference-' + pid
            props = {**deepcopy(source_ref['properties']), 'id': rid,
                     'source': '沿最後有效年度既有郡面裁入三底圖參考範圍；封國延續不等同實際控制。'}
            feature = {'type': 'Feature', 'geometry_id': save(part), 'properties': props}
            patch['add'].append(feature)
            mapped = {**deepcopy(feature), '_shape': part}
            refs[rid] = mapped
            entity_refs[pid] = mapped
            line = part.boundary.intersection(remainder.boundary)
            if line.length:
                patch['add'].append({'type': 'Feature', 'geometry_id': save(line), 'properties': {
                    'layer': 'prefecture_boundaries', 'level': 'prefecture', 'year': year, 'name': '郡國界',
                    'adjacent_entity_ids': [source_id, rid], 'adjacent_fief_ids': [props.get('fief_id'), None],
                    'between_fiefs': False, 'within_same_fief': False, 'boundary_inferred': True,
                    'source': props['source'], 'coordinate_role': 'boundary'}})
            return mapped
        # Apply the already-published abolition and reference decisions before
        # calculating this overlay's fief membership and adjacency.
        for r in abolitions:
            if not r['begin'] <= year <= r['end']:
                continue
            for f in areas.values():
                p = f['properties']
                if p.get('fief_id') in r['fief_ids']:
                    p.pop('fief_id', None)
            for rid in r['reference_area_ids']:
                if rid in refs:
                    refs[rid]['properties'].pop('fief_id', None)
        for r in reference_fiefs:
            if r['begin'] <= year <= r['end']:
                for rid in r['reference_area_ids']:
                    if rid in refs:
                        refs[rid]['properties'].update(fief_id=r['fief_id'], display_name=r['name'])

        # 291 is the first display year of the newly delineated Zhongqiu fief.
        if year < 291 and 'p033' in areas:
            zhao, zhongqiu = areas['p032'], areas['p033']
            zhao['_shape'] = clean(unary_union([zhao['_shape'], zhongqiu['_shape']]))
            patch['replace'][feature_key(zhao)] = save(zhao['_shape'])
            for f in features:
                p = f['properties']
                if p.get('entity_id') == 'p033' and p.get('level') == 'prefecture':
                    patch['remove'].append(feature_key(f))
                if p.get('adjacent_entity_ids') and 'p033' in p['adjacent_entity_ids']:
                    if 'p032' in p['adjacent_entity_ids']:
                        patch['remove'].append(feature_key(f))
                    else:
                        # The same outer line now belongs to Zhao.
                        p['adjacent_entity_ids'] = ['p032' if i == 'p033' else i for i in p['adjacent_entity_ids']]
                        added = {k: deepcopy(v) for k, v in f.items() if k != '_shape'}
                        added['geometry_id'] = save(f['_shape'])
                        patch['remove'].append(feature_key(f))
                        patch['add'].append(added)
            patch['county_reassignments']['c0283'] = {'prefecture_id': 'p032', 'prefecture_name': '趙國', 'county_key': 'p032/c0283'}
            del areas['p033']
            changed_ids.add('p032')
            touched_fiefs.add('jin-趙')
            patch['entities']['p032'] = {k: zhao['properties'].get(k) for k in ('name', 'display_name', 'fief_id', 'member_role', 'membership_evidence', 'color')}

        # The former Zhongqiu footprint can remain a neutral administrative
        # reference after its established fief interval has ended.
        if year >= 314:
            zhao_ref = refs['unassigned-reference-tan281-77']
            zhongqiu = clean(zhongqiu_source['_shape'].intersection(zhao_ref['_shape']))
            zhao_ref['_shape'] = clean(zhao_ref['_shape'].difference(zhongqiu))
            patch['replace'][feature_key(zhao_ref)] = save(zhao_ref['_shape'])
            zp = {**deepcopy(zhao_ref['properties']), 'id': 'review-reference-zhongqiu', 'entity_id': None,
                  'name': '中丘郡', 'display_name': '中丘郡', 'base_name': '中丘郡', 'fief_id': None,
                  'member_role': None, 'membership_evidence': None, 'is_reference': True,
                  'reference_reason': '中丘王爵按既有表列止311；後續只保留擬定郡域參考，不延長封國時間。',
                  'source': '既有中丘擬定郡域；312起普通郡，參考範圍不等同實際控制。'}
            zf = {'type': 'Feature', 'geometry_id': save(zhongqiu), 'properties': zp}
            patch['add'].append(zf)
            refs[zp['id']] = {**deepcopy(zf), '_shape': zhongqiu}
            entity_refs['p033'] = refs[zp['id']]
            patch['add'].append({'type': 'Feature', 'geometry_id': save(zhongqiu.boundary.intersection(zhao_ref['_shape'].boundary)),
                                 'properties': {'layer': 'prefecture_boundaries', 'level': 'prefecture', 'year': year, 'name': '郡國界',
                                                'adjacent_entity_ids': ['tan281-77', 'review-reference-zhongqiu'],
                                                'adjacent_fief_ids': [None, None], 'between_fiefs': False,
                                                'within_same_fief': False, 'boundary_inferred': True,
                                                'source': zp['source'], 'coordinate_role': 'boundary'}})
            touched_fiefs.add('jin-中丘')
            changed_ids.add('p033')

        # From 289 the old Chen county group becomes a separately counted
        # subsidiary. Preserve Liang's outer boundary and all county points.
        if year >= 289:
            liang_ref = 'unassigned-reference-tan281-147'
            liang = areas.get('p025') or refs.get(liang_ref)
            if liang:
                source_key = save(liang['_shape'])
                if source_key not in chen_shapes:
                    mask = liang['_shape']
                    chen = clean(chen_source.intersection(mask))
                    remainder = clean(mask.difference(chen))
                    pieces = sorted(list(remainder.geoms) if remainder.geom_type == 'MultiPolygon' else [remainder], key=lambda p: -p.area)
                    kept = pieces[0]
                    chen = clean(mask.difference(kept))
                    assert kept.geom_type == chen.geom_type == 'Polygon'
                    assert mask.symmetric_difference(unary_union([kept, chen])).area < 1e-8
                    chen_shapes[source_key] = (kept, chen)
                liang_shape, chen_shape = chen_shapes[source_key]
                original_mask = liang['_shape']
                liang['_shape'] = liang_shape
                patch['replace'][feature_key(liang)] = save(liang_shape)
                is_reference = 'p025' not in areas
                chen_props = deepcopy(liang['properties'])
                chen_props.update(entity_id=None if is_reference else 'p026', id='review-reference-chen' if is_reference else 'review-chen-area', name='陳支郡', display_name='陳支郡', base_name='陳支郡', fief_id='jin-梁', member_role='branch', membership_evidence='inferred', boundary_note='以原陳國界裁入梁國，切分保留原縣歸屬；289起依使用者制度展示分期列為正式支郡。')
                chen_feature = {'type': 'Feature', 'geometry_id': save(chen_shape), 'properties': chen_props}
                patch['add'].append(chen_feature)
                stored = {**deepcopy(chen_feature), '_shape': chen_shape}
                if is_reference:
                    refs['review-reference-chen'] = stored
                    entity_refs['p026'] = stored
                else:
                    areas['p026'] = stored
                label_props = {**chen_props, 'layer': 'labels', 'coordinate_role': 'territory_label_not_capital', 'label_type': 'prefecture', 'show_label': True}
                if not is_reference:
                    patch['add'].append({'type': 'Feature', 'geometry_id': save(chen_shape.representative_point()), 'properties': label_props})
                for f in features:
                    p = f['properties']
                    if p['layer'] == 'labels' and (p.get('entity_id') == 'p025' or p.get('id') == liang_ref):
                        if not liang_shape.covers(f['_shape']):
                            patch['replace'][feature_key(f)] = save(liang_shape.representative_point())
                    if p['layer'] == 'county_seats' and p.get('prefecture_id') == 'p025':
                        target = chen_shape if p['entity_id'] in CHEN_COUNTIES else liang_shape
                        if original_mask.covers(f['_shape']):
                            assert target.covers(f['_shape']), (year, p['name'])
                        if p['entity_id'] in CHEN_COUNTIES:
                            patch['county_reassignments'][p['entity_id']] = {'prefecture_id': 'p026', 'prefecture_name': '陳支郡', 'county_key': 'p026/' + p['entity_id']}
                line_props = {'layer': 'prefecture_boundaries', 'level': 'prefecture', 'year': year, 'name': '郡國界',
                              'adjacent_entity_ids': ['p025', 'p026'], 'adjacent_state_ids': ['s03', 's03'],
                              'adjacent_fief_ids': ['jin-梁', 'jin-梁'], 'within_same_fief': True, 'between_fiefs': False,
                              'boundary_inferred': True, 'geometry_status': 'user_reviewed_chen_branch_local_fit',
                              'source': chen_props['boundary_note'], 'coordinate_role': 'boundary'}
                patch['add'].append({'type': 'Feature', 'geometry_id': save(liang_shape.boundary.intersection(chen_shape.boundary)), 'properties': line_props})
                changed_ids.update(['p025', 'p026'])
                touched_fiefs.add('jin-梁')
                patch['county_reassignments'].update({cid: {'prefecture_id': 'p026', 'prefecture_name': '陳支郡', 'county_key': 'p026/' + cid} for cid in CHEN_COUNTIES})

        # Names and royal status come from the separately reviewed dated title
        # decisions. A missing text row never by itself cancels a map fief.
        for decision in restoration:
            if not decision['begin'] <= year <= decision['end']:
                continue
            for pid in decision['ids']:
                target = region(pid)
                if target:
                    name = decision['name']
                    fief_id = 'jin-' + name.removesuffix('國') if decision['rank'] else None
                    old = target['properties'].get('fief_id')
                    touched_fiefs.update(i for i in [old, fief_id] if i)
                    metadata = {'name': name, 'display_name': name, 'base_name': name, 'fief_id': fief_id, 'member_role': 'seat' if fief_id else None,
                                'membership_evidence': ('inferred' if decision.get('inferred') else 'confirmed') if fief_id else None, 'fief_review_note': decision['note']}
                    if pid in areas:
                        patch['entities'][pid] = metadata
                    else:
                        patch['references'][target['properties']['id']] = metadata
                    target['properties'].update(metadata)
                    changed_ids.add(pid)
                    if old and not fief_id:
                        # An explicitly abolished primary releases its former
                        # branches too; it cannot survive as orphaned colour.
                        for branch_id, branch in areas.items():
                            bp = branch['properties']
                            if bp.get('fief_id') != old:
                                continue
                            branch_name = rows[branch_id]['name']
                            restored = {'name': branch_name, 'display_name': branch_name, 'base_name': branch_name,
                                        'fief_id': None, 'member_role': None, 'membership_evidence': None,
                                        'fief_review_note': decision['note']}
                            bp.update(restored)
                            patch['entities'][branch_id] = restored
                            changed_ids.add(branch_id)
        # Reuse the reviewed table relations so maps and tables have the same
        # primary/branch names, while keeping the reference geography separate.
        used = set()
        for relation in active_relations:
            primary_ids = [pid for pid in relation['primary_ids'] if region(pid)]
            if len(primary_ids) != 1 or primary_ids[0] in used:
                continue
            pid = primary_ids[0]
            fid = 'jin-' + relation['kingdom_name']
            touched_fiefs.add(fid)
            def assign(entity_id, name, role, certainty):
                feature = region(entity_id)
                old = feature['properties'].get('fief_id')
                if old:
                    touched_fiefs.add(old)
                metadata = {'name': name, 'display_name': name, 'base_name': name, 'fief_id': fid, 'member_role': role,
                            'membership_evidence': certainty, 'fief_review_note': relation['note']}
                if entity_id in areas:
                    patch['entities'][entity_id] = metadata
                else:
                    patch['references'][feature['properties']['id']] = metadata
                feature['properties'].update(metadata)
                changed_ids.add(entity_id)
            assign(pid, relation['kingdom_name'] + '國', 'seat', relation['certainty'])
            used.add(pid)
            for member in relation['members']:
                matches = [i for i in member['ids'] if region(i) and i not in used]
                if len(matches) == 1:
                    branch_name = member['name'] + '支郡'
                    assign(matches[0], '（' + branch_name + '）' if year < 289 else branch_name, 'branch', member['certainty'])
                    used.add(matches[0])

        # Rebuild only touched fief unions, using the already-corrected local
        # commandery shapes; all untouched fiefs keep their published geometry.
        all_regions = {**areas, **refs}
        fief_regions = {}
        for key, feature in all_regions.items():
            fid = feature['properties'].get('fief_id')
            if fid:
                fief_regions.setdefault(fid, []).append((key, feature))
        colors = dict(data.get('fief_colors', {}))
        for f in features:
            p = f['properties']
            if p.get('fief_id') and p.get('color'):
                colors[p['fief_id']] = p['color']
        unions = {fid: clean(unary_union([f['_shape'] for _, f in members])) for fid, members in fief_regions.items()}
        palette = list(dict.fromkeys([*colors.values(), '#b879b5', '#729ac8', '#d5975d', '#70aa8c', '#d4b35e', '#ad839d', '#8a99ce']))
        for fid in sorted(touched_fiefs):
            if fid not in unions:
                continue
            adjacent = {other for other, g in unions.items() if other != fid and unions[fid].boundary.intersection(g.boundary).length > .00001}
            unavailable = {colors.get(other) for other in adjacent}
            if fid not in colors:
                colors[fid] = stable_colors.get(fid)
            if colors.get(fid) in unavailable or not colors.get(fid):
                colors[fid] = next(color for color in palette if color not in unavailable)
            patch['colors'][fid] = colors[fid]
            stable_colors[fid] = colors[fid]
        for fid in touched_fiefs.intersection(unions):
            for other, g in unions.items():
                if other != fid and unions[fid].boundary.intersection(g.boundary).length > .00001:
                    assert colors[fid] != colors.get(other), (year, fid, other, 'adjacent colour conflict')
        for fid in sorted(touched_fiefs):
            patch['remove_fiefs'].append(fid)
            if fid not in unions:
                continue
            members = fief_regions[fid]
            name = next((f['properties']['display_name'] for _, f in members if f['properties'].get('member_role') == 'seat'), fid.removeprefix('jin-') + '國')
            props = {'layer': 'kingdom_areas', 'level': 'fief', 'year': year, 'name': name, 'display_name': name, 'fief_id': fid,
                     'color': colors[fid], 'member_entity_ids': [key for key, _ in members if key in areas],
                     'member_reference_ids': [key for key, _ in members if key in refs], 'is_multi': len(members) > 1,
                     'has_inference': any(f['properties'].get('membership_evidence') == 'inferred' for _, f in members),
                     'source': NOTE, 'geometry_status': 'reviewed_289_fief_membership_on_existing_areas'}
            patch['add_fiefs'].append({'type': 'Feature', 'geometry_id': save(unions[fid]), 'properties': props})
        # Member colour metadata must match the revised adjacency colours.
        for metadata in [*patch['entities'].values(), *patch['references'].values()]:
            metadata['color'] = colors.get(metadata['fief_id']) if metadata['fief_id'] else None
        patch['boundary_fiefs'] = {pid: metadata['fief_id'] for pid, metadata in patch['entities'].items()}
        patch['boundary_fiefs'].update({rid.removeprefix('unassigned-reference-'): metadata['fief_id'] for rid, metadata in patch['references'].items()})
        patch['boundary_fiefs'].update({pid: f['properties'].get('fief_id') for pid, f in entity_refs.items()})
        for assignment in patch['county_reassignments'].values():
            target = areas.get(assignment['prefecture_id']) or entity_refs.get(assignment['prefecture_id'])
            if target:
                assignment['prefecture_name'] = target['properties']['display_name']
        for rid, metadata in patch['references'].items():
            for seat in features:
                p = seat['properties']
                if p['layer'] == 'reference_prefecture_seats' and refs[rid]['_shape'].covers(seat['_shape']):
                    patch['reference_seats'][p['source_id']] = {k: metadata[k] for k in ['display_name', 'fief_id', 'color', 'fief_review_note']}
        for feature in patch['add']:
            p = feature['properties']
            if p.get('fief_id'):
                p['color'] = colors[p['fief_id']]
        if changed_ids:
            output['years'][str(year)] = patch
            report.append({'year': year, 'entities': sorted(changed_ids), 'rebuilt_fiefs': sorted(touched_fiefs), 'county_points_moved': 0})
    # Retain only geometry actually referenced by a patch.
    used_geometries = {gid for patch in output['years'].values() for gid in patch['replace'].values()}
    used_geometries.update(f['geometry_id'] for patch in output['years'].values() for f in [*patch['add'], *patch['add_fiefs']])
    output['geometries'] = {gid: g for gid, g in output['geometries'].items() if gid in used_geometries}
    target = ROOT / 'data/jin-289-fief-map-review-20261007.js'
    target.write_text('window.JIN_289_FIEF_MAP_REVIEW = ' + json.dumps(output, ensure_ascii=False, separators=(',', ':')) + ';\n')
    (ROOT / 'reports/jin-289-fief-map-review-20261007.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(output["years"])} dated patches; {len(output["geometries"])} reused geometries; {target.stat().st_size} bytes')


if __name__ == '__main__':
    build()
