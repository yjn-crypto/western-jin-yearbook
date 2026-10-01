/* Exercise the real annual GeoJSON renderer without network or a browser. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),base=path.resolve(__dirname,'..');
const view=require('../jin-map-view.js');
class Node {
  constructor(tag,attrs={},text=''){this.tagName=tag;this.attributes={...attrs};this.textContent=text;this.children=[];this.dataset={};this.style={};}
  setAttribute(k,v){this.attributes[k]=v;}
  appendChild(c){this.children.push(c);return c;}
  replaceChildren(...c){this.children=c;}
  append(...c){this.children.push(...c);}
}
const svgNode=(...args)=>new Node(...args);
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'data/jin-map-snapshots.js'),'utf8'),sandbox);
const app=fs.readFileSync(path.join(base,'app.js'),'utf8');
const selectionContext=vm.createContext({mapZoom:8});
for(const name of ['normalizeName','mapLabelVisible','selectMapLabels']){
  const start=app.indexOf(`  function ${name}(`),end=app.indexOf('\n  function ',start+1);
  assert(start>=0&&end>start,`Read the production ${name} function`);
  vm.runInContext(app.slice(start,end),selectionContext);
}
// Labels without a separate identity retain the existing Chen/Liang deduplication.
const ordinary={text:'某縣',sourceName:'某縣',x:100,y:100,level:'county',entityId:'county-test',mapKey:'entity:county-test',kind:'county-seat',priority:400};
assert.equal(selectionContext.selectMapLabels([ordinary,{...ordinary}],8).length,1,'Duplicate administrative labels still collapse');
const range={...ordinary,level:'state',kind:'state-area',priority:1000};
const seat={...range,kind:'state-seat',x:120,priority:560};
assert.equal(selectionContext.selectMapLabels([range,seat],1).length,1,'State overview retains one range/seat name');
assert.equal(selectionContext.selectMapLabels([range,seat],8).length,2,'Detailed state view retains distinct range and seat names');
const results=[];
for(const [year,map] of Object.entries(sandbox.window.JIN_SNAPSHOT_MAPS.years)){
  const loaded=map.geojson?map:{...map,geojson:JSON.parse(fs.readFileSync(path.join(base,map.data_url),'utf8'))};
  const seatCalls=[];
  const root=new Node('svg'),rendered=view.draw(loaded,root,{svgNode,seatSymbol:(x,y,level)=>{seatCalls.push({x,y,level});return new Node('g',{'data-seat-level':level});}});
  const namedStates=loaded.geojson.features.filter(f=>f.properties?.layer==='province_areas'&&(f.properties.name||f.properties.display_name));
  assert.equal(rendered.labels.filter(l=>l.kind==='state-area').length,namedStates.length,'Each province must retain a range label when no state seat exists');
  assert(!rendered.labels.some(l=>l.level==='fief'),'Fief annotations need an effective display zoom level');
  assert(rendered.labels.every(l=>Number.isFinite(l.x)&&Number.isFinite(l.y)),'All map labels require finite projected coordinates');
  const realSeats=loaded.geojson.features.filter(f=>f.geometry?.type==='Point'&&f.properties.coordinate_role==='administrative_seat');
  assert.equal(seatCalls.length,realSeats.length,'Only actual administrative-seat records produce seat symbols');
  assert.equal(rendered.features.filter(f=>f.coordinate_role==='administrative_seat').length,realSeats.length,'Seat hotspot input excludes image/annotation anchors');
  const detailed=selectionContext.selectMapLabels(rendered.labels,8);
  const countyLabels=rendered.labels.filter(l=>l.level==='county');
  for(const label of countyLabels)assert(detailed.includes(label),`${year}: retain county or fief label ${label.text}`);
  assert(!selectionContext.selectMapLabels(rendered.labels,7).some(l=>l.level==='county'),'County labels still require zoom above 700%');
  for(const entityId of ['c0160',...(Number(year)===289?['c1165']:[])]){
    const expected=rendered.labels.filter(l=>l.entityId===entityId);
    assert.equal(expected.length,2,`${year}: fixture retains paired labels for ${entityId}`);
    assert.equal(detailed.filter(l=>l.entityId===entityId).length,2,`${year}: both paired labels survive selection for ${entityId}`);
    assert(expected.every(l=>l.mapKey===`entity:${entityId}`),'Separate annotations keep the same administrative text linkage');
  }
  const pairedCountyNames=countyLabels.filter(l=>l.entityId&&!l.fief&&countyLabels.some(other=>other.entityId===l.entityId&&other.fief));
  assert.equal(pairedCountyNames.length,Number(year)===289?13:17,'Exercise every previously omitted county name');
  for(const node of root.children){
    if(node.tagName!=='path')continue;
    assert(!/NaN|Infinity/.test(node.attributes.d),'Projected path must be finite');
  }
  const originalPrefAreas=loaded.geojson.features.filter(f=>f.properties.layer==='prefecture_areas');
  const explicit=loaded.geojson.features.some(f=>f.properties.layer==='prefecture_boundaries');
  if(explicit){
    const paths=new Map(root.children.filter(n=>n.tagName==='path').map(n=>[n.attributes.d,n]));
    const [w,s,e,n]=map.extent,[l,t,r,b]=map.plot,project=([x,y])=>[l+(x-w)/(e-w)*(r-l),t+(n-y)/(n-s)*(b-t)];
    // A prefecture polygon must never redraw dark edges over the faded member-boundary layer.
    for(const f of originalPrefAreas){
      const d=view.paths(f.geometry,project),matches=root.children.filter(node=>node.tagName==='path'&&node.attributes.d===d);
      assert(matches.some(node=>node.attributes.stroke==='none'),'Original prefecture edges must not be redrawn');
    }
  }
  results.push({year:Number(year),features:loaded.geojson.features.length,labels:rendered.labels.length,province_range_labels:namedStates.length,rendered_paths:root.children.filter(n=>n.tagName==='path').length,county_labels_at_800_percent:countyLabels.length,preserved_paired_county_names:pairedCountyNames.length});
}
assert(results.length,'Build at least one reviewed annual bundle before validation');
async function routing(){
  const app=fs.readFileSync(path.join(base,'app.js'),'utf8'),start=app.indexOf('  function renderYearMap('),end=app.indexOf('  async function exportCurrentYearMap(',start);
  const controls=new Map(),calls=[],overlay=new Node('svg');
  const context=vm.createContext({window:{...sandbox.window,JIN_MAP_VIEW:view},console,Map,
    jinMapRequest:0,jinMapCache:new Map(),currentDynasty:{key:'western-jin'},currentMap:null,currentMapFeatures:[],mapReadingMode:false,
    $:id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);},
    yearMapOverlay:overlay,mapLabelLayouts:new WeakMap(),yearMapPanel:{hidden:true},textMapLinkControl:{},
    yearMapExport:{},yearMapCsv:{},yearMapGeoJson:{},yearMapUhd:{},yearMapLoadUhd:{},yearMapStage:{style:{}},
    yearMapImage:{removeAttribute(){}},yearMapNote:{},results:{classList:{toggle(){}}},clearMapLinkHighlights(){},
    renderJinSnapshotMap:(year)=>calls.push(year),
    fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(base,url),'utf8'))})});
  vm.runInContext(app.slice(start,end),context);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  for(const year of [289,308]){context.renderYearMap(year,{});await flush();}
  assert.deepEqual(calls,[289,308],'Reviewed years must dispatch to Jin renderer');
  context.renderYearMap(307,{});await flush();
  assert.deepEqual(calls,[289,308],'Unreviewed 307 must not use a neighbouring map');
  assert.equal(context.yearMapPanel.hidden,true,'Unsupported date hides the map');
  context.renderYearMap(289,{});context.renderYearMap(307,{});await flush();
  assert.deepEqual(calls,[289,308],'Late asynchronous result cannot redraw a previous year');
  console.log(JSON.stringify({passed:true,annual_results:results,routing:'289/308 dispatch; 307 hidden; stale async response discarded'},null,2));
}
routing().catch(error=>{console.error(error);process.exitCode=1;});
