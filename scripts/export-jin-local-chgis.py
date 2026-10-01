#!/usr/bin/env python3
"""Offline CHGIS annual reference slices; source attributes never become fief facts.

No input data are fetched or published. Outputs retain source IDs and date-rule codes.
Run with --source-root pointing to the user's authorized CHGIS shapefile directory.
"""
import argparse, collections, hashlib, json, re, struct
from pathlib import Path
import fiona
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform
from shapely import make_valid

LAYERS = [
 ('v6_time_pref_pts_utf_wgs84','v6_time_pref_pts_utf_wgs84.shp',6,'prefecture_points'),
 ('v6_time_cnty_pts_utf_wgs84','v6_time_cnty_pts_utf_wgs84.shp',6,'county_points'),
 ('v6_time_pref_pgn_utf_wgs84','v6_time_pref_pgn_utf_wgs84.shp',6,'prefecture_areas'),
 ('v5_time_pref_pgn_utf-2','v5_time_pref_pgn_utf.shp',5,'prefecture_areas'),
 ('v4_time_prov_pgn_utf','v4_time_prov_pgn_utf.shp',4,'province_areas'),
]

VARIANTS = str.maketrans('钱扬东阳兴宁晋长吴临丰县国庐陈广义乐随郧寿龙汉乡归兰乌浔寻会怀齐绥锡凉涟巩历泾谯兖蒋脩臺郁',
                        '錢揚東陽興寧晉長吳臨豐縣國廬陳廣義樂隨鄖壽龍漢鄉歸蘭烏潯尋會懷齊綏錫涼漣鞏歷涇譙兗蔣修台鬱')

def key(value):
    s=str(value or '').translate(VARIANTS).replace('琅琊','琅邪').replace('候官','侯官').replace('錢唐','錢塘').replace('鍾','鐘')
    return re.sub(r'(王國|公國|侯國|伯國|子國|男國|郡|縣|國|州|尹)$','',re.sub(r'[\s※？?]','',s))

