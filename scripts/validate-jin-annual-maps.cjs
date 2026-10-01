/* Check annual coverage, dated frontier changes and the real UI dispatch. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const model=require('../jin-annual-map-model.js'),view=require('../jin-map-view.js');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const bundle=read('data/jin-maps/annual-geography.json');
assert.deepEqual(Object.keys(bundle.years).map(Number),Array.from({length:51},(_,i)=>266+i),'Each Jin year must have its own slice');
const slices={},maps={},results=[];
for(const year of Object.keys(bundle.years)){
  const entry=bundle.years[year];
  const slice=read(entry.data_url);slices[year]=slice;
  assert.equal(slice.year,Number(year),'No nearest-year substitution');
  const geometries=Object.assign({},bundle.geometries,...(entry.geometry_urls||[]).map(url=>read(url).geometries));
  const map=model.hydrate({...bundle,geometries},year,slice);maps[year]=map;
  const features=map.geojson.features;
  assert(features.length>0&&map.trial&&map.note.includes('擬合界'),'Annual maps disclose their geometric limits');
  assert(!/undefined|\[object Object\]/.test(map.note+map.status),'Readable annual coverage');
  const areas=features.filter(f=>f.properties.layer==='county_areas');
  assert(areas.length>0,'County tier must have boundaries, not just seats');
  assert(areas.every(f=>f.properties.geometric_certainty==='inferred'),'No fitted county boundary can be labelled observed');
  for(const feature of features){
    assert.equal(feature.properties.year,Number(year),'All features belong to selected year');
    assert(!['lost','external','enemy','withdrawn'].includes(feature.properties.control_status)||feature.properties.layer==='labels','Lost land cannot remain a Jin area or seat');
  }
  for(const layer of ['county_seats','prefecture_areas','province_areas']){
    const ids=features.filter(f=>f.properties.layer===layer).map(f=>f.properties.entity_id).filter(Boolean);
    assert.equal(new Set(ids).size,ids.length,`Unique ${year} ${layer} entity rows`);
  }
  const kingdoms=features.filter(f=>f.properties.layer==='kingdom_areas');
  assert(kingdoms.length>0,'Single-commandery and multi-commandery kingdoms retain coloured areas');
  results.push({year:Number(year),states:features.filter(f=>f.properties.layer==='province_areas').length,prefectures:features.filter(f=>f.properties.layer==='prefecture_areas').length,county_seats:features.filter(f=>f.properties.layer==='county_seats').length,county_cells:areas.length,kingdoms:kingdoms.length});
}
const layer=(year,name)=>maps[year].geojson.features.filter(f=>f.properties.layer===name);
const has=(year,layerName,id)=>layer(year,layerName).some(f=>f.properties.entity_id===id);
for(const year of [266,279]){
  assert(!has(year,'prefecture_areas','p189'),'Wu Danyang must not be backdated into Jin');
  assert(!has(year,'province_areas','s20'),'Pre-conquest Jiaozhou is not a complete Jin province');
  assert(layer(year,'labels').some(f=>/孫吳/.test(f.properties.display_name||f.properties.name)),'Pre-280 confrontation is visible');
}
assert(has(280,'prefecture_areas','p189'),'Conquest adds Jiangdong');
assert(has(280,'province_areas','s20'),'Conquest adds Jiaozhou');
assert(layer(266,'labels').some(f=>f.properties.marker_only),'Early Jiaozhi footholds are annotations');
assert(!layer(271,'labels').some(f=>f.properties.marker_only),'Early foothold cannot survive documented loss');
assert(!has(303,'prefecture_areas','p115'),'Chengdu loss applies in the loss year');
assert(!has(301,'prefecture_areas','p103'),'Guanghan loss applies in the loss year');
assert(!has(311,'county_seats','c0506')&&has(312,'county_seats','c0506')&&!has(316,'county_seats','c0506'),'Changan loss, recovery and final fall');
assert(!has(311,'county_seats','c0442'),'Xianping falls without deleting all Liaodong');
assert(has(311,'prefecture_areas','p002')&&has(311,'prefecture_areas','p003'),'Luoyang loss must preserve Xingyang and Hongnong exceptions');
assert(has(316,'prefecture_areas','p002')&&has(316,'prefecture_areas','p003'),'Residual Jin prefectures survive the end of a parent province phase');
assert(!has(289,'province_areas','s13')&&!has(289,'province_areas','s18'),'No later Ningzhou or Xiangzhou in 289');
const fufeng313=layer(313,'prefecture_areas').find(f=>f.properties.entity_id==='p073');
assert(fufeng313&&fufeng313.properties.display_name==='扶風郡'&&!fufeng313.properties.fief_id,'313 accession ends Qin kingdom before single-kingdom fallback');

class Node{
  constructor(tag,attributes={},text=''){this.tagName=tag;this.attributes=attributes;this.textContent=text;this.children=[];this.dataset={};this.style={};}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
}
for(const year of [266,280,289,308,311,316]){
  const canvas=new Node('svg');
  const rendered=view.draw(maps[year],canvas,{svgNode:(...args)=>new Node(...args),seatSymbol:()=>new Node('g')});
  assert(rendered.labels.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)),'Annual labels have real projected coordinates');
  assert.equal(canvas.children.filter(n=>n.attributes.class==='jin-county-boundary').length,layer(year,'county_areas').length,'Each county unit draws a boundary');
  assert(rendered.labels.filter(l=>l.kind==='prefecture-area').length>=layer(year,'prefecture_areas').length*.95,'Prefecture labels retain range anchors');
  assert(canvas.children.every(n=>!n.attributes.d||!n.attributes.d.includes('NaN')),'Valid SVG paths');
  assert(!rendered.features.some(f=>f.coordinate_role==='administrative_seat'&&/晋据点/.test(f.label)),'Layout annotations never become historical seat symbols');
}

async function dispatch(){
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const start=app.indexOf('  function renderYearMap('),end=app.indexOf('  async function exportCurrentYearMap(',start);
  const controls=new Map(),calls=[];
  const context=vm.createContext({window:{JIN_ANNUAL_MAP_MODEL:model,JIN_MAP_VIEW:view},console,Map,
    jinMapRequest:0,jinMapCache:new Map(),jinMapVersion:{value:'annual'},currentDynasty:{key:'western-jin'},currentMap:null,currentMapFeatures:[],mapReadingMode:false,
    $:id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);},
    yearMapOverlay:new Node('svg'),mapLabelLayouts:new WeakMap(),yearMapPanel:{hidden:true},textMapLinkControl:{},
    yearMapExport:{},yearMapCsv:{},yearMapGeoJson:{},yearMapUhd:{},yearMapLoadUhd:{},yearMapStage:{style:{}},
    yearMapImage:{removeAttribute(){}},yearMapNote:{},results:{classList:{toggle(){}}},clearMapLinkHighlights(){},
    renderJinSnapshotMap:(year,snapshot,map)=>calls.push({year,trial:map.trial}),
    fetch:async url=>({ok:true,json:async()=>read(url.split('?')[0])})});
  vm.runInContext(app.slice(start,end),context);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  context.renderYearMap(266,{});await flush();
  context.renderYearMap(307,{});await flush();
  assert.deepEqual(calls,[{year:266,trial:true},{year:307,trial:true}],'Previously unsupported years dispatch their annual maps');
  context.renderYearMap(289,{});context.renderYearMap(316,{});await flush();
  assert.equal(calls.at(-1).year,316,'A late result cannot restore a stale selected year');
  assert(!calls.slice(2).some(c=>c.year===289),'Stale response discarded');
  assert(context.yearMapExport.hidden&&context.yearMapCsv.hidden&&context.yearMapGeoJson.hidden&&context.yearMapUhd.hidden,'Jin downloads stay hidden');
  assert(app.includes("initialParams.get('jinmap')==='legacy'"),'Original mode survives refresh');
  assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('切回修改前地圖'),'Visible rollback entry');
  console.log(JSON.stringify({passed:true,years:results,routing:'All annual years, loss/recovery dates, stale responses, original-mode entry and hidden downloads verified'},null,2));
}
dispatch().catch(error=>{console.error(error);process.exitCode=1;});
