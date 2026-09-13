import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function extract(name) {
  const start=source.indexOf(`  function ${name}(`);
  assert.notEqual(start,-1,`Missing ${name}`);
  const tail=source.slice(start+3),next=tail.search(/\n  (?:(?:async )?function |(?:const|let) )/);
  return source.slice(start,next<0?undefined:start+3+next);
}

class Node {
  constructor(tag,attributes={},text='') {
    this.tagName=tag;this.attributes={};this.dataset={};this.children=[];this.style={};this.events={};this.textContent=text;
    const classes=new Set();
    this.classList={add:(...names)=>names.forEach((n)=>classes.add(n)),remove:(...names)=>names.forEach((n)=>classes.delete(n)),contains:(name)=>classes.has(name),toggle:(name,on)=>{if(on)classes.add(name);else classes.delete(name);}};
    for(const [name,value] of Object.entries(attributes))this.setAttribute(name,value);
  }
  setAttribute(name,value) {
    this.attributes[name]=String(value);
    if(name==='class')this.classList.add(...String(value).split(' '));
    if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);
  }
  getAttribute(name){return this.attributes[name];}
  removeAttribute(name){delete this.attributes[name];}
  appendChild(child){this.children.push(child);return child;}
  append(...children){this.children.push(...children);}
  insertBefore(child,sibling){this.children.splice(this.children.indexOf(sibling),0,child);}
  replaceChildren(...children){this.children=children;}
  addEventListener(name,callback){this.events[name]=callback;}
  all(){return this.children.flatMap((child)=>[child,...child.all()]);}
  querySelectorAll(selector) {
    return this.all().filter((node)=>selector==='[data-map-key]'?node.dataset.mapKey:
      selector==='.name-with-citation[data-entity-id]'?node.classList.contains('name-with-citation')&&node.dataset.entityId:
      node.classList.contains(selector.slice(1)));
  }
}

const overlay=new Node('svg'),results=new Node('section'),controls=new Map();
const getControl=(id)=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);};
const context=vm.createContext({
  Math,Map,Set,Boolean,Number,String,console,
  yearMapOverlay:overlay,results,$:getControl,
  svgNode:(...args)=>new Node(...args),
  activeMapKey:'',mapReadingMode:false,mapZoom:1,
  yearMapStage:{clientWidth:1000,style:{}},
  currentMap:{year:588,width:1000,height:1000},
  yearMapViewport:{clientWidth:1000,clientHeight:600,scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0})},
  yearMapZoomValue:{},requestAnimationFrame:(callback)=>callback(),
  mapLabelLayouts:new WeakMap(),
});
for(const name of ['normalizeName','labelWidth','mapTerritoryLabelGuard','labelCandidates','placeAndDrawLabels','mapLabelVisible','selectMapLabels','restoreMapSelection','selectMapKey','clearMapLinkHighlights','layoutDynamicMapLabels','applyMapZoom','ensureMapLabelVisible']) {
  // labelCandidates is a generator, so its declaration has a different prefix.
  const code=name==='labelCandidates'?source.slice(source.indexOf('  function *labelCandidates('),source.indexOf('  function placeAndDrawLabels(')):extract(name);
  vm.runInContext(code,context);
}

const expected=[
  [1,['state']],[2.99,['state']],[3,['state','prefecture']],
  [7,['state','prefecture']],[7.01,['state','prefecture','county']],[10,['state','prefecture','county']],
];
for(const [zoom,levels] of expected) {
  assert.deepEqual(['state','prefecture','county'].filter((level)=>context.mapLabelVisible(level,zoom)),levels,`${zoom*100}% label boundary`);
}