def jsonwrite(path, data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def jsobject(path):
    text=path.read_text()
    return json.loads(text[text.index('{'):].rstrip(';\n '))

def phase(entity, year):
    active=[p for p in entity.get('phases',[]) if p['start']<=year<=p['end']]
    return max(active,key=lambda p:p['start']) if active else None

def snapshot(data,year):
    rows=[]
    def add(e,p,level,state_id,state_name,pref_id=None,pref_name=None):
        rows.append(dict(id=e['id'],name=p.get('name') or e.get('base_name') or e.get('name'),level=level,
                         state_id=state_id,state_name=state_name,prefecture_id=pref_id,prefecture_name=pref_name,
                         begin=p['start'],end=p['end'],uncertain=bool(p.get('uncertain')),is_fief=p.get('is_fief'),
                         source=p.get('source') or e.get('source'),phase=p))
    for s in data['states']:
        sp=phase(s,year)
        if not sp:continue
        sn=sp.get('name',s['name']);add(s,sp,'state',s['id'],sn)
        for p in s.get('prefectures',[]):
            pp=phase(p,year)
            if not pp:continue
            pn=pp.get('name',p['base_name']);add(p,pp,'prefecture',s['id'],sn,p['id'],pn)
            for c in p.get('counties',[]):
                cp=phase(c,year)
                if cp:add(c,cp,'county',s['id'],sn,p['id'],pn)
    return rows

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-root',type=Path,required=True)
    parser.add_argument('--output-root',type=Path,required=True)
    parser.add_argument('--years',nargs='+',type=int,default=[289,307])
    args=parser.parse_args();repo=Path(__file__).resolve().parents[1]
    data=jsobject(repo/'data/jin-data.js')
    loaded=[];sources=[]
    for folder,filename,version,layer in LAYERS:
        path=args.source_root/folder/filename
        with fiona.open(path,encoding='utf-8') as fs:
            crs=CRS.from_wkt(fs.crs_wkt);tr=Transformer.from_crs(crs,4326,always_xy=True)
            source_id=f'CHGIS_V{version}:{path.stem}'
            raw=path.read_bytes();declared_bytes=struct.unpack_from('>i',raw,24)[0]*2
            sources.append(dict(id=source_id,path=str(path),count=len(fs),crs_wkt=fs.crs_wkt,
                                shapefile_sha256=hashlib.sha256(raw).hexdigest(),
                                actual_shp_bytes=len(raw),declared_shp_bytes=declared_bytes,
                                shp_complete=len(raw)==declared_bytes,
                                dbf_sha256=hashlib.sha256(path.with_suffix('.dbf').read_bytes()).hexdigest(),
                                transform_accuracy_metres=tr.accuracy,
                                coordinate_caveat='Source WGS84 geometry' if version==6 else 'Inverse source projection, WGS84 output; source-to-WGS84 datum transformation accuracy unknown/ballpark'))
            for index, f in enumerate(fs):
                a=dict(f['properties']);b=a.get('BEG_YR');e=a.get('END_YR')
                if b is None or e is None or not any(b<=y<=e for y in args.years):continue
                g=transform(tr.transform,shape(f['geometry'])) if f['geometry'] else None
                repaired=False
                if g is not None and not g.is_valid:g=make_valid(g);repaired=True
                t=a.get('TYPE_CH');name=a.get('NAME_FT') or a.get('NAME_CH')
                target=layer
                if layer=='prefecture_points' and t=='州':target='province_points'
                if layer=='prefecture_points' and t=='都督':target='other_points'
                if t=='非政区国土':target='non_admin_areas'
                unknown_zero=(b==0 and str(a.get('BEG_RULE')) in ['0','0.0'])
                if unknown_zero:target='excluded_unknown_begin'
                elif g is None:target='excluded_missing_geometry'
                p=dict(id=f'{source_id}:{a.get("SYS_ID")}:{index+1}',source_id=source_id,source_version=version,
                       source_sys_id=str(a.get('SYS_ID')),dbf_row=index+1,name=name,ch_name=a.get('NAME_CH'),
                       name_py=a.get('NAME_PY'),name_key=key(name),begin=int(b),end=int(e),
                       begin_rule=a.get('BEG_RULE'),end_rule=a.get('END_RULE'),source_type=t,
                       level_rank=a.get('LEV_RANK'),location=a.get('PRES_LOC',a.get('PERS_LOC')),
                       geo_source=a.get('GEO_SRC'),note_id=a.get('NOTE_ID'),
                       coordinate_role='administrative_seat' if g and g.geom_type=='Point' else 'administrative_reference_area',
                       geometry_repaired=repaired,source_properties=a,
                       time_semantics='CHGIS inclusive year interval, not independently verified year-end control',
                       source_conflict_rule='CHGIS V6 > V5 > V4 at same level/entity; CHGIS coordinates/areas precede image-derived geometry',
                       historical_fief_status='not inferred from CHGIS TYPE_CH')
                if g and g.geom_type=='Point':p.update(lon=g.x,lat=g.y)
                loaded.append((target,{'type':'Feature','properties':p,'geometry':mapping(g) if g else None}))
    totals={}
    for year in args.years:
        output=args.output_root/f'chgis_{year}';output.mkdir(parents=True,exist_ok=True)
        layers=collections.defaultdict(list)
        for target,feature in loaded:
            p=feature['properties']
            if p['begin']<=year<=p['end']:layers[target].append(feature)
        exclusions=[]
        for layer in ['prefecture_areas','non_admin_areas']:
            selected=[]
            for f in sorted(layers[layer],key=lambda f:-f['properties']['source_version']):
                p=f['properties'];g=shape(f['geometry']);duplicates=[]
                for old in selected:
                    op=old['properties']
                    if p['source_version']>=op['source_version']:continue
                    sameid=p['source_sys_id']==op['source_sys_id']
                    samekey=p['name_key']==op['name_key']
                    if not(sameid or samekey):continue
                    og=shape(old['geometry']);overlap=g.intersection(og).area/min(g.area,og.area) if g.area and og.area else 0
                    if sameid or overlap>.5:duplicates.append((old['properties']['id'],overlap))
                if duplicates:
                    exclusions.append(dict(excluded_id=p['id'],name=p['name'],reason='lower CHGIS version of same source ID or same named overlapping entity',preferred=duplicates))
                else:selected.append(f)
            layers[layer+'_all_versions']=layers[layer]
            layers[layer]=selected
        for layer,features in layers.items():
            jsonwrite(output/(layer+'.geojson'),dict(type='FeatureCollection',name=f'{year} CHGIS {layer}',
                                                    crs_note='RFC7946 longitude/latitude EPSG:4326; V4/V5 datum caveat preserved in sources',features=features))
        snap=snapshot(data,year);jsonwrite(output/'yearbook_entities.json',snap)
        candidates=[];coverage={}
        for lvl,layer in [('state','province_points'),('prefecture','prefecture_points'),('county','county_points')]:
            entities=[x for x in snap if x['level']==lvl];source=layers[layer];cc=collections.Counter()
            for e in entities:
                matches=[f for f in source if f['properties']['name_key']==key(e['name'])]
                # Report name-only candidates. No nearest-neighbour assignment to seats.
                status='no_name_candidate' if not matches else 'unique_name_candidate' if len(matches)==1 else 'multiple_name_candidates'
                cc[status]+=1
                candidates.append(dict(entity_id=e['id'],entity_name=e['name'],level=lvl,state_id=e['state_id'],state_name=e['state_name'],
                                       prefecture_id=e.get('prefecture_id'),status=status,
                                       candidate_source_ids=[f['properties']['id'] for f in matches],
                                       match_status='candidate_only_not_verified_entity_link'))
            coverage[lvl]={'yearbook_entities':len(entities),'available_chgis_points':len(source),'name_candidate_counts':dict(cc)}
        jsonwrite(output/'name_candidates.json',candidates)
        jsonwrite(output/'sources.json',sources)
        jsonwrite(output/'version_exclusions.json',exclusions)
        counts={k:len(v) for k,v in layers.items()}
        totals[year]=dict(counts=counts,name_candidate_coverage=coverage,
                          pref_areas_by_version=dict(collections.Counter(f['properties']['source_version'] for f in layers['prefecture_areas'])),
                          cautions=['Coverage is source availability/name-candidate coverage, not verified GIS coverage.',
                                    'Local V5 SHP is truncated (12,628,480 of declared 54,886,652 bytes); missing geometries are excluded, not invented.',
                                    'Source type 侯国 for 彭城/沛 is not used as evidence of Jin feudal rank.',
                                    'BEG_YR=0 with BEG_RULE=0 excluded rather than interpreted as a real year zero.',
                                    'Date-rule codes preserved verbatim; missing rule is not a verified exact boundary.',
                                    'CHGIS README restricts redistribution; generated CHGIS slices are local research inputs, not publish-approved web assets.'])
        jsonwrite(output/'summary.json',totals[year])
    jsonwrite(args.output_root/'chgis_summary.json',totals)
    print(json.dumps(totals,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
