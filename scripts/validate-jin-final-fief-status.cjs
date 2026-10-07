/* The reviewed title periods must reach the final map without changing counties. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const context=vm.createContext({window:{}});
for(const file of ['data/princes.js','data/jin-ruler-constraints.js','data/five-rank-fiefs.js','data/jin-multi-kingdoms.js','jin-kingdom-table.js','data/jin-local-connectivity-20261007.js','data/jin-289-fief-map-review-20261007.js','data/jin-fief-abolitions-20261007.js','data/jin-map-reference-fiefs-20261007.js','data/jin-detail-map-review-20261007.js','jin-annual-map-model.js'])vm.runInContext(read(file),context,{filename:file});
const config=JSON.parse(read('data/jin-fief-research/reviewed-final-fief-status-20261008.json'));
const referenceAreas={p044:'unassigned-reference-tan281-69',p047:'unassigned-reference-tan281-159',p017:'unassigned-reference-tan281-140',p027:'unassigned-reference-tan281-146',p066:'unassigned-reference-tan281-64'};
const cache=new Map();let checked=0;
for(let year=266;year<=316;year++){
 const bundle=JSON.parse(read(`data/jin-maps/three-basemap-annual/${year}.json`));
 for(const url of bundle.geometry_urls){
  if(!cache.has(url))cache.set(url,JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,url)))).geometries);
  Object.assign(bundle.geometries,cache.get(url));
 }
 const map=context.window.JIN_ANNUAL_MAP_MODEL.hydrateThreeBasemap(bundle,year),features=map.geojson.features;
 for(const period of config.title_periods.filter(p=>p.begin<=year&&year<=p.end)){
  const refs=period.ids.map(id=>referenceAreas[id]).filter(Boolean),fid=period.rank?'jin-'+period.name.replace(/國$/,''):null;
  const areas=features.filter(f=>['prefecture_areas','reference_prefecture_areas'].includes(f.properties.layer)&&(period.ids.includes(f.properties.entity_id)||refs.includes(f.properties.id)));
  assert.ok(areas.length,`${year} ${period.id}: missing existing area`);
  const related=features.filter(f=>f.properties.level==='prefecture'&&(period.ids.includes(f.properties.entity_id)||refs.includes(f.properties.id)));
  for(const f of related){
   const p=f.properties;
   assert.equal(p.display_name,period.name,`${year} ${period.id} ${p.layer}: wrong name`);
   assert.equal(p.fief_id||null,fid,`${year} ${period.id} ${p.layer}: wrong fief`);
   assert.equal(p.member_role||null,fid?'seat':null,`${year} ${period.id} ${p.layer}: wrong membership`);
   if(fid)assert.equal(p.color,map.fiefColors[fid],`${year} ${period.id} ${p.layer}: wrong color`);
   else assert.ok(!p.color,`${year} ${period.id} ${p.layer}: ordinary commandery still colored`);
   checked++;
  }
  if(fid){
   assert.ok(map.fiefColors[fid],`${year} ${period.id}: missing color`);
   const kingdom=features.find(f=>f.properties.layer==='kingdom_areas'&&f.properties.fief_id===fid);
   assert.ok(kingdom,`${year} ${period.id}: missing kingdom union`);
   for(const f of areas.filter(f=>f.properties.entity_id))assert.ok(kingdom.properties.member_entity_ids.includes(f.properties.entity_id),`${year} ${period.id}: main commandery absent from union`);
  }
 }
}
console.log(`PASS: ${config.title_periods.length} reviewed periods, ${checked} area/name/seat records across all 51 years; kingdom unions and ordinary-commandery color removal agree.`);
