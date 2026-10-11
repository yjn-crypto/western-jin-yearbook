#!/usr/bin/env python3
"""Build the first Eastern Jin map from the annual display tree and local GIS.

PYTHONPATH=work/_gis_deps <Python 3.12> scripts/build-eastern-jin-maps.py
County cells are temporary fitting units, never public map layers. The Western
Jin outline is context only; no unassigned northern administrative line is kept.
"""
from __future__ import annotations
import argparse, collections, gzip, hashlib, importlib.util, io, json, re, zipfile
from functools import lru_cache
from pathlib import Path
from shapely import make_valid, normalize, set_precision, voronoi_polygons
from shapely.geometry import shape, mapping, Point, Polygon, MultiPoint, box
from shapely.ops import unary_union, transform
from pyproj import CRS, Transformer

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/eastern-jin-maps'
TAN382=Path('/Users/yujiangnan/Documents/Codex/2026-10-02/ni/outputs/东晋382年')
spec=importlib.util.spec_from_file_location('western_jin_gis',ROOT/'scripts/build-jin-annual-geography.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
GEOMS={}
GRID=.000001

def read(path):
    p=Path(path);return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes())

def write(path,value):
    p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n')

def key(name,county=False):
    n=str(name or '').replace('丹杨','丹陽').replace('丹楊','丹陽').replace('侨','').replace('僑','')
    n=n.translate(str.maketrans({'荆':'荊','并':'並','凉':'涼','渔':'漁','蓟':'薊','邺':'鄴','邹':'鄒','瑯':'琅'}))
    return (old.county_key if county else old.key)(n)

def clean(g):
    if g.is_empty:return Polygon()
    return old.polygonal(set_precision(old.polygonal(make_valid(g)),GRID))

def solid(g):
    """Fill only closed interior voids; never bridge separate outer components."""
    parts=[g] if g.geom_type=='Polygon' else list(g.geoms) if g.geom_type=='MultiPolygon' else []
    return clean(unary_union([Polygon(p.exterior) for p in parts])) if parts else Polygon()

def shared_boundaries(gs):
    """Only boundaries shared by assigned units; void rims are not admin lines."""
    return shared_boundary_geometry(tuple(g for g in gs if not g.is_empty))

@lru_cache(maxsize=512)
def shared_boundary_geometry(gs):
    if len(gs)<2:return Polygon().boundary
    return unary_union([g.boundary for g in gs]).difference(union(gs).boundary)

def union(gs):
    return union_geometry(tuple(g for g in gs if not g.is_empty))

@lru_cache(maxsize=8192)
def union_geometry(gs):
    return clean(unary_union(gs)) if gs else Polygon()

@lru_cache(maxsize=32768)
def gid(g):
    obj=mapping(g) if hasattr(g,'geom_type') else g
    # Point values retain source precision; shared boundaries are not simplified.
    raw=json.dumps(obj,separators=(',',':'),sort_keys=True)
    ident='g'+hashlib.sha256(raw.encode()).hexdigest()[:16];GEOMS[ident]=obj;return ident

def feature(g,**props):return dict(geometry_id=gid(g),properties=props)

def source_archive():
    entries=[]
    for layer in ['zhou_territories','zhou_boundaries','polity_territories','polity_boundaries','historical_coastline','commandery_seats','state_seats','original_labels','hosted_state_references']:
        src=TAN382/'gis'/f'{layer}.geojson';dest=OUT/'sources'/f'tan382-{layer}.geojson.gz'
        if src.exists():
            raw=src.read_bytes();dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(gzip.compress(raw,mtime=0))
        else:raw=gzip.decompress(dest.read_bytes())
        entries.append(dict(id='tan382-'+layer,path=str(dest.relative_to(ROOT)),source_package='东晋382年/gis/'+layer+'.geojson',sha256=hashlib.sha256(raw).hexdigest(),feature_count=len(json.loads(raw)['features'])))
    write(OUT/'sources/manifest.json',dict(sources=entries,source_year=382,year_status='用户指定382；源成果说明称原图未见可独立确认年款',method='原图经纬网配准；州面及独立古治所圈；没有郡界',coordinate_precision='原图坐标不是CHGIS原点；20度以南涉及配准外推'))

