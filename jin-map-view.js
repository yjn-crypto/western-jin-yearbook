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
    if(/county.*area|county.*bound/.test(layer))return 4;
    if(/member.*bound|branch.*bound/.test(layer))return 4;
    if(/province.*bound/.test(layer))return 8;
    return 5;
  }
  function palette(id){
    const colors=['#ba8249','#638f72','#647ea6','#a87699','#928543','#6d999d'];
    let hash=0;for(const c of String(id||''))hash=(hash*31+c.charCodeAt(0))>>>0;
    return colors[hash%colors.length];
  }
  function containsPoint(g,point){
    const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    const inRing=ring=>{let inside=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const [x,y]=ring[i],[px,py]=ring[j];
        if((y>point[1])!==(py>point[1])&&point[0]<(px-x)*(point[1]-y)/(py-y)+x)inside=!inside;
      }
      return inside;
    };
    return polygons.some(rings=>inRing(rings[0])&&!rings.slice(1).some(inRing));
  }
  function prefectureName(name){return String(name||'').replace(/(?:支郡|郡|國|国)$/,'');}
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
  function draw(map,container,{svgNode,seatSymbol,areaGuard,labelAnchors=root.JIN_MAP_LABEL_ANCHORS?.anchors||[]}){
    const [west,south,east,north]=map.extent,[left,top,right,bottom]=map.plot;
    const project=([lon,lat])=>[left+(lon-west)/(east-west)*(right-left),top+(north-lat)/(north-south)*(bottom-top)];
    container.replaceChildren();
    container.appendChild(svgNode('text',{x:left,y:60,fill:'#39352e','font-size':32,'font-weight':'bold'},map.title||`${map.year}年　西晉州郡與封國`));
    container.appendChild(svgNode('text',{x:left,y:99,fill:'#655e50','font-size':17},map.subtitle||(map.year===308?'名義建置與封國關係，非實際控制疆域；多郡王國合併著色，內部郡界淡化。':'多郡王國合併著色；內部郡界淡化。原圖文字位置與CHGIS治所分列。')));
    const labels=[],features=[],controlOverlays=[];
    const pointLabels=map.geojson.features.filter(f=>f.geometry?.type==='Point'&&f.properties?.layer==='labels');
    const countySeats=map.geojson.features.filter(f=>f.properties?.layer==='county_seats');
    const sameSeat=(a,b)=>a.source_id&&b.source_id?String(a.source_id)===String(b.source_id):false;
    const matchesCountySeat=(label,seat)=>sameSeat(label.properties,seat.properties)||
      (!label.properties.source_id&&label.properties.entity_id&&label.properties.entity_id===seat.properties.entity_id&&
       label.geometry.coordinates.every((value,i)=>Math.abs(value-seat.geometry.coordinates[i])<.00001));
    const countyPointLabels=pointLabels.filter(f=>f.properties.level==='county');
    const countyLabelsBySeat=new Map(countySeats.map(seat=>[seat,countyPointLabels.filter(label=>matchesCountySeat(label,seat))]));
    const rangeForPoint=new Map(),prefectureRanges=new Map();
    for(const area of map.geojson.features.filter(f=>f.properties?.layer==='prefecture_areas')){
      const p=area.properties,base=prefectureName(p.base_name||p.name);
      const named=pointLabels.filter(f=>f.properties.level==='prefecture'&&prefectureName(f.properties.name)===base);
      const related=named.length===1?named[0]:null;
      const rp=related?.properties||{},entityId=p.entity_id||rp.entity_id||null;
      const mapKey=entityId?`entity:${entityId}`:`jin:prefecture-area:${base}`;
      const candidates=labelAnchors.filter(anchor=>prefectureName(anchor.name)===base);
      // Original text is preferred only inside this year's matched polygon.
      // A CHGIS seat coordinate remains a seat and is never relabelled as an
      // original image anchor after the annual boundary changes.
      const original=candidates.find(anchor=>containsPoint(area.geometry,anchor.coordinates));
      const point=original?.coordinates||interiorPoint(area.geometry);
      if(!point)continue;
      const record={point,original,related,entityId,mapKey,properties:rp};
      prefectureRanges.set(area,record);if(related)rangeForPoint.set(related,record);
    }
    const explicitPrefBoundaries=map.geojson.features.some(f=>f.properties?.layer==='prefecture_boundaries');
    const explicitStateBoundaries=map.geojson.features.some(f=>f.properties?.layer==='province_boundaries');
    const defs=svgNode('defs'),hatch=svgNode('pattern',{id:`jin-uncertain-${map.year}`,width:8,height:8,patternUnits:'userSpaceOnUse',patternTransform:'rotate(30)'});
    hatch.appendChild(svgNode('line',{x1:0,y1:0,x2:0,y2:8,stroke:'#9b8364','stroke-width':1,'stroke-opacity':.45}));defs.appendChild(hatch);container.appendChild(defs);
    if(map.trial){
      const control=svgNode('pattern',{id:`jin-control-${map.year}`,width:10,height:10,patternUnits:'userSpaceOnUse',patternTransform:'rotate(35)'});
      control.appendChild(svgNode('line',{x1:0,y1:0,x2:0,y2:10,stroke:'#bf723b','stroke-width':2,'stroke-opacity':.65}));defs.appendChild(control);
    }
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
          symbol.appendChild(svgNode('title',{},`${name}：${p.source||'來源未載'}；${map.trial?(p.coordinate_time||'治所參考位置'):role}${p.control_reason?`；${p.control_reason}`:''}`));
          container.appendChild(symbol);
        }
        features.push({entity_id:p.entity_id||null,x,y,level,label:name,mapKey:key,coordinate_role:role,source:p.source});
        const range=rangeForPoint.get(f);
        const seat=level==='county'?(isSeat?f:countySeats.find(item=>matchesCountySeat(f,item))):null;
        const sourceId=seat?.properties.source_id||p.source_id||'';
        // Imported seat rows were hidden for the static paper map, whose label
        // layer only covered fief research. The interactive county tier needs
        // every county seat, with annual rename labels replacing only that seat.
        const showCounty=isSeat&&level==='county'&&!countyLabelsBySeat.get(f)?.length;
        const duplicateImageAnchor=range&&!p.is_seat;
        if(name&&!duplicateImageAnchor&&(p.show_label!==false||showCounty))labels.push({text:name+(p.inferred||(map.trial&&p.time_uncertain)?'※':''),sourceName:p.name||name,x,y,anchorX:x,anchorY:y,level,
          entityId:range?.entityId||p.entity_id||null,mapKey:range?.mapKey||key,mapGroup:range?.mapKey,kind:`${level}-seat`,
          // A county and each nearby fief annotation share text linkage, but
          // are distinct labels even when they use the same CHGIS position.
          labelIdentity:rawLevel!=='fief'&&level==='county'&&sourceId?`jin-county:${sourceId}`:p.fief_id?`jin-fief:${p.fief_id}`:null,
          seatSourceId:rawLevel!=='fief'&&level==='county'?sourceId:null,
          fontSize:rawLevel==='fief'?Number(p.font_size||8.6):level==='state'?22.5:level==='prefecture'?11.5:8.6,
          priority:isText?700:level==='state'?560:level==='prefecture'?500:400,
          fief:Boolean(p.fief_id),color:p.color||(p.fief_id?palette(p.fief_id):null),
          isTextAnchor:isText&&!p.is_seat,smallAnnotation:rawLevel==='fief',
          uncertain:p.mapping_status==='uncertain'||Boolean(p.inferred)||(map.trial&&Boolean(p.time_uncertain))});
        continue;
      }
      const d=paths(g,project);if(!d)continue;
      const polygon=/Polygon/.test(g.type),style={d,fill:'none',stroke:'#6d624d','stroke-width':.9,'fill-rule':'evenodd','vector-effect':'non-scaling-stroke'};
      if(/territory/.test(layer))Object.assign(style,{fill:'#ded3a8',stroke:'#6c6043','stroke-width':1.8});
      else if(/kingdom.*area/.test(layer))Object.assign(style,{fill:p.color||palette(p.fief_id||p.name),'fill-opacity':.62,stroke:'#915c32','stroke-width':2.2,'stroke-dasharray':p.has_inference?'6 3':'none'});
      else if(/member.*bound|branch.*bound/.test(layer))Object.assign(style,{stroke:'#766854','stroke-opacity':.24,'stroke-width':.65});
      else if(/province.*bound|state.*bound/.test(layer))Object.assign(style,{class:'jin-province-boundary',stroke:'#292b32','stroke-width':3.2,'stroke-opacity':1});
      else if(/province.*area|state.*area/.test(layer))Object.assign(style,{class:'jin-province-area',fill:'#e2e5d2',stroke:explicitStateBoundaries?'none':'#292b32','stroke-width':3.2,'stroke-opacity':1});
      else if(/county.*area|county.*bound/.test(layer))Object.assign(style,{class:'jin-county-boundary',fill:'none',stroke:'#a69d89','stroke-width':.65,'stroke-dasharray':'2 2','data-boundary-level':'county'});
      else if(layer==='prefecture_boundaries'&&map.trial)Object.assign(style,{'data-boundary-level':'prefecture'});
      else if(layer==='prefecture_areas'&&explicitPrefBoundaries)style.stroke='none';
      else if(layer==='unresolved_areas')Object.assign(style,{fill:`url(#jin-uncertain-${map.year})`,stroke:'none'});
      else if(/coast|river/.test(layer))Object.assign(style,{stroke:'#829aa6','stroke-width':.7});
      if(map.trial&&p.is_context&&/province.*bound/.test(layer))style['stroke-dasharray']='5 4';
      if(polygon&&!/kingdom|territory|province|state/.test(layer))style['stroke-opacity']=.65;
      const path=svgNode('path',style);
      if(p.entity_id){path.dataset.entityId=p.entity_id;path.dataset.mapKey=key;path.dataset.mapLevel=level;path.setAttribute('tabindex','0');path.setAttribute('role','button');}
      const evidence=Array.isArray(p.notes)?p.notes.join('；'):p.notes||'';
      path.appendChild(svgNode('title',{},`${name}${p.holder?`；${p.holder}`:''}；${p.source||''}${p.book_page?`；原書第${p.book_page}頁`:''}${p.member_role==='branch'?'；王國支郡':''}${p.boundary_evidence?`；${p.boundary_evidence}`:''}${p.explanation?`；${p.explanation}`:''}${p.control_reason?`；${p.control_reason}`:''}${evidence?`；${evidence}`:''}${p.time_uncertain?'；年代待考':''}`));
      container.appendChild(path);
      if(map.trial&&layer==='prefecture_areas'&&['contested','partial','uncertain','nominal'].includes(p.control_status)){
        controlOverlays.push(svgNode('path',{d,fill:`url(#jin-control-${map.year})`,stroke:'none','pointer-events':'none'}));
      }
      if(layer==='province_areas'&&name){
        const point=interiorPoint(g);
        if(point){const [x,y]=project(point);
          labels.push({text:name,sourceName:p.name||name,x,y,level:'state',entityId:p.entity_id||null,mapKey:key,
            kind:'state-area',fontSize:24,priority:1000,isTextAnchor:true,areaGuard:areaGuard?.(d),areaId:p.entity_id||key});
          features.push({entity_id:p.entity_id||null,x,y,level:'state',label:name,mapKey:key,coordinate_role:'derived_area_label_not_seat',source:p.source});
        }
      }
      if(prefectureRanges.has(f)){
        const range=prefectureRanges.get(f),rp=range.properties,[x,y]=project(range.point);
        // Annual labels already encode 郡/国/支郡. Do not invent a suffix
        // for a complete historical title or an unmatched original name.
        const text=rp.display_name||p.display_name||name;
        const inferred=Boolean(rp.inferred)||p.membership_evidence==='inferred'||(map.trial&&Boolean(p.time_uncertain));
        const fiefId=p.fief_id||rp.fief_id;
        labels.push({text:text+(inferred?'※':''),sourceName:p.name||name,x,y,level:'prefecture',entityId:range.entityId,mapKey:range.mapKey,mapGroup:range.mapKey,
          kind:'prefecture-area',fontSize:16.5,priority:900,isTextAnchor:true,areaGuard:areaGuard?.(d),areaId:range.mapKey,allowAreaFontShrink:true,
          labelIdentity:fiefId?`jin-fief:${fiefId}`:null,fief:Boolean(fiefId),color:fiefId?'#493b2a':null,uncertain:inferred,
          coordinateRole:range.original?'image_label_anchor_not_seat':'derived_area_label_not_seat',originalAnchorId:range.original?.id||null});
        features.push({entity_id:range.entityId,x,y,level:'prefecture',label:text,mapKey:range.mapKey,coordinate_role:range.original?'image_label_anchor_not_seat':'derived_area_label_not_seat',source:range.original?'原图已确认郡名文字锚点':p.source});
      }
      if(layer==='prefecture_areas'&&p.membership_evidence==='inferred'){
        const hatchOverlay=svgNode('path',{d,fill:`url(#jin-uncertain-${map.year})`,stroke:'none','pointer-events':'none'});
        if(map.trial)controlOverlays.push(hatchOverlay);else container.appendChild(hatchOverlay);
      }
    }
    for(const overlay of controlOverlays)container.appendChild(overlay);
    container.appendChild(svgNode('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'none',stroke:'#a99b7d','stroke-width':1,'pointer-events':'none'}));
    return {labels,features,project};
  }
  const api={draw,paths,order,interiorPoint,containsPoint};root.JIN_MAP_VIEW=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
