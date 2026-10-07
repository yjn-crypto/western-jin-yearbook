/* Targeted regression: dividing Jiyang must not relocate unrelated text anchors. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const zlib=require('node:zlib');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const context=vm.createContext({window:{}});
for(const file of ['data/princes.js','data/jin-ruler-constraints.js','data/five-rank-fiefs.js',
  'data/jin-multi-kingdoms.js','jin-kingdom-table.js','data/jin-local-connectivity-20261007.js',
  'data/jin-289-fief-map-review-20261007.js','data/jin-fief-abolitions-20261007.js',
  'data/jin-map-reference-fiefs-20261007.js','data/jin-detail-map-review-20261007.js','jin-annual-map-model.js']){
  vm.runInContext(read(file),context,{filename:file});
}
const geometryCache=new Map();
const identity=feature=>{
  const p=feature.properties;
  return [p.layer,p.entity_id||p.id||p.source_id||'',p.level,p.level==='fief'?p.name:''].join('|');
};
let checked=0;
for(const year of [304,305,306,308,313,314]){
  const bundle=JSON.parse(read(`data/jin-maps/three-basemap-annual/${year}.json`));
  for(const url of bundle.geometry_urls){
    if(!geometryCache.has(url))geometryCache.set(url,JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,url)))).geometries);
    Object.assign(bundle.geometries,geometryCache.get(url));
  }
  const source=context.window.JIN_ANNUAL_MAP_MODEL.hydrateThreeBasemap(bundle,year,{detail:false}).geojson.features;
  const actual=context.window.JIN_ANNUAL_MAP_MODEL.hydrateThreeBasemap(bundle,year).geojson.features;
  const labels=new Map(actual.filter(f=>f.properties.layer==='labels').map(f=>[identity(f),f]));
  for(const feature of source.filter(f=>f.properties.layer==='labels')){
    const p=feature.properties;
    if(p.entity_id==='p013'||p.id==='unassigned-reference-tan281-137')continue;
    const current=labels.get(identity(feature));
    assert.ok(current,`${year}: missing existing label ${p.name}`);
    assert.equal(JSON.stringify(current.geometry),JSON.stringify(feature.geometry),`${year}: unrelated label moved: ${p.name}`);
    checked++;
  }
  for(const [name,coordinates] of [['樂浪郡',[126.26161640630956,39.43494151767665]],['帶方郡',[125.74626718640405,38.268746697531995]]]){
    const label=actual.find(f=>f.properties.layer==='labels'&&f.properties.display_name===name);
    assert.ok(label,`${year}: ${name} label missing`);
    assert.equal(JSON.stringify(label.geometry.coordinates),JSON.stringify(coordinates),`${year}: ${name} source anchor moved`);
  }
}
console.log(`PASS: ${checked} existing labels stay at their source anchors across 304, 305, 306, 308, 313 and 314; Lelang/Daifang anchors preserved.`);