def chgis():
    cache=OUT/'sources/chgis-317-420.geojson.gz'
    if cache.exists():
        d=read(cache);return [dict(f['properties'],name_key=key(f['properties']['name'],f['properties']['level']=='county'),geometry=shape(f['geometry'])) for f in d['features']],d['inventory']
    records=[];inventory=[]
    packages=[('CHGIS数据/dataverse_files-v6.zip','v6_time_cnty_pts_utf_wgs84.zip','county'),('CHGIS数据/dataverse_files (2)-v6.zip','v6_time_pref_pts_utf_wgs84.zip','prefecture'),('CHGIS数据/dataverse_files (1)-v6.zip','v6_time_pref_pgn_utf_wgs84.zip','prefecture_area'),('CHGIS数据/v4_time_prov_pts_utf.zip',None,'state')]
    with zipfile.ZipFile(Path.home()/'Downloads/CHGIS数据.zip') as outer:
        for package,nested,level in packages:
            payload=outer.read(package);inner=zipfile.ZipFile(io.BytesIO(payload))
            if nested:payload=inner.read(nested);inner=zipfile.ZipFile(io.BytesIO(payload))
            names=[n for n in inner.namelist() if not n.startswith('__MACOSX')]
            dbf=next(n for n in names if n.endswith('.dbf'));shp=next(n for n in names if n.endswith('.shp'))
            attrs=list(old.dbf_rows(inner.read(dbf)));shapes=list(old.shp_rows(inner.read(shp))) if nested else []
            count=0
            for i,a in enumerate(attrs):
                if not a:continue
                try:begin,end=int(float(a['BEG_YR'])),int(float(a['END_YR']))
                except (ValueError,KeyError):continue
                if begin>420 or end<317 or (begin==0 and a.get('BEG_RULE') in ('0','0.0')) or a.get('TYPE_CH') in ('非政区国土','都督'):continue
                if nested:g=old.shapefile_geometry(shapes[i])
                else:g=Point(float(a.get('X_COORD') or a.get('X_COOR')),float(a.get('Y_COORD') or a.get('Y_COOR')))
                if g is None or g.is_empty:continue
                actual='state' if level=='prefecture' and a.get('TYPE_CH')=='州' else level
                name=a.get('NAME_FT') or a.get('NAME_CH')
                records.append(dict(level=actual,name=name,name_key=key(name,actual=='county'),begin=begin,end=end,geometry=g,source=f'CHGIS_V{6 if nested else 4}:{Path(dbf).stem}',source_id=a.get('SYS_ID'),version=6 if nested else 4,location=a.get('PRES_LOC') or a.get('PERS_LOC') or '',begin_rule=a.get('BEG_RULE'),end_rule=a.get('END_RULE')));count+=1
            inventory.append(dict(source=package,nested=nested,sha256=hashlib.sha256(payload).hexdigest(),records=count))
    raw=json.dumps(dict(type='FeatureCollection',features=[dict(type='Feature',geometry=mapping(r['geometry']),properties={k:v for k,v in r.items() if k!='geometry'}) for r in records],inventory=inventory),ensure_ascii=False,separators=(',',':')).encode()
    cache.write_bytes(gzip.compress(raw,mtime=0));return records,inventory

