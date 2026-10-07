#!/usr/bin/env python3
"""Select dated CHGIS seats before assigning political display roles.

This module never clips, projects, moves, or snaps point coordinates. An annual
political mask may change a point's display role, not its underlying location.
Same-name records require a unique identity or explicit spatial context; unused
current CHGIS records remain available as unlinked reference points.
"""
from __future__ import annotations

import collections
import importlib.util
import math
import re
from pathlib import Path

from shapely.geometry import mapping

ROOT = Path(__file__).resolve().parents[1]
_ANNUAL = None
_INDEX = {}


def annual_module():
    global _ANNUAL
    if _ANNUAL is None:
        spec = importlib.util.spec_from_file_location('jin_point_annual_helpers', ROOT / 'scripts/build-jin-annual-geography.py')
        _ANNUAL = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_ANNUAL)
    return _ANNUAL


def is_chgis(record):
    return bool(re.search(r'CHGIS', str(record.get('source', '')), re.I))


def record_id(record):
    return (record.get('source'), str(record.get('source_id')), record.get('begin'),
            record.get('end'), tuple(record['geometry'].coords[0]))


def valid_point(record):
    geometry = record['geometry']
    if geometry.is_empty or geometry.geom_type != 'Point':
        return False
    x, y = geometry.coords[0]
    return math.isfinite(x) and math.isfinite(y) and -180 <= x <= 180 and -90 <= y <= 90


def coordinate_groups(records):
    groups = collections.defaultdict(list)
    for record in records:
        # Six decimal places identify duplicate source observations, not a
        # replacement coordinate. The selected record retains full precision.
        groups[tuple(round(v, 6) for v in record['geometry'].coords[0])].append(record)
    return list(groups.values())


def strongest(records):
    return max(records, key=lambda p: (p.get('version', 0), p.get('begin', -9999),
                                       -(p.get('end', 9999)-p.get('begin', -9999)),
                                       -p.get('index', 0)))


