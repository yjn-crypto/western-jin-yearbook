#!/usr/bin/env python3
"""Build an explicitly experimental, evidence-labelled annual Jin geography.

Requires Shapely >= 2.1. Reads the user's existing CHGIS archive locally; does
not fetch data. County polygons are constrained nearest-seat fitting units,
NOT historical county boundary observations. The dated administrative table
determines affiliations; separate researched control rules limit territory.
The two reviewed 289/308 snapshots are inputs and are never rewritten.
"""
from __future__ import annotations
import argparse, collections, hashlib, io, json, re, struct, zipfile
from pathlib import Path

from shapely import make_valid, normalize, set_precision, voronoi_polygons
from shapely.geometry import shape, mapping, Point, Polygon, MultiPoint, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
YEARS = range(266, 317)
VARIANTS = str.maketrans('钱扬东阳兴宁晋长吴临丰县国庐陈广义乐随郧寿龙汉乡归兰乌浔寻会怀齐绥锡凉涟巩历泾谯兖蒋脩臺郁辽乐滕蕃邹濮濟济贊赞邺邯渤营麴曲应荣渭渑渋黾卢贝沛颍颖襄缪闽苍愍谭枣灊潜鄄洮台邛祁获钜枹邵绛武匡甯',
                        '錢揚東陽興寧晉長吳臨豐縣國廬陳廣義樂隨鄖壽龍漢鄉歸蘭烏潯尋會懷齊綏錫涼漣鞏歷涇譙兗蔣修台鬱遼樂滕蕃鄒濮濟濟贊贊鄴邯渤營麴曲應榮渭澠澀黽盧貝沛潁穎襄繆閩蒼愍譚棗灊潛鄄洮台邛祁獲鉅枹邵絳武匡寧')
VARIANTS.update(str.maketrans({'荥':'滎','农':'農','阴':'陰','杨':'楊','内':'內','顿':'頓','鲁':'魯','为':'為','隶':'隸','门':'門','卫':'衛','云':'雲','济':'濟','颖':'穎','莲':'蓮','荫':'蔭','朔':'朔','阁':'閣','间':'間','蓟':'薊','双':'雙','盖':'蓋','还':'還','仓':'倉','华':'華','陕':'陝','汤':'湯','盐':'鹽','淮':'淮','温':'溫','标':'標','诸':'諸','虑':'慮','范':'範','审':'審','肃':'肅','轵':'軹','护':'護','穷':'窮','绵':'綿','绥':'綏','绛':'絳','纂':'纂','犊':'犢','壶':'壺','经':'經','阳':'陽','义':'義','萨':'薩','顺':'順','颍':'潁','桓':'桓','连':'連','乡':'鄉','荣':'榮','绵':'綿','旸':'暘','临':'臨','蒙':'蒙','术':'術','粤':'粵','渎':'瀆','梓':'梓','枣':'棗','峡':'峽','濑':'瀨','广':'廣','禹':'禹','达':'達','骠':'驃','饶':'饒','丰':'豐','归':'歸','宁':'寧','泽':'澤','营':'營','攸':'攸','溪':'溪','濬':'浚'}))
VARIANTS.update(str.maketrans({'风':'風','襄':'襄','陇':'隴','负':'負','桐':'桐','缑':'緱','渑':'澠','饒':'饒','顯':'顯','显':'顯','厩':'廄','邓':'鄧','摇':'搖','麹':'麴'}))
VARIANTS.update(str.maketrans({'赵':'趙'}))


def key(name):
    s = str(name or '').translate(VARIANTS).replace('琅琊', '琅邪').replace('候官', '侯官').replace('錢唐', '錢塘').replace('鍾', '鐘').replace('脩', '修').replace('丹楊', '丹陽').replace('勃海', '渤海')
    return re.sub(r'(王國|公國|侯國|伯國|子國|男國|支郡|郡|縣|國|州|尹)$', '', re.sub(r'[\s※？?]', '', s))


def county_key(name):
    # 襄國 is a county's own name, and 州 is a one-character county name.
    # Neither should lose its final character as if it were a prefecture title.
    s = str(name or '').translate(VARIANTS).replace('琅琊', '琅邪').replace('候官', '侯官').replace('錢唐', '錢塘').replace('鍾', '鐘').replace('脩', '修').replace('丹楊', '丹陽').replace('勃海', '渤海')
    s = re.sub(r'[\s※？?]', '', s)
    return re.sub(r'(縣|县)$', '', s)


def write_json(path, value, compact=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':') if compact else None, indent=None if compact else 2) + '\n')


def load_js(path):
    s = path.read_text()
    return json.loads(s[s.index('{'):].strip().rstrip(';'))


def phase(e, year):
    active = [p for p in e.get('phases', []) if p['start'] <= year <= p['end']]
    return max(active, key=lambda p: p['start']) if active else None


def rows_for(data, year):
    rows = {'state': {}, 'prefecture': {}, 'county': {}}
    for s in data['states']:
        sp = phase(s, year)
        if not sp:
            # The source ends SIZHOU in 311 but explicitly keeps Xingyang and
            # Hongnong prefectures and their counties through 316. A lapsed
            # province interval must not erase still-active child geography.
            if not any(phase(p,year) for p in s['prefectures']):
                continue
            sp=dict(start=year,end=year,name='原'+s['name']+'殘存郡',uncertain=True,source=s.get('source'),lapsed_state_context=True)
        sn = s['name'] if sp.get('lapsed_state_context') else sp.get('name', s['name'])
        rows['state'][s['id']] = dict(id=s['id'], name=sp.get('name',sn), state_id=s['id'], state_name=sn, phase=sp, entity=s)
        for p in s['prefectures']:
            pp = phase(p, year)
            if not pp:
                continue
            if p['id']=='p073' and year>=313:
                # The same cited prefecture source states that Sima Ye's
                # accession in 313 ended Qin Guo. Inclusive OCR phase endpoints
                # must not reintroduce a single-commandery Qin overlay afterward.
                pp=dict(pp,name='扶風郡',is_fief=False,map_name_override='313司马邺即帝位，秦国绝，按年末改扶风郡',map_name_override_source_ids=['JS005','JS064','yearbook'])
            pn = pp.get('name', p['base_name'])
            rows['prefecture'][p['id']] = dict(id=p['id'], name=pn, base_name=p['base_name'], state_id=s['id'], state_name=sn, phase=pp, entity=p)
            for c in p['counties']:
                cp = phase(c, year)
                if cp:
                    rows['county'][c['id']] = dict(id=c['id'], name=cp.get('name', c['base_name']), base_name=c['base_name'], state_id=s['id'], state_name=sn, prefecture_id=p['id'], prefecture_name=pn, phase=cp, entity=c)
    return rows


