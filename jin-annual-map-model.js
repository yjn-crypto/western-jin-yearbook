/* Hydrate one researched annual slice. Original 289/308 maps remain separate. */
(function(root){
  'use strict';
  const DATA_URL='data/jin-maps/annual-geography.json?v=20261002.1';
  const REFERENCE_URL='data/jin-maps/reference-geography.json?v=20261002.1';
  const PREVIOUS_VIDEO_URLS={289:'data/jin-maps/video-trial-289-308/289.json?v=20261002.2',308:'data/jin-maps/video-trial-289-308/308.json?v=20261002.2'};
  const VIDEO_TRIAL_URLS=Object.fromEntries(Array.from({length:51},(_,i)=>[266+i,`data/jin-maps/video-annual/${266+i}.json?v=20261002.3`]));
  const VIDEO_LAND_URL='data/jin-maps/jin-video-land.geojson?v=20261002.2';
  async function readMapData(url,fetcher=fetch){
    if(url.startsWith('data/jin-maps/video-annual/')&&typeof DecompressionStream==='function'){
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
  function hydrateVideoTrial(bundle,year,land,{annualVideo=false}={}){
    if(Number(bundle?.year)!==Number(year)||!Array.isArray(bundle.features))throw new Error(`Missing video trial: ${year}`);
    const features=bundle.features.map(feature=>{
      const geometry=feature.geometry||bundle.geometries?.[feature.geometry_id];
      if(!geometry)throw new Error(`Missing video geometry: ${feature.geometry_id}`);
      const properties={...feature.properties};
      const color=annualVideo&&root.JIN_FIEF_COLORS?.colors?.[properties.fief_id];
      if(color)properties.color=color;
      return {type:'Feature',geometry,properties};
    });
    for(const feature of land?.features||[])features.unshift({...feature,properties:{...feature.properties,layer:'land_background',name:'地理陆地背景',political_evidence:false}});
    const geojson={type:'FeatureCollection',features};
    const source=root.JIN_VIDEO_FRAMES?.frames?.find(frame=>Number(frame.year)===Number(year));
    const count=layer=>features.filter(f=>f.properties?.layer===layer).length;
    const contextCount=features.filter(f=>f.properties.layer==='province_areas'&&f.properties.is_context).length;
    const prefectureCount=features.filter(f=>f.properties.layer==='prefecture_areas'&&!f.properties.is_context).length;
    const unresolvedContextCount=features.filter(f=>f.properties.layer==='prefecture_areas'&&f.properties.is_context).length;
    return {year:Number(year),trial:true,videoTrial:true,annualVideo,fiefColors:annualVideo?root.JIN_FIEF_COLORS?.colors:null,width:2400,height:1986,extent:[85,15,137,50],plot:[80,140,2320,1906],
      title:`${year}年　西晉州郡封國 · 視頻年末疆域測驗`,
      subtitle:annualVideo?'原州界為基礎，按本年郡屬調整；政權界採年末視頻，接壤封國使用不同色彩。':'上輪兩年測驗：政權界採年末視頻；補齊界線含推定段。',
      note:`史圖館視頻年末原幀配准至WGS84，政權邊界與年表行政層分列。${annualVideo?'州界以原圖穩定州域為基礎，年度改屬沿郡面調整；州際共邊單独繪製，不把補洞碎片外圈畫成州界。':''}晉境內原有漏色區按當年縣屬、原圖郡屬及同州鄰郡補齊；缺少直接依據的分界為拟合，不代表史料已考定。白色表示其它政權，淡赭色表示原圖另列的晉西域附屬範圍；郡級及以上封國保持合併著色${annualVideo?'，接壤封國顏色不同':''}，制度範圍不等同封君軍事实控。縣域單元只用於內部擬合，不顯示縣面或縣界。可在上方選擇上輪年度圖或最初原版比較。${source?`本年原幀：${source.source_part}，${Number(source.timestamp_seconds).toFixed(3)}秒。`:''}`,
      status:`${year}年：${count('province_areas')-contextCount}州${contextCount?`及${contextCount}組原州地理參考`:''}、${prefectureCount}郡國範圍、${count('county_seats')}縣治${unresolvedContextCount?`；另有${unresolvedContextCount}處晉地郡屬待定`:''}；政權界採本年視頻，新增分界保留推定說明。`,
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
  const api={DATA_URL,REFERENCE_URL,VIDEO_TRIAL_URLS,PREVIOUS_VIDEO_URLS,VIDEO_LAND_URL,readMapData,hydrateVideoTrial,hydrate};root.JIN_ANNUAL_MAP_MODEL=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