class AnnualPointIndex:
    """A process-transferable source index; no module is stored on instances."""

    def __init__(self, data, annual=None, chgis=None, references=None, original=None, archive=None):
        global _ANNUAL
        if annual is not None:
            _ANNUAL = annual
        annual = annual_module()
        self.data = data
        self.entities = annual.all_entities(data)
        if chgis is None:
            chgis, self.inventory = annual.read_chgis(Path(archive or Path.home() / 'Downloads/CHGIS数据.zip'))
        else:
            self.inventory = []
        if references is None or original is None:
            references, _, original = annual.load_reference_areas(self.entities)
        self.references = references
        self.original = original
        self.chgis = {level: [p for p in chgis.get(level, []) if valid_point(p)]
                      for level in ('county', 'prefecture', 'state')}
        self._years = {}

    def _choose(self, entity, row, level, current, annual_name_count):
        annual = annual_module()
        # The 308 import linked Yan's 廣陽 to the Sichuan observation. 96050
        # belongs to Wenshan 廣陽 only; the archive has no dated Yan county
        # observation, so do not manufacture a northern coordinate for it.
        county_id = row.get('yearbook_entity_id', row['id'])
        if level == 'county' and row.get('map_location_unresolved'):
            return None, 'unlocated', 'reviewed_county_location_unknown_do_not_link_distant_homonym'
        if level == 'county' and county_id == 'c0389':
            return None, 'unlocated', 'Yan_Guangyang_has_no_reviewed_source_point_96050_is_Wenshan'
        if level == 'county' and county_id == 'c0770':
            return strongest([p for p in current if str(p.get('source_id')) == '96050']), 'CHGIS_current_reviewed_identity_correction', None
        if level == 'county' and county_id in ('c0380', 'c0390'):
            return strongest([p for p in current if str(p.get('source_id')) == '87436']), 'CHGIS_current_reviewed_identity_correction', None
        normalize = annual.county_key if level == 'county' else annual.key
        names = {normalize(row['name']), normalize(row.get('base_name')),
                 normalize(entity['entity'].get('base_name') or entity['entity'].get('name'))}
        names.discard('')
        possible = [p for p in current if names.intersection(p.get('name_keys', {p['name_key']}))]
        known = self.original.get(row['id'])
        if known and is_chgis(known) and known.get('source_id'):
            linked = [p for p in possible if str(p.get('source_id')) == str(known['source_id'])]
            if len(coordinate_groups(linked)) == 1:
                return strongest(linked), 'CHGIS_current_explicit_source_link', None
        # One matching name used by only one current table entity is sufficient
        # even if the old schematic prefecture lies slightly off that point.
        # Image geometry cannot displace a uniquely identified CHGIS location.
        groups = coordinate_groups(possible)
        unique_name = all(annual_name_count.get(name, 0) <= 1 for name in names)
        if len(groups) == 1 and unique_name:
            return strongest(groups[0]), 'CHGIS_current_unique_name', None
        parent = entity.get('prefecture', entity['entity'])
        parent_phase = annual.phase(parent, row['year'])
        parent_names = {annual.key(parent.get('base_name') or parent.get('name')),
                        annual.key((parent_phase or {}).get('name'))}
        masks = annual.named_reference(parent_names, self.references) if level != 'state' else []
        within = [p for p in possible if any(r['geometry'].covers(p['geometry']) for r in masks)]
        inside_groups = coordinate_groups(within)
        if len(inside_groups) == 1:
            return strongest(inside_groups[0]), 'CHGIS_current_unique_parent_compartment', None
        if known and possible:
            distances = sorted((min(p['geometry'].distance(known['geometry']) for p in group), i)
                               for i, group in enumerate(groups))
            if distances[0][0] <= .08 and (len(distances) == 1 or distances[1][0] >= .2):
                return strongest(groups[distances[0][1]]), 'CHGIS_current_unique_reviewed_location', None
        reason = 'ambiguous_current_CHGIS_name' if possible else 'no_current_CHGIS_name_match'
        if known:
            return known, 'reviewed_original_coordinate_fallback', reason
        return None, 'unlocated', reason

    def _build(self, year):
        annual = annual_module()
        rows = annual.rows_for(self.data, year)
        selected, features = set(), []
        report = dict(year=year, point_priority='current_CHGIS_then_reviewed_original_point',
                      coordinates_preserved=True, political_masks_used_for_point_selection=False,
                      levels={}, unresolved=[])
        for level in ('county', 'prefecture', 'state'):
            current = [p for p in self.chgis[level] if p['begin'] <= year <= p['end']]
            normalize = annual.county_key if level == 'county' else annual.key
            by_name, by_coordinate = collections.defaultdict(list), collections.defaultdict(list)
            for point in current:
                for name in point.get('name_keys', {point['name_key']}):
                    by_name[name].append(point)
                by_coordinate[tuple(point['geometry'].coords[0])].append(point)
            name_count = collections.Counter()
            for row in rows[level].values():
                names = {normalize(row['name']), normalize(row.get('base_name')),
                         normalize(row['entity'].get('base_name') or row['entity'].get('name'))}
                name_count.update(names-{''})
            methods = collections.Counter()
            stats = dict(yearbook_entities=len(rows[level]), current_CHGIS_source_records=len(current),
                         current_CHGIS_points=0, original_point_fallbacks=0, unlocated=0)
            for eid, original_row in sorted(rows[level].items()):
                row = dict(original_row, year=year)
                if level == 'state' and row['phase'].get('lapsed_state_context'):
                    continue
                names = {normalize(row['name']), normalize(row.get('base_name')),
                         normalize(row['entity'].get('base_name') or row['entity'].get('name'))}
                candidates, used_records = [], set()
                for name in names-{''}:
                    for candidate in by_name.get(name, []):
                        identity = record_id(candidate)
                        if identity not in used_records:
                            used_records.add(identity)
                            candidates.append(candidate)
                point, method, reason = self._choose(self.entities[level][eid], row, level, candidates, name_count)
                methods[method] += 1
                if point is None:
                    stats['unlocated'] += 1
                    report['unresolved'].append(dict(entity_id=eid, level=level, name=row['name'], reason=reason))
                    continue
                use_current = method.startswith('CHGIS_current_')
                stats['current_CHGIS_points' if use_current else 'original_point_fallbacks'] += 1
                if use_current:
                    # Repeated records at the chosen coordinate are one usable
                    # observation; don't emit them again as neutral duplicates.
                    for item in by_coordinate[tuple(point['geometry'].coords[0])]:
                        if (
                                str(item.get('source_id')) == str(point.get('source_id')) or
                                normalize(item['name']) == normalize(point['name'])):
                            selected.add((level, record_id(item)))
                p = annual.common_properties(row, level, dict(status='administrative', source_ids=['yearbook']), year)
                p.update(layer=f'{level}_seats', source=point.get('source'), source_id=point.get('source_id'),
                         source_version=point.get('version', 0), coordinate_role='administrative_seat',
                         geometry_role='administrative_seat', show_label=level in ('county', 'state'),
                         geometric_certainty='reference', location_match=method,
                         point_source_priority='current_CHGIS' if use_current else 'reviewed_original_fallback',
                         point_coordinates_preserved=True, source_coordinates=list(point['geometry'].coords[0]),
                         source_point_name=point.get('name'), coordinate_source_begin=point.get('begin'),
                         coordinate_source_end=point.get('end'),
                         coordinate_time='同年CHGIS参考点' if use_current else '原289/308图治所参照，非本年CHGIS时段匹配')
                if reason:
                    p['point_match_limitation'] = reason
                    report['unresolved'].append(dict(entity_id=eid, level=level, name=row['name'], reason=reason,
                                                   original_point_retained=True))
                if level == 'county':
                    parent_names = {annual.key(self.entities[level][eid]['prefecture']['base_name'])}
                    masks = annual.named_reference(parent_names, self.references)
                    if masks and not any(r['geometry'].covers(point['geometry']) for r in masks):
                        p['coordinate_conflict'] = 'CHGIS点在旧原图郡面之外；保留源坐标，不吸附到原图或视频范围。'
                features.append(dict(type='Feature', geometry=mapping(point['geometry']), properties=p))
            stats['match_methods'] = dict(methods)
            report['levels'][level] = stats
        references, seen = [], set()
        for level, records in self.chgis.items():
            for point in records:
                if not point['begin'] <= year <= point['end'] or (level, record_id(point)) in selected:
                    continue
                signature = (level, point.get('source_id'), tuple(point['geometry'].coords[0]))
                if signature in seen:
                    continue
                seen.add(signature)
                p = dict(layer=f'reference_{level}_seats', level=level, year=year,
                         name=point['name'], display_name=point['name'], entity_id=None, source_entity_id=None,
                         is_reference=True, source=point['source'], source_id=point.get('source_id'),
                         source_version=point.get('version', 0), coordinate_role='reference_administrative_seat',
                         geometry_role='reference_administrative_seat', point_source_priority='current_CHGIS',
                         point_coordinates_preserved=True, source_coordinates=list(point['geometry'].coords[0]),
                         coordinate_source_begin=point['begin'], coordinate_source_end=point['end'],
                         location_match='CHGIS_current_unlinked_source_record', show_label=level in ('county', 'state'),
                         reference_reason='本年CHGIS治所参照，尚未与年表实体唯一对应；不据此判定西晋归属或封国。')
                references.append(dict(type='Feature', geometry=mapping(point['geometry']), properties=p))
        report['unlinked_current_CHGIS_reference_points'] = len(references)
        self._years[year] = features, references, report

    def features_for(self, year):
        if year not in self._years:
            self._build(year)
        features, _, report = self._years[year]
        return features, report

    def unlinked_features_for(self, year):
        if year not in self._years:
            self._build(year)
        return self._years[year][1]


def get_index(data, **kwargs):
    key = (id(data), str(kwargs.get('archive', 'default')))
    if key not in _INDEX:
        _INDEX[key] = AnnualPointIndex(data, **kwargs)
    return _INDEX[key]