def all_entities(data):
    result = {'state': {}, 'prefecture': {}, 'county': {}}
    for s in data['states']:
        result['state'][s['id']] = dict(entity=s, names={key(s['name'])}, state=s)
        for p in s['prefectures']:
            result['prefecture'][p['id']] = dict(entity=p, names={key(p['base_name']), *[key(t.get('name')) for t in p['phases']]}, state=s)
            for c in p['counties']:
                result['county'][c['id']] = dict(entity=c, names={county_key(c['base_name']), *[county_key(t.get('name')) for t in c['phases']]}, state=s, prefecture=p)
    return result


def dbf_rows(raw):
    count, header, size = struct.unpack_from('<IHH', raw, 4)
    fields = []
    for offset in range(32, header - 1, 32):
        if raw[offset] == 13:
            break
        fields.append((raw[offset:offset+11].split(b'\0')[0].decode(), raw[offset+16]))
    for index in range(count):
        row = raw[header+index*size:header+(index+1)*size]
        if not row or row[:1] == b'*':
            yield None
            continue
        cursor, result = 1, {}
        for name, length in fields:
            result[name] = row[cursor:cursor+length].decode('utf-8', errors='replace').strip()
            cursor += length
        yield result


def shp_rows(raw):
    cursor = 100
    while cursor + 8 <= len(raw):
        length = struct.unpack_from('>i', raw, cursor+4)[0] * 2
        yield raw[cursor+8:cursor+8+length]
        cursor += 8 + length


def polygonal(g):
    if g.is_empty:
        return g
    if not g.is_valid:
        g = make_valid(g)
    if g.geom_type in ('Polygon', 'MultiPolygon'):
        return g
    geoms = [x for x in getattr(g, 'geoms', []) if x.geom_type in ('Polygon', 'MultiPolygon')]
    return unary_union(geoms) if geoms else Polygon()


def shapefile_geometry(raw):
    kind = struct.unpack_from('<i', raw)[0]
    if kind == 0:
        return None
    if kind == 1:
        return Point(*struct.unpack_from('<dd', raw, 4))
    if kind != 5:
        raise ValueError(f'Unsupported SHP geometry {kind}')
    parts, count = struct.unpack_from('<ii', raw, 36)
    starts = list(struct.unpack_from(f'<{parts}i', raw, 44)) + [count]
    coords = [struct.unpack_from('<dd', raw, 44+parts*4+i*16) for i in range(count)]
    # SHP rings can contain multiple exterior rings. Containment parity handles
    # holes without assuming winding order in the original source file.
    rings = [Polygon(coords[starts[i]:starts[i+1]]) for i in range(parts) if starts[i+1]-starts[i] >= 4]
    rings = sorted(rings, key=lambda p: p.area, reverse=True)
    parents = []
    for i, ring in enumerate(rings):
        possible = [j for j in range(i) if rings[j].covers(ring.representative_point())]
        parents.append(min(possible, key=lambda j: rings[j].area) if possible else None)
    depths = []
    for i, parent in enumerate(parents):
        depths.append(0 if parent is None else depths[parent] + 1)
    polygons = []
    for i, ring in enumerate(rings):
        if depths[i] % 2:
            continue
        holes = [list(rings[j].exterior.coords) for j, parent in enumerate(parents) if parent == i]
        polygons.append(Polygon(ring.exterior.coords, holes))
    return polygonal(unary_union(polygons))


def read_chgis(archive_path):
    packages = [
        ('CHGIS数据/dataverse_files-v6.zip', 'v6_time_cnty_pts_utf_wgs84.zip', 'county'),
        ('CHGIS数据/dataverse_files (2)-v6.zip', 'v6_time_pref_pts_utf_wgs84.zip', 'prefecture'),
        ('CHGIS数据/dataverse_files (1)-v6.zip', 'v6_time_pref_pgn_utf_wgs84.zip', 'prefecture_area'),
        ('CHGIS数据/v4_time_prov_pts_utf.zip', None, 'state'),
    ]
    result = collections.defaultdict(list)
    inventory = []
    with zipfile.ZipFile(archive_path) as outer:
        for package, nested, level in packages:
            payload = outer.read(package)
            with zipfile.ZipFile(io.BytesIO(payload)) as inner:
                if nested:
                    payload = inner.read(nested)
                    inner = zipfile.ZipFile(io.BytesIO(payload))
                names = [n for n in inner.namelist() if not n.startswith('__MACOSX')]
                dbf = next(n for n in names if n.endswith('.dbf'))
                shp = next(n for n in names if n.endswith('.shp'))
                attrs = list(dbf_rows(inner.read(dbf)))
                raw_shapes = list(shp_rows(inner.read(shp))) if nested else []
                source = f'CHGIS_V{6 if nested else 4}:{Path(dbf).stem}'
                imported = 0
                for index, a in enumerate(attrs):
                    if not a:
                        continue
                    try:
                        begin, end = int(float(a['BEG_YR'])), int(float(a['END_YR']))
                    except (KeyError, ValueError):
                        continue
                    if begin > 316 or end < 266 or (begin == 0 and a.get('BEG_RULE') in ('0', '0.0')):
                        continue
                    if a.get('TYPE_CH') == '非政区国土':
                        continue
                    if nested:
                        g = shapefile_geometry(raw_shapes[index])
                    else:
                        try:
                            g = Point(float(a.get('X_COORD') or a.get('X_COOR')), float(a.get('Y_COORD') or a.get('Y_COOR')))
                        except (TypeError, ValueError):
                            continue
                    if g is None or g.is_empty:
                        continue
                    actual_level = level
                    if level == 'prefecture' and a.get('TYPE_CH') == '州':
                        actual_level = 'state'
                    if level == 'prefecture' and a.get('TYPE_CH') == '都督':
                        continue
                    name = a.get('NAME_FT') or a.get('NAME_CH')
                    result[actual_level].append(dict(name=name, name_key=county_key(name) if actual_level=='county' else key(name), begin=begin, end=end, geometry=g,
                        source=source, source_id=a.get('SYS_ID'), version=6 if nested else 4,
                        location=a.get('PRES_LOC') or a.get('PERS_LOC') or '', index=index + 1,
                        source_name_ch=a.get('NAME_CH'),source_name_ft=a.get('NAME_FT'),
                        time_semantics='CHGIS闭区间参考，与年末沿革可能不一致'))
                    imported += 1
                inventory.append(dict(source=source, archive=package, nested=nested, sha256=hashlib.sha256(payload).hexdigest(), records=len(attrs), imported=imported))
    for level, records in result.items():
        for record in records:
            record['name_key'] = county_key(record['name']) if level=='county' else key(record['name'])
            name_fn=county_key if level=='county' else key
            record['name_keys']={name_fn(record['name']),name_fn(record.get('source_name_ch')),name_fn(record.get('source_name_ft'))}
    return result, inventory