def chgis_states():
    cache=OUT/'sources/chgis-state-areas-317-420.geojson.gz'
    if cache.exists():
        d=read(cache);return [dict(f['properties'],name_key=key(f['properties']['name']),geometry=shape(f['geometry'])) for f in d['features']],d['inventory']
    package='CHGIS数据/v4_time_prov_pgn_utf.zip'
    with zipfile.ZipFile(Path.home()/'Downloads/CHGIS数据.zip') as outer:payload=outer.read(package)
    with zipfile.ZipFile(io.BytesIO(payload)) as source:
        names=[n for n in source.namelist() if not n.startswith('__MACOSX')]
        dbf=next(n for n in names if n.endswith('.dbf'));shp=next(n for n in names if n.endswith('.shp'));prj=next(n for n in names if n.endswith('.prj'))
        wkt=source.read(prj).decode();project=Transformer.from_crs(CRS.from_wkt(wkt),4326,always_xy=True)
        attrs=list(old.dbf_rows(source.read(dbf)));raw_shapes=list(old.shp_rows(source.read(shp)));records=[]
        for i,a in enumerate(attrs):
            if not a:continue
            try:begin,end=int(float(a['BEG_YR'])),int(float(a['END_YR']))
            except (ValueError,KeyError):continue
            if begin>420 or end<317 or (begin==0 and a.get('BEG_RULE') in ('0','0.0')):continue
            g=old.shapefile_geometry(raw_shapes[i])
            if g is None or g.is_empty:continue
            name=a.get('NAME_FT') or a.get('NAME_CH')
            records.append(dict(level='state_area',name=name,name_key=key(name),begin=begin,end=end,geometry=clean(transform(project.transform,g)),source='CHGIS_V4:v4_time_prov_pgn_utf',source_id=a['SYS_ID'],version=4,coordinate_conversion='包内Xian_1980_GK_Zone_19 PRJ经pyproj转EPSG:4326；非治所坐标',begin_rule=a.get('BEG_RULE'),end_rule=a.get('END_RULE')))
    inventory=[dict(source=package,sha256=hashlib.sha256(payload).hexdigest(),records=len(records),source_crs_wkt=wkt,output_crs='EPSG:4326')]
    raw=json.dumps(dict(type='FeatureCollection',features=[dict(type='Feature',geometry=mapping(r['geometry']),properties={k:v for k,v in r.items() if k!='geometry'}) for r in records],inventory=inventory),ensure_ascii=False,separators=(',',':')).encode();cache.write_bytes(gzip.compress(raw,mtime=0));return records,inventory

def western_sources():
    d=read(ROOT/'data/jin-maps/three-basemap-annual/281.json');geoms=d.get('geometries',{}).copy()
    for url in d['geometry_urls']:
        chunk=read(ROOT/url);geoms.update(chunk.get('geometries',chunk))
    edge=next(f for f in d['features'] if f['properties']['layer']=='original_territory_boundary')
    outline=shape(edge.get('geometry') or geoms[edge['geometry_id']])
    # The current Western Jin map includes reviewed subdivisions (notably
    # Jiaozhi/Xinchang/Jiude) absent from the raw 281 image compartments.
    latest=read(ROOT/'data/jin-maps/three-basemap-annual/316.json')
    for url in latest['geometry_urls']:
        chunk=read(ROOT/url);geoms.update(chunk.get('geometries',chunk))
    groups=collections.defaultdict(list);names={}
    for f in latest['features']:
        p=f['properties']
        if p.get('layer') not in ('prefecture_areas','reference_prefecture_areas'):continue
        k=(key(p['name']),key(p.get('state_name')));names[k]=p['name']
        # Keep the shared source network; independently simplifying each face
        # creates sliver gaps and overlaps even with preserve_topology=True.
        groups[k].append(clean(shape(f.get('geometry') or geoms[f['geometry_id']])))
    refs=[dict(name=names[k],key=k[0],state=k[1],id='west316-'+str(i),geometry=union(gs)) for i,(k,gs) in enumerate(groups.items())]
    return outline,refs

def point_candidates(records,name,level,year,mask=None):
    candidates=[r for r in records if r['level']==level and r['name_key']==key(name,level=='county') and r['begin']<=year<=r['end']]
    if mask is not None and not mask.is_empty:candidates=[r for r in candidates if mask.distance(r['geometry'])<=.20]
    grouped={}
    for r in candidates:
        sig=tuple(round(x,6) for x in r['geometry'].coords[0])
        if sig not in grouped or r['version']>grouped[sig]['version']:grouped[sig]=r
    return list(grouped.values())

