#!/usr/bin/env python3
"""Give every dated, touching Jin fief a different, stable map colour.

One adjacency graph contains the union of contacts in all requested years.
Polygon overlap, common edges and corner contact all forbid an equal colour.
Only a two-metre-scale WGS84 tolerance bridges coordinate-rounding seams;
it does not infer historical contacts over a visibly separating district.
Old comparison maps are not rewritten. Requires Shapely >= 2.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
PALETTE = [
    '#c66d28',  # orange
    '#427caf',  # blue
    '#8b609d',  # purple
    '#3b9385',  # teal
    '#b54f58',  # red
    '#b49a30',  # ochre
    '#617c39',  # olive
    '#815a40',  # brown
    '#4c638e',  # indigo, reserved for a harder union graph
    '#b16588',  # rose, reserved
]
CONTACT_TOLERANCE = 0.00002  # degrees, about 1.6–2.2 metres in the study area


def read_json(path):
    return json.loads(path.read_text())


def read_final_year(directory, year, geometry_cache):
    path = directory / f'{year}.geojson'
    if not path.exists():
        path = directory / f'{year}.json'
    if not path.exists():
        raise FileNotFoundError(f'Missing completed map for {year}: {directory}')
    data = read_json(path)
    if int(data.get('year', year)) != year:
        raise ValueError(f'Wrong year in {path}')
    geometries = dict(data.get('geometries', {}))
    for url in data.get('geometry_urls', []):
        shard = ROOT / url
        key = str(shard)
        if key not in geometry_cache:
            geometry_cache[key] = read_json(shard).get('geometries', {})
        geometries.update(geometry_cache[key])
    return data['features'], geometries, path


def read_original_year(index, year, geometry_cache):
    entry = index['years'][str(year)]
    geometries = dict(index.get('geometries', {}))
    for url in entry.get('geometry_urls', []):
        if url not in geometry_cache:
            geometry_cache[url] = read_json(ROOT / url)['geometries']
        geometries.update(geometry_cache[url])
    path = ROOT / entry['data_url']
    return read_json(path)['features'], geometries, path


def fief_shapes(features, geometries):
    groups = collections.defaultdict(list)
    names = collections.defaultdict(set)
    prefecture_fiefs = set()
    for feature in features:
        properties = feature.get('properties', {})
        fid = properties.get('fief_id')
        if not fid or properties.get('is_reference'):
            continue
        names[fid].add(properties.get('display_name') or properties.get('name') or fid)
        if properties.get('layer') == 'prefecture_areas':
            prefecture_fiefs.add(fid)
        if properties.get('layer') != 'kingdom_areas':
            continue
        geometry = feature.get('geometry') or geometries.get(feature.get('geometry_id'))
        if not geometry:
            raise ValueError(f'Missing fief geometry: {fid}')
        g = shape(geometry)
        if not g.is_empty:
            if not g.is_valid:
                raise ValueError(f'Invalid fief geometry: {fid}')
            groups[fid].append(g)
    if prefecture_fiefs.difference(groups):
        raise ValueError(f'Coloured prefecture fiefs without kingdom polygons: {sorted(prefecture_fiefs.difference(groups))}')
    return {fid: unary_union(parts) for fid, parts in sorted(groups.items())}, names


def contact_graph(shapes, tolerance):
    ids = sorted(shapes)
    geometries = [shapes[fid] for fid in ids]
    tree = STRtree(geometries)
    contacts = []
    for i, geometry in enumerate(geometries):
        for j_value in tree.query(geometry.buffer(tolerance)):
            j = int(j_value)
            if j <= i:
                continue
            other = geometries[j]
            distance = geometry.distance(other)
            if distance > tolerance:
                continue
            intersection = geometry.intersection(other)
            # Exported neighbours can share a sub-metre rounding sliver.
            # Diagnostics call this a precision seam, while every such pair
            # still receives different colours just like an exact contact.
            if intersection.area > tolerance * max(intersection.length, tolerance):
                relation = 'overlap'
            elif geometry.boundary.intersection(other.boundary).length > tolerance:
                relation = 'shared_edge'
            elif not intersection.is_empty and intersection.area == 0:
                relation = 'corner_contact'
            else:
                relation = 'precision_seam'
            contacts.append({'fiefs': [ids[i], ids[j]], 'relation': relation})
    return sorted(contacts, key=lambda edge: edge['fiefs'])


def dsatur(graph, frequencies, colour_limit=None, state_limit=100000,
           initial_assignments=None, preferred=None):
    """Deterministic DSATUR; bounded search finds a small union palette."""
    assignments = dict(initial_assignments or {})
    states = 0
    exhausted = False

    def next_node():
        return min((fid for fid in graph if fid not in assignments),
                   key=lambda fid: (-len({assignments[n] for n in graph[fid] if n in assignments}),
                                    -len(graph[fid]), -frequencies[fid], fid))

    if colour_limit is None:
        while len(assignments) < len(graph):
            fid = next_node()
            forbidden = {assignments[n] for n in graph[fid] if n in assignments}
            candidates = ([preferred[fid]] if preferred and fid in preferred else []) + list(range(len(PALETTE)))
            colour = next(c for c in candidates if c not in forbidden)
            assignments[fid] = colour
        return assignments, states, exhausted

    def visit():
        nonlocal states, exhausted
        states += 1
        if states > state_limit:
            exhausted = True
            return False
        if len(assignments) == len(graph):
            return True
        fid = next_node()
        forbidden = {assignments[n] for n in graph[fid] if n in assignments}
        # New colour numbers are interchangeable. Introduce only the next one.
        available_limit = min(colour_limit, max(assignments.values(), default=-1) + 2)
        for colour in range(available_limit):
            if colour in forbidden:
                continue
            assignments[fid] = colour
            if visit():
                return True
            assignments.pop(fid)
            if exhausted:
                return False
        return False

    result = dict(assignments) if visit() else None
    return result, states, exhausted


def retain_existing_colours(graph, frequencies, previous):
    """Keep old colours, unlocking only a cover of newly conflicting edges."""
    preferred = {fid: PALETTE.index(colour) for fid, colour in previous.items()
                 if fid in graph and colour in PALETTE}
    locked = dict(preferred)
    while True:
        conflicts = [(fid, neighbour) for fid in sorted(locked) for neighbour in graph[fid]
                     if neighbour in locked and fid < neighbour and locked[fid] == locked[neighbour]]
        if not conflicts:
            break
        degrees = collections.Counter(fid for edge in conflicts for fid in edge)
        # Unlock few records, and prefer to retain frequently displayed fiefs.
        unlock = min(degrees, key=lambda fid: (-degrees[fid], frequencies[fid], len(graph[fid]), fid))
        locked.pop(unlock)
    assignment, _, _ = dsatur(graph, frequencies, initial_assignments=locked, preferred=preferred)
    return assignment


def build(args):
    geometry_cache = {}
    index = read_json(ROOT / 'data/jin-maps/annual-geography.json') if args.source == 'original' else None
    year_contacts = {}
    graph = collections.defaultdict(set)
    names = collections.defaultdict(set)
    frequencies = collections.Counter()
    sources = []
    for year in args.years:
        features, geometries, path = (read_original_year(index, year, geometry_cache) if index
                                     else read_final_year(args.input_dir, year, geometry_cache))
        shapes, year_names = fief_shapes(features, geometries)
        for fid, values in year_names.items():
            names[fid].update(values)
            graph[fid]
        frequencies.update(shapes.keys())
        contacts = contact_graph(shapes, args.tolerance)
        year_contacts[year] = {'contacts': contacts, 'area_fief_count': len(shapes)}
        for contact in contacts:
            left, right = contact['fiefs']
            graph[left].add(right)
            graph[right].add(left)
        sources.append({'year': year, 'path': str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        print(f'{year}: {len(shapes)} territorial fiefs, {len(contacts)} contacts', flush=True)

    attempts = []
    preservation = None
    if args.preserve_existing:
        prior_data = read_json(args.preserve_existing)
        prior_colours = prior_data['colors']
        assignment = retain_existing_colours(graph, frequencies, prior_colours)
        preservation = {'previous_mapping_sha256': hashlib.sha256(json.dumps(prior_colours, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
                        'retained_fief_colors': sum(PALETTE[value] == prior_colours.get(fid) for fid, value in assignment.items()),
                        'changed_fief_colors': sum(fid in prior_colours and PALETTE[value] != prior_colours[fid] for fid, value in assignment.items()),
                        'new_fief_colors': sum(fid not in prior_colours for fid in assignment)}
    else:
        assignment, _, _ = dsatur(graph, frequencies)
        greedy_count = max(assignment.values(), default=-1) + 1
        # The union graph need not be planar, since it combines different years.
        for count in range(4, greedy_count):
            candidate, states, exhausted = dsatur(graph, frequencies, count)
            attempts.append({'colour_count': count, 'search_states': states, 'state_limit_reached': exhausted})
            if candidate is not None:
                assignment = candidate
                break
    colours = {fid: PALETTE[assignment[fid]] for fid in sorted(assignment)}
    validation = []
    for year, record in sorted(year_contacts.items()):
        conflicts = [edge['fiefs'] for edge in record['contacts'] if colours[edge['fiefs'][0]] == colours[edge['fiefs'][1]]]
        validation.append({'year': year, 'area_fief_count': record['area_fief_count'],
                           'edge_count': len(record['contacts']), 'conflict_count': len(conflicts),
                           'contact_types': dict(sorted(collections.Counter(edge['relation'] for edge in record['contacts']).items()))})
        if conflicts:
            raise AssertionError(f'{year}: same-colour adjacent fiefs: {conflicts}')
    result = {'version': '20261002.3', 'colors': colours,
              'palette': PALETTE[:max(assignment.values(), default=-1)+1],
              'names': {fid: sorted(values) for fid, values in sorted(names.items())},
              'meta': {'years': args.years, 'source': args.source,
                       'rule': '对全部年度的封国邻接关系作联合图着色；共边、点接触及精度缝均禁用同色，同一fief_id跨年保持固定色。',
                       'contact_tolerance_degrees': args.tolerance,
                       'color_count': len(set(colours.values())), 'fief_count': len(colours),
                       'union_edge_count': sum(len(neighbours) for neighbours in graph.values())//2,
                       'search_attempts': attempts, 'sources': sources},
              'validation': {'total_conflicts': sum(row['conflict_count'] for row in validation), 'years': validation}}
    if preservation is not None:
        result['meta']['preservation'] = preservation
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    args.output.with_suffix('.js').write_text('/* Same fief colour across all years; touching fiefs never share a colour. */\nwindow.JIN_FIEF_COLORS='+json.dumps(result,ensure_ascii=False,separators=(',', ':'))+';\n')
    if args.edges_output:
        args.edges_output.parent.mkdir(parents=True, exist_ok=True)
        args.edges_output.write_text(json.dumps({str(year): row for year,row in year_contacts.items()}, ensure_ascii=False, indent=2)+'\n')
    print(f"{len(colours)} fiefs, {result['meta']['union_edge_count']} union edges, "
          f"{result['meta']['color_count']} colours, {result['validation']['total_conflicts']} conflicts", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', choices=['original', 'completed'], default='completed')
    parser.add_argument('--input-dir', type=Path, default=ROOT/'work/jin-video/annual-final-gis')
    parser.add_argument('--years', type=int, nargs='+', default=list(range(266,317)))
    parser.add_argument('--tolerance', type=float, default=CONTACT_TOLERANCE)
    parser.add_argument('--output', type=Path, default=ROOT/'data/jin-fief-colors.json')
    parser.add_argument('--edges-output', type=Path, default=ROOT/'work/jin-video/fief-contact-edges.json')
    parser.add_argument('--preserve-existing', type=Path,
                        help='Keep a previous colour mapping; change only fiefs required by new contacts.')
    args = parser.parse_args()
    if not 0 <= args.tolerance <= 0.0001:
        raise ValueError('Contact tolerance must remain within sub-map-pixel coordinate precision.')
    build(args)


if __name__ == '__main__':
    main()
