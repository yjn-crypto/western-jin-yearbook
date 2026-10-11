#!/usr/bin/env python3
"""Build Liu Song 420–479 maps from CHGIS and the 464/497 atlas sources only.

Run with Python 3.12 and PYTHONPATH=work/_gis_deps. No other dynasty's
geography is imported. Existing atlas province compartments may be merged;
only dated CHGIS polygons create prefecture faces and prefecture boundaries.
"""
from __future__ import annotations
import argparse, collections, gzip, hashlib, io, json, re, struct, zipfile
from functools import lru_cache
from pathlib import Path
from shapely import make_valid, set_precision
from shapely.geometry import shape, mapping, Point, Polygon
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/liu-song-maps'
INPUT=ROOT/'data/liu-song-research/annual'
ATLAS_ROOT=Path.home()/'Documents/Codex/2026-10-02/ni/outputs'
ATLAS_DIRS={464:'刘宋464年',497:'齐魏497年'}
GRID=.000001
GEOMS={}
VARIANTS=str.maketrans('钱扬东阳兴宁晋长吴临丰县国庐陈广义乐随郧寿龙汉乡归兰乌浔寻会怀齐绥锡凉涟巩历泾谯兖蒋脩臺郁辽邹濟济贊赞邺营应荣渑渋黾卢贝颍颖缪闽谭枣潜钜甯荥农阴杨内顿鲁为隶门卫云莲荫阁间蓟双盖还仓华陕汤盐温诸虑范审肃轵护穷绵犊壶经萨顺连旸术粤渎峡濑达骠饶泽风陇负缑显厩邓摇赵苍',
                      '錢揚東陽興寧晉長吳臨豐縣國廬陳廣義樂隨鄖壽龍漢鄉歸蘭烏潯尋會懷齊綏錫涼漣鞏歷涇譙兗蔣修台鬱遼鄒濟濟贊贊鄴營應榮澠澀黽盧貝潁穎繆閩譚棗潛鉅寧滎農陰楊內頓魯為隸門衛雲蓮蔭閣間薊雙蓋還倉華陝湯鹽溫諸慮範審肅軹護窮綿犢壺經薩順連暘術粵瀆峽瀨達驃饒澤風隴負緱顯廄鄧搖趙蒼')
VARIANTS.update(str.maketrans({'荆':'荊','并':'並','渔':'漁','瑯':'琅','濬':'浚','邱':'丘'}))

def key(name,county=False):
    s=str(name or '').translate(VARIANTS).replace('琅琊','琅邪').replace('候官','侯官').replace('錢唐','錢塘').replace('鍾','鐘').replace('丹楊','丹陽')
    s=re.sub(r'[\s※？?]','',s)
    return re.sub(r'(縣)$' if county else r'(王國|公國|侯國|郡|國|州|尹)$','',s)

def read(path):
    p=Path(path);return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes())

def write(path,value):
    p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n')

def polygonal(g):
    if g.is_empty:return Polygon()
    if not g.is_valid:g=make_valid(g)
    if g.geom_type in ('Polygon','MultiPolygon'):return g
    parts=[p for p in getattr(g,'geoms',[]) if p.geom_type in ('Polygon','MultiPolygon')]
    return unary_union(parts) if parts else Polygon()

def clean(g):return polygonal(set_precision(polygonal(g),GRID))
def union(gs):return union_geometry(tuple(g for g in gs if not g.is_empty))
@lru_cache(maxsize=2048)
def union_geometry(gs):return clean(unary_union(gs)) if gs else Polygon()
@lru_cache(maxsize=1024)
def solid(g):
    parts=[g] if g.geom_type=='Polygon' else list(g.geoms) if g.geom_type=='MultiPolygon' else []
    return union(Polygon(p.exterior) for p in parts)
@lru_cache(maxsize=256)
def shared_boundaries(gs):
    return unary_union([g.boundary for g in gs]).difference(union(gs).boundary) if len(gs)>1 else Polygon().boundary
@lru_cache(maxsize=16384)
def gid(g):
    obj=mapping(g);raw=json.dumps(obj,separators=(',',':'),sort_keys=True)
    ident='ls'+hashlib.sha256(raw.encode()).hexdigest()[:16];GEOMS[ident]=obj;return ident
def feature(g,**props):return dict(geometry_id=gid(g),properties=props)

