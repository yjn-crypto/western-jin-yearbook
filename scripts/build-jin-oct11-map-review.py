#!/usr/bin/env python3
"""Apply only the October 11 fief amendments to the published annual geometry."""
import hashlib,json,math,subprocess
from pathlib import Path
from copy import deepcopy
from shapely.geometry import shape,mapping,Point,Polygon
from shapely.ops import unary_union,transform
from pyproj import CRS,Transformer
ROOT=Path(__file__).resolve().parents[1]
INPUT=Path('/private/tmp/jin-oct11-input')
NOTE='本輪封域修訂：支郡只由本人復封或前任親生子連續承繼；縣王國按當年所屬郡面積除以轄縣數模擬，從原封國色面扣除，曲線虛界不是考定縣界。壯武據譚圖青州縣治擬合。普通縣仍不繪面。'
KEY_FIELDS=['layer','entity_id','id','source_id']
def key(f):
 p=f['properties'];return ':'.join([p['layer'],str(p.get('entity_id') or p.get('id') or p.get('source_id') or ''),','.join(sorted(p.get('adjacent_entity_ids',[])))])
def polygons(g):return [g] if g.geom_type=='Polygon' else [x for x in g.geoms if x.geom_type=='Polygon']
FIT_CACHE={}
def fit(domain,xy,n,other_seats):
 """Equal-area cell; choose a curving shape that does not absorb other seats."""
 cache_key=(domain.wkb,tuple(xy),n,tuple(sorted(tuple(p) for p in other_seats)))
 if cache_key in FIT_CACHE:return FIT_CACHE[cache_key]
 crs=CRS.from_proj4(f'+proj=laea +lat_0={xy[1]} +lon_0={xy[0]} +datum=WGS84 +units=m')
 to=Transformer.from_crs(4326,crs,always_xy=True).transform;back=Transformer.from_crs(crs,4326,always_xy=True).transform
 d=transform(to,domain);pt=Point(to(*xy));target=d.area/n
 others=[Point(to(*p)) for p in other_seats if math.dist(p,xy)>.0001 and domain.covers(Point(p))]
 angles=[0]+[math.atan2(p.y-pt.y,p.x-pt.x)+math.pi/2 for p in sorted(others,key=lambda p:p.distance(pt))[:3]]+[math.pi*i/8 for i in range(16)]
 forms=[(0,1,0)]+[(angle,ratio,shift) for ratio in [1.5,2,3,4] for shift in [0,.45,-.45,.7,-.7] for angle in angles]
 candidates=[(inset,*form) for inset in [0,min(200,pt.distance(d.boundary)/3)] for form in forms]
 limit=max(d.bounds[2]-d.bounds[0],d.bounds[3]-d.bounds[1])*3
 for inset,angle,ratio,shift in candidates:
  clip=d.buffer(-inset) if inset else d
  ca,sa=math.cos(angle),math.sin(angle)
  unit=[]
  for i in range(128):
   t=2*math.pi*i/128;w=1+.07*math.sin(3*t)+.035*math.cos(5*t)
   x=(w*math.cos(t)+shift)*ratio;y=w*math.sin(t)/ratio
   unit.append((x*ca-y*sa,x*sa+y*ca))
  def cell(radius):
   mask=Polygon([(pt.x+radius*x,pt.y+radius*y) for x,y in unit])
   pieces=polygons(clip.intersection(mask))
   return next((g for g in pieces if g.covers(pt)),max(pieces,key=lambda g:g.area))
  lo=0;hi=limit
  for _ in range(36):
   mid=(lo+hi)/2;g=cell(mid)
   if g.area<target:lo=mid
   else:hi=mid
  g=cell(hi)
  remaining=polygons(d.difference(g));parent_parts=len(polygons(d))
  if abs(g.area/target-1)<.00001 and not any(g.covers(p) for p in others) and sum(part.area>1 for part in remaining)<=parent_parts:break
 else:raise ValueError(f'No connected equal-area fit avoiding neighbouring seats: {xy}')
 result=(transform(back,g),{'county_count':n,'parent_area_km2':round(d.area/1e6,3),'fitted_area_km2':round(g.area/1e6,3),'target_fraction':1/n,'actual_fraction':g.area/d.area,'seat_inside':g.covers(pt),'connected':g.geom_type=='Polygon','other_seats_inside':sum(g.covers(p) for p in others),'new_parent_fragments':max(0,sum(part.area>1 for part in remaining)-parent_parts),'illustrative_edge_margin_m':round(inset,3)})
 FIT_CACHE[cache_key]=result;return result

