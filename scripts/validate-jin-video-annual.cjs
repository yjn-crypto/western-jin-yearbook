/* Check this publication's data loading, state-line rendering and colour contract. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{gunzipSync}=require('zlib');
const root=path.resolve(__dirname,'..'),model=require('../jin-annual-map-model.js'),view=require('../jin-map-view.js');
const sourcePriority=process.argv.includes('--source-priority');
const publicDirectory=sourcePriority?'source-priority-annual':'video-annual';
const annualUrls=sourcePriority?model.SOURCE_PRIORITY_URLS:model.VIDEO_TRIAL_URLS;
const vm=require('vm'),yearbookScope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data/jin-data.js'),'utf8'),yearbookScope);
const yearbook=JSON.parse(JSON.stringify(yearbookScope.window.JIN_DATA));
const ningzhou=yearbook.states.find(state=>state.id==='s13');
const qinzhou=yearbook.states.find(state=>state.id==='s10');
const active=(entity,year)=>entity.phases.some(phase=>phase.start<=year&&phase.end>=year);
const prefectures=new Map(yearbook.states.flatMap(state=>state.prefectures.map(pref=>[pref.id,{pref,state}])));
const cache=new Map(),read=url=>{const file=url.split('?')[0];if(!cache.has(file))cache.set(file,JSON.parse(fs.readFileSync(path.join(root,file))));return cache.get(file);};
global.JIN_FIEF_COLORS=read('data/jin-fief-colors.json');
global.JIN_VIDEO_FRAMES=read('data/jin-video-frames.json');
const land=read(model.VIDEO_LAND_URL),graph=read(`data/jin-maps/${publicDirectory}/graph.json`);
assert.deepEqual(Object.keys(graph.years).map(Number),Array.from({length:51},(_,i)=>266+i));
assert(global.JIN_FIEF_COLORS.validation.years.length===51,'Colour validation covers all new years');
assert(global.JIN_FIEF_COLORS.validation.years.every(y=>y.conflict_count===0),'No adjacent fiefs share a colour');
for(const file of ['graph.json',...Array.from({length:51},(_,i)=>`${266+i}.json`),...graph.geometry_shards.map(s=>path.basename(s.url))]){
 const plain=fs.readFileSync(path.join(root,'data/jin-maps',publicDirectory,file));
 const compressed=fs.readFileSync(path.join(root,'data/jin-maps',publicDirectory,file+'.gz'));
 assert(gunzipSync(compressed).equals(plain),'Compressed map data equals its fallback sibling: '+file);
}
class Node{
 constructor(tag,attributes={},text=''){this.tagName=tag;this.attributes=attributes;this.textContent=text;this.children=[];this.dataset={};this.style={};}
 appendChild(node){this.children.push(node);return node;}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attributes[k]=v;}
}
const all=node=>[node,...node.children.flatMap(all)],results=[];
for(let year=266;year<=316;year++){
 const sliced=read(annualUrls[year]),geometries=Object.assign({},sliced.geometries,...sliced.geometry_urls.map(url=>read(url).geometries));
 assert.equal(sliced.year,year,'No nearest-year substitution');assert(sliced.features.every(f=>f.geometry||geometries[f.geometry_id]));
 const map=model.hydrateVideoTrial({...sliced,geometries},year,land,{annualVideo:true,sourcePriority});
 if(sourcePriority){
  assert(map.sourcePriority,'Default map uses original-image source policy');
  assert(!map.geojson.features.some(f=>f.properties.layer==='land_background'),'No worldwide video background in default maps');
  const outer=map.geojson.features.filter(f=>f.properties.layer==='original_territory_boundary');
  assert.equal(outer.length,1,'One original outer boundary, with no second video coast');
  assert(outer.every(f=>['LineString','MultiLineString'].includes(f.geometry.type)),'Original outer boundary is a line');
  assert(map.geojson.features.filter(f=>f.properties.layer==='regime_boundaries').every(f=>['LineString','MultiLineString'].includes(f.geometry.type)),'Only shared internal political boundary lines');
 }
 const activeAreas=map.geojson.features.filter(f=>f.properties.layer==='prefecture_areas'&&f.properties.entity_id&&!f.properties.is_context);
 for(const area of activeAreas){
  const record=prefectures.get(area.properties.entity_id);
  assert(record&&active(record.pref,year),'Displayed prefecture has a valid dated yearbook entity');
  assert.equal(area.properties.state_id,record.state.id,'Displayed prefecture retains its dated parent state');
 }
 if(year>=271&&year<=283){
  const states=map.geojson.features.filter(f=>f.properties.layer==='province_areas');
  assert(states.some(f=>f.properties.entity_id===ningzhou.id),'Dated Ningzhou is split from whole original prefectures in '+year);
  const expected=ningzhou.prefectures.filter(pref=>pref.phases.some(phase=>phase.start<=year&&phase.end>=year)).map(pref=>pref.id);
  const actual=map.geojson.features.filter(f=>f.properties.layer==='prefecture_areas'&&f.properties.state_id===ningzhou.id).map(f=>f.properties.entity_id);
  assert.deepEqual(actual.sort(),expected.sort(),'Changed prefecture IDs still retain all dated Ningzhou members in '+year);
 }
 if(year===284)assert(!map.geojson.features.some(f=>f.properties.layer==='province_areas'&&f.properties.entity_id===ningzhou.id),'Ningzhou returns to Yizhou after its yearbook period');
 if([269,281].includes(year)){
  const expected=qinzhou.prefectures.filter(pref=>active(pref,year)).map(pref=>pref.id);
  const actual=activeAreas.filter(f=>f.properties.state_id===qinzhou.id).map(f=>f.properties.entity_id);
  assert.deepEqual(actual.sort(),expected.sort(),'Qinzhou whole-prefecture changes follow the dated yearbook IDs in '+year);
 }
 if([291,306].includes(year)){
  for(const name of ['始安郡','始興郡','桂陽郡']){
   const expected=[...prefectures.values()].filter(({pref})=>pref.base_name===name&&active(pref,year));
   assert(expected.every(({pref})=>activeAreas.some(area=>area.properties.entity_id===pref.id)),'Recreated southern prefecture IDs are retained in '+year+': '+name);
  }
 }
 const boundaries=map.geojson.features.filter(f=>f.properties.layer==='province_boundaries');
 assert(boundaries.every(f=>['LineString','MultiLineString'].includes(f.geometry.type)),'New state boundaries are shared lines, never closed polygon circles');
 const canvas=new Node('svg'),rendered=view.draw(map,canvas,{svgNode:(...args)=>new Node(...args),seatSymbol:()=>new Node('g')});
 const nodes=all(canvas),stateAreas=nodes.filter(n=>n.attributes.class==='jin-province-area');
 assert(stateAreas.every(n=>n.attributes.stroke==='none'),'No separate state outline around political fragments');
 assert(!nodes.some(n=>n.attributes.class==='jin-county-boundary'),'County fitting cells never draw boundaries');
 assert(rendered.labels.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)));
 assert(nodes.every(n=>!n.attributes.d||!/NaN|Infinity/.test(n.attributes.d)));
 const fiefs=map.geojson.features.filter(f=>f.properties.layer==='kingdom_areas');
 for(const f of fiefs)assert.equal(f.properties.color,global.JIN_FIEF_COLORS.colors[f.properties.fief_id],'Published fief colour equals validated assignment');
 assert(nodes.filter(n=>n.attributes['fill-opacity']===.62).length===fiefs.length);
 results.push({year,states:stateAreas.length,shared_state_lines:boundaries.length,coloured_fiefs:fiefs.length});
}
for(const year of [289,308]){
 const sliced=read(model.PREVIOUS_VIDEO_URLS[year]),geometries=Object.assign({},sliced.geometries,...sliced.geometry_urls.map(url=>read(url).geometries));
 assert.equal(model.hydrateVideoTrial({...sliced,geometries},year,land).annualVideo,false,'Previous trial keeps its own boundaries and colours');
}
console.log(JSON.stringify({passed:true,scope:'New 51-year data loading/state rendering/colour contract; no comprehensive historical review',years:results},null,2));
