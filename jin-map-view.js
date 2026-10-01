/* The Jin renderer consumes EPSG:4326 GeoJSON; coordinates of text anchors are
 * never converted into seat symbols. Reviewed area unions are built offline. */
(function(root){
  'use strict';
  function paths(g,project){
    if(!g)return '';
    const line=(coords,closed=false)=>coords.map((c,i)=>`${i?'L':'M'}${project(c).map(v=>v.toFixed(2)).join(',')}`).join('')+(closed?'Z':'');
    if(g.type==='Polygon')return g.coordinates.map(r=>line(r,true)).join('');
    if(g.type==='MultiPolygon')return g.coordinates.flatMap(p=>p.map(r=>line(r,true))).join('');
    if(g.type==='LineString')return line(g.coordinates);
    if(g.type==='MultiLineString')return g.coordinates.map(r=>line(r)).join('');
    if(g.type==='GeometryCollection')return g.geometries.map(x=>paths(x,project)).join('');
    return '';
  }
  function order(layer){
    if(/territory/.test(layer))return 0;
    if(/province.*area/.test(layer))return 1;
    if(/prefecture.*area/.test(layer))return 2;
    if(/kingdom.*area/.test(layer))return 3;
    if(/member.*bound|branch.*bound/.test(layer))return 4;
    if(/province.*bound/.test(layer))return 8;
    return 5;
  }
  function palette(id){
    const colors=['#ba8249','#638f72','#647ea6','#a87699','#928543','#6d999d'];
    let hash=0;for(const c of String(id||''))hash=(hash*31+c.charCodeAt(0))>>>0;
    return colors[hash%colors.length];
  }
  function interiorPoint(g){
    const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    const area=ring=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0));
    const rings=[...polygons].sort((a,b)=>area(b[0])-area(a[0]))[0];if(!rings?.length)return null;
    const ys=rings[0].map(p=>p[1]),south=Math.min(...ys),north=Math.max(...ys);let best=null;
    for(let j=1;j<20;j++){
      const y=south+(north-south)*j/20,xs=[];
      for(const ring of rings)for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      xs.sort((a,b)=>a-b);
      for(let i=0;i+1<xs.length;i+=2){
        const score=(xs[i+1]-xs[i])*(1-.35*Math.abs(j-10)/10);
        if(!best||score>best.score)best={point:[(xs[i]+xs[i+1])/2,y],score};
      }
    }
    return best?.point||null;
  }
  function draw(map,container,{svgNode,seatSymbol,areaGuard}){
    const [west,south,east,north]=map.extent,[left,top,right,bottom]=map.plot;
    const project=([lon,lat])=>[left+(lon-west)/(east-west)*(right-left),top+(north-lat)/(north-south)*(bottom-top)];
    container.replaceChildren();
    container.appendChild(svgNode('text',{x:left,y:60,fill:'#39352e','font-size':32,'font-weight':'bold'},map.title||`${map.year}年　西晉州郡與封國`));
    container.appendChild(svgNode('text',{x:left,y:99,fill:'#655e50','font-size':17},map.year===308?'名義建置與封國關係，非實際控制疆域；多郡王國合併著色，內部郡界淡化。':'多郡王國合併著色；內部郡界淡化。原圖文字位置與CHGIS治所分列。'));
    const labels=[],features=[];
    const explicitPrefBoundaries=map.geojson.features.some(f=>f.properties?.layer==='prefecture_boundaries');
    const explicitStateBoundaries=map.geojson.features.some(f=>f.properties?.layer==='province_boundaries');
    const defs=svgNode('defs'),hatch=svgNode('pattern',{id:`jin-uncertain-${map.year}`,width:8,height:8,patternUnits:'userSpaceOnUse',patternTransform:'rotate(30)'});
    hatch.appendChild(svgNode('line',{x1:0,y1:0,x2:0,y2:8,stroke:'#9b8364','stroke-width':1,'stroke-opacity':.45}));defs.appendChild(hatch);container.appendChild(defs);
    for(const f of [...map.geojson.features].sort((a,b)=>order(a.properties?.layer||'')-order(b.properties?.layer||''))){
      const p=f.properties||{},g=f.geometry;if(!g)continue;
      const layer=p.layer||'',rawLevel=p.level||(/province|state/.test(layer)?'state':/county/.test(layer)?'county':'prefecture');
      const level=rawLevel==='fief'?(p.display_level||(/^p/.test(p.entity_id||'')?'prefecture':'county')):rawLevel;
      const name=p.display_name||p.name||'',key=p.entity_id?`entity:${p.entity_id}`:`jin:${layer}:${p.id||features.length}`;
      if(g.type==='Point'){
        const [x,y]=project(g.coordinates),role=String(p.coordinate_role||'');
        const isText=/label|text|anchor|文字/.test(role)||/label/.test(layer);
        const isSeat=!isText&&/seat|治所|county_seats|prefecture_seats|state_seats/.test(role+' '+layer);
        // Unclassified points can label geography but must not masquerade as seats.
        if(isSeat){
          const symbol=seatSymbol(x,y,level,p.fief_id?palette(p.fief_id):null);
          symbol.appendChild(svgNode('title',{},`${name}：${p.source||'來源未載'}；${role}`));
          container.appendChild(symbol);
        }
        features.push({entity_id:p.entity_id||null,x,y,level,label:name,mapKey:key,coordinate_role:role,source:p.source});
        if(name&&p.show_label!==false)labels.push({text:name+(p.inferred?'※':''),sourceName:p.name||name,x,y,anchorX:x,anchorY:y,level,
          entityId:p.entity_id||null,mapKey:key,kind:`${level}-seat`,
          // A county and each nearby fief annotation share text linkage, but
          // are distinct labels even when they use the same CHGIS position.
          labelIdentity:p.fief_id?`jin-fief:${p.fief_id}`:null,
          fontSize:rawLevel==='fief'?Number(p.font_size||8.6):level==='state'?22.5:level==='prefecture'?11.5:8.6,
          priority:isText?700:level==='state'?560:level==='prefecture'?500:400,
          fief:Boolean(p.fief_id),color:p.color||(p.fief_id?palette(p.fief_id):null),
          isTextAnchor:isText&&!p.is_seat,smallAnnotation:rawLevel==='fief',
          uncertain:p.mapping_status==='uncertain'||Boolean(p.inferred)});
        continue;
      }
      const d=paths(g,project);if(!d)continue;
      const polygon=/Polygon/.test(g.type),style={d,fill:'none',stroke:'#6d624d','stroke-width':.9,'fill-rule':'evenodd','vector-effect':'non-scaling-stroke'};
      if(/territory/.test(layer))Object.assign(style,{fill:'#ded3a8',stroke:'#6c6043','stroke-width':1.8});
      else if(/kingdom.*area/.test(layer))Object.assign(style,{fill:p.color||palette(p.fief_id||p.name),'fill-opacity':.62,stroke:'#915c32','stroke-width':2.2,'stroke-dasharray':p.has_inference?'6 3':'none'});
      else if(/member.*bound|branch.*bound/.test(layer))Object.assign(style,{stroke:'#766854','stroke-opacity':.24,'stroke-width':.65});
      else if(/province.*bound|state.*bound/.test(layer))Object.assign(style,{stroke:'#4f493f','stroke-width':1.7});
      else if(/province.*area|state.*area/.test(layer))Object.assign(style,{fill:'#e2e5d2',stroke:explicitStateBoundaries?'none':'#4f493f','stroke-width':1.7});
      else if(layer==='prefecture_areas'&&explicitPrefBoundaries)style.stroke='none';
      else if(layer==='unresolved_areas')Object.assign(style,{fill:`url(#jin-uncertain-${map.year})`,stroke:'none'});
      else if(/coast|river/.test(layer))Object.assign(style,{stroke:'#829aa6','stroke-width':.7});
      if(polygon&&!/kingdom|territory/.test(layer))style['stroke-opacity']=.65;
      const path=svgNode('path',style);
      if(p.entity_id){path.dataset.entityId=p.entity_id;path.dataset.mapKey=key;path.dataset.mapLevel=level;path.setAttribute('tabindex','0');path.setAttribute('role','button');}
      path.appendChild(svgNode('title',{},`${name}；${p.source||''}${p.member_role==='branch'?'；王國支郡':''}`));
      container.appendChild(path);
      if(layer==='province_areas'&&name){
        const point=interiorPoint(g);
        if(point){const [x,y]=project(point);
          labels.push({text:name,sourceName:p.name||name,x,y,level:'state',entityId:p.entity_id||null,mapKey:key,
            kind:'state-area',fontSize:24,priority:1000,isTextAnchor:true,areaGuard:areaGuard?.(d),areaId:p.entity_id||key});
          features.push({entity_id:p.entity_id||null,x,y,level:'state',label:name,mapKey:key,coordinate_role:'derived_area_label_not_seat',source:p.source});
        }
      }
      if(layer==='prefecture_areas'&&p.membership_evidence==='inferred'){
        container.appendChild(svgNode('path',{d,fill:`url(#jin-uncertain-${map.year})`,stroke:'none','pointer-events':'none'}));
      }
    }
    container.appendChild(svgNode('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'none',stroke:'#a99b7d','stroke-width':1,'pointer-events':'none'}));
    return {labels,features,project};
  }
  const api={draw,paths,order,interiorPoint};root.JIN_MAP_VIEW=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