class GeometryStore:
    def __init__(self, tolerance):
        self.values = {}
        self.tolerance = tolerance

    def add(self, g, simplify=True):
        if g is None or g.is_empty:
            return None
        if g.geom_type != 'Point' and simplify:
            g = g.simplify(self.tolerance, preserve_topology=True)
            if 'Polygon' in g.geom_type:
                g = polygonal(g)
        # Decimal rounding can collapse narrow rings and introduce self-crossing
        # after a valid simplification. Snap with GEOS topology preservation
        # before serialising rather than round a polygon's vertices blindly.
        g = set_precision(g, 1e-5, mode='valid_output')
        if g.is_empty:
            return None
        g = normalize(g)
        def rounded(x):
            if isinstance(x, (list, tuple)):
                return [rounded(v) for v in x]
            return round(float(x), 5) if isinstance(x, (int, float)) else x
        value = mapping(g)
        value = {k: rounded(v) if k == 'coordinates' else v for k, v in value.items()}
        raw = json.dumps(value, sort_keys=True, separators=(',', ':'))
        ident = 'g' + hashlib.sha256(raw.encode()).hexdigest()[:16]
        self.values.setdefault(ident, value)
        return ident


def load_reference_areas(entities):
    references, points, original = [], collections.defaultdict(list), {}
    for year in (308, 289):
        data = json.loads((ROOT / f'data/jin-maps/{year}_map.geojson').read_text())
        for f in data['features']:
            p = f['properties']; g = shape(f['geometry'])
            if p.get('layer') == 'prefecture_areas':
                linked = entities['prefecture'].get(p.get('entity_id'), {})
                name = key(linked.get('entity', {}).get('base_name') or p.get('base_name') or p.get('name'))
                if year == 289 and any(r['name_key'] == name for r in references):
                    continue
                references.append(dict(name_key=name, name=p.get('base_name') or p.get('name'), geometry=polygonal(g), source=p.get('source'), source_id=p.get('source_id'), ref_year=year))
            if p.get('layer') in ('county_seats', 'prefecture_seats', 'state_seats'):
                level = {'county_seats':'county', 'prefecture_seats':'prefecture', 'state_seats':'state'}[p['layer']]
                item = dict(name_key=county_key(p.get('name')) if level=='county' else key(p.get('name')), name=p.get('name'), begin=year, end=year, geometry=g, source=p.get('source'), source_id=p.get('source_id'), version=0, location='', index=0)
                points[level].append(item)
                if p.get('entity_id'):
                    original.setdefault(p['entity_id'], item)
    # Reference masks are clipped against earlier masks in deterministic order.
    # This prevents overlap where CHGIS and schematic source edges differ.
    occupied = Polygon()
    for i, r in enumerate(references):
        r['geometry'] = polygonal(r['geometry'].difference(occupied))
        occupied = unary_union([occupied, r['geometry']])
        r['id'] = f'ref-{i:03d}'
    return references, points, original


def named_reference(names, references):
    candidates = [r for r in references if r['name_key'] in names and not r['geometry'].is_empty]
    return candidates


def choose_point(entity, level, candidates, references, original, year=None):
    names = entity['names']
    possible = [p for p in candidates if names.intersection(p.get('name_keys',{p['name_key']})) and (year is None or p['begin'] <= year <= p['end'])]
    known = original.get(entity['entity']['id'])
    if known:
        # The existing reviewed point has an explicit stable entity ID. Reuse a
        # current-year CHGIS row of that source ID before trying a name join.
        # A common title in a distant prefecture must not erase this link.
        linked = [p for p in candidates if str(p.get('source_id')) == str(known.get('source_id')) and p.get('source_id') and (year is None or p['begin'] <= year <= p['end'])]
        if linked:
            return max(linked,key=lambda p:p['version']), 'CHGIS_explicit_snapshot_entity_link'
    if not possible and entity['entity']['id'] in original:
        return original[entity['entity']['id']], 'reviewed_snapshot_coordinate'
    if not possible:
        return None, 'missing'
    parent = entity.get('prefecture', entity['entity'])
    parent_names = {key(parent.get('base_name')), *[key(t.get('name')) for t in parent.get('phases', [])]}
    masks = named_reference(parent_names, references) if level != 'state' else []
    if not masks and level == 'county':
        if known:
            return known, 'reviewed_snapshot_coordinate'
        return None, 'missing_parent_area_context'
    def score(p):
        distance = min((r['geometry'].distance(p['geometry']) for r in masks), default=0)
        relevant = 0 if p['begin'] <= 289 <= p['end'] or p['begin'] <= 308 <= p['end'] else 1
        return (round(distance, 5), -p['version'], relevant, p['end'] - p['begin'], p['index'])
    possible.sort(key=score)
    best = possible[0]
    if level == 'county' and score(best)[0] > 1.2:
        return (known, 'reviewed_snapshot_coordinate') if known else (None, 'same_name_too_far')
    if level == 'county' and len(possible) > 1:
        first, second = score(possible[0]), score(possible[1])
        if abs(first[0] - second[0]) < .02 and possible[0]['geometry'].distance(possible[1]['geometry']) > .8:
            return (known, 'reviewed_snapshot_coordinate') if known else (None, 'ambiguous_same_name')
    return best, 'CHGIS_name_and_parent_area' if best['version'] else 'reviewed_snapshot_coordinate'