def dbf_rows(raw):
    count,header,size=struct.unpack_from('<IHH',raw,4);fields=[]
    for offset in range(32,header-1,32):
        if raw[offset]==13:break
        fields.append((raw[offset:offset+11].split(b'\0')[0].decode(),raw[offset+16]))
    for i in range(count):
        row=raw[header+i*size:header+(i+1)*size]
        if not row or row[:1]==b'*':yield None;continue
        pos=1;out={}
        for name,length in fields:out[name]=row[pos:pos+length].decode('utf-8',errors='replace').strip();pos+=length
        yield out

def shp_rows(raw):
    pos=100
    while pos+8<=len(raw):
        size=struct.unpack_from('>i',raw,pos+4)[0]*2
        yield raw[pos+8:pos+8+size];pos+=8+size

def shp_geometry(raw):
    kind=struct.unpack_from('<i',raw)[0]
    if kind==0:return None
    if kind==1:return Point(*struct.unpack_from('<dd',raw,4))
    if kind!=5:raise ValueError('Unsupported geometry '+str(kind))
    parts,count=struct.unpack_from('<ii',raw,36)
    starts=list(struct.unpack_from(f'<{parts}i',raw,44))+[count]
    coords=[struct.unpack_from('<dd',raw,44+parts*4+i*16) for i in range(count)]
    rings=sorted([Polygon(coords[starts[i]:starts[i+1]]) for i in range(parts) if starts[i+1]-starts[i]>=4],key=lambda p:p.area,reverse=True)
    parents=[];depths=[]
    for i,ring in enumerate(rings):
        possible=[j for j in range(i) if rings[j].covers(ring.representative_point())]
        parent=min(possible,key=lambda j:rings[j].area) if possible else None
        parents.append(parent);depths.append(0 if parent is None else depths[parent]+1)
    return polygonal(unary_union([Polygon(r.exterior.coords,[list(rings[j].exterior.coords) for j,p in enumerate(parents) if p==i]) for i,r in enumerate(rings) if depths[i]%2==0]))

def chgis():
    path=OUT/'sources/chgis-420-479.geojson.gz'
    if path.exists():
        d=read(path);return [dict(f['properties'],geometry=shape(f['geometry'])) for f in d['features']],d['inventory']
    records=[];inventory=[]
    packages=[('CHGIS数据/dataverse_files-v6.zip','v6_time_cnty_pts_utf_wgs84.zip','county'),('CHGIS数据/dataverse_files (2)-v6.zip','v6_time_pref_pts_utf_wgs84.zip','prefecture'),('CHGIS数据/dataverse_files (1)-v6.zip','v6_time_pref_pgn_utf_wgs84.zip','prefecture_area'),('CHGIS数据/v4_time_prov_pts_utf.zip',None,'state')]
    with zipfile.ZipFile(Path.home()/'Downloads/CHGIS数据.zip') as outer:
        for package,nested,level in packages:
            payload=outer.read(package);inside=zipfile.ZipFile(io.BytesIO(payload))
            if nested:payload=inside.read(nested);inside=zipfile.ZipFile(io.BytesIO(payload))
            names=[n for n in inside.namelist() if not n.startswith('__MACOSX')]
            dbf=next(n for n in names if n.endswith('.dbf'));shp=next(n for n in names if n.endswith('.shp'))
            attrs=list(dbf_rows(inside.read(dbf)));geoms=list(shp_rows(inside.read(shp))) if nested else []
            selected=0
            for i,a in enumerate(attrs):
                if not a:continue
                try:begin,end=int(float(a['BEG_YR'])),int(float(a['END_YR']))
                except (KeyError,ValueError):continue
                if begin>479 or end<420 or (begin==0 and a.get('BEG_RULE') in ('0','0.0')) or a.get('TYPE_CH') in ('非政区国土','都督'):continue
                g=shp_geometry(geoms[i]) if nested else Point(float(a.get('X_COORD') or a.get('X_COOR')),float(a.get('Y_COORD') or a.get('Y_COOR')))
                if g is None or g.is_empty:continue
                actual='state' if level=='prefecture' and a.get('TYPE_CH')=='州' else level
                name=a.get('NAME_FT') or a.get('NAME_CH')
                records.append(dict(level=actual,name=name,name_key=key(name,actual=='county'),begin=begin,end=end,geometry=g,source=f'CHGIS_V{6 if nested else 4}:{Path(dbf).stem}',source_id=a.get('SYS_ID'),version=6 if nested else 4,location=a.get('PRES_LOC') or a.get('PERS_LOC') or '',begin_rule=a.get('BEG_RULE'),end_rule=a.get('END_RULE')));selected+=1
            inventory.append(dict(package=package,nested=nested,sha256=hashlib.sha256(payload).hexdigest(),records=selected))
    payload=dict(type='FeatureCollection',features=[dict(type='Feature',geometry=mapping(r['geometry']),properties={k:v for k,v in r.items() if k!='geometry'}) for r in records],inventory=inventory)
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
    return records,inventory