def build():
 rows=json.loads((ROOT/'data/jin-reviewed-annual-rows.json').read_text())['years']
 kings=json.loads((INPUT/'county-kings.json').read_text())
 releases=json.loads((ROOT/'data/jin-fief-research/reviewed-branch-succession-20261011.json').read_text())['branch_releases']
 titles=json.loads((ROOT/'data/jin-fief-research/reviewed-title-status-20261011.json').read_text())['title_periods']
 source={p['id']:p for p in json.loads((ROOT/'data/jin-maps/zhuangwu-source-20261011.json').read_text())['points']}
 out={'reviewed_at':'2026-10-11','policy':NOTE,'geometries':{},'years':{}};report=[]
 targets={'棘陽':{'ids':['c1169'],'pid':'p166'},'南宮':{'ids':['c0298'],'pid':'p035','source':source['nangong']},'樂成':{'ids':['c0330'],'pid':'p040'},'隨':{'ids':['c1154','c1167'],'pid':'p165'},'西陽':{'ids':['c0267'],'pid':'p030'},'華容':{'ids':['c1114','c1302'],'pid':'p186'}}
 reference_ids={'p040':'unassigned-reference-tan281-71','p035':'unassigned-reference-tan281-75'}
 def save(g):
  raw=json.dumps(g,separators=(',',':'));gid='oct11-'+hashlib.sha256(raw.encode()).hexdigest()[:16];out['geometries'][gid]=g;return gid
 for year in range(266,317):
  original=json.loads((INPUT/f'{year}.json').read_text());fs=deepcopy(original['geojson']['features']);changed=set();touched=set();details=[]
  def touch(f):changed.add(key(f))
  def remove(f):touch(f);fs.remove(f)
  def add(g,p):
   f={'type':'Feature','geometry':mapping(g),'properties':p};fs.append(f);touch(f);return f
  def areas():return [f for f in fs if f['properties']['layer'] in ['prefecture_areas','reference_prefecture_areas']]
  def amend(face,values):
   values={**values,'base_name':values['name']};p=face['properties'];pid=p.get('entity_id');rid=p.get('id');old=p.get('fief_id');touched.update(x for x in [old,values.get('fief_id')] if x)
   for f in fs:
    q=f['properties']
    if (pid and q.get('entity_id')==pid and q.get('level')=='prefecture') or (rid and q.get('id')==rid):touch(f);q.update(values)
    elif rid and q['layer']=='reference_prefecture_seats' and shape(face['geometry']).covers(shape(f['geometry'])):touch(f);q.update({k:v for k,v in values.items() if k in ['name','display_name','base_name','fief_id','color']})
    elif q.get('source_entity_id')==pid and pid and q.get('coordinate_role') in ['enclave_affiliation_annotation','branch_affiliation_annotation']:
     touch(f);q['name']=q['display_name']='屬'+values['name'];q['parent_fief_id']=values.get('fief_id');q['color']=None
   return face
  for rule in releases:
   if rule['start']<=year<=rule['end']:
    for f in areas():
     p=f['properties']
     if p.get('entity_id')==rule['pid'] and p.get('fief_id')==rule['fief_id']:
      amend(f,{'name':rule['name'],'display_name':rule['name'],'fief_id':None,'member_role':None,'membership_evidence':None,'color':None,'fief_review_note':rule['note']});details.append({'branch_released':rule['pid']})
  for rule in titles:
   if rule['begin']<=year<=rule['end']:
    for f in areas():
     p=f['properties']
     if p.get('entity_id') in rule['ids'] or p.get('id') in rule.get('reference_area_ids',[]):
      amend(f,{'name':rule['name'],'display_name':rule['name'],'fief_id':None,'member_role':None,'membership_evidence':None,'color':None,'fief_review_note':rule['note']})
  # Remove pre-existing title anchors: rebuilt below using a unique county identity.
  for f in fs[:]:
   if str(f['properties'].get('fief_id','')).startswith('county-prince-'):remove(f)
  year_rows=rows[str(year)];new_county=[]
  for king in kings[str(year)]:
   name=king['name']
   if name not in targets:
    details.append({'county_king':name,'unmapped':'同名地望未定，不重複繪成兩國'});continue
   target=targets[name];matches=[(p,c) for p in year_rows for c in p['counties'] if c['id'] in target['ids']]
   row,c=matches[0] if matches else (None,None);pid=row['id'] if row else target['pid']
   point=next((f for f in fs if f['geometry']['type']=='Point' and (f['properties'].get('entity_id') in target['ids'] or f['properties'].get('seat_county_id') in target['ids']) and 'seat' in f['properties']['layer']),None)
   # A reference seat is used with its original CHGIS coordinates after loss of actual control.
   if not point and name=='樂成':point=next(f for f in fs if f['geometry']['type']=='Point' and str(f['properties'].get('source_id'))=='87280')
   xy=point['geometry']['coordinates'] if point else target['source']['coordinates']
   face=next((f for f in areas() if f['properties'].get('entity_id')==pid),None)
   if face is None:face=next(f for f in areas() if f['properties'].get('id')==reference_ids[pid])
   domain=shape(face['geometry'])
   if row:n=len(row['counties'])
   else:
    base=next(p for y in range(year,265,-1) for p in rows[str(y)] if p['id']==pid);n=len(base['counties'])+(1 if name=='南宮' else 0)
   cell,stats=fit(domain,xy,n,[f['geometry']['coordinates'] for f in fs if f['geometry']['type']=='Point' and 'seat' in f['properties']['layer']]);fid='jin-county-'+name;parent_fid=face['properties'].get('fief_id')
   if parent_fid:touched.add(parent_fid)
   cid=c['id'] if c else target['ids'][0]
   note=f'縣王國模擬面：所屬郡參考面積的1/{n}；非考定縣界。'+king['note']
   if not row:note+='本年文字無該縣行，分母依同郡最近有效縣目；南宮另計有據縣王一縣。'
   props={'layer':'kingdom_areas','level':'fief','display_level':'county','county_kingdom':True,'entity_id':cid,'id':fid,'fief_id':fid,'prefecture_id':pid,'name':name+'縣王國','display_name':name+'國','holder':king['holder'],'year':year,'has_inference':True,'source':note,'notes':[note],'actual_control_claim':False,'fitting':stats}
   new_county.append({'shape':cell,'properties':props,'parent_fid':parent_fid})
   add(cell.boundary,{'layer':'county_kingdom_boundaries','level':'county','county_kingdom':True,'id':fid+'-boundary','name':name+'縣王國擬界','fief_id':fid,'boundary_inferred':True,'source':note,'year':year})
   if point:
    touch(point);point['properties']['fief_id']=fid
   elif name=='南宮':add(Point(xy),{'layer':'county_seats','level':'county','entity_id':cid,'prefecture_id':pid,'name':name,'fief_id':fid,'show_label':True,'year':year,'coordinate_role':'county_seat','source':'譚圖281冀州原圖縣治配準；CHGIS同年缺點'})
   details.append({'county_king':name,'pid':pid,'parent_fief_id':parent_fid,**stats})
  # Zhuangwu is explicitly a commandery-rank fief; only its new boundary is inferred.
  if 291<=year<=299:
   face=next(f for f in areas() if f['properties'].get('entity_id')=='p145');row=next(p for p in year_rows if p['id']=='p145')
   xy=source['zhuangwu']['coordinates'];cell,stats=fit(shape(face['geometry']),xy,len(row['counties'])+1,[f['geometry']['coordinates'] for f in fs if f['geometry']['type']=='Point' and 'seat' in f['properties']['layer']])
   old=shape(face['geometry']);touch(face);face['geometry']=mapping(old.difference(cell))
   fid='jin-壯武公';touched.add(fid)
   if face['properties'].get('fief_id'):touched.add(face['properties']['fief_id'])
   note='壯武縣治據譚圖281青州原圖配準；以城陽原轄縣數等分面積擬界，作本輪壯武郡公國參考面。'
   add(cell,{'layer':'prefecture_areas','level':'prefecture','entity_id':'p251','state_id':face['properties'].get('state_id'),'state_name':'青州','name':'壯武公國','display_name':'壯武公國','base_name':'壯武','year':year,'fief_id':fid,'member_role':'seat','membership_evidence':'inferred','source':note,'fitting':stats})
   add(cell.boundary.difference(old.boundary.buffer(.0000001)),{'layer':'prefecture_boundaries','level':'prefecture','id':'zhuangwu-fitted-boundary','name':'壯武公國擬界','adjacent_entity_ids':['p145','p251'],'adjacent_fief_ids':[face['properties'].get('fief_id'),fid],'between_fiefs':True,'boundary_inferred':True,'source':note,'year':year})
   add(Point(xy),{'layer':'prefecture_seats','level':'prefecture','entity_id':'p251','seat_county_id':'c1002','seat_name':'壯武','name':'壯武公國','display_name':'壯武公國','fief_id':fid,'source':note,'coordinate_role':'prefecture_seat','year':year})
   details.append({'zhuangwu':True,**stats})
  byid={f['properties'].get('entity_id') or f['properties'].get('id','').removeprefix('unassigned-reference-'):f for f in areas()}
  for f in fs:
   p=f['properties']
   if p.get('adjacent_entity_ids'):
    vals=[byid[x]['properties'].get('fief_id') if x in byid else old for x,old in zip(p['adjacent_entity_ids'],p.get('adjacent_fief_ids',[None,None]))]
    if vals!=p.get('adjacent_fief_ids'):touch(f);p.update(adjacent_fief_ids=vals,between_fiefs=vals[0]!=vals[1] and bool(any(vals)),within_same_fief=bool(vals[0] and vals[0]==vals[1]))
  colors=dict(original['fiefColors']);unions={}
  for f in fs:
   p=f['properties']
   if p['layer']=='kingdom_areas':unions[p['fief_id']]=shape(f['geometry'])
  for fid in touched:
   members=[shape(f['geometry']) for f in areas() if f['properties'].get('fief_id')==fid]
   unions[fid]=unary_union(members)
  for item in new_county:
   fid=item['parent_fid']
   if fid:unions[fid]=unions[fid].difference(item['shape'])
   unions[item['properties']['fief_id']]=item['shape']
  palette=list(dict.fromkeys([*colors.values(),'#b879b5','#729ac8','#d5975d','#70aa8c','#d4b35e']))
  for fid in sorted(touched|{x['properties']['fief_id'] for x in new_county}):
   for f in fs[:]:
    if f['properties']['layer']=='kingdom_areas' and f['properties'].get('fief_id')==fid:remove(f)
   if unions[fid].is_empty:colors.pop(fid,None);continue
   forbidden={colors.get(other) for other,g in unions.items() if other!=fid and not g.is_empty and unions[fid].buffer(.000002).intersects(g)}
   col=colors.get(fid)
   if not col or col in forbidden:col=next(c for c in palette if c not in forbidden)
   colors[fid]=col;new=next((x for x in new_county if x['properties']['fief_id']==fid),None)
   members=[f for f in areas() if f['properties'].get('fief_id')==fid]
   props=new['properties'] if new else {'layer':'kingdom_areas','level':'fief','fief_id':fid,'name':next((f['properties']['display_name'] for f in members if f['properties'].get('member_role')=='seat'),fid.removeprefix('jin-')+'國'),'member_entity_ids':[f['properties'].get('entity_id') for f in members],'year':year,'source':NOTE,'actual_control_claim':False}
   add(unions[fid],{**props,'color':col})
   for f in fs:
    if f['properties'].get('fief_id')==fid:touch(f);f['properties']['color']=col
  patch={'remove':sorted(changed),'add':[{'type':'Feature','geometry_id':save(f['geometry']),'properties':f['properties']} for f in fs if key(f) in changed],'remove_fief_colors':[fid for fid in original['fiefColors'] if fid not in colors],'colors':{fid:c for fid,c in colors.items() if original['fiefColors'].get(fid)!=c},'note':NOTE}
  out['years'][str(year)]=patch;report.append({'year':year,'details':details})
 target=ROOT/'data/jin-oct11-map-review.js';target.write_text('window.JIN_OCT11_MAP_REVIEW = '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
 (ROOT/'reports/jin-map-fitted-fiefs-20261011.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print('Saved',target.stat().st_size,'bytes')
if __name__=='__main__':build()