// The overview chooses the original area text; higher zooms can restore the
// distinct seat text. Duplicate records at one coordinate never add a field.
const paired=[];
for(const level of ['state','prefecture','county'])for(const type of ['area','seat'])paired.push({
  level,kind:`${level}-${type}`,text:level==='state'?'揚州':level==='prefecture'?'吳郡':'吳縣',
  x:type==='area'?400:500,y:400,fontSize:18,priority:type==='area'?1000:500,
  entityId:level,mapKey:`entity:${level}`,
});
paired.push({...paired[0]},{...paired[3]});
for(const [zoom,counts] of [[1,[1,0,0]],[2.99,[1,0,0]],[3,[2,1,0]],[7,[2,1,0]],[7.01,[2,2,2]],[10,[2,2,2]]]) {
  const chosen=context.selectMapLabels(paired,zoom);
  assert.deepEqual(['state','prefecture','county'].map((level)=>chosen.filter((label)=>label.level===level).length),counts,`${zoom*100}% area/seat deduplication`);
  if(zoom<=7)assert.ok(chosen.filter((label)=>label.level===(zoom<3?'state':'prefecture')).every((label)=>label.kind.includes('area')),'Choose existing area text before adding seat text');
}
assert.equal(context.selectMapLabels([paired[0],{...paired[0],kind:'state-seat'}],10).length,1,'One entity and coordinate must never gain a second text field');
assert.equal(context.selectMapLabels([paired[0],{...paired[0],entityId:'another-state',mapKey:'entity:another-state'}],1).length,2,'Different known entities with the same name must remain distinct');

const actualOverlay=new Node('svg'),actualLayouts=new WeakMap(),actualWindow={};
for(const filename of ['chen-data.js','chen-map-dynamic.js'])vm.runInNewContext(fs.readFileSync(new URL(`../data/${filename}`,import.meta.url),'utf8'),{window:actualWindow});
const actual=vm.createContext({window:actualWindow,Math,Map,Set,Number,String,Boolean,mapZoom:1,yearMapOverlay:actualOverlay,mapLabelLayouts:actualLayouts,svgNode:(...args)=>new Node(...args)});
for(const name of ['normalizeName','itemDisplayName','activeMapRecords','chenTerritoryFeature','chenTerritorySource','drawRegimes','mapDistance','chooseEntitySeat','resolveSnapshotFeatures','dynamicFiefLabels','snapshotFeatureForMapArea','appendHotspots','mapTerritoryLabelGuard','mapLabelVisible','selectMapLabels','renderDynamicMap'])vm.runInContext(extract(name),actual);
const phaseAt=(entity,year)=>(entity.phases||[]).find((phase)=>Number(phase.start)<=year&&year<=Number(phase.end));
const states=actualWindow.CHEN_DATA.regimes.chen.states.flatMap((entity)=>{
  const phase=phaseAt(entity,588);if(!phase)return [];
  return [{id:entity.id,name:phase.name||entity.base_name||entity.name,group:'chen',rows:(entity.prefectures||[]).flatMap((pref)=>{
    const prefPhase=phaseAt(pref,588);return prefPhase?[{id:pref.id,name:prefPhase.name||pref.base_name,counties:[],chenFiefs:[]}]:[];
  })}];
});
assert.ok(states.length,'The annual fixture must include real Chen states');
actual.renderDynamicMap(588,{states,virtualFiefs:[]},actualWindow.CHEN_DYNAMIC_MAP);
const actualLabels=actualLayouts.get(actualOverlay).labels;
for(const name of ['崖州','豐州']) {
  const overview=actual.selectMapLabels(actualLabels,1).filter((label)=>label.text===name);
  assert.equal(overview.length,1,`100% ${name} must have one label`);
  assert.equal(overview[0].kind,'state-area',`${name} retains its original area text`);
  const sparse=new Node('g');context.placeAndDrawLabels(sparse,overview,actualWindow.CHEN_DYNAMIC_MAP.plot,1,4128);
  assert.equal(sparse.querySelectorAll('.map-label-leader').length,0,`${name} needs no leader when its area text has not moved`);
  assert.equal(actual.selectMapLabels(actualLabels,10).filter((label)=>label.text===name).length,2,`${name} may show area and seat in the full view`);
}
const wu=actualLabels.find((label)=>label.kind==='prefecture-area'&&label.text==='吳郡');
assert.ok(wu?.entityId,'Real Wu area must still connect to its annual entity');
assert.equal(actual.selectMapLabels(actualLabels,7).filter((label)=>label.entityId===wu.entityId).length,1,'700% real Wu keeps one area label');
assert.equal(actual.selectMapLabels(actualLabels,7.01).filter((label)=>label.entityId===wu.entityId).length,2,'Above 700% real Wu restores its separate seat label');

