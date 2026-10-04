#!/usr/bin/env python3
"""Build dated Jin maps from Tan 262/281, reviewed annual rows and local 308 evidence.

Full source layers are archived losslessly. 281 supplies the stable shared
compartments; 262 restores earlier divisions and 308 supplies only later local
divisions. County seats constrain amendments inside affected compartments.
No county polygon is published. Old maps are never overwritten.
Run with the project's Shapely 2.1 runtime (PYTHONPATH=work/_gis_deps).
"""
from __future__ import annotations
import argparse, collections, gzip, hashlib, importlib.util, json, math, re, sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from shapely import make_valid, normalize, set_precision, voronoi_polygons
from shapely.geometry import shape, mapping, Point, Polygon, MultiPoint, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'data/jin-maps/three-basemap-annual'
SOURCES = ROOT/'data/jin-maps/three-basemap-sources'
LOCAL = ROOT/'work/jin-three-basemap'
GRID = .000001
YEARS = range(266,317)
GEOMETRY_EXCEPTIONS={
    'p033':dict(years=[283,283],mother='趙國',book_pages=[621,623],reason='中丘始置年份不確定；本年縣目仍列趙國，三底圖及同年CHGIS均無獨立郡面，未補定轉屬年。'),
    'p109':dict(years=[290,290],mother='巴西郡',book_pages=[666],reason='宕渠復置與領縣有前後限定；本年縣目仍列巴西，無可直接使用的獨立郡面，未補定轉屬年。'),
    'p166':dict(years=[290,290],mother='義陽郡／襄陽郡',book_pages=[709,712,713],reason='新野復置與領縣有前後限定；本年縣目仍列原郡，無可直接使用的獨立郡面，未補定轉屬年。'),
    'p138':dict(years=[313,316],mother='牂柯郡',book_pages=[682,683],reason='通史記313分牂柯置，領平夷、鱉；現存圖面及CHGIS缺這兩縣的可定位源點和郡界，不能把廣東同名平夷點用於寧州。'),
    'p186':dict(years=[307,316],mother='南郡',book_pages=[725,726],reason='荊州成都起訖為307後至316前，分南郡華容等置；本年無可用治所或豐都縣源點，不能套用益州成都。')
}

