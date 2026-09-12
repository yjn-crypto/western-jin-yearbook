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
for(const name of ['labelWidth','labelCandidates','placeAndDrawLabels','mapLabelVisible','restoreMapSelection','selectMapKey','clearMapLinkHighlights','layoutDynamicMapLabels','applyMapZoom','ensureMapLabelVisible']) {
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

console.log('地圖驗證通過：300%／700%邊界、封國與溢出標注、1000%上限、文字／點／引線持續聯動、讀圖模式進出與平移後視野保持、Esc及查看正文。');