def atlases():
    result={};manifest=[]
    for year,dirname in ATLAS_DIRS.items():
        result[year]={}
        for layer in ['zhou_territories','polity_territories','commandery_seats','state_seats']:
            raw=(ATLAS_ROOT/dirname/'gis'/(layer+'.geojson')).read_bytes();d=json.loads(raw)
            fs=[f for f in d['features'] if f['properties'].get('polity') in ('刘宋','南齐')]
            # Publish only the small geographic source record, not the source
            # package's private working paths, image crops, or nested OCR.
            fields=['id','unit_id','name','state','polity','level','kind','year','source_year','source_id','source_ids','member_states','is_common_range','is_emigrant','host_commandery','seat_status','seat_group_id','point_entity_key','seat_confidence','name_confidence','is_primary_display']
            public=dict(type='FeatureCollection',features=[dict(type='Feature',geometry=f.get('geometry'),properties={k:v for k,v in f['properties'].items() if k in fields}) for f in fs])
            dest=OUT/'sources'/f'atlas{year}-{layer}.geojson.gz';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(gzip.compress(json.dumps(public,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
            result[year][layer]=fs
            manifest.append(dict(id=f'atlas{year}-{layer}',path=str(dest.relative_to(ROOT)),source_package=dirname+'/gis/'+layer+'.geojson',source_sha256=hashlib.sha256(raw).hexdigest(),records=len(fs),source_year=year))
        result[year]['units']=[dict(name=f['properties']['name'],members=f['properties'].get('member_states') or f['properties']['name'].split('、'),geometry=clean(shape(f['geometry'])),source_id=f'atlas{year}-zone-{i+1}') for i,f in enumerate(result[year]['zhou_territories'])]
        result[year]['control']=solid(union(shape(f['geometry']) for f in result[year]['polity_territories']))
    write(OUT/'sources/manifest.json',dict(sources=manifest,source_rule='仅CHGIS与464/497矢量底图；没有西晋地图数据',atlas497_points='只作参考；不得只凭497同名记录回填宋代治所'))
    return result

def flatten(d,with_unassigned=True):
    levels={k:{} for k in ['state','prefecture','county']}
    def put(row,level,sid=None,pid=None,unassigned=False):
        ident=row.get('entity_id') or row.get('id')
        if ident in levels[level]:return
        levels[level][ident]=dict(row,id=ident,state_id=sid,prefecture_id=pid,parentage_unresolved=unassigned)
        if level=='state':
            for p in row.get('prefectures',row.get('rows',[])):put(p,'prefecture',ident,None,unassigned)
            for c in row.get('direct_counties',[]):put(c,'county',ident,None,unassigned)
        if level=='prefecture':
            for c in row.get('counties',[]):put(c,'county',sid,ident,unassigned)
    for s in d['states']:put(s,'state')
    if with_unassigned:
        for row in d.get('unassigned',[]):put(row,row['level'],unassigned=True)
    return levels

def active_rows(records,year,level,name):
    return [r for r in records if r['level']==level and r['name_key']==key(name,level=='county') and r['begin']<=year<=r['end']]

def unique_points(candidates):
    groups={}
    for r in candidates:
        sig=tuple(round(c,6) for c in r['geometry'].coords[0])
        if sig not in groups or r.get('version',0)>groups[sig].get('version',0):groups[sig]=r
    return list(groups.values())

def province_targets(unit,year,states,sourceyear):
    name=unit['name']
    normal={'宁州':'ls6_s4160','益州':'ls6_s3968','梁州、秦州':'ls6_s3720','荆州':'ls6_s2234','江州':'ls6_s3498','广州':'ls6_s4394','交州':'ls6_s5130','豫州':'ls6_s1294'}
    if name in normal:ids=[normal[name]]
    elif name=='湘州':ids=['ls6_s2992' if 'ls6_s2992' in states else 'ls6_s2234']
    elif name=='雍州':ids=['ls6_s3238' if year>=449 else 'ls6_s2234']
    elif name=='郢州':ids=['ls6_s2770'] if 'ls6_s2770' in states else ['ls6_s2234','ls6_s3498']
    elif name=='南豫州':ids=['ls6_s1680' if 'ls6_s1680' in states else 'ls6_s1294']
    elif name=='东扬州':ids=['ls6_s456' if 'ls6_s456' in states else 'ls6_s180']
    elif name=='扬州':ids=['ls6_s180']
    elif name=='南徐州':ids=['ls6_s180' if year<=430 else 'ls6_s540']
    elif name=='南兖州':ids=['ls6_s694' if year<=430 else 'ls6_s540' if year==453 else 'ls6_s782']
    elif sourceyear==464 and name=='徐州':ids=['ls6_s886','ls6_s1092']
    elif sourceyear==464 and name=='兖州':ids=['ls6_s1112']
    elif sourceyear==464 and name=='青州、冀州':ids=['ls6_s1916','ls6_s2086']
    elif sourceyear==497 and name=='越州':ids=['ls6_s5296'] if 'ls6_s5296' in states else ['ls6_s4394','ls6_s5130']
    elif sourceyear==497 and name=='司州':ids=['ls6_s5352'] if states.get('ls6_s5352',{}).get('territorial_status') in ('territorial','mixed') else []
    else:ids=[]
    return tuple(i for i in ids if i in states and not states[i].get('parentage_unresolved') and states[i].get('territorial_status')!='nonterritorial')

def locate_from_text(row,records,phases,year,control):
    phase=phases.get(row.get('phase_id'),{})
    seat=(phase.get('seat') or {}).get('raw') or ''
    # Modern explanations are removed before matching historical place names.
    seat=re.sub(r'（[^）]*）|\([^)]*\)','',seat)
    hosts=[c.get('label') or '' for c in row.get('qiao_annotation',{}).get('context',[]) if c.get('kind')=='hosted_at' and c.get('temporal_applicability')!='undated_research_context']
    raw=seat or '；'.join(hosts)
    if not raw or re.search('乏考|不详|未详|疑|或|先治|后移|復移|复移|之间|之間|郡境|郡界',raw):return None
    text=raw.translate(VARIANTS)
    candidates=[r for r in records if r['level'] in ('county','prefecture') and r['begin']<=year<=r['end'] and len(r['name_key'])>=2 and r['name_key'] in text and control.distance(r['geometry'])<.3]
    # Do not accept an entity's own name as independent evidence of its seat.
    candidates=[r for r in candidates if r['name_key']!=key(row['name'],row.get('level')=='county')]
    if candidates:
        longest=max(len(r['name_key']) for r in candidates);candidates=[r for r in candidates if len(r['name_key'])==longest]
    candidates=unique_points(candidates)
    if len(candidates)!=1:return None
    return dict(candidates[0],method='正文明确治所/有时限寄地：'+raw,coordinate_role='administrative_seat' if seat else 'hosted_relation_reference_not_seat',host_reference=not bool(seat))

def build(year,records,atlas,phases,baseline,config):
    rows=flatten(read(INPUT/f'{year}.json'));states=rows['state'];prefs=rows['prefecture'];counties=rows['county']
    sourceyear=464 if year<config['late_basemap_start'] else 497;base=atlas[sourceyear]
    units=[];dropped=[]
    for unit in base['units']:
        targets=province_targets(unit,year,states,sourceyear)
        # Northern loss is an annual text event, not a blanket 465 map switch.
        if sourceyear==464 and unit['name'] in ('兖州','徐州','青州、冀州') and not targets:dropped.append(unit['geometry']);continue
        units.append(dict(unit,targets=targets))
    control=solid(clean(base['control'].difference(union(dropped))))
    masks={sid:union(u['geometry'] for u in units if sid in u['targets']) for sid in states}
    # A clear host can locate points for a nonterritorial state without giving
    # the institution an administrative polygon.
    for sid,s in states.items():
        if masks[sid].is_empty:
            named=[u['geometry'] for u in base['units'] if key(s['name']) in [key(n) for n in u['members']]]
            if s.get('territorial_status')=='nonterritorial' and named:masks[sid]=union(named)
    points={};mapping_rows=[];authority={}
    for pid,p in prefs.items():
        if p.get('parentage_unresolved'):continue
        mask=masks.get(p.get('state_id'),Polygon())
        candidates=active_rows(records,year,'prefecture',p['name'])
        if not mask.is_empty:candidates=[r for r in candidates if mask.distance(r['geometry'])<=.3]
        else:candidates=[]
        candidates=unique_points(candidates)
        if len(candidates)==1:points[pid]=dict(candidates[0],method='同年CHGIS郡点＋当年州域/寄地约束',coordinate_role='administrative_seat')
        if p.get('territorial_status')=='nonterritorial':continue
        areas=active_rows(records,year,'prefecture_area',p['name'])
        if mask.is_empty:areas=[]
        else:areas=[r for r in areas if r['geometry'].intersection(mask).area>r['geometry'].area*.1 and (pid not in points or r['geometry'].distance(points[pid]['geometry'])<.1)]
        if p.get('qiao') is True and p.get('territorial_status') not in ('territorial','mixed'):areas=[]
        if len(areas)==1:authority[pid]=areas[0]
    # Prefer a single current CHGIS point, then an explicit historical seat
    # relation, then the 464 circle only across the same source phase.
    atlas_points=atlas[464]['commandery_seats']+atlas[464]['state_seats']
    for level in ['state','prefecture']:
        for ident,row in rows[level].items():
            if ident in points:continue
            sid=ident if level=='state' else row.get('state_id');mask=masks.get(sid,Polygon())
            # A missing province polygon does not erase a independently dated
            # CHGIS seat within the selected southern political reference.
            if mask.is_empty and level=='state':mask=control
            elif mask.is_empty and sid in points:mask=points[sid]['geometry'].buffer(1.5)
            if not row.get('parentage_unresolved'):
                cs=active_rows(records,year,level,row['name'])
                cs=[r for r in cs if not mask.is_empty and mask.distance(r['geometry'])<=.3]
                cs=unique_points(cs)
                if len(cs)==1:points[ident]=dict(cs[0],method='同年CHGIS＋有据本地州域约束',coordinate_role='administrative_seat');continue
            located=locate_from_text(row,records,phases,year,control)
            if located:points[ident]=located;continue
            oldrow=baseline[level].get(ident)
            if row.get('parentage_unresolved') or not oldrow or row.get('phase_id')!=oldrow.get('phase_id'):continue
            matches=[f for f in atlas_points if f.get('geometry') and f['properties'].get('level')==('州' if level=='state' else '郡') and key(f['properties']['name'])==key(oldrow['name'])]
            if level=='prefecture':
                oldstate=baseline['state'].get(oldrow.get('state_id'),{})
                local=[f for f in matches if key(f['properties'].get('state'))==key(oldstate.get('name'))]
                matches=local or matches if len(matches)==1 else local
            if len(matches)==1:
                f=matches[0];g=shape(f['geometry'])
                if control.distance(g)<=.3:
                    points[ident]=dict(geometry=g,source='谭图464原图古治所圈',source_id=f['properties']['id'],begin=464,end=464,method='与464同一来源阶段的治所沿用参考；非逐年独立测定',coordinate_role='administrative_seat',source_year=464,projection=year!=464)
    for cid,c in counties.items():
        if c.get('parentage_unresolved'):
            located=locate_from_text(c,records,phases,year,control)
            if located:points[cid]=located
            continue
        pid=c.get('prefecture_id');mask=authority.get(pid,{}).get('geometry')
        if mask is None and pid in points:mask=points[pid]['geometry'].buffer(.8 if c.get('qiao') is True else 1.5)
        if mask is None and c.get('qiao') is not True:mask=masks.get(c.get('state_id'))
        cs=active_rows(records,year,'county',c['name'])
        cs=[r for r in cs if mask is not None and not mask.is_empty and mask.distance(r['geometry'])<=.2 and control.distance(r['geometry'])<=.3]
        cs=unique_points(cs)
        if len(cs)==1:points[cid]=dict(cs[0],method='同年CHGIS县点＋有据所属郡域/治所范围',coordinate_role='administrative_seat')
    # Choose dated CHGIS polygons once. No atlas intersection shortens them.
    occupied=Polygon();areas={};overlaps={}
    for pid,r in sorted(authority.items(),key=lambda kv:(-kv[1]['begin'],kv[0])):
        raw=clean(r['geometry']);g=clean(raw.difference(occupied))
        if g.is_empty:continue
        areas[pid]=g;overlaps[pid]=round(raw.area-g.area,10);occupied=union([occupied,g])
    control=solid(union([control,occupied]))
    state_pieces=collections.defaultdict(list);shared=[]
    complete=set()
    for sid in ['ls6_s180','ls6_s456','ls6_s540','ls6_s3498']:
        required=[p['id'] for p in prefs.values() if p.get('state_id')==sid and p.get('territorial_status') in ('territorial','mixed')]
        if required and all(pid in areas for pid in required):complete.add(sid)
    for u in units:
        remaining=clean(u['geometry'].difference(occupied));targets=u['targets']
        if remaining.is_empty or not targets:continue
        if len(targets)==1:
            if targets[0] not in complete:state_pieces[targets[0]].append(remaining)
        else:shared.append((targets,remaining,u))
    for pid,g in areas.items():state_pieces[prefs[pid]['state_id']].append(g)
    state_areas={sid:union(gs) for sid,gs in state_pieces.items()}
    shared_areas=collections.defaultdict(list)
    for targets,g,u in shared:shared_areas[targets].append(g)
    shared_areas={targets:union(gs) for targets,gs in shared_areas.items()}
    province_network=shared_boundaries(tuple([*state_areas.values(),*shared_areas.values()]))
    features=[feature(control,layer='regime_areas',level='territory',name='刘宋政权范围参考',is_jin=True,source=f'用户首轮约定：{sourceyear}底图范围，按本年有据失地及CHGIS取界',actual_control_claim='reference_convention_not_precise_military_frontier'),feature(control.boundary,layer='regime_boundaries',level='territory',name='刘宋政权外缘参考',is_jin=True,source=f'{sourceyear}参考底图＋同年选定CHGIS边界')]
    for pid,g in areas.items():
        p=prefs[pid];r=authority[pid]
        props=dict(entity_id=pid,level='prefecture',name=p['name'],state_id=p['state_id'],qiao=p.get('qiao'),territorial_status=p.get('territorial_status'),source=r['source'],source_id=r['source_id'],source_begin=r['begin'],source_end=r['end'],boundary_inferred=False,boundary_evidence='仅采用同年有效CHGIS原郡面；没有新拟合郡界',year=year)
        features.append(feature(g,layer='prefecture_areas',**props));features.append(feature(g.boundary,layer='prefecture_boundaries',**props))
        mapping_rows.append(dict(entity_id=pid,name=p['name'],state_id=p['state_id'],source_id=r['source_id'],begin=r['begin'],end=r['end'],overlap_removed_degrees2=overlaps[pid]))
    for sid,g in state_areas.items():
        s=states[sid];props=dict(entity_id=sid,level='state',name=s['name'],qiao=s.get('qiao'),territorial_status=s.get('territorial_status'),source=f'本年有效CHGIS郡面并集'+('' if sid in complete else f'＋{sourceyear}完整州域分区；按年度分合'),year=year)
        features.append(feature(g,layer='province_areas',**props))
        border=g.boundary.intersection(province_network)
        if not border.is_empty:features.append(feature(border,layer='province_boundaries',**props))
    for targets,g in shared_areas.items():
        name='、'.join(states[sid]['name'] for sid in targets)+'（未分界）'
        props=dict(entity_id=None,member_entity_ids=list(targets),name=name,level='state',qiao=False,shared_reference=True,source=f'{sourceyear}原图共同参考区；现无可靠内部界，不新拟合',year=year)
        features.append(feature(g,layer='province_areas',**props))
        border=g.boundary.intersection(province_network)
        if not border.is_empty:features.append(feature(border,layer='province_boundaries',**props))
    for level in ['state','prefecture','county']:
        for ident,row in rows[level].items():
            if ident not in points:continue
            r=points[ident];g=r['geometry'];role=r.get('coordinate_role','administrative_seat')
            show=level=='county' or (ident not in areas if level=='prefecture' else ident not in state_areas)
            features.append(feature(g,layer='labels' if r.get('host_reference') else level+'_seats',level=level,entity_id=ident,name=row['name'],state_id=row.get('state_id'),prefecture_id=row.get('prefecture_id'),qiao=row.get('qiao'),territorial_status=row.get('territorial_status'),parentage_unresolved=row.get('parentage_unresolved',False),source=r['source'],source_id=r['source_id'],source_coordinates=list(g.coords[0]),coordinate_source_begin=r['begin'],coordinate_source_end=r['end'],coordinate_role=role,seat_note=r['method'],show_label=show,source_projection=bool(r.get('projection')),year=year))
    parts=[control] if control.geom_type=='Polygon' else list(control.geoms)
    known=union([*state_areas.values(),*shared_areas.values()])
    coverage=dict(year=year,basemap_year=sourceyear,states_in_text=len([r for r in states.values() if not r.get('parentage_unresolved')]),prefectures_in_text=len([r for r in prefs.values() if not r.get('parentage_unresolved')]),counties_in_text=len([r for r in counties.values() if not r.get('parentage_unresolved')]),state_areas=len(state_areas),shared_state_areas=len(shared_areas),prefecture_areas=len(areas),chgis_prefecture_areas=len(areas),complete_chgis_state_ids=sorted(complete),state_seats=sum(i in points for i in states),prefecture_seats=sum(i in points for i in prefs),county_seats=sum(i in points for i in counties),unassigned_points=sum(i in points and r.get('parentage_unresolved',False) for rows_ in rows.values() for i,r in rows_.items()),qiao_points=sum(i in points and r.get('qiao') is True for rows_ in rows.values() for i,r in rows_.items()),unlocated_ids=[i for rows_ in rows.values() for i in rows_ if i not in points],missing_prefecture_area_ids=[i for i,p in prefs.items() if not p.get('parentage_unresolved') and p.get('territorial_status')!='nonterritorial' and i not in areas],control_interior_holes=sum(len(p.interiors) for p in parts),unassigned_control_area_degrees2=round(control.difference(known).area,8),atlas497_points_used=0,new_prefecture_boundaries_fitted=0,western_jin_data_used=False)
    write(OUT/f'annual/{year}.json',dict(type='LiuSongGeometryGraph',version=1,year=year,geometry_url='data/liu-song-maps/geometries.json.gz',features=features,coverage=coverage))
    return dict(coverage=coverage,prefecture_mappings=mapping_rows,state_mappings=[dict(source_unit=u['name'],source_id=u['source_id'],state_ids=list(u['targets']),shared=len(u['targets'])>1) for u in units],point_mappings=[dict(entity_id=i,source=r['source'],source_id=r['source_id'],coordinates=list(r['geometry'].coords[0]),method=r['method'],coordinate_role=r.get('coordinate_role'),projection=bool(r.get('projection'))) for i,r in points.items()])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--late-start',type=int,default=469);args=parser.parse_args();years=list(range(420,480))
    config=dict(early_basemap=464,late_basemap=497,late_basemap_start=args.late_start,transition='465—468按年度保留尚存实兖、实徐/东徐、实青/东青；469起497范围',basis='用户2026-10-11首轮展示约定；不是逐年精确军事实控边界',province_splits='完整原州分区按年度合并；CHGIS有据郡面优先；缺分界处共同参考',prefecture_boundaries='仅同年CHGIS；不生成任何拟合郡界',western_jin_data_used=False)
    write(OUT/'build-config.json',config)
    atlas=atlases();records,inventory=chgis()
    research=read(ROOT/'data/liu-song-research/research.json');phases={p['id']:p for p in research['phases']};baseline=flatten(read(INPUT/'464.json'))
    reports=[]
    for year in years:
        result=build(year,records,atlas,phases,baseline,config);reports.append(result);c=result['coverage']
        print(f"{year}: {c['state_areas']} provinces + {c['shared_state_areas']} shared; {c['prefecture_areas']} CHGIS prefectures; {c['county_seats']} county seats; {c['control_interior_holes']} holes",flush=True)
    (OUT/'geometries.json.gz').write_bytes(gzip.compress(json.dumps(dict(geometries=GEOMS),ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
    write(OUT/'index.json',dict(version=1,years=years,extent=[96,16,124,39],width=1600,height=1300,plot=[72,150,1528,1170],geometry_url='data/liu-song-maps/geometries.json.gz',coverage=[r['coverage'] for r in reports],config=config))
    write(OUT/'mapping-report.json',dict(version=1,source_inventory=inventory,config=config,years=reports))

if __name__=='__main__':main()
