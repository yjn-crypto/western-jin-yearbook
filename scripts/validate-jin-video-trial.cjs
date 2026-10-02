/* Necessary runtime checks for the preserved video trials and map-version return.
 * Deliberately does not repeat the 51-year historical/geographic audit. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const model=require('../jin-annual-map-model.js'),view=require('../jin-map-view.js');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file.split('?')[0]),'utf8'));
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
let frames;
if(fs.existsSync(path.join(root,'data/jin-video-frames.js'))){
  const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/jin-video-frames.js'),'utf8'),scope);
  frames=scope.window.JIN_VIDEO_FRAMES||scope.JIN_VIDEO_FRAMES;
}else frames=read('work/jin-video/manifest.json');
frames=JSON.parse(JSON.stringify(frames));
if(frames.frames.every(f=>f.web_path))assert(frames.frames.every(f=>fs.existsSync(path.join(root,f.web_path))&&fs.statSync(path.join(root,f.web_path)).size>0),'Every indexed frame has a published image asset');
assert.deepEqual(frames.frames.map(f=>Number(f.year)),Array.from({length:51},(_,i)=>266+i),'All source years are indexed');
class Node{
  constructor(tag,attributes={},text=''){this.tagName=tag;this.attributes=attributes;this.textContent=text;this.children=[];this.dataset={};this.style={};}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
const land=read(model.VIDEO_LAND_URL),results=[];
for(const year of [289,308]){
  const data=read(model.PREVIOUS_VIDEO_URLS[year]);
  const geometries=Object.assign({},data.geometries,...(data.geometry_urls||[]).map(url=>read(url).geometries));
  assert(data.features.every(f=>f.geometry||geometries[f.geometry_id]),`${year}: all geometry references resolve`);
  const map=model.hydrateVideoTrial({...data,geometries},year,land);
  assert(map.videoTrial&&map.trial&&map.year===year,'Selected-year video trial is hydrated');
  const internalGeo=map.geojson.features.find(f=>f.properties.layer==='prefecture_areas').geometry;
  const internalCounty={type:'Feature',geometry:internalGeo,properties:{layer:'county_areas',entity_id:'county-internal-fixture',name:'內部擬合'}};
  const internalBoundary={...internalCounty,properties:{...internalCounty.properties,layer:'county_boundaries'}};
  const canvas=new Node('svg');
  const rendered=view.draw({...map,geojson:{...map.geojson,features:[...map.geojson.features,internalCounty,internalBoundary]}},canvas,{svgNode:(...args)=>new Node(...args),seatSymbol:()=>new Node('g')});
  const nodes=flatten(canvas);
  const regimes=map.geojson.features.filter(f=>f.properties.layer==='regime_areas');
  const regimePaths=nodes.filter(n=>n.attributes.class==='jin-regime-area');
  assert.equal(regimePaths.length,regimes.length,'All regimes have displayed polygons');
  let foreign=0;
  for(let i=0;i<regimes.length;i++){
    const p=regimes[i].properties;
    if(!p.is_jin&&!p.is_jin_affiliate){assert.equal(regimePaths[i].attributes.fill,'#ffffff',`${p.name}: other rule is white`);foreign++;}
    if(p.is_jin)assert.notEqual(regimePaths[i].attributes.fill,'#ffffff','Jin control area is filled');
  }
  assert(foreign>0,'Other regimes are represented');
  const kingdoms=map.geojson.features.filter(f=>f.properties.layer==='kingdom_areas');
  const kingdomPaths=nodes.filter(n=>n.tagName==='path'&&n.attributes['fill-opacity']===.62);
  assert(kingdoms.length>0&&kingdomPaths.length===kingdoms.length,'Prefecture-level fiefs keep area colour');
  assert(kingdomPaths.every(n=>n.attributes.fill!=='none'&&n.attributes.fill!=='#ffffff'),'Fief fill remains visible');
  assert(!nodes.some(n=>n.dataset.entityId==='county-internal-fixture'||n.attributes.class==='jin-county-boundary'),'County fitting cells and boundaries do not render');
  assert(rendered.labels.some(l=>l.level==='county'),'County names continue to render');
  assert(rendered.labels.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)),'Labels use finite coordinates');
  assert(nodes.every(n=>!n.attributes.d||!/NaN|Infinity/.test(n.attributes.d)),'SVG paths have finite coordinates');
  const borders=nodes.filter(n=>n.attributes.class==='jin-regime-boundary');
  assert.equal(borders.length,map.geojson.features.filter(f=>f.properties.layer==='regime_boundaries').length,'Political boundaries are displayed');
  results.push({year,features:map.geojson.features.length,foreign_regimes:foreign,coloured_fiefs:kingdoms.length,political_boundaries:borders.length});
}
function extract(name){const marker=`  function ${name}(`,start=app.indexOf(marker),end=app.indexOf('\n  }',start+1)+5;assert(start>=0&&end>start,`Function ${name} exists`);return app.slice(start,end);}
function versionFixture(version='annual',year=304,href=`https://example.test/?year=${year}`){
  const controls=new Map();
  const context=vm.createContext({URL,Number,Math,DYNASTIES:{'western-jin':{years:[266,316]}},currentDynasty:{key:'western-jin',years:[266,316]},
    jinMapVersion:{value:version},activeJinMapVersion:version,jinAnnualReturnYear:304,jinAnnualReturnVersion:version==='legacy'?'annual':version,
    yearSelect:{value:String(year)},stateSelect:{value:'',selectedOptions:[]},window:{location:{href}},
    history:{replaceState(a,b,url){context.window.location.href=String(url);}},
    $:id=>{if(!controls.has(id))controls.set(id,{dataset:{}});return controls.get(id);},populateStates(){},clearMapLinkHighlights(){},render(){}});
  for(const name of ['validJinAnnualYear','nearestJinLegacyYear','syncMainLocation','changeJinMapVersion'])vm.runInContext(extract(name),context);
  return {context,controls};
}
for(const version of ['annual','prior','video-prior','video']){
  const {context,controls}=versionFixture(version);
  context.changeJinMapVersion('legacy');
  const legacyUrl=new URL(context.window.location.href);
  assert.equal(context.yearSelect.value,'308','304 switches to the nearest real legacy snapshot');
  assert.equal(legacyUrl.searchParams.get('returnyear'),'304','Original selected year survives a refresh');
  assert.equal(legacyUrl.searchParams.get('returnmap'),version,'Original selected map mode survives a refresh');
  assert.equal(controls.get('jinMapRestore').dataset.version,version,'Return action targets the original map version');
  assert.equal(new URL(controls.get('jinMapRestore').href).searchParams.get('year'),'304','Return link retains the selected year');
  context.changeJinMapVersion(version);
  const returned=new URL(context.window.location.href);
  assert.equal(context.yearSelect.value,'304');assert.equal(context.jinMapVersion.value,version);
  assert.equal(returned.searchParams.get('jinmap'),version==='annual'?null:version);
  assert(!returned.searchParams.has('returnyear')&&!returned.searchParams.has('returnmap'),'Return state is cleared after return');
  const refreshed=versionFixture('legacy',308,legacyUrl.href);
  refreshed.context.jinAnnualReturnYear=Number(legacyUrl.searchParams.get('returnyear'));
  refreshed.context.jinAnnualReturnVersion=legacyUrl.searchParams.get('returnmap');
  refreshed.context.changeJinMapVersion(refreshed.context.jinAnnualReturnVersion);
  assert.equal(refreshed.context.yearSelect.value,'304','Refreshed legacy map still returns to 304');
  assert.equal(refreshed.context.jinMapVersion.value,version,'Refreshed legacy map returns to the original mode');
}
const initialStart=app.indexOf('  if(jinMapVersion)jinMapVersion.value=');
const initialEnd=app.indexOf('\n',initialStart);
assert(initialStart>=0&&initialEnd>initialStart);
for(const version of ['annual','prior','video-prior','video','legacy']){
  const context=vm.createContext({jinMapVersion:{value:''},initialParams:new URL(`https://example.test/?jinmap=${version}`).searchParams});
  vm.runInContext(app.slice(initialStart,initialEnd),context);assert.equal(context.jinMapVersion.value,version,'Mode URL initializes the correct selector');
}
const dispatchStart=app.indexOf('  function renderYearMap('),dispatchEnd=app.indexOf('  async function exportCurrentYearMap(',dispatchStart);
function dispatchFixture(heldYear){
  const controls=new Map(),calls=[],waiting=[];
  const legacy={years:{308:{year:308,geojson:{type:'FeatureCollection',features:[]}}}};
  const context=vm.createContext({window:{JIN_ANNUAL_MAP_MODEL:model,JIN_MAP_VIEW:view,JIN_VIDEO_FRAMES:frames,JIN_SNAPSHOT_MAPS:legacy},console,Map,
    jinMapRequest:0,jinMapCache:new Map(),jinMapVersion:{value:'annual'},currentDynasty:{key:'western-jin'},currentMap:null,currentMapFeatures:[],mapReadingMode:false,
    $:id=>{if(!controls.has(id))controls.set(id,{dataset:{}});return controls.get(id);},yearMapOverlay:new Node('svg'),mapLabelLayouts:new WeakMap(),yearMapPanel:{hidden:true},textMapLinkControl:{},
    yearMapExport:{},yearMapCsv:{},yearMapGeoJson:{},yearMapUhd:{},yearMapLoadUhd:{},yearMapStage:{style:{}},yearMapImage:{removeAttribute(){}},yearMapNote:{},results:{classList:{toggle(){}}},clearMapLinkHighlights(){},
    renderJinSnapshotMap:(year,snapshot,map)=>calls.push({year,kind:map.sourcePriority?'source-priority':map.videoTrial?'trial':map.trial?'prior':'legacy'}),renderJinVideoSourceMap:(year,frame)=>calls.push({year,kind:'video',sourceYear:Number(frame.year)}),
    fetch:url=>{
      const response={ok:true,json:async()=>read(url)};
      return Number(heldYear)&&url.split('?')[0]===model.SOURCE_PRIORITY_URLS[heldYear]?.split('?')[0]?new Promise(resolve=>waiting.push(()=>resolve(response))):Promise.resolve(response);
    }});
  vm.runInContext(app.slice(dispatchStart,dispatchEnd),context);
  return {context,calls,release(){waiting.splice(0).forEach(resolve=>resolve());}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function runDispatch(){
  const normal=dispatchFixture(),years=[266,279,280,289,308,312,316];
  for(const year of years){normal.context.renderYearMap(year,{});await flush();}
  assert.deepEqual(normal.calls,years.map(year=>({year,kind:'source-priority'})),'Annual mode dispatches the source-priority map for the exact selected year');
  normal.context.jinMapVersion.value='video-prior';normal.context.renderYearMap(304,{});await flush();
  assert.deepEqual(normal.calls.at(-1),{year:304,kind:'trial'},'The preceding 51-year video edition remains accessible');
  normal.context.jinMapVersion.value='prior';normal.context.renderYearMap(289,{});await flush();
  assert.equal(normal.calls.at(-1).kind,'trial','Prior mode keeps the previous two-year video trial');
  normal.context.renderYearMap(304,{});await flush();
  assert.deepEqual(normal.calls.at(-1),{year:304,kind:'prior'},'Other prior years retain the previous annual model');
  normal.context.jinMapVersion.value='video';normal.context.renderYearMap(304,{});
  assert.deepEqual(normal.calls.at(-1),{year:304,kind:'video',sourceYear:304},'Source mode uses the exact selected video year');
  assert(normal.context.yearMapExport.hidden&&normal.context.yearMapCsv.hidden&&normal.context.yearMapGeoJson.hidden&&normal.context.yearMapUhd.hidden,'Jin downloads remain hidden');
  for(const destination of ['trial','video','legacy']){
    const pending=dispatchFixture(289);pending.context.renderYearMap(289,{});
    if(destination==='trial')pending.context.renderYearMap(316,{});
    else if(destination==='video'){pending.context.jinMapVersion.value='video';pending.context.renderYearMap(304,{});}
    else{pending.context.jinMapVersion.value='legacy';pending.context.renderYearMap(308,{});}
    await flush();const before=[...pending.calls];pending.release();await flush();
    assert.deepEqual(pending.calls,before,`Late trial reply is discarded after switching to ${destination}`);
    assert(pending.calls.length===1&&!pending.calls.some(c=>c.year===289),'Only the currently selected map renders');
  }
  console.log(JSON.stringify({passed:true,scope:'Preserved trials and source-priority annual version return/dispatch only',maps:results,frames:frames.frames.length,dispatch_years:years,version_return:['annual','video-prior','prior','video'],stale_dispatch:['trial','video','legacy']},null,2));
}
runDispatch().catch(error=>{console.error(error);process.exitCode=1;});