// Northern reference names can overlap beside their own points but their
// complete text boxes must stay outside Chen, even along a narrow coastline.
const territoryGuard=context.mapTerritoryLabelGuard('M500,200L900,200L900,900L500,900Z');
assert.equal(territoryGuard.contains(550,500),true);
assert.equal(territoryGuard.contains(490,500),false);
assert.equal(territoryGuard.intersects([480,400,520,600]),true,'A label straddling the border must be rejected');
const narrowGuard=context.mapTerritoryLabelGuard('M490,490L510,490L510,510L490,510Z');
assert.equal(narrowGuard.intersects([480,480,520,520]),true,'An island entirely inside a label must also be detected');
assert.equal(narrowGuard.intersects([480,495,520,505]),true,'A narrow border can intersect without containing a text-box corner');
assert.equal(narrowGuard.intersects([450,450,470,470]),false);
const holeGuard=context.mapTerritoryLabelGuard('M0,0L100,0L100,100L0,100ZM20,20L80,20L80,80L20,80Z');
assert.equal(holeGuard.intersects([30,30,70,70]),false,'Even-odd holes must retain the displayed territory geometry');
const borderLayer=new Node('g'),borderLabels=[0,1].map((index)=>({
  level:'state',kind:'state-seat',text:'北朝參考州',x:490,y:500,fontSize:18,priority:1000,
  mapKey:`reference:border-${index}`,outsideChen:true,
}));
borderLabels.push({level:'state',kind:'state-seat',text:'陳州',x:490,y:500,fontSize:18,priority:900,entityId:'chen-border',mapKey:'entity:chen-border'});
const borderHeight=context.placeAndDrawLabels(borderLayer,borderLabels,[0,0,1000,1000],1,1000,territoryGuard);
const borderNames=borderLayer.querySelectorAll('.dynamic-map-label'),northernNames=borderNames.filter((node)=>node.dataset.mapKey.startsWith('reference:'));
assert.equal(northernNames.length,2,'Northern references must remain visible, rather than being removed wholesale');
assert.deepEqual(northernNames.map((node)=>[node.getAttribute('x'),node.getAttribute('y'),node.getAttribute('text-anchor')]),[[469.84,500,'end'],[469.84,500,'end']].map((row)=>row.map(String)),'Northern names are allowed to overlap at their own seat');
for(const node of northernNames) {
  const font=Number.parseFloat(node.style.fontSize),width=context.labelWidth(node.textContent,font)+font*.35,height=font*1.4;
  const x=Number(node.getAttribute('x')),y=Number(node.getAttribute('y')),anchor=node.getAttribute('text-anchor');
  const left=anchor==='middle'?x-width/2:anchor==='end'?x-width:x;
  assert.equal(territoryGuard.intersects([left-1.4,y-height/2-1.4,left+width+1.4,y+height/2+1.4]),false,'Whole northern label including its halo must remain outside Chen');
}
const chenBorderName=borderNames.find((node)=>node.dataset.entityId==='chen-border');
assert.ok(chenBorderName,'A matched Chen label near the border must remain visible');
assert.equal(chenBorderName.getAttribute('text-anchor'),'start','Northern references must not push Chen labels away from their existing placement');
assert.equal(borderHeight,1000,'Northern crowding must not create a southern overflow panel');

const layer=new Node('g');overlay.appendChild(layer);
const labels=[];
for(const level of ['state','prefecture','county'])for(let index=0;index<8;index++) {
  labels.push({level,kind:`${level}-seat`,text:`${level==='state'?'州':level==='prefecture'?'郡國':'縣國'}${index}`,x:50,y:50,
    anchorX:25,anchorY:25,fontSize:18,priority:100-index,entityId:`${level}-${index}`,mapKey:`entity:${level}-${index}`,fief:level!=='state'});
}
context.mapLabelLayouts.set(overlay,{year:588,labels,layer,plot:[0,0,110,110]});
for(const [zoom,levels] of expected) {
  context.mapZoom=zoom;context.layoutDynamicMapLabels();
  const textNodes=layer.querySelectorAll('.dynamic-map-label');
  assert.equal(textNodes.length,levels.length*8,`${zoom*100}% must include all eligible labels, including overflow`);
  assert.ok(textNodes.every((node)=>levels.includes(node.dataset.labelLevel)),'Hidden levels must not occupy layout or PNG bounds');
  assert.ok(layer.querySelectorAll('.map-overflow-legend').length,'Dense labels retain the overflow panel');
  assert.ok(context.currentMap.renderHeight>context.currentMap.height,'Overflow must expand export bounds');
  for(const line of layer.querySelectorAll('.map-label-leader')) {
    assert.equal(line.getAttribute('x1'),'25','An area label leader must connect to the actual matching seat');
    assert.equal(line.getAttribute('y1'),'25');
    assert.ok(line.dataset.mapKey);
  }
}