def hosted_reference(row,records,year):
    """A referenced host is a location label, never an attested seat symbol."""
    contexts=[c['label'] for c in row.get('context',[]) if c.get('kind')=='hosted_at' and c.get('status')=='adopted']
    if not contexts:return None
    text='；'.join(re.sub(r'（[^）]*）|\([^)]*\)','',c) for c in contexts)
    text=text.translate(old.VARIANTS).replace('荆','荊').replace('苌','萇')
    text=text.replace('京邑','建康')
    # A region-only host remains a region reference; choosing its county of the
    # same name could be a different location. Multiple successive hosts defer.
    levels={'prefecture'} if re.search('郡[界境]',text) else {'county','prefecture'}
    found=[]
    for r in records:
        if r['level'] not in levels or not r['begin']<=year<=r['end'] or r['geometry'].geom_type!='Point':continue
        name=r['name_key']
        if len(name)<2 or name not in text:continue
        # Changyuan in the old homeland is not evidence of Jiangzuo's hosted
        # Changyuan; no precise local location has yet been supplied.
        if name in ('長垣',):continue
        found.append(r)
    grouped={}
    for r in found:grouped.setdefault(tuple(round(x,5) for x in r['geometry'].coords[0]),r)
    if len(grouped)!=1:return None
    r=next(iter(grouped.values()))
    return dict(r,host_reference=True,method='正文明确寄治地关系参考：'+ '；'.join(contexts)+'；位置借用该地同年CHGIS点，不是独立考定的侨郡治所')

def partition(mask,seeds):
    return partition_geometry(mask,tuple(seeds))

@lru_cache(maxsize=4096)
def partition_geometry(mask,seeds):
    unique={}
    for pid,p in seeds:unique.setdefault((round(p.x,8),round(p.y,8)),(pid,p))
    seeds=list(unique.values())
    if not seeds:return {}
    if len({p for p,_ in seeds})==1:return {seeds[0][0]:mask}
    cells=voronoi_polygons(MultiPoint([p for _,p in seeds]),extend_to=box(*mask.bounds).buffer(3),ordered=True)
    groups=collections.defaultdict(list)
    for (pid,_),cell in zip(seeds,cells.geoms):groups[pid].append(clean(cell.intersection(mask)))
    return {pid:union(gs) for pid,gs in groups.items()}

def flatten(d):
    states={};prefs={};counties={}
    for s in d['states']:
        sid=s.get('entity_id',s.get('id'));states[sid]=dict(s,id=sid)
        for p in s.get('prefectures',s.get('rows',[])):
            pid=p.get('entity_id',p.get('id'));prefs[pid]=dict(p,id=pid,state_id=sid,state_name=s['name'])
            for c in p.get('counties',[]):
                cid=c.get('entity_id',c.get('id'));counties[cid]=dict(c,id=cid,prefecture_id=pid,state_id=sid)
    return states,prefs,counties