def module(name, path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    obj=importlib.util.module_from_spec(spec);sys.modules[name]=obj;spec.loader.exec_module(obj);return obj

old=module('jin_three_old','scripts/build-jin-prefecture-completion.py')
annual=old.annual
colours=module('jin_three_colours','scripts/build-jin-fief-colors.py')

def read(path):
    path=Path(path)
    return json.loads(gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_bytes())

def write(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n')

def clean(g):
    return old.clean(g)

def union(gs):
    gs=[g for g in gs if not g.is_empty]
    return clean(unary_union(gs)) if gs else Polygon()

def lineal(g):
    if g.geom_type in ('LineString','MultiLineString'):return g
    return unary_union([lineal(p) for p in getattr(g,'geoms',[]) if p.geom_type in ('LineString','MultiLineString','GeometryCollection')])

def key(s):
    s=annual.key(str(s or '').translate(str.maketrans({'党':'黨','冯':'馮','莱':'萊','张':'張','贺':'賀','带':'帶','属':'屬','渔':'漁'})))
    s=s.replace('合浦屬國都尉','合浦屬')
    return {'巨鹿':'鉅鹿','牂柯':'牂牁','右北平':'北平','毗陵典農校尉':'毗陵',
            '廣魏':'略陽','東廣漢':'廣漢','東':'濮陽','山陽':'高平'}.get(s,s)

def archive_sources():
    roots={262:Path('/Users/yujiangnan/Documents/Codex/2026-10-02/ni/outputs/三国262年'),
           281:Path('/Users/yujiangnan/Documents/Codex/2026-10-02/ni/outputs/修订版')}
    layers=['jun_guo_territories','jun_guo_names','all_source_names','zhou_territories',
            'jun_boundaries_partial','source_date_annotations','historical_coastline']
    manifest=[]
    for year,root in roots.items():
        for layer in layers:
            dest=SOURCES/f'tan{year}-{layer}.geojson.gz';src=root/'gis'/f'{layer}.geojson'
            if src.exists():
                raw=src.read_bytes();dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(gzip.compress(raw,mtime=0))
            elif dest.exists():raw=gzip.decompress(dest.read_bytes())
            else:raise FileNotFoundError(src)
            manifest.append(dict(id=f'tan{year}-{layer}',source_year=year,tier=1,path=str(dest.relative_to(ROOT)),
                original_path=str(src),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),
                feature_count=len(json.loads(raw)['features']),lossless_archive=True,crs='EPSG:4326'))
    original=Path('/Users/yujiangnan/Documents/Codex/2026-10-01/289-svg-chatgpt-library-file-libfile/work/original/成果/GeoJSON/308_prefecture_areas.geojson')
    dest=SOURCES/'circa308-prefecture_areas.geojson.gz'
    if original.exists():raw=original.read_bytes();dest.write_bytes(gzip.compress(raw,mtime=0))
    elif dest.exists():raw=gzip.decompress(dest.read_bytes())
    else:
        raw=json.dumps(dict(type='FeatureCollection',features=[f for f in read(ROOT/'data/jin-maps/308_map.geojson')['features'] if f['properties'].get('layer')=='prefecture_areas']),ensure_ascii=False).encode()
        dest.write_bytes(gzip.compress(raw,mtime=0))
    manifest.append(dict(id='circa308-prefecture_areas',source_year=308,source_date='circa_308_not_synchronous_snapshot',
        tier=2,path=str(dest.relative_to(ROOT)),original_path=str(original),sha256=hashlib.sha256(raw).hexdigest(),
        bytes=len(raw),feature_count=len(json.loads(raw)['features']),lossless_archive=True,
        source_identity='earlier_full_resolution_mixed_image_CHGIS_delivery_not_pure_user_original',
        fallback_web_simplification_degrees=None if original.exists() else .003))
    video_source=ROOT/'work/jin-video/annual-georeference/annual-territories.geojson'
    video_archive=SOURCES/'video-annual-control.geojson.gz'
    if video_source.exists():
        raw=video_source.read_bytes();video_archive.write_bytes(gzip.compress(raw,mtime=0))
    elif video_archive.exists():raw=gzip.decompress(video_archive.read_bytes())
    else:raise FileNotFoundError(video_source)
    manifest.append(dict(id='video-annual-control',path=str(video_archive.relative_to(ROOT)),
        original_path=str(video_source),sha256=hashlib.sha256(raw).hexdigest(),
        purpose='political_control_only_no_shoreline',years=[266,316],lossless_archive=True))
    chgis_archive=SOURCES/'chgis-266-316.geojson.gz'
    if not chgis_archive.exists():
        records,inventory=annual.read_chgis(Path.home()/'Downloads/CHGIS数据.zip')
        features=[]
        for level,items in records.items():
            for record in items:
                props={k:sorted(v) if isinstance(v,set) else v for k,v in record.items() if k!='geometry'}
                features.append(dict(type='Feature',geometry=mapping(record['geometry']),properties=dict(props,record_level=level)))
        raw=json.dumps(dict(type='FeatureCollection',features=features,inventory=inventory,
            point_coordinates_preserved=True,source='CHGIS local source subset; only records intersecting 266—316'),ensure_ascii=False,separators=(',',':')).encode()
        chgis_archive.write_bytes(gzip.compress(raw,mtime=0))
    else:raw=gzip.decompress(chgis_archive.read_bytes())
    manifest.append(dict(id='dated-CHGIS-subset',path=str(chgis_archive.relative_to(ROOT)),
        sha256=hashlib.sha256(raw).hexdigest(),tier=1,years=[266,316],
        point_coordinates_preserved=True,original_archive='CHGIS数据.zip',
        attribution='CHGIS Harvard/Fudan; see data/jin-maps/CHGIS_V6_README.txt'))
    write(SOURCES/'manifest.json',dict(version=1,date='2026-10-04',sources=manifest,
        priority=[['Tan262','Tan281','dated_CHGIS_points_and_areas'],['circa308_user_map']],
        control_only='Shituguan_video',county_areas_public=False))
    return manifest

def source_units(year):
    if year==308:
        fs=read(SOURCES/'circa308-prefecture_areas.geojson.gz')['features']
        return [dict(id=f'user308-{i}',year=308,name=f['properties'].get('base_name') or f['properties'].get('name',''),
                    names={key(f['properties'].get('base_name') or f['properties'].get('name'))},
                    state=f['properties'].get('state_name',''),properties=f['properties'],geometry=clean(shape(f['geometry'])))
                for i,f in enumerate(fs)]
    labels=read(SOURCES/f'tan{year}-jun_guo_names.geojson.gz')['features']
    members=collections.defaultdict(set);anchors=collections.defaultdict(dict)
    for f in labels:
        uid=f['properties'].get('unit_id');name=key(f['properties'].get('name'))
        members[uid].add(name);anchors[uid][name]=shape(f['geometry'])
    result=[]
    for f in read(SOURCES/f'tan{year}-jun_guo_territories.geojson.gz')['features']:
        p=f['properties'];uid=p['unit_id'];names=members[uid] or {key(p['name'])}
        if '；' in p.get('original_names',''):names.update(key(n) for n in p['original_names'].split('；'))
        if key(p.get('state'))=='交' and key(p['name'])=='新興':names.add('新昌')
        result.append(dict(id=f'tan{year}-{uid}',year=year,name=p['name'],names=names,anchors=anchors[uid],state=p.get('state',''),
                           properties=p,geometry=clean(shape(f['geometry']))))
    return result

def load_rows(data,path):
    if not path.exists():raise FileNotFoundError('Reviewed annual rows are required: '+str(path))
    reviewed=read(path);entities=annual.all_entities(data);years={}
    for year in YEARS:
        rows={'state':{},'prefecture':{},'county':{}}
        original_groups={}
        for p in reviewed['years'][str(year)]:
            sid=p['state_id'];s=entities['state'][sid]['entity'];pe=entities['prefecture'][p['id']]['entity']
            ph=dict(start=year,end=year,name=p['name'],uncertain=p.get('uncertain',False),source=p.get('source',{}),is_fief=p.get('is_fief',False))
            rows['state'][sid]=dict(id=sid,name=p['state_name'],state_id=sid,state_name=p['state_name'],entity=s,
                is_context=p.get('residual_state_grouping',False),
                phase=dict(start=year,end=year,name=p['state_name'],source=s.get('source',{}),lapsed_state_context=p.get('residual_state_grouping',False)))
            rows['prefecture'][p['id']]=dict(p,phase=ph,entity=pe)
            if p.get('transfer_origin_grouping'):
                if not p.get('geometry_parent_id') and not p.get('geometry_parent_ids'):raise ValueError(f'{year} {p["id"]}: origin group needs geometry parent')
                original_groups[p['id']]=p.get('geometry_parent_id')
            for c in p.get('counties',[]):
                ce=next(e for e in pe['counties'] if e['id']==c['id'])
                cid=p['id']+':'+c['id']
                rows['county'][cid]=dict(c,id=cid,yearbook_entity_id=c['id'],entity_key=c.get('entity_key',p['id']+'/'+c['id']),
                    display_prefecture_id=p['id'],prefecture_id=p['id'],prefecture_name=p['name'],state_id=p['state_id'],state_name=p['state_name'],entity=ce,
                    phase=dict(start=year,end=year,name=c['name'],uncertain=c.get('uncertain',False),source=c.get('source',{})))
        for c in rows['county'].values():
            # Editorial placement and the documented event year are separate.
            # Explicit annual transfers change geometry in their actual year.
            explicit_transfer=c.get('transfer_destination_id') and c.get('transfer_event_certainty')=='dated_in_source'
            if explicit_transfer or c['prefecture_id'] in original_groups:
                destination=c.get('transfer_destination_id') or original_groups[c['prefecture_id']]
                if destination not in rows['prefecture']:raise ValueError(f'{year}: missing geometry parent {destination}')
                p=rows['prefecture'][destination]
                c.update(prefecture_id=destination,state_id=p['state_id'],state_name=p['state_name'],prefecture_name=p['name'])
                c['geometry_year_note']='表格按转出方列县，本年边界据已发生转属；原始县点坐标不变'
        for pid in original_groups:rows['prefecture'].pop(pid)
        years[year]=rows
    return years,reviewed

def names_for(row):
    return {key(row.get('name')),key(row.get('base_name')),
            *[key(p.get('name')) for p in row.get('entity',{}).get('phases',[])]}-{''}

def choose_unit(row,units,point=None):
    choices=[u for u in units if names_for(row)&u['names']]
    if not choices:return None
    if point is not None:
        choices.sort(key=lambda u:u['geometry'].distance(point))
        if choices[0]['geometry'].distance(point)<.75:return choices[0]
        return None
    state=[u for u in choices if key(u['state'])==key(row.get('state_name'))]
    return state[0] if len(state)==1 else choices[0] if len(choices)==1 else None

def county_identity(f):
    p=f['properties'];xy=f['geometry']['coordinates']
    return (annual.county_key(p['name']),round(xy[0],2),round(xy[1],2))

def round_geometry(value):
    if isinstance(value,(list,tuple)):return [round_geometry(x) for x in value]
    if isinstance(value,dict):return {k:round_geometry(v) for k,v in value.items()}
    return round(value,6) if isinstance(value,float) else value

def pack(trials):
    registry={};years={};OUT.mkdir(parents=True,exist_ok=True)
    for year,trial in trials.items():
        features=[];inline={};need=set()
        for f in trial['features']:
            geom=f['geometry']
            if geom['type']!='Point':geom=round_geometry(mapping(normalize(shape(geom))))
            raw=json.dumps(geom,separators=(',',':'),sort_keys=True);gid='g'+hashlib.sha256(raw.encode()).hexdigest()[:16]
            if geom['type']=='Point':inline[gid]=geom
            else:registry.setdefault(gid,geom);need.add(gid)
            features.append(dict(geometry_id=gid,properties=f['properties']))
        years[year]=dict(trial,features=features,geometries=inline,_need=need)
    # One global packing avoids repeated national polygon copies in every year.
    gids=sorted(registry);shards=[];gid_url={};values={};size=0
    def flush():
        nonlocal values,size
        if not values:return
        raw=json.dumps(dict(version=1,geometries=values),separators=(',',':'))+'\n'
        filename='geometry-'+hashlib.sha256(raw.encode()).hexdigest()[:16]+'.json.gz';p=OUT/filename
        compressed=gzip.compress(raw.encode(),mtime=0);p.write_bytes(compressed)
        url=str(p.relative_to(ROOT));shards.append(dict(url=url,bytes=len(compressed),uncompressed_bytes=len(raw),geometry_count=len(values)))
        for gid in values:gid_url[gid]=url
        values={};size=0
    for gid in gids:
        n=len(json.dumps(registry[gid],separators=(',',':')))
        if values and size+n>1000000:flush()
        values[gid]=registry[gid];size+=n
    flush();manifest=dict(type='JinThreeBasemapGraphIndex',version=1,crs='EPSG:4326',geometry_encoding='gzip',geometry_shards=shards,years={})
    for year,sliced in years.items():
        sliced['geometry_urls']=sorted({gid_url[g] for g in sliced.pop('_need')})
        p=OUT/f'{year}.json';write(p,sliced);p.with_suffix('.json.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
        manifest['years'][str(year)]=dict(data_url=str(p.relative_to(ROOT)),geometry_urls=sliced['geometry_urls'],coverage=sliced['coverage'])
    write(OUT/'graph.json',manifest);(OUT/'graph.json.gz').write_bytes(gzip.compress((OUT/'graph.json').read_bytes(),mtime=0))
    keep={Path(s['url']).name for s in shards}
    for p in OUT.glob('geometry-*'):
        if p.name not in keep:p.unlink()
    return manifest

class Builder:
    def __init__(self,rows_path):
        self.data=annual.load_js(ROOT/'data/jin-data.js');self.entities=annual.all_entities(self.data)
        self.rows,self.reviewed=load_rows(self.data,rows_path)
        for rows in self.rows.values():
            for cid,row in rows['county'].items():
                pe=self.entities['prefecture'][row['display_prefecture_id']]
                self.entities['county'][cid]=dict(entity=row['entity'],names={annual.county_key(row['name'])},
                    state=pe['state'],prefecture=pe['entity'])
        annual.all_entities=lambda data:self.entities
        # The existing CHGIS selector consumes the same corrected annual table.
        annual.rows_for=lambda data,year:self.rows[year]
        subset=read(SOURCES/'chgis-266-316.geojson.gz');chgis=collections.defaultdict(list)
        self.chgis_inventory=subset['inventory']
        for f in subset['features']:
            p=dict(f['properties']);level=p.pop('record_level');p['name_keys']=set(p['name_keys']);p['geometry']=shape(f['geometry']);chgis[level].append(p)
        self.chgis_areas=chgis.get('prefecture_area',[])
        self.points=old.point_priority.AnnualPointIndex(self.data,annual=annual,chgis=chgis)
        for rows in self.rows.values():
            for cid,row in rows['county'].items():
                original=self.points.original.get(row['yearbook_entity_id'])
                if original and annual.county_key(original.get('name'))==annual.county_key(row['name']):self.points.original[cid]=original
        self.units={y:source_units(y) for y in (262,281,308)}
        self.yearpoints={};self.pointreports={};self.rejected_points={};self.maps={};self.events=[];self.mapping=[]
        self.rules=annual.load_js(ROOT/'data/jin-multi-kingdoms.js')
        self.polity=read(SOURCES/'video-annual-control.geojson.gz')['features']
        self.units[281]=[u for u in self.units[281] if not u['names'].intersection({'樂浪','帶方'})]
        self.domain=clean(union([u['geometry'] for u in self.units[281]]).intersection(box(*old.PRESENTATION['extent'])))
        old_domain=union([clean(shape(f['geometry'])) for f in read(ROOT/'data/jin-maps/308_map.geojson')['features'] if f['properties'].get('layer')=='province_areas'])
        # Keep the Tan outer boundary. The old lower-ranked coast may describe
        # the study scope, but must not cut the higher-resolution shoreline.
        self.scope_comparison=dict(old_area=old_domain.area,new_area=self.domain.area,
            original_only_area=old_domain.difference(self.domain).area,new_only_area=self.domain.difference(old_domain).area,
            excluded_named_scope=['樂浪／帶方共同圖示範圍（朝鮮半島）','西域參考層'],viewport=old.PRESENTATION['extent'])
        self.units[281]=[dict(u,geometry=clean(u['geometry'].intersection(self.domain))) for u in self.units[281]]
        self.units[281]=[u for u in self.units[281] if not u['geometry'].is_empty]
        # Source overlaps are removed in a fixed order so adjacent units share
        # precisely one edge. Every operation uses the same sub-metre grid.
        occupied=Polygon()
        for u in self.units[281]:
            u['geometry']=clean(u['geometry'].difference(occupied));occupied=union([occupied,u['geometry']])
        self.domain=occupied
        self.get_points(281)
        self.baseline_assign=self.match_rows(281)
        self.baseline_counties=collections.defaultdict(list)
        for f in self.yearpoints[281]:
            p=f['properties']
            if p.get('level')!='county':continue
            row=self.rows[281]['county'].get(p.get('entity_id'))
            if not row:continue
            uid=self.baseline_assign.get(row['prefecture_id'])
            if uid:self.baseline_counties[uid].append(f)

    def get_points(self,year):
        if year not in self.yearpoints:
            fs,report=self.points.features_for(year)
            accepted=[];rejected=[]
            for f in fs:
                p=f['properties'];level=p.get('level');row=self.rows[year].get(level,{}).get(p.get('entity_id'))
                parent=self.rows[year]['prefecture'].get(row.get('prefecture_id')) if row and level=='county' else row
                masks=[]
                if parent and level in ('county','prefecture') and p.get('location_match')=='CHGIS_current_unique_name':
                    matches=[choose_unit(parent,self.units[y]) for y in (281,262,308)]
                    masks=[u['geometry'] for u in matches if u]
                    if not masks:
                        masks=[u['geometry'] for units in self.units.values() for u in units if key(u['state'])==key(parent['state_name'])]
                distance=min((g.distance(shape(f['geometry'])) for g in masks),default=0)
                if distance>2:
                    # A unique name in an incomplete source is not a unique
                    # historical identity (e.g. 九德西安 versus 齊郡西安).
                    # Keep the observation as unlinked; never move its point.
                    reason='same_name_source_point_in_distant_other_region'
                    report['unresolved'].append(dict(entity_id=p.get('entity_id'),name=p['name'],level=level,
                        source_id=p.get('source_id'),reason=reason,distance_degrees=distance))
                    stats=report['levels'][level];stats['current_CHGIS_points']-=1;stats['unlocated']+=1
                    stats['match_methods']['CHGIS_current_unique_name']-=1
                    stats['match_methods'][reason]=stats['match_methods'].get(reason,0)+1
                    q=dict(p,layer='reference_'+p['layer'],entity_id=None,source_entity_id=None,is_reference=True,
                        location_match='CHGIS_current_unlinked_source_record',reference_reason='同名点远离已知郡境，保留源点但不绑定年表实体')
                    q.pop('prefecture_id',None);q.pop('state_id',None);q.pop('state_name',None)
                    rejected.append(dict(f,properties=q))
                else:accepted.append(f)
            self.yearpoints[year]=accepted;self.pointreports[year]=report;self.rejected_points[year]=rejected
        return self.yearpoints[year]

    def match_rows(self,year):
        self.get_points(year)
        seats={f['properties']['entity_id']:shape(f['geometry']) for f in self.yearpoints[year] if f['properties'].get('level')=='prefecture'}
        result={}
        for pid,row in self.rows[year]['prefecture'].items():
            if names_for(row)&{'樂浪','帶方'}:continue
            u=choose_unit(row,self.units[281],seats.get(pid))
            if u:result[pid]=u['id']
        return result

    def geography(self,year):
        rows=self.rows[year];points=self.get_points(year);matched=self.match_rows(year)
        byunit=collections.defaultdict(set)
        for pid,uid in matched.items():byunit[uid].add(pid)
        county_points=[f for f in points if f['properties'].get('level')=='county']
        county_by_identity={county_identity(f):f for f in county_points}
        county_by_name=collections.defaultdict(list)
        for f in county_points:county_by_name[annual.county_key(f['properties']['name'])].append(f)
        seats={f['properties']['entity_id']:shape(f['geometry']) for f in points if f['properties'].get('level')=='prefecture'}
        additions=collections.defaultdict(list);provenance=collections.defaultdict(list);events=[]
        # New and former entities select an explicit local source; they may not
        # replace unaffected national boundary compartments.
        local_candidates={}
        for pid,row in rows['prefecture'].items():
            if names_for(row)&{'樂浪','帶方'}:continue
            if pid not in matched:
                preferred=262 if year<281 else 308
                u=choose_unit(row,self.units[preferred],seats.get(pid))
                if u:local_candidates[pid]=u
            elif len(byunit[matched[pid]])<2:continue
            # Dated CHGIS faces have the same source rank as Tan. For a new
            # entity absent from 281, use a uniquely matched current CHGIS
            # face before a lower-ranked 308 reconstruction.
            areas=[r for r in self.chgis_areas if r['begin']<=year<=r['end'] and key(r['name']) in names_for(row)]
            if pid in seats:areas=[r for r in areas if r['geometry'].distance(seats[pid])<.75]
            if len(areas)==1:
                r=areas[0]
                local_candidates[pid]=dict(id='CHGIS-'+str(r['source_id']),year=year,name=r['name'],
                    geometry=clean(r['geometry']),tier=1,valid_from=r['begin'],valid_to=r['end'],source=r['source'])
        for u in self.units[281]:
            mask=u['geometry'];base=set(byunit[u['id']]);seeds=[];county_transfers=[]
            for oldpoint in self.baseline_counties[u['id']]:
                current=county_by_identity.get(county_identity(oldpoint))
                if not current:
                    candidates=county_by_name.get(annual.county_key(oldpoint['properties']['name']),[])
                    if len(candidates)==1:current=candidates[0]
                if not current:continue
                row=rows['county'].get(current['properties']['entity_id'])
                if not row:continue
                pid=row['prefecture_id'];pt=shape(current['geometry'])
                # A disagreement between the point and an atlas edge does not
                # move the point or alone trigger redrawing an unchanged unit.
                if mask.buffer(.08).covers(pt):seeds.append((pid,pt))
                if pid not in base:
                    county_transfers.append(dict(county_id=row['id'],name=row['name'],to=pid,book_page=row.get('source',{}).get('book_page')))
            # Later counties with no 281 counterpart still supply local seeds
            # for a dated newly-created prefecture. Its existence comes from
            # the table, not from the CHGIS point or an atlas name annotation.
            for f in county_points:
                row=rows['county'].get(f['properties']['entity_id'])
                if not row or row['prefecture_id'] in matched or row['prefecture_id'] in local_candidates:continue
                if names_for(rows['prefecture'][row['prefecture_id']])&{'樂浪','帶方'}:continue
                pt=shape(f['geometry'])
                if mask.covers(pt):seeds.append((row['prefecture_id'],pt))
            targets=base|{pid for pid,_ in seeds}
            for pid,source in local_candidates.items():
                overlap=source['geometry'].intersection(mask).area
                if overlap>max(.0001,source['geometry'].area*.06):
                    # Names are identity evidence; spatial overlap selects only
                    # a bounded mother compartment, not a same-name far-away郡.
                    targets.add(pid)
            if not targets:
                # No current named parent: carry territory to a current local
                # successor using the known county correspondence, then nearby
                # same-state seat. This is recorded as a fitted allocation.
                state_candidates=[pid for pid,r in rows['prefecture'].items() if key(r['state_name'])==key(u['state']) and pid in seats and not names_for(r)&{'樂浪','帶方'}]
                candidates=state_candidates or list(seats)
                if not candidates:raise ValueError(f'{year}: no seed for {u["name"]}')
                targets={min(candidates,key=lambda pid:mask.distance(seats[pid]))}
                allocation='dated_successor_nearest_same_state_fit'
            else:allocation='source_compartment_retained' if len(targets)==1 and not county_transfers else 'dated_county_membership_local_fit'
            parts={};remaining=mask
            # Preserve a real 262 former boundary or a 308 late division only
            # inside the affected 281 mother. Unaffected coasts stay untouched.
            for pid in sorted(targets):
                source=local_candidates.get(pid)
                if not source:continue
                patch=clean(source['geometry'].intersection(remaining))
                if patch.is_empty:continue
                parts[pid]=patch;remaining=clean(remaining.difference(patch))
                events.append(dict(year=year,type='local_source_boundary',source=source['id'],source_year=source['year'],
                    mother_source=u['id'],entity_id=pid,evidence=rows['prefecture'][pid].get('source',{}),
                    source_tier=source.get('tier',1 if source['year']==262 else 2),
                    status='dated_CHGIS_boundary_clipped_to_mother' if source['id'].startswith('CHGIS-') else
                    'earlier_boundary_restored' if source['year']==262 else 'late_reference_boundary_clipped_to_mother',inferred=True))
            if not remaining.is_empty:
                if len(targets)==1:parts[next(iter(targets))]=union([parts.get(next(iter(targets)),Polygon()),remaining])
                else:
                    valid=[(pid,pt) for pid,pt in seeds if pid in targets]
                    # Atlas name anchors are only a final fitting seed, never
                    # exported as historical administrative seat observations.
                    present={pid for pid,_ in valid}
                    for pid in sorted(targets-present):
                        anchors=[pt for name,pt in u.get('anchors',{}).items() if name in names_for(rows['prefecture'][pid])]
                        if pid in seats:valid.append((pid,seats[pid]))
                        elif pid in local_candidates:valid.append((pid,local_candidates[pid]['geometry'].representative_point()))
                        elif len(anchors)==1:valid.append((pid,anchors[0]))
                        else:valid.append((pid,mask.representative_point()))
                    for pid,g in old.partition_by_seeds(remaining,valid).items():parts[pid]=union([parts.get(pid,Polygon()),g])
            for pid,g in parts.items():
                additions[pid].append(g)
                provenance[pid].append(dict(source_id=u['id'],source_year=281,geometry_status=allocation,
                    local_source_id=local_candidates[pid]['id'] if pid in local_candidates else None,
                    inferred=allocation!='source_compartment_retained' or pid in local_candidates))
            if county_transfers or allocation!='source_compartment_retained':events.append(dict(year=year,type=allocation,
                mother_source=u['id'],entity_ids=sorted(targets),county_transfers=county_transfers,
                evidence_policy='reviewed_annual_rows',inferred=True))
        final={pid:union(gs) for pid,gs in additions.items()}
        missing=[pid for pid,r in rows['prefecture'].items() if not names_for(r)&{'樂浪','帶方'} and (pid not in final or final[pid].is_empty)]
        self.events.extend(events)
        self.mapping.extend(dict(year=year,entity_id=pid,sources=refs) for pid,refs in provenance.items())
        return final,provenance,missing

    def build(self,year):
        print(f'{year}: constructing source compartments and dated local amendments',flush=True)
        rows=self.rows[year];full,provenance,missing=self.geography(year)
        political=[f for f in self.polity if int(f['properties'].get('year',-1))==year]
        political,jin,others,excluded,assessments=old.political_control_in_original_domain(year,political,self.domain)
        final={pid:clean(g.intersection(jin)) for pid,g in full.items()}
        features=[]
        def add(g,p):
            if not g.is_empty:features.append(dict(type='Feature',geometry=mapping(g),properties=p))
        member={};fiefs={}
        for pid,row in rows['prefecture'].items():
            if row.get('is_fief') or row['name'].endswith(('國','国')):
                fid='jin-'+key(row['name']);member[pid]=(fid,'seat','confirmed',row['name']);fiefs[fid]=dict(name=row['name'])
        for record in self.rules.get('records',[]):
            if not record['begin']<=year<=record['end']:continue
            core=[pid for pid in record['primary_ids'] if pid in rows['prefecture']]
            if not core:continue
            fid='jin-'+key(record['kingdom_name']);fiefs[fid]=dict(name=key(record['kingdom_name'])+'國',source_ids=record.get('source_ids',[]))
            for pid in core:member[pid]=(fid,'seat',record.get('certainty','confirmed'),key(record['kingdom_name'])+'國')
            for branch in record.get('members',[]):
                for pid in branch.get('ids',[]):
                    if pid in rows['prefecture']:member[pid]=(fid,'branch',branch.get('certainty','inferred'),key(rows['prefecture'][pid]['name'])+'支郡')
        state_parts=collections.defaultdict(list);kingdom_parts=collections.defaultdict(list)
        for pid,g in final.items():
            row=rows['prefecture'][pid];prov=provenance[pid]
            p=dict(entity_id=pid,name=row['name'],display_name=member[pid][3] if pid in member else row['name'],base_name=row['base_name'],
                state_id=row['state_id'],state_name=row['state_name'],level='prefecture',layer='prefecture_areas',year=year,
                source='谭图281稳定界；262旧界及约308晚置郡仅局部采用；年度县属据复核表',
                geometry_status='three_basemap_dated_compartments',geometry_sources=prov,
                geometric_certainty='inferred' if any(r['inferred'] for r in prov) else 'source_reference_carried',
                book_page=row.get('source',{}).get('book_page'),boundary_evidence='源图边线沿用；发生县属变更的局部与共同图示面为拟合',
                coordinate_role='administrative_area_schematic',political_control_is_separate=True,
                source_policy='2026-10-04-three-basemap',time_uncertain=row.get('uncertain',False))
            if pid in member:
                fid,role,certainty,label=member[pid];p.update(fief_id=fid,member_role=role,membership_evidence=certainty);kingdom_parts[fid].append(g)
            add(g,p);state_parts[row['state_id']].append(full[pid])
            # Shared boundaries are emitted once below, never polygon outlines.
            if not g.is_empty:
                add(g.representative_point(),dict(p,layer='labels',label_type='prefecture',coordinate_role='territory_label_not_capital',show_label=True))
        # Administrative shared lines are computed from the uncut partitions;
        # a political frontier is not re-labelled as a province boundary.
        ids=sorted(full);tree=STRtree([full[pid] for pid in ids])
        for i,pid in enumerate(ids):
            for jv in tree.query(full[pid],predicate='intersects'):
                j=int(jv)
                if j<=i:continue
                other=ids[j];line=lineal(full[pid].boundary.intersection(full[other].boundary).intersection(jin))
                if line.length<.00001:continue
                layer='province_boundaries' if rows['prefecture'][pid]['state_id']!=rows['prefecture'][other]['state_id'] else 'prefecture_boundaries'
                add(line,dict(layer=layer,level='state' if layer=='province_boundaries' else 'prefecture',year=year,
                    name='州界' if layer=='province_boundaries' else '郡国界',adjacent_entity_ids=[pid,other],
                    adjacent_state_ids=[rows['prefecture'][pid]['state_id'],rows['prefecture'][other]['state_id']],
                    geometry_status='single_shared_boundary',source='三底图共同分区共享线',coordinate_role='boundary'))
        # Wu and later non-Jin space needs geographical reference names, not
        # the nearest surviving Jin prefecture stretched over foreign control.
        ref_year=262 if year<280 else 281
        references=[]
        for u in self.units[ref_year]:
            if u['names']&{'樂浪','帶方'}:continue
            g=clean(u['geometry'].intersection(others).intersection(self.domain))
            if g.is_empty:continue
            references.append((u,g))
            add(g,dict(id='reference-'+u['id'],layer='reference_prefecture_areas',level='prefecture',entity_id=None,
                name=u['name'],display_name=u['name'],base_name=u['name'],state_name=u['state'],year=year,
                is_reference=True,reference_year=ref_year,source=f'谭图{ref_year}行政地理参考',
                geometry_status='dated_basemap_reference_inside_non_jin_control',
                reference_reason=f'{ref_year}年底图名称与边线参照，不宣称该郡本年属于西晋或仍为独立建置',
                show_label=True,explicit_shared_boundaries=True))
        for i,(left,lg) in enumerate(references):
            for right,rg in references[i+1:]:
                if not lg.intersects(rg):continue
                line=lineal(lg.boundary.intersection(rg.boundary))
                if line.length<.00001:continue
                layer='province_boundaries' if key(left['state'])!=key(right['state']) else 'prefecture_boundaries'
                add(line,dict(layer=layer,level='state' if layer=='province_boundaries' else 'prefecture',year=year,
                    name='非晋控制区底图参考界',is_reference=True,reference_year=ref_year,
                    geometry_status='single_shared_reference_boundary',source=f'谭图{ref_year}共享线'))
        for sid,parts in state_parts.items():
            g=union(parts);r=rows['state'][sid]
            add(clean(g.intersection(jin)),dict(layer='province_areas',level='state',entity_id=sid,state_id=sid,name=r['name'],display_name=r['name'],year=year,
                is_context=r.get('is_context',False),lapsed_state_context=r.get('is_context',False),
                geometry_status='whole_dated_prefecture_union',source='完整年度郡面按当年州属组合'))
            if not g.intersection(jin).is_empty:add(g.intersection(jin).representative_point(),dict(layer='labels',level='state',label_type='province',entity_id=sid,name=r['name'],display_name=r['name'],show_label=True,year=year,coordinate_role='territory_label_not_capital'))
        fief_geoms={}
        for fid,parts in kingdom_parts.items():
            g=union(parts)
            if g.is_empty:continue
            fief_geoms[fid]=g
            pids=[pid for pid,m in member.items() if m[0]==fid and pid in final and not final[pid].is_empty]
            add(g,dict(layer='kingdom_areas',level='fief',fief_id=fid,year=year,name=fiefs[fid]['name'],display_name=fiefs[fid]['name'],
                member_entity_ids=pids,is_multi=len(pids)>1,has_inference=any(member[pid][2]!='confirmed' for pid in pids),
                source='本轮复核多郡王国关系；州属单列'))
        for f in self.get_points(year):
            p=dict(f['properties']);pt=shape(f['geometry'])
            row=rows['county'].get(p.get('entity_id')) if p.get('level')=='county' else rows['prefecture'].get(p.get('entity_id'))
            parent=rows['prefecture'].get(row.get('prefecture_id')) if row and p.get('level')=='county' else row
            if parent and names_for(parent)&{'樂浪','帶方'}:continue
            if p.get('level')=='county' and row:
                p.update(entity_id=row['yearbook_entity_id'],yearbook_entity_key=row['entity_key'],prefecture_id=row['prefecture_id'],
                    display_prefecture_id=row['display_prefecture_id'],text_prefecture_id=row['display_prefecture_id'])
                if row.get('geometry_year_note'):p['geometry_year_note']=row['geometry_year_note']
                if row.get('transfer_event_certainty'):
                    p.update(transfer_event_certainty=row['transfer_event_certainty'],transfer_event_year=row.get('transfer_event_year'),
                             transfer_destination_id=row.get('transfer_destination_id'))
            if not box(*old.PRESENTATION['extent']).covers(pt):continue
            if others.covers(pt):p.update(layer='reference_'+p['layer'],is_reference=True,source_entity_id=p.get('entity_id'),entity_id=None)
            if not self.domain.covers(pt):p['coordinate_footprint_conflict']='治所坐标位于参考面外，保留源坐标，不移动点或扩张面'
            add(pt,p)
        # Unlinked same-year CHGIS points in foreign control still provide
        # seats. They never assert Jin affiliation and retain raw coordinates.
        linked_positions={tuple(f['geometry']['coordinates']) for f in features if f['geometry']['type']=='Point' and 'seat' in f['properties'].get('layer','')}
        for f in self.points.unlinked_features_for(year)+self.rejected_points.get(year,[]):
            pt=shape(f['geometry']);p=dict(f['properties'])
            if not others.covers(pt) or not self.domain.covers(pt) or tuple(pt.coords[0]) in linked_positions:continue
            p.update(control_status='non_jin_video_control',reference_reason='非晋控制区内本年CHGIS治所；未与西晋年表实体绑定')
            add(pt,p);linked_positions.add(tuple(pt.coords[0]))
        for f in political:
            p=dict(f['properties'],layer='regime_areas',level='regime',year=year,
                source_policy='2026-10-04-three-basemap',footprint_source='Tan281_shared_outer_boundary_with_existing_study_scope',
                source='谭图281外圈限定的汉晋天下；域内明确控制变化参照史图馆年度原帧')
            g=shape(f['geometry']);add(g,p)
            if not old.is_jin(p):add(lineal(g.boundary.difference(self.domain.boundary.buffer(GRID*2))),dict(p,layer='regime_boundaries'))
        add(self.domain.boundary,dict(layer='original_territory_boundary',level='territory',name='底图疆域与海岸',year=year,
            source='谭图281完整边线，在原项目汉晋天下空间范围内显示',video_outer_boundary_used=False))
        covered=union(final.values());gap=clean(jin.difference(covered));overlap=sum(g.area for g in final.values())-covered.area
        if gap.area>1e-5 or overlap>1e-5:raise ValueError(f'{year}: coverage gap={gap.area} overlap={overlap}')
        report=dict(year=year,states_total=sum(not r.get('is_context',False) for r in rows['state'].values()),state_groups_total=len(rows['state']),prefectures_total=len(rows['prefecture']),counties_total=len(rows['county']),
            prefectures_drawn=sum(not g.is_empty for g in final.values()),prefectures_without_geometry=missing,
            gap_area=gap.area,overlap_area=overlap,county_polygons_displayed=False,point_report=self.pointreports[year],
            boundary_events=len([e for e in self.events if e['year']==year]),source_reference_year=281)
        report['display_scope_comparison']=self.scope_comparison
        exceptions=[]
        for pid in missing:
            exception=GEOMETRY_EXCEPTIONS.get(pid)
            if exception and exception['years'][0]<=year<=exception['years'][1]:
                exceptions.append(dict(exception,entity_id=pid,name=rows['prefecture'][pid]['name'],year=year,
                    status='known_yearbook_entity_without_independent_boundary',area_policy='母範圍仍由有據的參考或擬合郡面覆蓋；不另畫任意小面或留白洞'))
        report['documented_geometry_exceptions']=exceptions
        report['unmapped_details']=[dict(entity_id=e['entity_id'],name=e['name'],state_name=rows['prefecture'][e['entity_id']]['state_name'],
            reason=e['reason'],source_parent=e['mother'],book_page=e['book_pages']) for e in exceptions]
        unsupported=[pid for pid in missing if pid not in {e['entity_id'] for e in exceptions}]
        if unsupported:raise ValueError(f'{year}: unexplained missing prefecture geometry {unsupported}')
        trial=dict(type='JinThreeBasemapGeometryGraph',version=1,year=year,features=features,coverage=report,meta={},
            presentation=dict(old.PRESENTATION,three_basemap=True,title=f'{year}年　西晉州郡與封國',subtitle='谭图262／281与约308局部边界；年度建置依据复核年表',
                note='谭图与同年CHGIS为同级依据。281稳定边界向前回溯并向后沿用；262旧界与约308晚期界仅局部补充。合面及县属变更处分界为拟合；县域单元不展示。治所保留CHGIS原坐标；史图馆只提供域内政权控制。'),
            source_policy=dict(version='2026-10-04-three-basemap',tier_1=['Tan262','Tan281','dated_CHGIS'],tier_2=['circa308'],
                county_boundaries_displayed=False,video_outer_boundary_used=False,original_versions_preserved=True),
            provenance=dict(source_manifest='data/jin-maps/three-basemap-sources/manifest.json',yearbook='data/jin-reviewed-annual-rows.json',
                full_resolution=True,coordinate_grid_degrees=GRID,no_display_simplification=True))
        if exceptions:trial['presentation']['note']+=' 本年表內但未能單獨繪界：'+ '、'.join(e['name'] for e in exceptions)+'；仍保留有據母範圍，具體缺據見年度coverage記錄。'
        self.maps[year]=trial
        write(LOCAL/f'{year}.geojson',dict(trial,type='FeatureCollection'))
        return fief_geoms

_BUILDER=None

def initialize_worker(rows_path):
    global _BUILDER
    _BUILDER=Builder(rows_path)

def build_worker(year):
    builder=_BUILDER;builder.events=[];builder.mapping=[]
    shapes=builder.build(year);contacts=colours.contact_graph(shapes,colours.CONTACT_TOLERANCE)
    trial=builder.maps.pop(year)
    return year,trial,contacts,list(shapes),builder.events,builder.mapping

def compress_events(events):
    groups=collections.defaultdict(list)
    for event in events:
        core={k:v for k,v in event.items() if k!='year'}
        signature=json.dumps(core,ensure_ascii=False,sort_keys=True)
        groups[signature].append(event['year'])
    result=[]
    for signature,years in groups.items():
        start=end=sorted(years)[0]
        for year in sorted(years)[1:]+[None]:
            if year is not None and year==end+1:end=year;continue
            result.append(dict(json.loads(signature),valid_from=start,valid_to=end,date_rule='reviewed_source_intervals',
                date_certainty='see_yearbook_source',geometry_inference_disclosed=True))
            start=end=year
    return sorted(result,key=lambda e:(e['valid_from'],e.get('mother_source',''),e.get('type','')))

def main():
    global OUT
    ap=argparse.ArgumentParser();ap.add_argument('--years',nargs='+',type=int,default=list(YEARS))
    ap.add_argument('--rows',type=Path,default=ROOT/'data/jin-reviewed-annual-rows.json')
    ap.add_argument('--workers',type=int,default=1)
    ap.add_argument('--output',type=Path,help='Optional independent output directory; partial builds default to work/')
    args=ap.parse_args()
    if args.output:OUT=args.output.resolve()
    elif set(args.years)!=set(YEARS):OUT=LOCAL/'partial-public'
    source_sha256=hashlib.sha256(args.rows.read_bytes()).hexdigest()
    archive_sources();graph=collections.defaultdict(set);freq=collections.Counter();adjacency={};maps={};events=[];entity_mapping=[]
    def consume(result):
        year,trial,contacts,fids,event_rows,mapping_rows=result
        maps[year]=trial;events.extend(event_rows);entity_mapping.extend(mapping_rows);adjacency[str(year)]=contacts
        for fid in fids:freq[fid]+=1;graph[fid]
        for e in contacts:a,b=e['fiefs'];graph[a].add(b);graph[b].add(a)
    if args.workers>1:
        executor=ProcessPoolExecutor(max_workers=args.workers,initializer=initialize_worker,initargs=(args.rows,))
        try:
            for future in as_completed([executor.submit(build_worker,y) for y in args.years]):consume(future.result())
        except BaseException:
            for process in executor._processes.values():process.terminate()
            executor.shutdown(wait=True,cancel_futures=True)
            raise
        else:executor.shutdown(wait=True)
    else:
        initialize_worker(args.rows)
        for year in args.years:consume(build_worker(year))
    assigned=colours.dsatur(graph,freq)
    if isinstance(assigned,tuple):assigned=assigned[0]
    palette={fid:colours.PALETTE[index] for fid,index in assigned.items()}
    for year,trial in maps.items():
        trial['fief_colors']=palette
        for f in trial['features']:
            fid=f['properties'].get('fief_id')
            if fid in palette:f['properties']['color']=palette[fid]
        write(LOCAL/f'{year}.geojson',dict(trial,type='FeatureCollection'))
    if hashlib.sha256(args.rows.read_bytes()).hexdigest()!=source_sha256:raise ValueError('Annual rows changed during build; regenerate against one frozen input')
    manifest=pack(dict(sorted(maps.items())))
    write(OUT/'entity-source-map.json',sorted(entity_mapping,key=lambda r:(r['year'],r['entity_id'])))
    write(OUT/'boundary-events.json',compress_events(events))
    write(OUT/'fief-colors.json',dict(colors=palette,adjacency=adjacency,method='all_years_union_adjacency_stable_DSatur'))
    write(OUT/'build-report.json',dict(years={str(y):m['coverage'] for y,m in sorted(maps.items())},
        source_sha256=source_sha256,
        no_county_geometry=True,old_versions_preserved=True))
    print(f'Built {len(manifest["years"])} years; {len(manifest["geometry_shards"])} shared full-resolution shards',flush=True)

if __name__=='__main__':main()