// A label that fits beside its point legitimately has no leader. Exercise a
// displaced state label that the layout actually connected with a leader.
const selectedKey=layer.querySelectorAll('.map-label-leader').find((node)=>node.dataset.labelLevel==='state')?.dataset.mapKey;
assert.ok(selectedKey,'The dense fixture must produce a displaced state label');
const point=new Node('circle',{'data-map-key':selectedKey,role:'button'});overlay.appendChild(point);
const textTarget=new Node('span',{class:'name-with-citation','data-entity-id':selectedKey.slice(7)});results.appendChild(textTarget);
context.selectMapKey(selectedKey);
const selected=overlay.querySelectorAll('[data-map-key]').filter((node)=>node.dataset.mapKey===selectedKey);
assert.ok(selected.length>=3,'Selection must cover point, label and leader');
assert.ok(selected.every((node)=>node.classList.contains('is-active')));
assert.equal(point.getAttribute('aria-pressed'),'true');
assert.ok(textTarget.classList.contains('map-linked-active'));
context.layoutDynamicMapLabels();
assert.ok(overlay.querySelectorAll('[data-map-key]').filter((node)=>node.dataset.mapKey===selectedKey).every((node)=>node.classList.contains('is-active')),'Selection survives label reconstruction');
const selectedName=layer.querySelectorAll('.dynamic-map-label').find((node)=>node.dataset.mapKey===selectedKey);
selectedName.events.mouseenter();selectedName.events.mouseleave();
assert.ok(layer.querySelectorAll('.map-label-leader').find((node)=>node.dataset.mapKey===selectedKey).classList.contains('is-active'),'Hover ending must not clear a persistent selection');
context.selectMapKey('entity:prefecture-0');
assert.ok(!point.classList.contains('is-active'));assert.ok(!textTarget.classList.contains('map-linked-active'));
context.clearMapLinkHighlights();
assert.equal(overlay.querySelectorAll('[data-map-key]').filter((node)=>node.classList.contains('is-active')).length,0);

context.applyMapZoom(50);assert.equal(context.mapZoom,10);assert.equal(context.yearMapZoomValue.value,'1000%');
assert.equal(getControl('yearMapZoomIn').disabled,true);
context.applyMapZoom(0.1);assert.equal(context.mapZoom,1);assert.equal(getControl('yearMapZoomOut').disabled,true);
context.ensureMapLabelVisible('prefecture');assert.equal(context.mapZoom,3);
context.ensureMapLabelVisible('county');assert.equal(context.mapZoom,7.1);

let revealed=0;
context.mapFeatureById=()=>({label:'揚州',level:'state'});
context.revealTextEntity=()=>{revealed++;};
vm.runInContext(extract('activateMapTarget'),context);
const target={dataset:{entityId:'state-0',mapKey:'entity:state-0'},getBoundingClientRect:()=>({left:10,top:10,width:20,height:20})};
context.mapReadingMode=true;context.activateMapTarget(target);
assert.equal(revealed,0,'Reading mode must not scroll to body text');
assert.equal(getControl('yearMapLocateText').hidden,false);
context.mapReadingMode=false;context.activateMapTarget(target);
assert.equal(revealed,1,'Normal map clicks retain body-text navigation');

