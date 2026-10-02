/* Necessary checks for this source/presentation change; no historical audit. */
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const model=require('../jin-annual-map-model.js'),view=require('../jin-map-view.js');
const originalExtent=[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462];
class Node{
  constructor(tag,attributes={},text=''){this.tagName=tag;this.attributes=attributes;this.textContent=text;this.children=[];this.dataset={};}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
const feature=(layer,geometry,extra={})=>({type:'Feature',geometry,properties:{layer,...extra}});
const polygon={type:'Polygon',coordinates:[[[110,25],[114,25],[114,29],[110,29],[110,25]]]};
const line={type:'LineString',coordinates:polygon.coordinates[0]};
const chgis={type:'Point',coordinates:[112.123456,27.654321]};
global.JIN_FIEF_COLORS={colors:{fixture:'#427caf'}};
global.JIN_PREVIOUS_FIEF_COLORS={colors:{fixture:'#c66d28'}};
const bundle={year:289,presentation:{width:2400,height:1986,extent:originalExtent,plot:[80,140,2320,1906],source_priority:true},features:[
  feature('regime_areas',polygon,{is_jin:true,name:'晋'}),
  feature('regime_areas',polygon,{is_jin:false,name:'孫吳'}),
  feature('province_areas',polygon,{entity_id:'s0',name:'荊州'}),
  feature('kingdom_areas',polygon,{fief_id:'fixture',name:'南陽國'}),
  feature('province_boundaries',line),feature('regime_boundaries',line),feature('original_territory_boundary',line),
  feature('county_seats',chgis,{entity_id:'c0',source:'CHGIS_V6:SYS_ID=fixture',source_id:'fixture',coordinate_role:'administrative_seat',level:'county',name:'長沙縣'}),
  feature('county_areas',polygon,{entity_id:'hidden-county-area'}),feature('county_boundaries',line,{entity_id:'hidden-county-boundary'})
]};
const land={features:[feature('land_background',polygon,{name:'全球陸地'})]};
const map=model.hydrateVideoTrial(bundle,289,land,{annualVideo:true,sourcePriority:true});
assert.deepEqual(map.extent,originalExtent,'The original map framing is preserved');
assert(!map.geojson.features.some(f=>f.properties.layer==='land_background'),'No broad video land/coast backdrop is imported');
assert.deepEqual(map.geojson.features.find(f=>f.properties.source_id==='fixture').geometry.coordinates,chgis.coordinates,'CHGIS coordinates are untouched');
const previous=model.hydrateVideoTrial({...bundle,presentation:{}},289,land,{annualVideo:true});
assert.equal(previous.geojson.features.find(f=>f.properties.fief_id==='fixture').properties.color,'#c66d28','Previous annual maps retain their frozen colours');
assert.deepEqual(previous.extent,[85,15,137,50],'The previous annual display framing remains reversible');
const canvas=new Node('svg'),rendered=view.draw(map,canvas,{svgNode:(...args)=>new Node(...args),seatSymbol:()=>new Node('g')});
const nodes=flatten(canvas),paths=nodes.filter(n=>n.tagName==='path');
assert.equal(paths.find(n=>n.attributes.class==='jin-original-territory-boundary').attributes.fill,'none','The single original outer line does not add a territory fill');
assert.equal(paths.filter(n=>n.attributes.class==='jin-original-territory-boundary').length,1,'The original exterior is drawn once');
assert.equal(paths.find(n=>n.attributes.class==='jin-province-area').attributes.stroke,'none','Province polygons do not create small enclosing state lines');
assert.equal(paths.find(n=>n.attributes.class==='jin-province-area').attributes.fill,'#e2e5d2','Original province fill is preserved');
assert.equal(paths.find(n=>n.attributes.class==='jin-regime-boundary').attributes['stroke-width'],2.2,'Internal political divisions use the original earth-tone style');
assert.equal(paths.find(n=>n.attributes.class==='jin-province-boundary').attributes['stroke-width'],3.2,'State lines retain the requested stronger emphasis');
assert.equal(paths.find(n=>n.attributes['fill-opacity']===.62).attributes.fill,'#427caf','The adjacency colour table still controls fief areas');
assert(paths.filter(n=>n.attributes.class==='jin-regime-area').some(n=>n.attributes.fill==='#ffffff'),'Non-Jin control inside the display space remains white');
assert(rendered.labels.some(l=>l.text==='長沙縣'&&l.level==='county'),'County seats/names remain available to zoom tiers');
assert.equal(rendered.labels.find(l=>l.kind==='regime-area').fontSize,24,'Foreign polity names use the original state label size');
assert(!nodes.some(n=>String(n.dataset.entityId||'').startsWith('hidden-county')),'Internal county fitting geometry stays hidden');
assert(rendered.features.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)),'Projected seat/label coordinates are finite');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(app.includes("map.videoTrial&&!map.sourcePriority?'#dce9f4':'#f7f3e9'"),'Default annual background matches the original paper colour');
assert(app.includes('sourcePriority?Promise.resolve(null):load(window.JIN_ANNUAL_MAP_MODEL.VIDEO_LAND_URL)'),'Source-priority mode does not request a competing video coast');
assert(app.includes("$('jinVideoLegend').hidden=!map.videoTrial||Boolean(map.sourcePriority)"),'Default annual maps use the original legend');
assert(html.includes('<option value="video-prior">'),'The immediately previous full annual edition remains selectable');
assert(Object.keys(model.SOURCE_PRIORITY_URLS).length===51,'The new source-priority edition covers all selected years');
async function checkCompressedDelivery(){
  const url=model.SOURCE_PRIORITY_URLS[289],payload={year:289,presentation:bundle.presentation},calls=[];
  const decoded=await model.readMapData(url,async requested=>{
    calls.push(requested);return new Response(zlib.gzipSync(JSON.stringify(payload)));
  });
  assert.deepEqual(decoded,payload,'Compressed source-priority resources decode correctly');
  assert.deepEqual(calls,[url.replace('.json?','.json.gz?')],'The new directory requests its compressed sibling first');
  calls.length=0;
  const fallback=await model.readMapData(url,async requested=>{
    calls.push(requested);return requested.includes('.json.gz')?new Response('',{status:404}):new Response(JSON.stringify(payload));
  });
  assert.deepEqual(fallback,payload,'Plain resources remain a compatible fallback');
  assert.deepEqual(calls,[url.replace('.json?','.json.gz?'),url],'A missing compressed sibling falls back to the same selected year');
  console.log(JSON.stringify({passed:true,scope:'Source-priority presentation and preserved original style only',years:51,original_extent:map.extent,competing_video_land:false,county_geometry_displayed:false,compressed_delivery:true,plain_fallback:true}));
}
checkCompressedDelivery().catch(error=>{console.error(error);process.exitCode=1;});
