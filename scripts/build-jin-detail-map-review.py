#!/usr/bin/env python3
"""Dated, local amendments layered after the existing 289 and connectivity work.
Run with the bundled Python, PYTHONPATH=work/_gis_deps. No annual atlas is rebuilt.
"""
import gzip, hashlib, json, subprocess
from copy import deepcopy
from pathlib import Path
from shapely import normalize, set_precision
from shapely.geometry import shape, mapping, Point, Polygon, LineString, box
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/jin-maps/three-basemap-sources'
NODE=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
NOTE='本輪局部補正：樂浪、帶方沿譚圖共同外圈及未閉合內界恢復；魯沛間東海碎面歸魯，按真實州屬重分郡界；新都與濟陰封爵採既定Word年份；濟陽另分陳留，濟陽、考城用CHGIS原點約束曲線擬界。封國參考範圍不等同當年實控。'

def read_source(name):return json.loads(gzip.decompress((SOURCE/(name+'.geojson.gz')).read_bytes()))['features']
def clean(g):return normalize(set_precision(g,.000001))
def lineal(g):
    if g.geom_type in ['LineString','MultiLineString']:return g
    return unary_union([lineal(x) for x in getattr(g,'geoms',[]) if x.geom_type in ['LineString','MultiLineString','GeometryCollection']])
def key(f):
    p=f['properties'];return ':'.join([p['layer'],str(p.get('entity_id') or p.get('id') or p.get('source_id') or ''),','.join(sorted(p.get('adjacent_entity_ids',[])))])
def parts(g):return list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
def curve(points):
    """Catmull-Rom curve through the reviewed local separator waypoints."""
    padded=[points[0],*points,points[-1]];result=[]
    for i in range(1,len(padded)-2):
        a,b,c,d=padded[i-1:i+3]
        for k in range(15):
            t=k/15
            result.append(tuple(.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t) for j in [0,1]))
    return result+[points[-1]]