// Exercise the real reading-mode and zoom functions with viewport dimensions
// that change when the panel becomes fixed to the window.
const panel=new Node('section'),main=new Node('main'),body=new Node('body');
const outside=new Node('button'),alreadyInert=new Node('aside'),bodySibling=new Node('footer');
outside.inert=false;alreadyInert.inert=true;bodySibling.inert=false;
main.children=[outside,panel,alreadyInert];body.children=[main,bodySibling];
for(const node of main.children)node.parentElement=main;
for(const node of body.children)node.parentElement=body;
const frames=[],readingControls=new Map();
const document={body,activeElement:outside,events:{},addEventListener(name,callback){this.events[name]=callback;}};
outside.isConnected=true;outside.closest=()=>null;outside.focus=()=>{document.activeElement=outside;};
const readingControl=(id)=>{
  if(!readingControls.has(id)) {
    const node=new Node('button');node.focus=()=>{document.activeElement=node;};readingControls.set(id,node);
  }
  return readingControls.get(id);
};
const viewport={
  get clientWidth(){return panel.classList.contains('is-reading')?1440:1000;},
  get clientHeight(){return panel.classList.contains('is-reading')?1000:600;},
  scrollLeft:1200,scrollTop:1300,getBoundingClientRect:()=>({left:0,top:0}),
};
const stage={style:{width:'3992px'},get clientWidth(){return Number.parseFloat(this.style.width);}};
let locatedEntity='';
const reading=vm.createContext({
  Math,Map,Boolean,Number,String,document,$:readingControl,
  yearMapPanel:panel,yearMapViewport:viewport,yearMapStage:stage,yearMapZoomValue:{},
  yearMapOverlay:overlay,results,currentMap:{year:588,width:1000,height:1000},
  mapZoom:4,mapReadingMode:false,mapReadingReturnFocus:null,mapReadingInertNodes:new Map(),
  activeMapKey:selectedKey,sourceModal:{hidden:true},
  requestAnimationFrame:(callback)=>frames.push(callback),layoutDynamicMapLabels:()=>{},
  revealTextEntity:(entityId)=>{locatedEntity=entityId;},
});
for(const name of ['restoreMapSelection','applyMapZoom','setMapReadingMode'])vm.runInContext(extract(name),reading);
const listenerStart=source.indexOf("  $('yearMapReading').addEventListener('click'");
const listenerEnd=source.indexOf("  yearMapViewport.addEventListener('keydown'",listenerStart);
assert.ok(listenerStart>=0&&listenerEnd>listenerStart);
vm.runInContext(source.slice(listenerStart,listenerEnd),reading);
const flushFrames=()=>{while(frames.length)frames.shift()();};
const viewCenter=()=>[(viewport.scrollLeft+viewport.clientWidth/2)/stage.clientWidth,(viewport.scrollTop+viewport.clientHeight/2)/stage.clientWidth];
const assertCenter=(expected,message)=>viewCenter().forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-10,message));
const initialCenter=viewCenter();
readingControl('yearMapReading').events.click();flushFrames();
assert.equal(reading.mapReadingMode,true);assert.equal(panel.getAttribute('role'),'dialog');
assert.equal(panel.getAttribute('aria-modal'),'true');assert.equal(body.classList.contains('map-reading-open'),true);
assert.equal(outside.inert,true);assert.equal(bodySibling.inert,true);assert.equal(alreadyInert.inert,true);
assert.equal(document.activeElement,readingControl('yearMapReading'));
assert.equal(readingControl('yearMapLocateText').hidden,false);
assertCenter(initialCenter,'Entering reading mode must retain the map center');
viewport.scrollLeft+=420;viewport.scrollTop+=360;
const pannedCenter=viewCenter();let escapePrevented=false;
document.events.keydown({key:'Escape',preventDefault(){escapePrevented=true;}});flushFrames();
assert.equal(escapePrevented,true);assert.equal(reading.mapReadingMode,false);
assert.equal(panel.getAttribute('role'),undefined);assert.equal(panel.getAttribute('aria-modal'),undefined);
assert.equal(outside.inert,false);assert.equal(bodySibling.inert,false);assert.equal(alreadyInert.inert,true);
assert.equal(document.activeElement,outside);assert.equal(reading.mapReadingInertNodes.size,0);
assert.equal(reading.activeMapKey,selectedKey);assert.equal(reading.mapZoom,4);
assertCenter(pannedCenter,'Esc must preserve the location reached while reading');
readingControl('yearMapReading').events.click();flushFrames();
readingControl('yearMapLocateText').events.click();flushFrames();
assert.equal(reading.mapReadingMode,false);assert.equal(locatedEntity,selectedKey.slice(7),'View body text must exit and navigate to the selected entity');
assert.equal(readingControl('yearMapLocateText').hidden,true);
panel.hidden=true;reading.setMapReadingMode(true);assert.equal(reading.mapReadingMode,false,'A hidden map must not enter reading mode');

console.log('地圖驗證通過：分級去重、崖州／豐州原位文字不畫多餘引線、同名不同實體保留、北朝參考字框不侵入陳境、300%／700%邊界、封國與溢出標注、1000%上限、文字／點／引線持續聯動、讀圖模式與視野保持。');