def build_cells(entities, chgis, references, points, original):
    # A reference compartment retains observed/schematic old prefectural edges.
    # Sites include all dated entities, so a future Wu county can keep its cell
    # outside Jin's partial frontier before unification rather than filling the
    # entire later prefecture from the handful of Jin seats.
    placements, unlocated = {}, []
    groups = collections.defaultdict(dict)
    candidates = chgis['county'] + points['county']
    for cid, e in sorted(entities['county'].items()):
        p, method = choose_point(e, 'county', candidates, references, original)
        if not p:
            unlocated.append(dict(id=cid, name=e['entity']['base_name'], prefecture=e['prefecture']['base_name'], reason=method))
            continue
        point = p['geometry']
        matching = [r for r in references if r['geometry'].covers(point)]
        parent_names = {key(e['prefecture']['base_name']), *[key(t.get('name')) for t in e['prefecture']['phases']]}
        matching.sort(key=lambda r: (r['name_key'] not in parent_names, r['geometry'].area))
        if not matching:
            matching = sorted([r for r in references if not r['geometry'].is_empty], key=lambda r: r['geometry'].distance(point))
            if not matching or matching[0]['geometry'].distance(point) > .35:
                if cid in original and matching:
                    ref=matching[0]
                    placements[cid]=dict(physical=f'unfitted:{cid}',reference=ref['id'],point=point,source=p['source'],source_id=p['source_id'],method=method,fit_eligible=False,coordinate_conflict='已有明确实体ID治所点在示意郡面外，保留坐标但不拟造县面')
                    continue
                unlocated.append(dict(id=cid, name=e['entity']['base_name'], prefecture=e['prefecture']['base_name'], reason='point_outside_reference_domain'))
                continue
        ref = matching[0]
        # Same county appearing under a new parent has a new yearbook ID. Spatial
        # cells are joined by coordinate, not by administrative title alone.
        physical = f'{ref["id"]}:{point.x:.3f}:{point.y:.3f}'
        placements[cid] = dict(physical=physical, reference=ref['id'], point=point, source=p['source'], source_id=p['source_id'], method=method)
        groups[ref['id']].setdefault(physical, dict(point=point, county_ids=[]))['county_ids'].append(cid)
    cells = {}
    for ref in references:
        group = groups[ref['id']]
        physicals = sorted(group)
        sites = [group[k]['point'] for k in physicals]
        mask = ref['geometry']
        if not sites or mask.is_empty:
            continue
        if len(sites) == 1:
            polygons = [mask]
        else:
            partition = voronoi_polygons(MultiPoint(sites), extend_to=box(*mask.bounds).buffer(2), ordered=True)
            polygons = [polygonal(g.intersection(mask)) for g in partition.geoms]
        for physical, g in zip(physicals, polygons):
            if not g.is_empty:
                cells[physical] = dict(geometry=g, point=group[physical]['point'], reference=ref['id'], county_ids=group[physical]['county_ids'])
    return placements, cells, unlocated


def effective_control(row, year, rules):
    matches = []
    for rule in rules:
        if not rule['start'] <= year <= rule['end']:
            continue
        rank = 0
        if row.get('state_id') in rule.get('state_ids', []): rank = 1
        if (row.get('prefecture_id') or (row['id'] if row.get('level') == 'prefecture' else None)) in rule.get('prefecture_ids', []): rank = 2
        if row['id'] in rule.get('county_ids', []): rank = 3
        if row['id'] in rule.get('entity_ids', []): rank = 3
        if rank:
            matches.append((rank, rule['start'], rule))
    if not matches:
        return dict(status='administrative', reason='年度沿革表中的有效建置；没有独立实控边界观测', source_ids=['yearbook'])
    return max(matches, key=lambda x: (x[0], x[1], -(x[2]['end']-x[2]['start'])))[2]


def common_properties(row, level, control, year):
    source = row['phase'].get('source') or row['entity'].get('source') or {}
    result = dict(entity_id=row['id'], name=row['name'], display_name=row['name'], level=level,
                  state_id=row['state_id'], state_name=row['state_name'], year=year,
                  control_status=control['status'], time_uncertain=bool(row['phase'].get('uncertain')),
                  book_page=source.get('book_page'), control_source_ids=control.get('source_ids', []))
    if row.get('prefecture_id'):
        result['prefecture_id'] = row['prefecture_id']
    if control.get('reason') and control['status'] != 'administrative':
        result['control_reason'] = control['reason']
    if row['phase'].get('lapsed_state_context'):
        result.update(source_entity_id=row['id'],entity_id=None,administrative_status='lapsed_state_context',is_context=True,inferred=True)
    if row['phase'].get('map_name_override'):
        result.update(administrative_name_override=row['phase']['map_name_override'],name_override_source_ids=row['phase'].get('map_name_override_source_ids',[]))
    return result


