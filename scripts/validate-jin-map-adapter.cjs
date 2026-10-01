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
  insertBefore(c,before){this.children.splice(this.children.indexOf(before),0,c);}
  querySelectorAll(){return [];}
  addEventListener(){}
}
const svgNode=(...args)=>new Node(...args);
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'data/jin-map-snapshots.js'),'utf8'),sandbox);
vm.runInNewContext(fs.readFileSync(path.join(base,'data/jin-map-label-anchors.js'),'utf8'),sandbox);
const app=fs.readFileSync(path.join(base,'app.js'),'utf8');
const selectionContext=vm.createContext({mapZoom:8,svgNode,yearMapOverlay:new Node('svg')});
for(const name of ['normalizeName','mapLabelVisible','selectMapLabels','labelWidth','mapTerritoryLabelGuard','labelCandidates','placeAndDrawLabels']){
  const marker=`  function ${name==='labelCandidates'?'*':''}${name}(`;
  const start=app.indexOf(marker),nextFunction=app.indexOf('\n  function ',start+1),nextConstant=app.indexOf('\n  const ',start+1);
  const end=nextConstant>start?Math.min(nextFunction,nextConstant):nextFunction;
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
const narrow={text:'廣平國',x:22.5,y:20,level:'prefecture',kind:'prefecture-area',fontSize:16.5,priority:900,
  areaGuard:selectionContext.mapTerritoryLabelGuard('M0,0L45,0L45,40L0,40Z')};
for(const allowAreaFontShrink of [false,true]){
  const target=new Node('g');selectionContext.placeAndDrawLabels(target,[{...narrow,allowAreaFontShrink}],[0,0,100,100],1,100);
  const names=target.children.find(node=>node.attributes.class==='map-label-names').children;
  assert.equal(names.length,allowAreaFontShrink?1:0,'Only opted-in Jin ranges shrink to fit a narrow polygon');
  if(allowAreaFontShrink)assert.equal(names[0].style.fontSize,'10px','Small areas retain their names without overflowing their borders');
}
const results=[];
for(const [year,map] of Object.entries(sandbox.window.JIN_SNAPSHOT_MAPS.years)){
  const loaded=map.geojson?map:{...map,geojson:JSON.parse(fs.readFileSync(path.join(base,map.data_url),'utf8'))};
  const seatCalls=[];
  const root=new Node('svg'),rendered=view.draw(loaded,root,{svgNode,labelAnchors:sandbox.window.JIN_MAP_LABEL_ANCHORS.anchors,
    areaGuard:selectionContext.mapTerritoryLabelGuard,seatSymbol:(x,y,level)=>{seatCalls.push({x,y,level});return new Node('g',{'data-seat-level':level});}});
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
  const prefRanges=rendered.labels.filter(l=>l.kind==='prefecture-area');
  assert.equal(prefRanges.length,originalPrefAreas.length,'Every named annual prefecture area requires a range label');
  assert(prefRanges.every(label=>label.areaGuard.contains(label.x,label.y)),'Range anchors remain inside their annual polygons');
  assert(prefRanges.filter(label=>label.originalAnchorId).length>100,'Most range labels recover the confirmed original text anchors');
  const middle=selectionContext.selectMapLabels(rendered.labels,3);
  for(const label of prefRanges)assert(middle.includes(label),'The prefecture zoom tier retains its area labels');
  assert(prefRanges.filter(label=>label.fief).every(label=>label.color==='#493b2a'),'Fief area names use readable dark type instead of pale fill colors');
  const middleDrawing=new Node('g');selectionContext.placeAndDrawLabels(middleDrawing,middle,loaded.plot,3000/loaded.width,loaded.height);
  const middleRangeCount=middleDrawing.children.find(node=>node.attributes.class==='map-label-names').children.filter(node=>node.dataset.labelKind==='area'&&node.attributes['data-label-level']==='prefecture').length;
  assert(middleRangeCount>=prefRanges.length*.9,'At 300% the real layout places at least 90% of prefecture names within their areas');
  const countySeats=loaded.geojson.features.filter(f=>f.properties.layer==='county_seats');
  for(const seat of countySeats)assert(countyLabels.some(label=>label.seatSourceId===seat.properties.source_id),'Every active county seat retains its own county or annual county-fief name');
  // Check the actual shared layout, not merely the list supplied to it. All
  // county names must appear in the drawing at 800%, inside the map itself.
  const drawn=new Node('g'),renderHeight=selectionContext.placeAndDrawLabels(drawn,detailed,loaded.plot,8000/loaded.width,loaded.height);
  const placed=drawn.children.find(node=>node.attributes.class==='map-label-names').children;
  const countyText=placed.filter(node=>node.attributes['data-label-level']==='county');
  assert.equal(countyText.length,countyLabels.length,'The shared layout draws every county and fief annotation');
  assert(countyText.every(node=>node.attributes.y>=loaded.plot[1]&&node.attributes.y<=loaded.plot[3]),'County names stay on the map rather than in the overflow panel');
  assert.equal(renderHeight,loaded.height,'The county tier fits without enlarging a hidden overflow panel');
  const stateBoundary=root.children.find(node=>node.attributes.class==='jin-province-boundary');
  assert(stateBoundary&&stateBoundary.attributes.stroke==='#292b32'&&stateBoundary.attributes['stroke-width']===3.2&&stateBoundary.attributes['stroke-opacity']===1,'Province borders are fully opaque and visually stronger than kingdom borders');
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
  results.push({year:Number(year),features:loaded.geojson.features.length,labels:rendered.labels.length,province_range_labels:namedStates.length,prefecture_range_labels:prefRanges.length,prefecture_ranges_drawn_at_300_percent:middleRangeCount,original_prefecture_anchors:prefRanges.filter(label=>label.originalAnchorId).length,rendered_paths:root.children.filter(n=>n.tagName==='path').length,county_seat_names:countySeats.length,county_labels_at_800_percent:countyText.length,preserved_paired_county_names:pairedCountyNames.length});
}
assert(results.length,'Build at least one reviewed annual bundle before validation');
async function routing(){
  const app=fs.readFileSync(path.join(base,'app.js'),'utf8'),start=app.indexOf('  function renderYearMap('),end=app.indexOf('  async function exportCurrentYearMap(',start);
  const controls=new Map(),calls=[],overlay=new Node('svg');
  const context=vm.createContext({window:{...sandbox.window,JIN_MAP_VIEW:view},console,Map,
    jinMapRequest:0,jinMapCache:new Map(),jinMapVersion:{value:'legacy'},currentDynasty:{key:'western-jin'},currentMap:null,currentMapFeatures:[],mapReadingMode:false,
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
