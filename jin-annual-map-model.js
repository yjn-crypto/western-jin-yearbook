/* Hydrate one researched annual slice. Original 289/308 maps remain separate. */
(function(root){
  'use strict';
  const DATA_URL='data/jin-maps/annual-geography.json?v=20261002.1';
  const REFERENCE_URL='data/jin-maps/reference-geography.json?v=20261002.1';
  const PREVIOUS_VIDEO_URLS={289:'data/jin-maps/video-trial-289-308/289.json?v=20261002.2',308:'data/jin-maps/video-trial-289-308/308.json?v=20261002.2'};
  const VIDEO_TRIAL_URLS=Object.fromEntries(Array.from({length:51},(_,i)=>[266+i,`data/jin-maps/video-annual/${266+i}.json?v=20261002.3`]));
  const SOURCE_PRIORITY_URLS=Object.fromEntries(Array.from({length:51},(_,i)=>[266+i,`data/jin-maps/source-priority-annual/${266+i}.json?v=20261002.4`]));
  const THREE_BASEMAP_URLS=Object.fromEntries(Array.from({length:51},(_,i)=>[266+i,`data/jin-maps/three-basemap-annual/${266+i}.json?v=20261007.1`]));
  const VIDEO_LAND_URL='data/jin-maps/jin-video-land.geojson?v=20261002.2';
  async function readMapData(url,fetcher=fetch){
    if(/^data\/jin-maps\/three-basemap-annual\/.*\.json\.gz(?:\?|$)/.test(url)){
      const response=await fetcher(url);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bytes=new Uint8Array(await response.arrayBuffer());
      // Hosts may serve the archive directly or apply Content-Encoding first.
      if(bytes[0]!==0x1f||bytes[1]!==0x8b)return JSON.parse(new TextDecoder().decode(bytes));
      if(typeof DecompressionStream!=='function')throw new Error('此瀏覽器不支援大圖解壓，請更新瀏覽器後重試。');
      return await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))).json();
    }
    if(/^data\/jin-maps\/(?:video-annual|source-priority-annual|three-basemap-annual)\//.test(url)&&typeof DecompressionStream==='function'){
      const compressed=url.replace(/\.json(?=\?|$)/,'.json.gz');
      try{
        const response=await fetcher(compressed);
        if(response.ok&&response.body)return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
      }catch(error){/* A plain JSON sibling remains available as a fallback. */}
    }
    const response=await fetcher(url);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  function hydrateVideoTrial(bundle,year,land,{annualVideo=false,sourcePriority=false}={}){
    if(Number(bundle?.year)!==Number(year)||!Array.isArray(bundle.features))throw new Error(`Missing video trial: ${year}`);
    sourcePriority=Boolean(sourcePriority||bundle.presentation?.source_priority);
    const fiefColors=annualVideo?(sourcePriority?root.JIN_FIEF_COLORS?.colors:root.JIN_PREVIOUS_FIEF_COLORS?.colors||root.JIN_FIEF_COLORS?.colors):null;
    const features=bundle.features.map(feature=>{
      const geometry=feature.geometry||bundle.geometries?.[feature.geometry_id];
      if(!geometry)throw new Error(`Missing video geometry: ${feature.geometry_id}`);
      const properties={...feature.properties};
      const color=fiefColors?.[properties.fief_id];
      if(color)properties.color=color;
      return {type:'Feature',geometry,properties};
    });
    if(!sourcePriority)for(const feature of land?.features||[])features.unshift({...feature,properties:{...feature.properties,layer:'land_background',name:'地理陆地背景',political_evidence:false}});
    const geojson={type:'FeatureCollection',features};
    const source=root.JIN_VIDEO_FRAMES?.frames?.find(frame=>Number(frame.year)===Number(year));
    const count=layer=>features.filter(f=>f.properties?.layer===layer).length;
    const contextCount=features.filter(f=>f.properties.layer==='province_areas'&&f.properties.is_context).length;
    const prefectureCount=features.filter(f=>f.properties.layer==='prefecture_areas'&&!f.properties.is_context).length;
    const unresolvedContextCount=features.filter(f=>f.properties.layer==='prefecture_areas'&&f.properties.is_context).length;
    const presentation=bundle.presentation||{};
    const sourceNote=source?`本年參考原幀：${source.source_part}，${Number(source.timestamp_seconds).toFixed(3)}秒。`:'';
    return {year:Number(year),trial:true,videoTrial:true,annualVideo,sourcePriority,fiefColors,
      width:presentation.width||2400,height:presentation.height||1986,
      extent:presentation.extent||(sourcePriority?[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462]:[85,15,137,50]),
      plot:presentation.plot||[80,140,2320,1906],
      title:sourcePriority?`${year}年　西晉州郡與封國`:`${year}年　西晉州郡封國 · 視頻年末疆域測驗`,
      subtitle:sourcePriority?'CHGIS治所與原圖州郡面接合；按本年郡屬調整，接壤封國異色。':annualVideo?'上輪全年度圖：原州界為基礎，政權界採年末視頻，接壤封國異色。':'上輪兩年測驗：政權界採年末視頻；補齊界線含推定段。',
      note:sourcePriority?`CHGIS同年有效點優先，保留原坐標；原上传圖片矢量化的疆域、海岸線、州郡面為空間基礎，州郡年度變動依年表實際統属沿完整郡界調整。史圖館年末原幀只補充统一前孫吳及末期成漢、漢趙、叛亂等明顯控制變化，不替換原圖外緣或海岸線。展示範圍限於原圖漢晉天下，範圍内其他政權以白色保留名稱與分界。晉境補齊範圍含推定段，郡級及以上封國合併著色且接壤異色，制度範圍不等同封君軍事實控。縣域只在內部擬合郡界，不顯示縣面、縣界；縣名和治所隨縮放顯示。修改前各版本可雙向切換。${sourceNote}`:`史圖館視頻年末原幀配准至WGS84，政權邊界與年表行政層分列。${annualVideo?'州界以原圖穩定州域為基礎，年度改屬沿郡面調整；州際共邊單独繪製，不把補洞碎片外圈畫成州界。':''}晉境內原有漏色區按當年縣屬、原圖郡屬及同州鄰郡補齊；缺少直接依據的分界為拟合，不代表史料已考定。白色表示其它政權，淡赭色表示原圖另列的晉西域附屬範圍；郡級及以上封國保持合併著色${annualVideo?'，接壤封國顏色不同':''}，制度範圍不等同封君軍事实控。縣域單元只用於內部擬合，不顯示縣面或縣界。可在上方選擇上輪年度圖或最初原版比較。${sourceNote}`,
      status:`${year}年：${count('province_areas')-contextCount}州${contextCount?`及${contextCount}組原州地理參考`:''}、${prefectureCount}郡國範圍、${count('county_seats')}縣治${unresolvedContextCount?`；另有${unresolvedContextCount}處晉地郡屬待定`:''}；${sourcePriority?'原圖疆域與海岸線，CHGIS點優先，視頻僅補充域內控制變化':'政權界採本年視頻'}，新增分界保留推定說明。`,
      coverage:bundle.coverage||{},geojson};
  }
  function hydrate(bundle,year,slice,referenceBundle){
    const entry=bundle?.years?.[String(year)];
    if(!entry||!slice||!Array.isArray(slice.features))throw new Error(`Missing annual Jin slice: ${year}`);
    const features=slice.features.map(feature=>{
      const geometry=feature.geometry||bundle.geometries?.[feature.geometry_id];
      if(!geometry)throw new Error(`Missing geometry: ${feature.geometry_id}`);
      return {type:'Feature',geometry,properties:{...feature.properties}};
    });
    const referenceEntry=referenceBundle?.years?.[String(year)];
    for(const id of referenceEntry?.feature_ids||[]){
      const feature=referenceBundle.features?.[id];
      const geometry=feature?.geometry||referenceBundle.geometries?.[feature?.geometry_id];
      if(!geometry)throw new Error(`Missing neutral reference geometry: ${id}`);
      features.push({type:'Feature',geometry,properties:{...feature.properties,year:Number(year),is_reference:true,entity_id:null}});
    }
    const coverage=slice.coverage||entry.coverage||{};
    const meta=bundle.meta||{};
    const count=layer=>features.filter(f=>f.properties.layer===layer).length;
    const contextCount=features.filter(f=>f.properties.layer==='province_areas'&&f.properties.is_context).length;
    const stateCount=count('province_areas')-contextCount;
    const referenceCount=count('reference_prefecture_areas');
    const notes=coverage.control_messages||slice.notes||[];
    const controlNote=Array.isArray(notes)?notes.map(n=>String(n).replace(/[。；]+$/,'')).join('；'):String(notes||'').replace(/[。；]+$/,'');
    const statusNames={partial:'局部控制',contested:'爭奪待考',nominal:'名義建置',uncertain:'控制待考'};
    const controlCounts=Object.entries(coverage.control_summary||{}).filter(([status,value])=>statusNames[status]&&value>0).map(([status,value])=>`${statusNames[status]}${value}郡`).join('、');
    return {
      year:Number(year),trial:true,title:`${year}年　西晉疆域、州郡縣與封國 · 年度試驗圖`,
      width:meta.width||2400,height:meta.height||1986,
      extent:meta.extent||[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462],
      plot:meta.plot||[80,140,2320,1906],coverage,
      subtitle:'按年末建置與失陷記錄復原；失地及未銜接區保留無色政區參考，縣域不展示。',
      note:`年度政區依年表沿革與本機《中國行政區劃通史》，失陷當年另按史料校正。同年CHGIS治所、郡面優先；缺面者以原圖郡面和縣治約束擬合，郡、州按當年所屬縣合併。縣域擬合只在內部生成郡界，不展示縣面或縣界；未定位政區不補造。無色州郡及縣治沿用289/308原圖地理參考，失陷或已撤銷單位不計入本年西晉建置，參考年代另見圖層提示。${controlNote?controlNote+'。':''}多郡王國按授封與改封期段合併著色，推定成員保留斜線；封國制度範圍不等同封君實際控制。`,
      status:`${year}年：${stateCount}州${contextCount?`及${contextCount}組原州殘存郡縣`:''}、${count('prefecture_areas')}郡國範圍、${count('county_seats')}縣治${coverage.counties_unlocated!=null?`，${coverage.counties_unlocated}縣未定位`:''}。${referenceCount?`另保留${referenceCount}處無色郡域參考。`:''}${controlCounts?controlCounts+'（橙色斜線）。':''}${controlNote?controlNote+'。':''}`,
      geojson:{type:'FeatureCollection',features}
    };
  }
  function hydrateThreeBasemap(bundle,year){
    if(Number(bundle?.year)!==Number(year)||!Array.isArray(bundle.features))throw new Error(`Missing three-basemap slice: ${year}`);
    const connectivity=root.JIN_LOCAL_CONNECTIVITY,localPatch=connectivity.years[String(year)];
    const review=root.JIN_289_FIEF_MAP_REVIEW,reviewPatch=review.years[String(year)];
    const connectedFeatures=localPatch?[...bundle.features.filter(feature=>!localPatch.remove.includes(feature.geometry_id)),...localPatch.add]:bundle.features;
    const reviewKey=feature=>`${feature.properties.layer}:${feature.geometry_id}`;
    const annualFeatures=reviewPatch?[...connectedFeatures.filter(feature=>!reviewPatch.remove.includes(reviewKey(feature))),...reviewPatch.add]:connectedFeatures;
    const abolished=root.JIN_FIEF_ABOLITIONS.records.filter(record=>record.begin<=year&&year<=record.end);
    const abolishedFiefIds=new Set(abolished.flatMap(record=>record.fief_ids));
    const restoredPrefectures=new Map(abolished.flatMap(record=>[
      ...record.entity_ids.map(id=>[id,{name:record.name,source:record.source_note}]),
      ...Object.entries(record.branch_entity_ids).map(([id,name])=>[id,{name,source:record.source_note}])
    ]));
    const restoredReferenceSeats=new Map(abolished.flatMap(record=>record.reference_source_ids.map(id=>[id,{name:record.name,source:record.source_note}])));
    const restoredReferenceAreas=new Map(abolished.flatMap(record=>record.reference_area_ids.map(id=>[id,{name:record.name,source:record.source_note}])));
    // The separately recorded local connectors replace only their exact source
    // geometry IDs; fief metadata changes reuse all other saved annual geometry.
    const features=annualFeatures.filter(feature=>!(feature.properties.layer==='kingdom_areas'&&abolishedFiefIds.has(feature.properties.fief_id))).map(feature=>{
      const geometryId=reviewPatch?.replace[reviewKey(feature)]||localPatch?.replace[feature.geometry_id]||feature.geometry_id;
      const geometry=feature.geometry||review.geometries[geometryId]||connectivity.geometries[geometryId]||bundle.geometries?.[geometryId];
      if(!geometry)throw new Error(`Missing annual geometry: ${feature.geometry_id}`);
      const properties={...feature.properties};
      if(properties.entity_id==='p166'&&localPatch?.replace[feature.geometry_id]&&properties.boundary_note){
        properties.source_boundary_note=properties.boundary_note;
        properties.boundary_note=localPatch.note;
      }
      const restored=restoredPrefectures.get(properties.entity_id);
      if(restored&&properties.level==='prefecture'){
        properties.name=restored.name;
        properties.display_name=restored.name;
        properties.fief_abolition_note=restored.source;
        for(const key of ['fief_id','member_role','membership_evidence','color'])delete properties[key];
      }
      const reference=properties.is_reference&&(restoredReferenceSeats.get(properties.source_id)||restoredReferenceAreas.get(properties.id));
      if(reference){
        properties.display_name=reference.name;
        properties.fief_abolition_note=reference.source;
      }
      if(properties.adjacent_fief_ids?.some(id=>abolishedFiefIds.has(id))){
        const [left,right]=properties.adjacent_fief_ids.map(id=>abolishedFiefIds.has(id)?null:id);
        properties.adjacent_fief_ids=[left,right];
        properties.between_fiefs=left!==right&&Boolean(left||right);
        properties.within_same_fief=Boolean(left&&left===right);
      }
      return {type:'Feature',geometry,properties};
    });
    for(const seat of features.filter(feature=>feature.properties.layer==='county_seats')){
      const p=seat.properties,base=String(p.name).replace(/[縣县國国]$/,'');
      const addTitle=(id,text,source,inferred)=>features.push({type:'Feature',geometry:seat.geometry,properties:{
        layer:'labels',level:'fief',display_level:'county',label_type:'county_fief',entity_id:p.entity_id,
        source_entity_id:p.entity_id,prefecture_id:p.prefecture_id,state_id:p.state_id,year:Number(year),
        name:text,display_name:text,fief_id:id,show_label:true,color:'#493b2a',font_size:8.6,
        coordinate_role:'title_annotation_not_seat',source,inferred}});
      for(const fief of root.JIN_FIVE_RANK_FIEFS.records.filter(record=>record.level==='county')){
        const period=fief.target_periods.find(period=>period.target_id===p.entity_id&&period.start<=year&&year<=period.end);
        if(!period)continue;
        const resolved=root.JIN_KINGDOM_TABLE.fiveRankAt(fief,year),holder=resolved.record;
        const inferred=Boolean(holder&&(period.uncertain||holder.display_inferred));
        addTitle(fief.id,`${fief.fief}${fief.rank}${holder?'·'+holder.person:''}${inferred?'（推定）':''}`,fief.source_page_title,inferred);
      }
      const ruler=root.JIN_KINGDOM_TABLE.rulerAt(root.JIN_PRINCES.records,base,Number(year),'county');
      if(ruler.all.length){
        const holder=ruler.record,inferred=Boolean(holder?.display_inferred);
        addTitle('county-prince-'+base,`${base}王${holder?'·'+holder.person:''}${inferred?'（推定）':''}`,'晉朝藩王列表；本輪縣王時段約束',inferred);
      }
    }
    const presentation=bundle.presentation||{};
    const map={year:Number(year),trial:true,sourcePriority:true,
      width:presentation.width||2400,height:presentation.height||1986,
      extent:presentation.extent||[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462],
      plot:presentation.plot||[80,140,2320,1906],coverage:bundle.coverage||{},geojson:{type:'FeatureCollection',features}};
    const fiefColors={...(bundle.fief_colors||presentation.fief_colors||{})};
    for(const id of abolishedFiefIds)delete fiefColors[id];
    for(const feature of map.geojson.features){
      const p=feature.properties;
      if(p.fief_id&&p.color&&!fiefColors[p.fief_id])fiefColors[p.fief_id]=p.color;
    }
    const referenceFiefs=root.JIN_MAP_REFERENCE_FIEFS.records.filter(record=>record.begin<=year&&year<=record.end);
    const referenceMembership=new Map();
    let referenceFiefCount=0;
    for(const record of referenceFiefs){
      for(const seat of features.filter(feature=>feature.properties.is_reference&&record.reference_source_ids.includes(feature.properties.source_id))){
        seat.properties.display_name=record.name;
        seat.properties.fief_reference_note=record.source_note;
      }
      for(const area of features.filter(feature=>feature.properties.layer==='reference_prefecture_areas'&&record.reference_area_ids.includes(feature.properties.id))){
        const p=area.properties,color=fiefColors[record.fief_id];
        p.display_name=record.name;
        p.fief_id=record.fief_id;
        p.fief_reference_note=record.source_note;
        p.source_reference_reason=p.reference_reason;
        p.reference_reason=`底圖行政參考範圍；封國性質另依封爵資料保留，不表示本年西晉實際控制。${record.source_note}`;
        referenceMembership.set(p.id.replace('unassigned-reference-',''),record.fief_id);
        features.push({type:'Feature',geometry:area.geometry,properties:{
          layer:'kingdom_areas',level:'fief',year:Number(year),entity_id:null,
          name:record.name,display_name:record.name,fief_id:record.fief_id,color,
          member_entity_ids:[],member_reference_ids:[p.id],is_multi:false,has_inference:record.inferred,
          institutional_reference:true,actual_control_claim:false,source:record.source_note,
          geometry_status:'existing_atlas_reference_fief_overlay',geometry_source_id:p.id}});
        referenceFiefCount++;
      }
    }
    for(const feature of features){
      const p=feature.properties;
      if(!p.adjacent_entity_ids?.some(id=>referenceMembership.has(id)))continue;
      const [left,right]=p.adjacent_entity_ids.map((id,index)=>referenceMembership.get(id)||p.adjacent_fief_ids[index]);
      p.adjacent_fief_ids=[left,right];
      p.between_fiefs=left!==right&&Boolean(left||right);
      p.within_same_fief=Boolean(left&&left===right);
    }
    if(reviewPatch){
      // This final pass restores the reviewed 289-era titles after the older
      // abolition/reference overlays, using their unchanged county coordinates.
      for(let i=features.length-1;i>=0;i--)if(features[i].properties.layer==='kingdom_areas'
        &&reviewPatch.remove_fiefs.includes(features[i].properties.fief_id))features.splice(i,1);
      for(const feature of features){
        const p=feature.properties;
        const metadata=reviewPatch.entities[p.entity_id]||reviewPatch.references[p.id];
        if(metadata&&p.level==='prefecture')Object.assign(p,metadata);
        if(p.layer==='reference_prefecture_seats'&&reviewPatch.reference_seats[p.source_id])
          Object.assign(p,reviewPatch.reference_seats[p.source_id]);
        const county=reviewPatch.county_reassignments[p.entity_id];
        if(county&&p.level==='county')Object.assign(p,county);
        const seatCounty=reviewPatch.county_reassignments[p.seat_county_id];
        if(seatCounty){p.prefecture_id=seatCounty.prefecture_id;p.seat_county_key=seatCounty.county_key;}
        if(p.adjacent_entity_ids){
          const [left,right]=p.adjacent_entity_ids.map((id,index)=>id in reviewPatch.boundary_fiefs
            ?reviewPatch.boundary_fiefs[id]:p.adjacent_fief_ids[index]);
          p.adjacent_fief_ids=[left,right];
          p.between_fiefs=left!==right&&Boolean(left||right);
          p.within_same_fief=Boolean(left&&left===right);
        }
        if(p.fief_id&&reviewPatch.colors[p.fief_id])p.color=reviewPatch.colors[p.fief_id];
      }
      for(const feature of reviewPatch.add_fiefs)features.push({type:'Feature',
        geometry:review.geometries[feature.geometry_id],properties:{...feature.properties}});
      for(const id of reviewPatch.remove_fiefs)delete fiefColors[id];
      Object.assign(fiefColors,reviewPatch.colors);
    }
    const count=layer=>map.geojson.features.filter(f=>f.properties.layer===layer).length;
    const sourceNote=presentation.note?.replace(/ 本年表內但未能單獨繪界：.*?具體缺據見年度coverage記錄。/,'')||'谭圖262、281與CHGIS同級採用；約308圖補晚期局部邊界。政區與支郡依本年文字，改名、整郡改州沿用已有郡界；析置及轉縣局部擬合並註明來源。政權邊界只採三底圖；末期缺少明確控制界線之處保留底圖政區參考，不表示仍屬西晉實際控制。縣面與縣界不展示；州郡大圖使用同一年度的完整矢量邊線。';
    const note=localPatch?sourceNote.replace(/ ?新野內圈為仍屬義陽的朝陽縣推定轄區，並非重複郡界。/,'')+' '+localPatch.note:sourceNote;
    const abolitionNote=abolished.length?' 有明確廢國或末任改封且無續封依據者，自變更當年恢復郡名，取消封國及支郡著色；無其他依據時仍沿用《通史》郡國名稱。':'';
    const referenceFiefNote=referenceFiefCount?' 文字依當年實際控制取捨，地圖底圖行政參考範圍另行處理；封國沿維基王表及後續Word既定起訖，明確承襲者在其有效爵期內繼承原多郡封土，不因文字缺郡或未見國絕而自行補年。著色不表示本年西晉實控。':'';
    return {...map,threeBasemap:true,fiefColors,
      title:presentation.title||`${year}年　西晉州郡與封國`,
      subtitle:presentation.subtitle||'據262、281及約308年圖按改置事件取界；CHGIS保留治所。',
      note:note+abolitionNote+referenceFiefNote+(reviewPatch?' '+reviewPatch.note:''),
      status:presentation.status||`${year}年：${count('prefecture_areas')}處郡國範圍、${count('county_seats')}處縣治；邊界逐段保留底圖年代與擬合說明。`
    };
  }
  const api={DATA_URL,REFERENCE_URL,SOURCE_PRIORITY_URLS,THREE_BASEMAP_URLS,VIDEO_TRIAL_URLS,PREVIOUS_VIDEO_URLS,VIDEO_LAND_URL,readMapData,hydrateVideoTrial,hydrateThreeBasemap,hydrate};root.JIN_ANNUAL_MAP_MODEL=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