def fief_records_for(path, year):
    if not path.exists():
        return []
    doc = json.loads(path.read_text())
    return [r for r in doc.get('records', []) if r.get('begin', r.get('start', 999)) <= year <= r.get('end', -999)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, default=Path.home() / 'Downloads/CHGIS数据.zip')
    parser.add_argument('--simplification', type=float, default=.006)
    parser.add_argument('--years', type=int, nargs='*', default=list(YEARS))
    args = parser.parse_args()
    data = load_js(ROOT / 'data/jin-data.js')
    chgis, inventory = read_chgis(args.archive)
    entities = all_entities(data)
    references, points, original = load_reference_areas(entities)
    placements, cells, unlocated = build_cells(entities, chgis, references, points, original)
    control_path = ROOT / 'data/jin-fief-research/annual-territory-rules.json'
    controls = json.loads(control_path.read_text()) if control_path.exists() else {'rules': []}
    rules = controls.get('rules', [])
    store = GeometryStore(args.simplification)
    years, coverage_report, year_geometry_ids = {}, {}, {}
    ref_by_id = {r['id']:r for r in references}
    chgis_by_name = collections.defaultdict(list)
    for record in chgis['prefecture_area']:
        for name in record.get('name_keys',{record['name_key']}):
            if name:
                chgis_by_name[name].append(record)
    excluded_status = {'external', 'lost', 'enemy', 'withdrawn'}
    for year in args.years:
        rows = rows_for(data, year)
        for level in rows:
            for row in rows[level].values(): row['level'] = level
        controls_for = {level:{eid:effective_control(row, year, rules) for eid,row in rows[level].items()} for level in rows}
        included = {cid:row for cid,row in rows['county'].items() if controls_for['county'][cid]['status'] not in excluded_status}
        seats_by_prefecture=collections.defaultdict(list)
        counties_by_prefecture=collections.defaultdict(list)
        for cid,row in included.items():
            if cid in placements:
                seats_by_prefecture[row['prefecture_id']].append(placements[cid]['point'])
                counties_by_prefecture[row['prefecture_id']].append(cid)
        physical_owners, ref_active = {}, collections.defaultdict(list)
        for cid, row in sorted(included.items()):
            if cid not in placements:
                continue
            physical = placements[cid]['physical']
            if physical not in cells:
                continue
            # Two active co-located entities are kept as separate seat labels;
            # the area is assigned once and the coverage records the limitation.
            physical_owners.setdefault(physical, cid)
            ref_active[placements[cid]['reference']].append(cid)
        county_parts = collections.defaultdict(list)
        for physical, cell in cells.items():
            cid = physical_owners.get(physical)
            if not cid:
                # A still-active county explicitly lost to another power is a
                # hole in the control mask. It must not become a vacant unit
                # that the nearest surviving Jin county absorbs back into Jin.
                excluded_here = [candidate for candidate in cell['county_ids'] if candidate in rows['county'] and controls_for['county'][candidate]['status'] in excluded_status]
                if excluded_here:
                    continue
                options = ref_active[cell['reference']]
                if not options:
                    continue
                # Only ordinary administrative compartments may absorb vacant
                # fitting cells. A partial frontier retains the excluded cells.
                options = [candidate for candidate in options if controls_for['county'][candidate]['status'] not in ('partial', 'contested', 'marker_only', 'nominal')]
                if not options:
                    continue
                cid = min(options, key=lambda c: placements[c]['point'].distance(cell['point']))
            county_parts[cid].append(cell['geometry'])
        county_geometries = {cid:polygonal(unary_union(gs)) for cid,gs in county_parts.items()}
        explicitly_lost_parts = [cells[placements[cid]['physical']]['geometry'] for cid in rows['county'] if cid in placements and placements[cid]['physical'] in cells and controls_for['county'][cid]['status'] in excluded_status and placements[cid]['physical'] not in physical_owners]
        lost_mask = polygonal(unary_union(explicitly_lost_parts)) if explicitly_lost_parts else Polygon()
        prefecture_parts = collections.defaultdict(list)
        for cid, g in county_geometries.items():
            prefecture_parts[included[cid]['prefecture_id']].append(g)
        prefecture_geometries = {pid:polygonal(unary_union(gs)) for pid,gs in prefecture_parts.items()}
        annual_assignment_masks=dict(prefecture_geometries)
        prefecture_sources = {}
        chgis_count = 0
        for pid, row in rows['prefecture'].items():
            status = controls_for['prefecture'][pid]['status']
            if status in excluded_status:
                continue
            names = entities['prefecture'][pid]['names']
            same_year = [record for n in names for record in chgis_by_name[n] if record['begin'] <= year <= record['end']]
            seats = seats_by_prefecture[pid]
            if same_year and status not in ('partial', 'contested', 'marker_only', 'nominal'):
                record = max(same_year, key=lambda r: (sum(r['geometry'].buffer(.025).covers(p) for p in seats), -(r['end']-r['begin']), -r['index']))
                # Reject same-name polygons from another part of the country.
                if seats and any(record['geometry'].buffer(.15).covers(p) for p in seats):
                    preferred_mask = polygonal(record['geometry'].difference(lost_mask))
                    # Some CHGIS intervals retain a coarse parent outline across
                    # a historically dated split (e.g. Danyang/Xuancheng). The
                    # dated county affiliations identify a separate prefecture's
                    # actual seat sites inside that outline. Preserve that new
                    # prefecture's fitting mask; do not swallow it by blindly
                    # accepting the coarse parent polygon for this same year.
                    conflicts=[]
                    for other_pid,other_mask in annual_assignment_masks.items():
                        if other_pid==pid or other_mask.is_empty:
                            continue
                        other_sites=seats_by_prefecture[other_pid]
                        if any(preferred_mask.contains(site) for site in other_sites) and preferred_mask.intersection(other_mask).area>.001:
                            conflicts.append((other_pid,other_mask))
                    if conflicts:
                        preferred_mask=polygonal(preferred_mask.difference(unary_union([g for _,g in conflicts])))
                    prefecture_geometries[pid] = preferred_mask
                    prefecture_sources[pid] = dict(source=record['source'], source_id=record['source_id'], geometry_status='CHGIS_preferred', geometric_certainty='reference', boundary_evidence='CHGIS年度有效面')
                    if conflicts:
                        prefecture_sources[pid].update(geometry_status='CHGIS_reference_annual_fit',geometric_certainty='inferred',boundary_evidence='CHGIS旧郡轮廓含当年别郡县治，按年度县属裁出新郡；分界为推定',source_conflict_prefecture_ids=[other_pid for other_pid,_ in conflicts])
                    chgis_count += 1
                    # County partitions inside the preferred current-year mask
                    # use those same seats. No pseudo county boundary is supplied
                    # as an observed CHGIS county boundary.
                    cids = sorted(counties_by_prefecture[pid])
                    if cids:
                        unique = list(dict.fromkeys((placements[cid]['point'].x, placements[cid]['point'].y) for cid in cids))
                        if len(unique) == len(cids):
                            if len(cids) == 1:
                                gs = [preferred_mask]
                            else:
                                part = voronoi_polygons(MultiPoint([placements[cid]['point'] for cid in cids]), extend_to=box(*preferred_mask.bounds).buffer(2), ordered=True)
                                gs = [polygonal(g.intersection(preferred_mask)) for g in part.geoms]
                            for cid,g in zip(cids,gs): county_geometries[cid] = g
            if pid not in prefecture_sources:
                prefecture_sources[pid] = dict(source='原图郡面约束＋当年CHGIS优先县治＋年度县属合并', geometry_status='annual_county_fit', geometric_certainty='inferred', boundary_evidence='拟合，非史料实测边界')
            if pid not in prefecture_geometries:
                # A still-existing prefecture with zero locatable counties gets
                # an explicit schematic fallback, not invented county seats.
                masks = named_reference(names, references)
                if masks and status not in ('partial', 'contested', 'marker_only', 'nominal'):
                    prefecture_geometries[pid] = polygonal(unary_union([r['geometry'] for r in masks]).difference(lost_mask))
                    prefecture_sources[pid] = dict(source='原图郡面，缺少可定位县治', geometry_status='reference_fallback', geometric_certainty='schematic', boundary_evidence='未拟合县界')
        # Prefer the observed/reference CHGIS masks at mixed-source joins, then
        # clip schematic neighbours against them. Independently substituting a
        # CHGIS area inside old image compartments otherwise overlaps both
        # prefectures. Apply this to the actual serialized masks, and preserve
        # their shared edges when clipping inferred county units below.
        occupied=Polygon()
        priority_order=sorted(prefecture_geometries,key=lambda pid:(not prefecture_sources[pid]['geometry_status'].startswith('CHGIS'),pid))
        for pid in priority_order:
            candidate=store.add(prefecture_geometries[pid])
            if not candidate:
                continue
            serialized=shape(store.values[candidate])
            clipped=polygonal(serialized.difference(occupied))
            ident=store.add(clipped,simplify=False)
            if not ident:
                prefecture_geometries[pid]=Polygon()
                continue
            prefecture_geometries[pid]=shape(store.values[ident])
            occupied=unary_union([occupied,prefecture_geometries[pid]])
        prefecture_geometries={pid:g for pid,g in prefecture_geometries.items() if not g.is_empty}
        for cid,g in list(county_geometries.items()):
            pid=included[cid]['prefecture_id']
            mask=prefecture_geometries.get(pid)
            county_geometries[cid]=polygonal(g.intersection(mask)) if mask is not None else Polygon()
        # Multi-commandery kingdoms are a second relationship on administrative
        # areas. They never change the administrative affiliations or control.
        active_fiefs = fief_records_for(ROOT / 'data/jin-fief-research/annual-multi-commandery-kingdoms.json', year)
        kingdom_rows, membership = [], {}
        for record in active_fiefs:
            if record.get('map_default') is False or record.get('mapping_policy') in ('marker_only', 'annotation_only', 'do_not_merge', 'unknown_transfer_year'):
                continue
            policy=record.get('mapping_policy','')
            names = [key(n) for n in record.get('confirmed_member_commanderies', [])]
            inferred_names = [key(n) for n in record.get('inferred_member_commanderies', [])]
            if policy=='seat_only_unknown_secondary_members':
                names=[key(record.get('seat_commandery') or record['kingdom_name'])]
                inferred_names=[]
            names_for = lambda pid,row: {key(row['name']),key(row['base_name']),*entities['prefecture'][pid]['names']}
            members = [pid for pid,row in rows['prefecture'].items() if names_for(pid,row).intersection(names) and pid in prefecture_geometries]
            inferred_members = [pid for pid,row in rows['prefecture'].items() if names_for(pid,row).intersection(inferred_names) and pid in prefecture_geometries and pid not in members]
            # Research inferences remain visible with hatching and explicit
            # provenance; excluded or fallen land never enters a kingdom union.
            total_members = members + inferred_members
            if not total_members:
                continue
            fief_id = record.get('id') or record.get('fief_id') or 'annual-' + key(record['kingdom_name'])
            seat_key = key(record.get('seat_commandery') or record['kingdom_name'])
            for pid in total_members:
                row = rows['prefecture'][pid]
                is_seat = seat_key in names_for(pid,row) or key(record['kingdom_name']) in names_for(pid,row)
                membership[pid] = dict(fief_id=fief_id, member_role='seat' if is_seat else 'branch', inferred=pid in inferred_members)
            kingdom_rows.append((record, fief_id, total_members, inferred_members, polygonal(unary_union([prefecture_geometries[pid] for pid in total_members]))))
        for pid,row in rows['prefecture'].items():
            if pid not in prefecture_geometries or pid in membership:
                continue
            if row['phase'].get('is_fief') or row['name'].endswith(('國','国')):
                fief_id = 'annual-single-' + pid
                membership[pid] = dict(fief_id=fief_id,member_role='seat',inferred=False)
                record = dict(kingdom_name=row['name'],certainty='confirmed',source_ids=['yearbook'],rank=row['phase'].get('fief_rank'))
                kingdom_rows.append((record,fief_id,[pid],[],prefecture_geometries[pid]))
        features = []
        def add(g, properties, simplify=True):
            ident = store.add(g,simplify=simplify)
            if ident:
                features.append(dict(geometry_id=ident, properties=properties))
        state_parts = collections.defaultdict(list)
        territory_parts = collections.defaultdict(list)
        control_summary = collections.Counter()
        for pid,g in sorted(prefecture_geometries.items()):
            row = rows['prefecture'][pid]
            ctl = controls_for['prefecture'][pid]
            p = common_properties(row, 'prefecture', ctl, year)
            p.update(prefecture_sources[pid], layer='prefecture_areas', base_name=row['base_name'], coordinate_role='administrative_area_schematic')
            if pid in membership:
                member = membership[pid]
                p.update(fief_id=member['fief_id'], member_role=member['member_role'], membership_evidence='inferred' if member['inferred'] else 'confirmed')
                if member['member_role'] == 'branch': p['display_name'] = key(row['name']) + '支郡'
                else:
                    multi_name=next((record['kingdom_name'] for record, fid, members, inferred_members, kg in kingdom_rows if fid==member['fief_id']),row['name'])
                    p['display_name']=key(multi_name)+'國'
            add(g,p,simplify=False)
            boundary = dict(p, layer='member_boundaries' if pid in membership else 'prefecture_boundaries', coordinate_role='boundary')
            add(g,boundary,simplify=False)
            state_parts[row['state_id']].append(g)
            control_summary[ctl['status']] += 1
            if ctl['status'] != 'nominal': territory_parts[row['state_id']].append(g)
        for sid,gs in sorted(state_parts.items()):
            row = rows['state'][sid]
            ctl = controls_for['state'][sid]
            p = common_properties(row, 'state', ctl, year)
            p.update(layer='province_areas', source='当年郡属聚合；边界含拟合段', geometry_status='annual_prefecture_union', geometric_certainty='inferred', coordinate_role='administrative_area_schematic')
            g = polygonal(unary_union(gs)); add(g,p); add(g,dict(p,layer='province_boundaries',coordinate_role='boundary'))
        for cid,g in sorted(county_geometries.items()):
            if cid not in included or g.is_empty:
                continue
            row = included[cid]; ctl = controls_for['county'][cid]
            p = common_properties(row, 'county', ctl, year)
            p.update(layer='county_areas', source='受旧郡界/同年CHGIS郡面约束的县治分区拟合', geometry_status='constrained_seat_fit', geometric_certainty='inferred', inferred=True, boundary_evidence='非史料县界', coordinate_role='inferred_county_area')
            add(g,p,simplify=False)
        located = 0
        for cid,row in sorted(included.items()):
            if cid not in placements:
                continue
            located += 1
            e = entities['county'][cid]
            point, method = choose_point(e, 'county', chgis['county'], references, original, year)
            placement = placements[cid]
            point = point or dict(geometry=placement['point'], source=placement['source'], source_id=placement['source_id'])
            p = common_properties(row, 'county', controls_for['county'][cid], year)
            p.update(layer='county_seats', source=point['source'], source_id=point['source_id'], coordinate_role='administrative_seat', geometric_certainty='reference', location_match=method, coordinate_time='同年CHGIS参考点' if point.get('begin',999)<=year<=point.get('end',-999) else '289/308或本时期参考点，非独立当年县治考证', show_label=True)
            if placement.get('coordinate_conflict'):
                p['coordinate_conflict']=placement['coordinate_conflict']
            add(point['geometry'],p)
        for level, layer in [('prefecture','prefecture_seats'), ('state','state_seats')]:
            for eid,row in sorted(rows[level].items()):
                if level=='state' and row['phase'].get('lapsed_state_context'):
                    continue
                ctl = controls_for[level][eid]
                if ctl['status'] in excluded_status:
                    continue
                point, method = choose_point(entities[level][eid], level, chgis[level], references, original, year)
                if not point:
                    continue
                p = common_properties(row, level, ctl, year)
                p.update(layer=layer, source=point['source'], source_id=point['source_id'], coordinate_role='administrative_seat', geometric_certainty='reference', show_label=level=='state')
                add(point['geometry'],p)
        for record,fief_id,members,inferred_members,g in kingdom_rows:
            kingdom_name=key(record['kingdom_name'])+'國'
            p = dict(layer='kingdom_areas', name=kingdom_name, display_name=kingdom_name, level='fief', year=year, fief_id=fief_id,
                     member_entity_ids=members, member_names=[rows['prefecture'][pid]['name'] for pid in members],
                     has_inference=bool(inferred_members) or record.get('certainty') in ('inferred','uncertain','unknown','low','medium'),
                     inferred_member_entity_ids=inferred_members, is_multi=len(members)>1, source='年度多郡王国研究＋当年郡面',
                     source_ids=record.get('source_ids',[]), holder=record.get('holder',''), notes=record.get('notes',[]), certainty=record.get('certainty','confirmed'),geometric_certainty='inferred', coordinate_role='fief_range_schematic')
            add(g,p)
        for sid,parts in sorted(territory_parts.items()):
            # Territory is tiled by province so its background reuses the same
            # shared geometry IDs as province areas. A giant union for each
            # changed year would repeatedly embed almost all unchanged edges.
            add(polygonal(unary_union(parts)),dict(layer='territory',name='西晋年度行政与控制参考范围',state_id=sid,level='territory',year=year,source='当年有效郡县＋独立控制沿革规则',geometric_certainty='inferred',geometry_status='administrative_control_union',coordinate_role='territory_reference'))
        # Three short-lived Jiaozhou footholds are explicitly point-only: their
        # later full prefectural masks are not backdated into certain territory.
        extra_count = 0
        for extra in controls.get('extra_entities', []):
            if not extra['start'] <= year <= extra['end']:
                continue
            eid = extra.get('entity_id') or extra.get('id')
            if eid not in entities['prefecture']:
                continue
            coordinates = extra.get('coordinate')
            if not coordinates:
                continue
            name = extra.get('name') or entities['prefecture'][eid]['entity']['base_name']
            add(Point(*coordinates),dict(layer='labels',source_entity_id=eid,name=name,display_name=name,level='state',year=year,source='原图文字锚点仅作历史注记布局位置，非当年治所坐标',coordinate_role=extra.get('coordinate_role','original_map_layout_anchor_not_historical_seat'),control_status=extra.get('status','partial'),control_reason=extra.get('reason',''),source_ids=extra.get('source_ids',[]),marker_only=True,inferred=True,show_label=True))
            extra_count += 1
        if year < 280:
            add(Point(117,25.7),dict(layer='labels',name='孫吳方向',display_name='孫吳方向（未繪內部政區）',level='state',year=year,source='晋吴对峙背景提示；非精确吴国边界',coordinate_role='context_text_anchor',control_status='external',show_label=True))
        counts = collections.Counter(f['properties']['layer'] for f in features)
        orphan_counties=[]
        for cid,e in entities['county'].items():
            if phase(e['entity'],year) and not phase(e['prefecture'],year):
                orphan_counties.append(dict(id=cid,name=phase(e['entity'],year).get('name',e['entity']['base_name']),prefecture_id=e['prefecture']['id'],reason='县期段有效但父郡期段已结束，未据此虚构仍存在整郡；待沿革校勘'))
        coverage = dict(year=year, states_total=sum(not r['phase'].get('lapsed_state_context') for r in rows['state'].values()), residual_groups=sum(bool(r['phase'].get('lapsed_state_context')) for r in rows['state'].values()), prefectures_total=len(rows['prefecture']),
                        counties_total=len(rows['county']), counties_included=len(included), located=located, unlocated=len(included)-located,
                        counties_located=located, counties_unlocated=len(included)-located,
                        inferred_county_areas=counts['county_areas'], prefecture_areas=counts['prefecture_areas'],
                        chgis_prefecture_areas=chgis_count, kingdom_areas=counts['kingdom_areas'],
                        control_summary=dict(control_summary), marker_only_extras=extra_count,
                        feature_count=len(features), ancestor_date_conflicts=orphan_counties,messages=['县界全部为受旧郡界约束的县治分区拟合，不是史料实测县界。','无坐标县保留正文，不虚构县治。', 'CHGIS同年郡面优先，原图与拟合范围属于地理参考。'])
        yearfile = ROOT / f'data/jin-maps/annual-years/{year}.json'
        write_json(yearfile, dict(year=year, features=features, coverage=coverage))
        years[str(year)] = dict(year=year,data_url=f'data/jin-maps/annual-years/{year}.json',coverage=coverage)
        year_geometry_ids[str(year)]={f['geometry_id'] for f in features}
        coverage_report[str(year)] = coverage
        print(f'{year}: {located}/{len(included)} county seats, {counts["county_areas"]} inferred county cells, {counts["prefecture_areas"]} prefectures, {chgis_count} CHGIS masks', flush=True)
    # Widely reused geometries live in the index. Less common geometries are
    # packed by their year-use signature into modest lazy-loaded shards.
    usage=collections.defaultdict(list)
    for year,ids in year_geometry_ids.items():
        for ident in ids: usage[ident].append(int(year))
    published_geometries={ident:g for ident,g in store.values.items() if ident in usage}
    common={ident:g for ident,g in published_geometries.items() if len(usage[ident])>=25}
    rare_groups=collections.defaultdict(dict)
    for ident,g in published_geometries.items():
        if ident not in common:
            rare_groups[tuple(sorted(usage[ident]))][ident]=g
    shards,geometry_shard,current,current_bytes=[],{}, {},0
    def flush_shard():
        nonlocal current,current_bytes
        if not current:return
        number=len(shards)+1
        url=f'data/jin-maps/annual-geometry/g{number:03d}.json'
        path=ROOT/url
        write_json(path,dict(version=1,geometries=current))
        shards.append(dict(url=url,bytes=path.stat().st_size,geometry_count=len(current)))
        for ident in current:geometry_shard[ident]=url
        current,current_bytes={},0
    for signature,group in sorted(rare_groups.items()):
        for ident,g in sorted(group.items()):
            size=len(json.dumps(g,separators=(',',':')))+len(ident)+8
            if current and current_bytes+size>600000:flush_shard()
            current[ident]=g;current_bytes+=size
    flush_shard()
    shard_paths={ROOT/s['url'] for s in shards}
    for path in (ROOT/'data/jin-maps/annual-geometry').glob('g*.json'):
        if path not in shard_paths:
            path.unlink()
    shard_sizes={s['url']:s['bytes'] for s in shards}
    for year,ids in year_geometry_ids.items():
        urls=sorted({geometry_shard[ident] for ident in ids if ident in geometry_shard})
        years[year]['geometry_urls']=urls
        years[year]['extra_geometry_bytes']=sum(shard_sizes[url] for url in urls)
    bundle = dict(version=1,meta=dict(dynasty='western-jin',years=[min(args.years),max(args.years)],crs='EPSG:4326',
        width=2400,height=1986,plot=[80,140,2320,1906],extent=[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462],
        date_rule='年末口径；年度源表有效期与控制规则分列，模糊起年仍属推定。',
        geometric_method='以308/289原图郡面作约束容器，按CHGIS优先县治建立分区，按当年县属聚合郡州；同年CHGIS郡面优先。',
        county_boundary_status='ALL INFERRED: constrained nearest-seat fitting cells, not observed historical county boundaries',
        control_rule_file='data/jin-fief-research/annual-territory-rules.json',
        fief_rule_file='data/jin-fief-research/annual-multi-commandery-kingdoms.json',
        snapshot_289_308_unchanged=True,source_inventory=inventory),geometries=common,geometry_shards=shards,years=years)
    write_json(ROOT / 'data/jin-maps/annual-geography.json',bundle)
    report = dict(method=bundle['meta'],reference_compartments=len(references),physical_county_cells=len(cells),county_entities=len(entities['county']),
                  matched_entities=len(placements),unlocated_entities=unlocated,geometry_count=len(published_geometries),common_geometry_count=len(common),
                  index_bytes=(ROOT/'data/jin-maps/annual-geography.json').stat().st_size,geometry_shards=shards,
                  max_year_extra_geometry_bytes=max((y['extra_geometry_bytes'] for y in years.values()),default=0),years=coverage_report)
    write_json(ROOT / 'reports/jin-annual-coverage.json', report, compact=False)
    print(f'Shared geometries: {len(store.values)}, common {len(common)}, index {(ROOT / "data/jin-maps/annual-geography.json").stat().st_size:,} bytes, {len(shards)} lazy shards', flush=True)


if __name__ == '__main__':
    main()
