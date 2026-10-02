/* Export the production Jin renderer and label layout for the requested comparison. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),view=require('../jin-map-view.js');
class Node{
  constructor(tag,attrs={},text=''){this.tagName=tag;this.attributes={...attrs};this.textContent=text;this.children=[];this.dataset={};this.style={};}
  setAttribute(k,v){this.attributes[k]=v;}
  appendChild(n){this.children.push(n);return n;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...n){this.children=n;}
  insertBefore(n,b){const i=this.children.indexOf(b);this.children.splice(i<0?0:i,0,n);}
  addEventListener(){}
  querySelectorAll(){return [];}
}
const svgNode=(...a)=>new Node(...a),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const context=vm.createContext({svgNode,mapZoom:3,yearMapOverlay:new Node('svg')});
for(const name of ['normalizeName','mapLabelVisible','selectMapLabels','labelWidth','mapTerritoryLabelGuard','labelCandidates','placeAndDrawLabels','mapSeatSymbol']){
  const marker=`  function ${name==='labelCandidates'?'*':''}${name}(`,start=app.indexOf(marker),end=app.indexOf('\n  }',start)+5;
  if(start<0||end<=start)throw Error('Cannot read production function '+name);
  vm.runInContext(app.slice(start,end),context);
}
const [file,destination,...options]=process.argv.slice(2);
if(!file||!destination)throw Error('Usage: node render-jin-comparison-map.cjs map.json destination.svg [west south east north]');
let map=JSON.parse(fs.readFileSync(file));
if(map.type==='FeatureCollection')map={year:map.year,trial:true,width:2400,height:1986,extent:map.meta?.extent||[92.76949,15.25765,128.42883,43.37634],plot:[80,140,2320,1906],geojson:map,
  title:`${map.year}年　史圖館年末疆域與州郡封國測驗`,subtitle:'政權界取自年末視頻；晋境內缺口按當年郡屬補齊，分界仍含擬合段。'};
if(options.length===4)map.extent=options.map(Number);
const canvas=new Node('svg',{xmlns:'http://www.w3.org/2000/svg',width:map.width,height:map.height,viewBox:`0 0 ${map.width} ${map.height}`});
const shapes=new Node('g');canvas.appendChild(new Node('rect',{width:'100%',height:'100%',fill:map.videoTrial&&!map.sourcePriority?'#dce9f4':'#f7f3ea'}));canvas.appendChild(shapes);
const rendered=view.draw(map,shapes,{svgNode,seatSymbol:context.mapSeatSymbol,areaGuard:context.mapTerritoryLabelGuard});
const labelLayer=new Node('g');canvas.appendChild(labelLayer);
context.placeAndDrawLabels(labelLayer,context.selectMapLabels(rendered.labels,3),map.plot,1,map.height);
const escape=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const cssName=k=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
function xml(n){
  const attrs={...n.attributes};for(const [k,v]of Object.entries(n.dataset))attrs['data-'+cssName(k)]=v;
  const styles=Object.entries(n.style).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`${cssName(k)}:${v}`).join(';');if(styles)attrs.style=styles;
  return `<${n.tagName}${Object.entries(attrs).map(([k,v])=>` ${k}="${escape(v)}"`).join('')}>${escape(n.textContent||'')}${n.children.map(xml).join('')}</${n.tagName}>`;
}
const styles=new Node('style',{},'text{font-family:"Songti SC","Noto Serif CJK SC",serif}.dynamic-map-label{paint-order:stroke;stroke:#fffdf8;stroke-width:2;stroke-linejoin:round;dominant-baseline:central;fill:#34312d}.dynamic-state-area-label{font-weight:700}.dynamic-prefecture-area-label{font-weight:700}.is-uncertain{font-style:italic}.dynamic-county-symbol{display:none}');
canvas.children.unshift(styles);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,xml(canvas));
console.log(JSON.stringify({year:map.year,destination,labels:rendered.labels.length,features:map.geojson.features.length}));