def build(year,records,refs,outline,atlas):
    annual=read(ROOT/f'data/eastern-jin-display/annual/{year}.json');states,prefs,counties=flatten(annual)
    real={pid:p for pid,p in prefs.items() if p.get('map_eligible',not p.get('qiao')) and not p.get('qiao')}
    masks={};matches={};points={};point_audit=[]
    for pid,p in real.items():
        direct=[r for r in refs if r['key']==key(p['name'])]
        if len(direct)>1:
            local=[r for r in direct if r['state']==key(p['state_name'])]
            direct=local if local else direct
        if len(direct)==1:masks[pid]=direct[0]['geometry'];matches[pid]=direct[0]['id']
    # The 382 atlas has actual host locations, including independently marked
    # emigrant seats. Its points never stand in for a county of the same name.
    atlas_seats=atlas['commandery_seats']+atlas['state_seats']
    host_states={sid:union([r['geometry'] for r in refs if r['state']==key(s['name'])]) for sid,s in states.items() if not s.get('qiao')}
    if year==382:
        for sid,s in states.items():
            if key(s['name']) in atlas['states']:host_states[sid]=atlas['states'][key(s['name'])]
    pref_points={}
    for pid,p in prefs.items():
        cand=point_candidates(records,p['name'],'prefecture',year,masks.get(pid))
        if p.get('qiao'):
            evidence=[f for f in atlas_seats if f['properties'].get('polity')=='东晋' and f['properties'].get('is_emigrant') and key(f['properties']['name'])==key(p['name']) and f.get('geometry')]
            host=host_states.get(p['state_id'])
            # A newly dated CHGIS point inside the attested host province may
            # locate an emigrant unit. A pre-317 original-home point may not.
            cand=[r for r in cand if (r['begin']>=317 and host is not None and host.covers(r['geometry'])) or (year==382 and any(r['geometry'].distance(shape(f['geometry']))<.35 for f in evidence))]
        if len(cand)==1:pref_points[pid]=dict(cand[0],method='同年CHGIS郡名＋原郡域约束' if pid in masks else '同年CHGIS唯一郡名；年度正文实体')
        elif year==382:
            evidence=[f for f in atlas_seats if f['properties'].get('polity')=='东晋' and bool(f['properties'].get('is_emigrant'))==bool(p.get('qiao')) and key(f['properties']['name'])==key(p['name']) and f.get('geometry')]
            if len(evidence)==1:
                f=evidence[0];pref_points[pid]=dict(geometry=shape(f['geometry']),source='谭图382原图古治所圈配准',source_id=f['properties']['id'],begin=382,end=382,method='382原图同名同侨置性质独立治所圈')
        if pid not in pref_points and p.get('qiao'):
            ref=hosted_reference(p,records,year)
            if ref is not None:pref_points[pid]=ref
    for cid,c in counties.items():
        pid=c['prefecture_id'];p=prefs[pid]
        local=masks.get(pid)
        if local is None and pid in pref_points:local=pref_points[pid]['geometry'].buffer(1.7)
        if local is None and c.get('qiao'):local=host_states.get(c['state_id'])
        cand=point_candidates(records,c['name'],'county',year,local)
        if c.get('qiao'):cand=[r for r in cand if local is not None and r['begin']>=317]
        if len(cand)==1 and (local is not None or not p.get('qiao')):
            r=cand[0];points[cid]=r
            point_audit.append(dict(entity_id=cid,name=c['name'],prefecture_id=pid,source_id=r['source_id'],source=r['source'],coordinates=list(r['geometry'].coords[0]),method='同年CHGIS317年后起段＋有据寄治郡州范围' if c.get('qiao') else '同年CHGIS＋本郡参考范围' if local is not None else '同年CHGIS唯一名称；未有郡面约束',qiao=bool(c.get('qiao'))))
    # Qiao does not imply that no land was administered. At least two located
    # non-emigrant counties plus a dated local commandery seat are required for
    # a first-round fitted extent; an isolated emigrant point creates no area.
    qiao_landed=[]
    for pid,p in prefs.items():
        if p.get('qiao') and pid in pref_points:
            landed=[r for cid,r in points.items() if counties[cid]['prefecture_id']==pid and not counties[cid].get('qiao') and r['geometry'].distance(pref_points[pid]['geometry'])<1.7]
            if len(landed)>=2:real[pid]=p;qiao_landed.append(pid)
    state_authorities={}
    for sid,s in states.items():
        if s.get('qiao'):continue
        candidates=[r for r in records if r['level']=='state_area' and r['name_key']==key(s['name']) and r['begin']<=year<=r['end']]
        if len(candidates)==1:state_authorities[sid]=candidates[0]
    prefecture_authorities={}
    for pid,p in prefs.items():
        candidates=[r for r in records if r['level']=='prefecture_area' and r['name_key']==key(p['name']) and r['begin']<=year<=r['end']]
        if p.get('qiao'):
            if p.get('territorial_status')!='territorial' or pid not in pref_points:continue
            candidates=[r for r in candidates if r['begin']>=317 and r['geometry'].distance(pref_points[pid]['geometry'])<=.01]
        else:
            local=masks.get(pid);point=pref_points.get(pid,{}).get('geometry');state_area=state_authorities.get(p['state_id'],{}).get('geometry')
            candidates=[r for r in candidates if (point is not None and r['geometry'].distance(point)<=.01) or (local is not None and r['geometry'].intersection(local).area>min(local.area,r['geometry'].area)*.1) or (local is None and point is None and state_area is not None and state_area.covers(r['geometry'].representative_point()))]
        if len(candidates)==1:
            prefecture_authorities[pid]=candidates[0];real[pid]=p
            if p.get('qiao') and pid not in qiao_landed:qiao_landed.append(pid)
    # Only active non-emigrant prefectures receive polygons. Each historical
    # compartment is transferred/split by current county affiliations.
    pieces=collections.defaultdict(list);fitted=set();used_refs=collections.defaultdict(list)
    for ref in refs:
        seeds=[(counties[cid]['prefecture_id'],r['geometry']) for cid,r in points.items() if not counties[cid].get('qiao') and counties[cid]['prefecture_id'] in real and ref['geometry'].covers(r['geometry'])]
        direct=[pid for pid,refid in matches.items() if refid==ref['id']]
        if not seeds and len(direct)==1:seeds=[(direct[0],ref['geometry'].representative_point())]
        if not seeds:continue
        # An isolated same-name point is insufficient to move an unrelated old
        # prefecture wholesale: retain the supported current home compartment.
        parent_ids={pid for pid,_ in seeds}
        for pid,g in partition(ref['geometry'],seeds).items():
            if pid not in matches and len([1 for pp,_ in seeds if pp==pid])<2 and len(parent_ids)==1 and key(real[pid]['name'])!=ref['key']:
                continue
            if g.is_empty:continue
            pieces[pid].append(g);used_refs[pid].append(ref['id'])
            if len(parent_ids)>1 or matches.get(pid)!=ref['id']:fitted.add(pid)
    areas={pid:union(gs) for pid,gs in pieces.items()}
    # A source boundary is chosen once. Authoritative CHGIS masks replace old
    # fitted faces; the lower-priority neighbors yield at that boundary.
    authoritative_areas={};authority_adjustments={};occupied=Polygon()
    for pid,r in sorted(prefecture_authorities.items(),key=lambda item:(-item[1]['begin'],item[0])):
        source_g=clean(r['geometry']);g=clean(source_g.difference(occupied));authoritative_areas[pid]=g;occupied=union([occupied,g])
        authority_adjustments[pid]=dict(overlap_removed_degrees2=round(source_g.area-g.area,10),overlap_priority='同年有效面相互重叠时，较晚起段优先；再按实体ID固定顺序择一')
    areas={pid:clean(g.difference(occupied)) for pid,g in areas.items() if pid not in authoritative_areas}
    areas.update(authoritative_areas);areas={pid:g for pid,g in areas.items() if not g.is_empty}
    if year==382:
        control=solid(atlas['polity'])
        # The dated text explicitly records Ningzhou lost in 373 and recovered
        # in 384. The undated/user-labelled 382 image cannot reinstate it.
        control=clean(control.difference(atlas['states'][key('宁州')]))
        # CHGIS faces selected for attested current entities remain the chosen
        # boundary, including their coast. The atlas cannot crop them again.
        control=solid(union([control,*authoritative_areas.values()]))
        areas={pid:g if pid in authoritative_areas else clean(g.intersection(control)) for pid,g in areas.items()}
        areas={pid:g for pid,g in areas.items() if not g.is_empty}
    else:
        adopted=[g for pid,g in masks.items() if pid not in prefecture_authorities]
        control=solid(union([*areas.values(),*adopted]))
    area_union=union(list(areas.values()))
    undetermined=clean(control.difference(area_union))
    prefecture_network=shared_boundaries(list(areas.values()))
    features=[feature(outline,layer='original_territory_boundary',level='territory',name='西晋政权外缘参考',source='沿用西晋281三底图版本的外缘与海岸',actual_control_claim=False,notes=['仅为空间参照，不代表本年东晋疆域；其内没有正文依据的州郡界不显示。'])]
    if not control.is_empty:
        features.append(feature(control,layer='regime_areas',level='territory',name='东晋连续控制参考底面',is_jin=True,source='382谭图政权底面；依《通史》373—383失陷期排除宁州' if year==382 else '本年采用的实郡范围；内部归属未定处同底色',actual_control_claim='dated_reference_not_precise_military_frontier',notes=['政权内部尚未落实到具体州郡的部分沿用同一底色；不补造州郡界或正文节点。']))
    state_geoms=collections.defaultdict(list)
    mapping_rows=[]
    for pid,g in areas.items():
        p=real[pid];sid=p['state_id'];state_geoms[sid].append(g)
        authority=prefecture_authorities.get(pid)
        props=dict(entity_id=pid,level='prefecture',name=p['name'],state_id=sid,state_name=p['state_name'],source=authority['source'] if authority else '西晋316现用三底图郡域＋同年CHGIS县点＋本年县属',source_id=authority['source_id'] if authority else None,source_begin=authority['begin'] if authority else None,source_end=authority['end'] if authority else None,boundary_inferred=pid in fitted and not authority,boundary_evidence='本年有效CHGIS郡面直接采用；未用旧州形状裁切' if authority else '旧郡域内按年度辖县最近治所分区拟合' if pid in fitted else '沿用西晋原图郡域参考，非独立东晋界线考证',qiao=bool(p.get('qiao')),year=year)
        features.append(feature(g,layer='prefecture_areas',**props))
        border=g.boundary.intersection(prefecture_network)
        if not border.is_empty:features.append(feature(border,layer='prefecture_boundaries',**props))
        mapping_rows.append(dict(entity_id=pid,name=p['name'],state_id=sid,source_compartment_ids=[] if authority else used_refs[pid],source=props['source'],source_id=props['source_id'],inferred=props['boundary_inferred'],method=props['boundary_evidence'],authority_adjustment=authority_adjustments.get(pid)))
    # A province is exactly its current commanderies' union. CHGIS state masks
    # assist ambiguous source matching, but never introduce another state edge
    # network or cut a commandery independently of the annual affiliations.
    state_areas={sid:union(gs) for sid,gs in state_geoms.items()}
    state_areas={sid:g for sid,g in state_areas.items() if not g.is_empty}
    province_network=shared_boundaries(list(state_areas.values()))
    for sid,g in state_areas.items():
        s=states[sid]
        properties=dict(level='state',entity_id=sid,name=s['name'],qiao=bool(s.get('qiao')),source='本年所属郡面并集；同年CHGIS郡面优先，缺处沿用已采用郡面',state_geometry_method='union_of_current_prefectures',year=year)
        features.append(feature(g,layer='province_areas',**properties))
        border=g.boundary.intersection(province_network)
        if not border.is_empty:features.append(feature(border,layer='province_boundaries',**properties))
    for cid,r in points.items():
        c=counties[cid]
        features.append(feature(r['geometry'],layer='county_seats',level='county',entity_id=cid,name=c['name'],prefecture_id=c['prefecture_id'],state_id=c['state_id'],qiao=bool(c.get('qiao')),source=r['source'],source_id=r['source_id'],coordinate_role='administrative_seat',source_coordinates=list(r['geometry'].coords[0]),coordinate_source_begin=r['begin'],coordinate_source_end=r['end'],show_label=True,year=year))
    for pid,r in pref_points.items():
        p=prefs[pid]
        features.append(feature(r['geometry'],layer='labels' if r.get('host_reference') else 'prefecture_seats',level='prefecture',entity_id=pid,name=p['name'],state_id=p['state_id'],qiao=bool(p.get('qiao')),source=r['source'],source_id=r['source_id'],coordinate_role='hosted_relation_reference_not_seat' if r.get('host_reference') else 'administrative_seat',show_label=pid not in areas,coordinate_source_begin=r['begin'],coordinate_source_end=r['end'],seat_note=r['method'],year=year))
    for sid,s in states.items():
        candidates=point_candidates(records,s['name'],'state',year,union(state_geoms.get(sid,[])) if sid in state_geoms else None)
        if s.get('qiao'):
            evidence=[f for f in atlas['state_seats'] if f.get('geometry') and f['properties'].get('polity')=='东晋' and f['properties'].get('is_emigrant') and key(f['properties']['name'])==key(s['name'])]
            candidates=[r for r in candidates if year==382 and any(r['geometry'].distance(shape(f['geometry']))<.35 for f in evidence)]
        if len(candidates)==1:
            r=candidates[0];features.append(feature(r['geometry'],layer='state_seats',level='state',entity_id=sid,name=s['name'],qiao=bool(s.get('qiao')),source=r['source'],source_id=r['source_id'],coordinate_role='administrative_seat',show_label=sid not in state_geoms,year=year))
    mapped_ids={f['properties'].get('entity_id') for f in features}
    chosen_chgis=[dict(entity_id=pid,name=real[pid]['name'],state_id=real[pid]['state_id'],state_name=real[pid]['state_name'],source_id=r['source_id'],begin=r['begin'],end=r['end']) for pid,r in prefecture_authorities.items() if pid in areas]
    control_parts=[control] if control.geom_type=='Polygon' else list(control.geoms)
    coverage=dict(year=year,states_in_text=len(states),prefectures_in_text=len(prefs),counties_in_text=len(counties),real_prefectures=sum(not p.get('qiao') for p in real.values()),prefecture_areas=len(areas),prefecture_seats=sum(not r.get('host_reference') for r in pref_points.values()),hosted_prefecture_references=sum(bool(r.get('host_reference')) for r in pref_points.values()),county_seats=len(points),qiao_county_seats=sum(bool(counties[cid].get('qiao')) for cid in points),qiao_prefecture_seats=sum(bool(prefs[pid].get('qiao')) and not r.get('host_reference') for pid,r in pref_points.items()),qiao_landed_prefecture_ids=qiao_landed,qiao_counties_unlocated=sum(bool(c.get('qiao')) for cid,c in counties.items() if cid not in points),missing_real_prefecture_ids=sorted(set(real)-set(areas)),unlocated_county_ids=sorted(set(counties)-set(points)),unlocated_prefecture_ids=sorted(set(prefs)-mapped_ids),unlocated_state_ids=sorted(set(states)-mapped_ids),fitted_prefectures=len(set(fitted)-set(prefecture_authorities)),tan382_used=year==382,chgis_prefecture_areas=len(chosen_chgis),chgis_prefecture_sources=chosen_chgis,chgis_state_reference_count=len(state_authorities),state_geometry_method='union_of_current_prefectures',control_interior_holes=sum(len(p.interiors) for p in control_parts),unassigned_control_area_degrees2=round(undetermined.area,8),ningzhou_control_excluded=373<=year<=383)
    write(OUT/f'annual/{year}.json',dict(type='EasternJinGeometryGraph',version=2,year=year,geometry_url='data/eastern-jin-maps/geometries.json.gz',features=features,coverage=coverage))
    return dict(coverage=coverage,prefecture_mappings=mapping_rows,point_mappings=point_audit,state_references=[dict(entity_id=sid,name=states[sid]['name'],source_id=r['source_id'],begin=r['begin'],end=r['end'],purpose='matching_reference_only_not_independent_boundary') for sid,r in state_authorities.items()])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--years',type=int,nargs='*',default=list(range(317,421)));args=parser.parse_args()
    source_archive();records,inventory=chgis();state_records,state_inventory=chgis_states();records+=state_records;inventory+=state_inventory;outline,refs=western_sources()
    atlas={n:read(OUT/f'sources/tan382-{n}.geojson.gz')['features'] for n in ['commandery_seats','state_seats','zhou_territories','polity_territories']}
    atlas['polity']=union([shape(f['geometry']) for f in atlas['polity_territories']]);atlas['states']={key(f['properties']['name']):shape(f['geometry']) for f in atlas['zhou_territories']}
    reports=[]
    for year in args.years:
        result=build(year,records,refs,outline,atlas);reports.append(result)
        c=result['coverage'];print(f'{year}: {c["prefecture_areas"]} areas, {c["chgis_prefecture_areas"]} CHGIS masks, {c["control_interior_holes"]} background holes',flush=True)
    raw=json.dumps(dict(geometries=GEOMS),ensure_ascii=False,separators=(',',':')).encode()
    (OUT/'geometries.json.gz').write_bytes(gzip.compress(raw,mtime=0))
    write(OUT/'mapping-report.json',dict(version=2,years=reports,source_inventory=inventory,policy=dict(western_outline='reference_only',county_polygons_public=False,county_boundaries_public=False,qiao_origin_points_allowed=False,unlocated_qiao='正文保留、地图不将原籍冒作侨治',tan382_scope='382政权底面与有据治所；不以其州面硬裁郡；宁州按373—383失陷期排除',prefecture_priority='当年有效且实体明确匹配的CHGIS郡面优先；缺处沿用已采用旧郡面',state_geometry='当前state_id下全部郡面并集；CHGIS州面只作参考',unassigned_interior='同政权底色，不造郡界州界，不改正文',fiefs='东晋第一轮不根据郡国名称自动着封国色')))
    write(OUT/'index.json',dict(version=2,years=args.years,coverage=[r['coverage'] for r in reports],extent=[94,16,132,43],width=1600,height=1300,plot=[72,150,1528,1170],geometry_url='data/eastern-jin-maps/geometries.json.gz'))

if __name__=='__main__':main()