def build():
    subprocess.run([str(NODE),'scripts/export-jin-detail-map-input.cjs'],cwd=ROOT,check=True)
    out={'reviewed_at':'2026-10-07','policy':NOTE,'geometries':{},'years':{}}
    report=[]
    def save(g):
        geom=mapping(normalize(g))
        if geom['type'] not in ['Point','MultiPoint']:
            def rounded(value):return [rounded(v) for v in value] if isinstance(value,(list,tuple)) else round(value,6)
            geom['coordinates']=rounded(geom['coordinates'])
        raw=json.dumps(geom,separators=(',',':'))
        gid='detail-'+hashlib.sha256(raw.encode()).hexdigest()[:16];out['geometries'][gid]=geom;return gid
    sources=read_source('tan281-jun_guo_territories')
    xindu_source=clean(shape(next(f for f in sources if f['properties']['unit_id']==130)['geometry']))
    joint=clean(shape(next(f for f in sources if f['properties']['unit_id']==165)['geometry']))
    joint_labels=[f for f in read_source('tan281-jun_guo_names') if f['properties']['unit_id']==165]
    joint_lines=[shape(f['geometry']) for f in read_source('tan281-jun_boundaries_partial') if f['properties'].get('source_id')=='e7208590']
    chgis=read_source('chgis-266-316')
    kao=next(f for f in chgis if f['properties'].get('source_id')=='82331')
    jiyang=next(f for f in chgis if f['properties'].get('source_id')=='44379')
    jiyang_curve=curve([(114.87,35.5),(114.86,35.02),(114.87,34.9),(115.055,34.825),(115.085,34.72),(115.075,34.635),(115.15,34.55),(116,34.55)])
    jiyang_mask=Polygon(jiyang_curve+[(116,36),(114.87,36)])
    stable_colors={}
    for year in range(266,317):
        original=json.loads((Path('/private/tmp/jin-detail-input')/f'{year}.json').read_text())
        fs=deepcopy(original['geojson']['features']);changed=set();touched_fiefs=set();checks={}
        for f in fs:f['_shape']=shape(f['geometry'])
        def touch(f):changed.add(key(f));return f
        def add(g,p):
            f={'type':'Feature','geometry':mapping(g),'properties':p,'_shape':g};fs.append(f);changed.add(key(f));return f
        def remove(f):changed.add(key(f));fs.remove(f)
        def change_shape(f,g):touch(f);f['_shape']=clean(g);f['geometry']=mapping(f['_shape'])
        def area(pid):return next((f for f in fs if f['properties']['layer']=='prefecture_areas' and f['properties'].get('entity_id')==pid),None)
        def region(pid,rid=None):return area(pid) or next((f for f in fs if rid and f['properties'].get('id')==rid and f['properties']['layer']=='reference_prefecture_areas'),None)
        def metadata(pid,rid,values):
            target=region(pid,rid)
            if target is None:return
            old=target['properties'].get('fief_id');new=values.get('fief_id');touched_fiefs.update(x for x in [old,new] if x)
            for f in fs:
                p=f['properties']
                if (p.get('entity_id')==pid and p.get('level')=='prefecture') or (rid and p.get('id')==rid):touch(f);p.update(values)
                if rid and p['layer']=='reference_prefecture_seats' and target['_shape'].covers(f['_shape']):touch(f);p.update({k:v for k,v in values.items() if k in ['display_name','fief_id','color']})
            return target
        # Restore only the two source commanderies, not the rest of Korea.
        old_domain=clean(unary_union([f['_shape'] for f in fs if f['properties']['layer']=='regime_areas']))
        joint_here=clean(joint.intersection(box(*original['extent'])).difference(old_domain))
        pid1,pid2=('p057','p059') if year<=273 else ('p062','p064')
        sid,sname=('s05','幽州') if year<=273 else ('s06','平州')
        add(joint_here,{'layer':'prefecture_areas','level':'prefecture','entity_id':'joint-lelang-daifang','member_entity_ids':[pid1,pid2],
            'name':'樂浪、帶方郡共同圖示範圍','display_name':'樂浪、帶方郡共同圖示範圍','state_id':sid,'state_name':sname,'year':year,
            'source':'譚圖281 unit165共同外圈；本輪取消將兩郡誤列域外的排除條件。','geometry_status':'source_joint_outline_without_invented_internal_border',
            'boundary_note':'原圖兩郡界未閉合；保留可見界段，未補造完整分界。','political_control_is_separate':True,'explicit_shared_boundaries':True,'show_label':False})
        for label,pid,name in zip(joint_labels,[pid1,pid2],['樂浪郡','帶方郡']):
            add(shape(label['geometry']),{'layer':'labels','level':'prefecture','entity_id':pid,'name':name,'display_name':name,'state_id':sid,'state_name':sname,'year':year,
                'label_type':'prefecture','show_label':True,'coordinate_role':'territory_label_not_capital','source':'譚圖281原名稱位置；共同外圈，郡間界未閉合。'})
        for n,line in enumerate(joint_lines):
            add(line.intersection(joint_here),{'layer':'prefecture_boundaries','level':'prefecture','id':'lelang-daifang-visible-'+str(n),'name':'原圖可見未閉郡界','year':year,'boundary_inferred':False,
                'source':'譚圖281可見郡界片段；不將其補作完整分界。','coordinate_role':'boundary'})
        state=next(f for f in fs if f['properties']['layer']=='province_areas' and f['properties'].get('entity_id')==sid)
        change_shape(state,unary_union([state['_shape'],joint_here]))
        jin=next(f for f in fs if f['properties']['layer']=='regime_areas' and f['properties'].get('is_jin'))
        change_shape(jin,unary_union([jin['_shape'],joint_here]))
        for f in fs:
            if f['properties']['layer']=='original_territory_boundary':change_shape(f,clean(unary_union([old_domain,joint_here])).boundary)
        # The same tiny source remnants pass from Donghai to Lanling. Restore
        # each to the adjacent real face for this year: Lu first, Pengcheng
        # after Fan and Xue have transferred. A real Xu/Yu border stays a state line.
        lu=area('p029');pengcheng=area('p149');repaired_ids=set();sliver_total=0
        for source_pid in ['p152','p156']:
            source_area=area(source_pid)
            if source_area is None:continue
            fragments=[g for g in parts(source_area['_shape']) if g.area<.0001 and g.intersects(box(116.85,34.8,117.06,34.95))]
            for fragment in fragments:
                target=lu if lu['_shape'].boundary.intersection(fragment.boundary).length>.0000001 else pengcheng
                change_shape(target,unary_union([target['_shape'],fragment]));change_shape(source_area,source_area['_shape'].difference(fragment))
                repaired_ids.update([target['properties']['entity_id'],source_pid])
                touched_fiefs.update(f['properties']['fief_id'] for f in [target,source_area] if f['properties'].get('fief_id'))
                if target['properties']['state_id']!=source_area['properties']['state_id']:
                    for f in fs:
                        p=f['properties']
                        if p['layer']=='province_areas' and p.get('entity_id')==target['properties']['state_id']:change_shape(f,unary_union([f['_shape'],fragment]))
                        if p['layer']=='province_areas' and p.get('entity_id')==source_area['properties']['state_id']:change_shape(f,f['_shape'].difference(fragment))
                sliver_total+=fragment.area
        checks['lu_donghai_lanling_sliver_area']=sliver_total
        # Xindu's two title periods and the interval merged into Guanghan.
        xindu=region('p104','unassigned-reference-tan281-130')
        if year==301:
            guanghan=area('p103');old_guanghan=guanghan['_shape']
            xindu_geometry=clean(old_guanghan.intersection(xindu_source))
            change_shape(guanghan,old_guanghan.difference(xindu_geometry))
            xp={**deepcopy(guanghan['properties']),'entity_id':'p104','name':'新都國','display_name':'新都國','base_name':'新都郡',
                'fief_id':'jin-新都','member_role':'seat','membership_evidence':'confirmed','source':'301復封，按281原新都面从廣漢分回。'}
            xindu=add(xindu_geometry,xp)
            add(xindu_geometry.representative_point(),{**xp,'layer':'labels','label_type':'prefecture','show_label':True,'coordinate_role':'territory_label_not_capital'})
            repaired_ids.update(['p103','p104']);touched_fiefs.update(['jin-新都',guanghan['properties']['fief_id']])
            new_counties={'c0694':'c0698','c0695':'c0699','c0696':'c0700','c0697':'c0701'}
            for f in fs[:]:
                p=f['properties']
                if p['layer']=='county_seats' and p.get('entity_id') in new_counties:
                    touch(f);cid=new_counties[p['entity_id']];p.update(entity_id=cid,prefecture_id='p104',prefecture_name='新都國',county_key='p104/'+cid);changed.add(key(f))
                if p['layer']=='prefecture_seats' and p.get('entity_id')=='p103' and xindu_geometry.covers(f['_shape']):
                    touch(f);p.update(entity_id='p104',prefecture_id='p104',name='新都國',display_name='新都國',seat_name='雒',seat_county_id='c0698',seat_county_key='p104/c0698');changed.add(key(f))
        if xindu:
            kingdom=277<=year<=282 or 301<=year<=306
            if 285<=year<=300:
                name='廣漢郡';kingdom=False
            else:name='新都國' if kingdom else '新都郡'
            metadata('p104','unassigned-reference-tan281-130',{'name':name,'display_name':name,'base_name':name,'fief_id':'jin-新都' if kingdom else None,
                 'member_role':'seat' if kingdom else None,'membership_evidence':'confirmed' if kingdom else None,
                 'fief_review_note':'新都王283卒後回郡，285省入廣漢；301復封，307改封濟陰後復郡。沿本輪Word展示年份。'})
        # New, separately located Jiyang uses exactly two existing CHGIS points.
        if year>=306:
            ch=area('p013') or region(None,'unassigned-reference-tan281-137')
            assert ch is not None,(year,'Chenliu area')
            previous=ch['_shape'];new=clean(previous.intersection(jiyang_mask));remain=clean(previous.difference(new))
            assert new.geom_type==remain.geom_type=='Polygon',(year,new.geom_type,remain.geom_type)
            assert new.covers(shape(kao['geometry'])) and new.covers(shape(jiyang['geometry']))
            assert remain.covers(Point(114.96721000023545,34.756289999812815)) and remain.covers(Point(115.06597000027092,34.43049999978844))
            change_shape(ch,remain);repaired_ids.add('p013')
            cp=ch['properties'];touched_fiefs.update(x for x in [cp.get('fief_id'),'jin-東海','jin-濟陰'] if x)
            fid='jin-東海' if year<=310 else None;name='濟陽支郡' if fid else '濟陽郡'
            is_ref=cp['layer']=='reference_prefecture_areas'
            props={**deepcopy(cp),'id':'detail-reference-jiyang' if is_ref else 'detail-jiyang','entity_id':None if is_ref else 'p252',
                'name':name,'display_name':name,'base_name':'濟陽郡','fief_id':fid,'member_role':'branch' if fid else None,'membership_evidence':'inferred' if fid else None,
                'state_id':'s02','state_name':'兗州','boundary_inferred':True,'geometry_status':'two_chgis_counties_local_curved_fit',
                'source':'本輪分陳留置濟陽：CHGIS濟陽44379、考城82331原點；曲線為展示擬合。','boundary_note':'依使用者所定二縣及譚图方向，局部擬合；不表示史載精確疆界。'}
            jy=add(new,props)
            add(new.representative_point(),{**props,'layer':'labels','label_type':'prefecture','coordinate_role':'territory_label_not_capital','show_label':True})
            repaired_ids.add('p252')
            for f in fs:
                p=f['properties']
                if p['layer']=='labels' and (p.get('entity_id')=='p013' or p.get('id')==cp.get('id')) and not remain.covers(f['_shape']):change_shape(f,remain.representative_point())
                if p['layer']=='county_seats' and p.get('entity_id')=='c0120':touch(f);p.update(prefecture_id='p252',prefecture_name=name,county_key='p252/c0120')
            if year<=313:
                source_seat=next(f for f in fs if f['properties']['layer']=='county_seats' and f['properties'].get('entity_id')=='c0120')
                jp=source_seat['properties']
                add(shape(kao['geometry']),{**deepcopy(jp),'entity_id':'c0128','name':'考城','display_name':'考城','county_key':'p252/c0128','source_id':'82331','source_name':'考城縣','source':'CHGIS_V6:v6_time_cnty_pts_utf_wgs84','prefecture_id':'p252','prefecture_name':name})
                add(shape(jiyang['geometry']),{'layer':'prefecture_seats','level':'prefecture','entity_id':'p252','name':name,'display_name':name,'state_id':'s02','state_name':'兗州','year':year,
                    'seat_name':'濟陽','seat_county_id':'c0120','seat_county_key':'p252/c0120','source_id':'44379','source':'CHGIS濟陽縣原坐標；郡治依首縣展示','coordinate_role':'prefecture_seat'})
                remove(source_seat) # Same-site symbols retain only the highest level.
            # Old p015 has always used the Jiyin source compartment, not Jiyang.
            name='濟陰國' if 307<=year<=311 else '濟陽郡' if year==306 else '濟陰郡'
            metadata('p015','unassigned-reference-tan281-143',{'name':name,'display_name':name,'base_name':'濟陰郡','fief_id':'jin-濟陰' if 307<=year<=311 else None,
                'member_role':'seat' if 307<=year<=311 else None,'membership_evidence':'confirmed' if 307<=year<=311 else None,
                'fief_review_note':'原濟陰圖面307—311顯示濟陰王國；濟陽支郡另由陳留東部二縣析置，不重用此面。'})
            checks['jiyang_partition_area_difference']=previous.symmetric_difference(unary_union([new,remain])).area
        # Recalculate only lines touching the changed Lu/Donghai or Chenliu faces.
        areas=[f for f in fs if f['properties']['layer'] in ['prefecture_areas','reference_prefecture_areas']]
        id_of=lambda f:f['properties'].get('entity_id') or f['properties'].get('id','').removeprefix('unassigned-reference-')
        changed_regions=[f for f in areas if id_of(f) in repaired_ids or f['properties'].get('id') in ['detail-reference-jiyang'] or (year>=306 and f['properties'].get('id')=='unassigned-reference-tan281-137')]
        change_ids={id_of(f) for f in changed_regions}
        old_boundary_props={}
        for f in fs[:]:
            if f['properties']['layer'] in ['prefecture_boundaries','province_boundaries'] and change_ids.intersection(f['properties'].get('adjacent_entity_ids',[])):remove(f)
            if f['properties']['layer'] in ['prefecture_boundaries','province_boundaries']:
                old_boundary_props.setdefault(tuple(sorted(f['properties'].get('adjacent_entity_ids',[]))),[]).append(f)
        done=set()
        for left in changed_regions:
            for right in areas:
                li,ri=id_of(left),id_of(right);pair=tuple(sorted([li,ri]))
                if li==ri or pair in done:continue
                done.add(pair);line=lineal(left['_shape'].boundary.intersection(right['_shape'].boundary))
                if line.length<.00001:continue
                lp,rp=left['properties'],right['properties'];states=[lp.get('state_id',lp.get('state_name')),rp.get('state_id',rp.get('state_name'))]
                same=states[0]==states[1] or lp.get('state_name')==rp.get('state_name')
                layer='prefecture_boundaries' if same else 'province_boundaries'
                fids=[lp.get('fief_id'),rp.get('fief_id')]
                props={'layer':layer,'level':'prefecture' if same else 'state','name':'郡國界' if same else '州界','year':year,
                    'adjacent_entity_ids':[li,ri],'adjacent_state_ids':states,'adjacent_fief_ids':fids,'between_fiefs':fids[0]!=fids[1] and bool(any(fids)),
                    'within_same_fief':bool(fids[0] and fids[0]==fids[1]),'boundary_inferred':same and bool({'p252','detail-reference-jiyang'}.intersection(pair)) and bool({'p013','tan281-137'}.intersection(pair)),
                    'source':'本輪沿局部修正後的共享郡界分類；魯、沛同屬豫州，濟陽新界為擬合。','coordinate_role':'boundary'}
                old_inferred=[f['_shape'] for f in old_boundary_props.get(pair,[]) if f['properties'].get('boundary_inferred')]
                if same and not props['boundary_inferred'] and old_inferred:
                    inferred=lineal(line.intersection(unary_union(old_inferred)))
                    retained=lineal(line.difference(inferred))
                    if inferred.length:add(inferred,{**props,'boundary_inferred':True})
                    if retained.length:add(retained,props)
                else:add(line,props)
        # Metadata-only fief changes also update boundary colouring.
        byid={id_of(f):f for f in areas}
        for f in fs:
            p=f['properties']
            if p.get('adjacent_entity_ids'):
                values=[byid[i]['properties'].get('fief_id') if i in byid else old for i,old in zip(p['adjacent_entity_ids'],p.get('adjacent_fief_ids',[None,None]))]
                if values!=p.get('adjacent_fief_ids'):touch(f);p.update(adjacent_fief_ids=values,between_fiefs=values[0]!=values[1] and bool(any(values)),within_same_fief=bool(values[0] and values[0]==values[1]))
        # Only changed kingdom unions are replaced; county membership is untouched elsewhere.
        colors=dict(original['fiefColors']);regions={}
        for f in areas:
            fid=f['properties'].get('fief_id')
            if fid:regions.setdefault(fid,[]).append(f)
        unions={fid:clean(unary_union([f['_shape'] for f in members])) for fid,members in regions.items()}
        palette=list(dict.fromkeys([*colors.values(),'#b879b5','#729ac8','#d5975d','#70aa8c','#d4b35e']))
        patch={'remove':[],'add':[],'colors':{},'remove_fief_colors':[],'note':NOTE}
        for fid in sorted(touched_fiefs):
            for f in fs[:]:
                if f['properties']['layer']=='kingdom_areas' and f['properties'].get('fief_id')==fid:remove(f)
            if fid not in unions:patch['remove_fief_colors'].append(fid);continue
            forbidden={colors.get(other) for other,g in unions.items() if other!=fid and unions[fid].boundary.intersection(g.boundary).length>.00001}
            color=colors.get(fid) or stable_colors.get(fid)
            if not color or color in forbidden:color=next(c for c in palette if c not in forbidden)
            colors[fid]=color;stable_colors[fid]=color;patch['colors'][fid]=color
            members=regions[fid];name=next((f['properties']['display_name'] for f in members if f['properties'].get('member_role')=='seat'),fid.replace('jin-','')+'國')
            add(unions[fid],{'layer':'kingdom_areas','level':'fief','year':year,'name':name,'display_name':name,'fief_id':fid,'color':color,
                'member_entity_ids':[f['properties']['entity_id'] for f in members if f['properties'].get('entity_id')],'has_inference':any(f['properties'].get('membership_evidence')=='inferred' for f in members),
                'source':NOTE,'geometry_status':'local_detail_fief_union','actual_control_claim':False})
            for f in fs:
                if f['properties'].get('fief_id')==fid:touch(f);f['properties']['color']=color
        # Label sizeable separate components of the two requested fiefs in place.
        enclave_count=0
        for fid in ['jin-西陽','jin-東海']:
            if fid not in unions:continue
            components=sorted(parts(unions[fid]),key=lambda g:-g.area)
            if len(components)<2:continue
            for n,component in enumerate(components[1:],1):
                if component.area<.0001:continue
                point=component.representative_point()
                # A component already bearing a full member name still gets its
                # country affiliation; this is essential for remote branch land.
                add(point,{'layer':'labels','level':'fief','display_level':'prefecture','entity_id':'enclave-'+fid+'-'+str(n),'name':'屬'+fid.replace('jin-','')+'國',
                    'display_name':'屬'+fid.replace('jin-','')+'國','year':year,'label_type':'prefecture','show_label':True,'parent_fief_id':fid,'color':colors[fid],
                    'coordinate_role':'enclave_affiliation_annotation','source':'既有多片封國面之所屬提示；不改郡界、縣屬或治所。','font_size':9})
                enclave_count+=1
        checks['enclave_affiliation_labels']=enclave_count
        patch['remove']=sorted(changed)
        for f in fs:
            if key(f) in changed:patch['add'].append({'type':'Feature','geometry_id':save(f['_shape']),'properties':f['properties']})
        out['years'][str(year)]=patch;report.append({'year':year,**checks,'county_point_coordinates_moved':0,'restored_joint_commandery_names':['樂浪郡','帶方郡']})
    target=ROOT/'data/jin-detail-map-review-20261007.js'
    target.write_text('window.JIN_DETAIL_MAP_REVIEW = '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
    (ROOT/'reports/jin-detail-map-review-20261007.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(len(out['geometries']),'geometries;',target.stat().st_size,'bytes')

if __name__=='__main__':build()
