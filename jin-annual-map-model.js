/* Hydrate one researched annual slice. Original 289/308 maps remain separate. */
(function(root){
  'use strict';
  const DATA_URL='data/jin-maps/annual-geography.json?v=20261001.6';
  function hydrate(bundle,year,slice){
    const entry=bundle?.years?.[String(year)];
    if(!entry||!slice||!Array.isArray(slice.features))throw new Error(`Missing annual Jin slice: ${year}`);
    const features=slice.features.map(feature=>{
      const geometry=feature.geometry||bundle.geometries?.[feature.geometry_id];
      if(!geometry)throw new Error(`Missing geometry: ${feature.geometry_id}`);
      return {type:'Feature',geometry,properties:{...feature.properties}};
    });
    const coverage=slice.coverage||entry.coverage||{};
    const meta=bundle.meta||{};
    const count=layer=>features.filter(f=>f.properties.layer===layer).length;
    const inferredCount=count('county_areas');
    const contextCount=features.filter(f=>f.properties.layer==='province_areas'&&f.properties.is_context).length;
    const stateCount=count('province_areas')-contextCount;
    const notes=coverage.control_messages||slice.notes||[];
    const controlNote=Array.isArray(notes)?notes.map(n=>String(n).replace(/[。；]+$/,'')).join('；'):String(notes||'').replace(/[。；]+$/,'');
    const statusNames={partial:'局部控制',contested:'爭奪待考',nominal:'名義建置',uncertain:'控制待考'};
    const controlCounts=Object.entries(coverage.control_summary||{}).filter(([status,value])=>statusNames[status]&&value>0).map(([status,value])=>`${statusNames[status]}${value}郡`).join('、');
    return {
      year:Number(year),trial:true,title:`${year}年　西晉疆域、州郡縣與封國 · 年度試驗圖`,
      width:meta.width||2400,height:meta.height||1986,
      extent:meta.extent||[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462],
      plot:meta.plot||[80,140,2320,1906],coverage,
      subtitle:'按年末建置與失陷記錄復原；縣界為縣治約束擬合，非史料實測界。',
      note:`年度政區依年表沿革與本機《中國行政區劃通史》，失陷當年另按史料校正。同年CHGIS治所、郡面優先；缺面者以原圖郡面和縣治約束擬合，郡、州按當年所屬縣合併。${inferredCount}個縣域單元均為擬合界；未定位政區不補造。${controlNote?controlNote+'。':''}多郡王國按授封與改封期段合併著色，推定成員保留斜線；封國制度範圍不等同封君實際控制。`,
      status:`${year}年：${stateCount}州${contextCount?`及${contextCount}組原州殘存郡縣`:''}、${count('prefecture_areas')}郡國範圍、${count('county_seats')}縣治；${inferredCount}個擬合縣域${coverage.counties_unlocated!=null?`，${coverage.counties_unlocated}縣未定位`:''}。${controlCounts?controlCounts+'（橙色斜線）。':''}${controlNote?controlNote+'。':''}`,
      geojson:{type:'FeatureCollection',features}
    };
  }
  const api={DATA_URL,hydrate};root.JIN_ANNUAL_MAP_MODEL=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
