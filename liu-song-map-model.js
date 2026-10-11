/* Liu Song geography: dated CHGIS plus the 464 and 497 atlas references. */
(function(root){
 'use strict';
 const cache=new Map();let geometryPromise;
 async function json(url){const r=await fetch(url);if(!r.ok)throw new Error(`劉宋地圖讀取失敗：${r.status} ${url}`);return url.endsWith('.gz')?new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json():r.json();}
 function entities(snapshot){
  const result=new Map();
  function visit(row){const id=row.id||row.entity_id;if(id)result.set(id,row);for(const p of row.rows||row.prefectures||[])visit(p);for(const c of row.counties||[])visit(c);for(const c of row.direct_counties||[])visit(c);}
  for(const s of snapshot.states||[])visit(s);for(const r of snapshot.unassigned||snapshot.annual?.unassigned||[])visit(r);return result;
 }
 function resolve(slice,geometries,snapshot){
  const current=entities(snapshot),coverage={...slice.coverage},missing=new Map();
  for(const id of coverage.missing_prefecture_area_ids||[])missing.set(id,'尚無同年可靠郡面；只呈現有據治所及州域參考，不擬合新郡界。');
  for(const id of coverage.unlocated_ids||[])missing.set(id,current.get(id)?.qiao===true?'侨置機構缺少可確認的本年寄治坐標；未將原籍冒作寄治。':'尚無可確認的本年治所點；原图文字位置不冒作治所。');
  coverage.unmapped_details=[...missing].filter(([id])=>current.has(id)).map(([id,reason])=>({entity_id:id,name:current.get(id).name,reason}));
  const features=slice.features.filter(f=>!f.properties.entity_id||current.has(f.properties.entity_id)).map(f=>{
   const e=current.get(f.properties.entity_id);
   return {type:'Feature',geometry:f.geometry||geometries[f.geometry_id],properties:{...f.properties,...(e?{name:e.name,display_name:e.name,qiao:e.qiao,territorial_status:e.territorial_status}:{})}};
  });
  const seats=new Map();
  for(const f of features)if(f.geometry.type==='Point'&&f.properties.coordinate_role==='administrative_seat'){const key=f.geometry.coordinates.map(n=>n.toFixed(6)).join(',');if(!seats.has(key))seats.set(key,[]);seats.get(key).push(f);}
  for(const same of seats.values())if(same.length>1){const names=[...new Set(same.map(f=>f.properties.name))].join('、');for(const f of same)f.properties.seat_note=(f.properties.seat_note||'')+'；同址機構：'+names;}
  return {year:slice.year,width:1600,height:1300,extent:[96,16,124,39],plot:[72,150,1528,1170],title:`${slice.year}年　劉宋州郡縣`,
   subtitle:`${coverage.basemap_year}圖範圍參考；州域按本年分合，郡界只採同年CHGIS；無新擬合郡界。`,
   geojson:{type:'FeatureCollection',features},coverage,sourcePriority:true,threeBasemap:true,liuSong:true,fiefColors:{},
   status:`本年 ${coverage.state_areas} 個州域、${coverage.shared_state_areas} 個共同參考區，${coverage.prefecture_areas} 個CHGIS郡面、${coverage.county_seats} 處縣治。`,
   notes:['本輪只使用CHGIS、劉宋464年及齊魏497年矢量資料；未使用任何西晉地图資料。','依使用者首輪約定，前期參考464圖，465—468按年度保留尚存北方州區，469年起參考497圖；這是展示框架，不是逐年精確軍事戰線。','完整州域依年度分合；有可靠同年CHGIS郡面時優先採用，缺郡界處沿原州域。共同參考區沒有資料支持的內界不補畫。郡面與郡界全部來自CHGIS，縣面縣界不展示。','政權內未明確分配的部分保持同色，不將補色區冒作新郡。侨置、有無實土與實際控制分開。','治所优先保留CHGIS原坐標；464圖古圈只在同一來源階段沿用並標明推定。497點沒有独立宋代同地證據者僅作參考，不回填宋代。','同址州郡縣只畫最高級治所符號，說明保留同址機構。行政歸屬未定但有獨立治所證據者可落點，其餘列入未定位清單。',...(slice.year===420||slice.year===479?['本年為朝代交替邊界，文字按相鄰年有據階段投射；不宣稱全年均屬宋制。']:[])]};
 }
 async function load(year,snapshot){if(!cache.has(year))cache.set(year,json(`data/liu-song-maps/annual/${year}.json`));if(!geometryPromise)geometryPromise=json('data/liu-song-maps/geometries.json.gz');const [slice,graph]=await Promise.all([cache.get(year),geometryPromise]);return resolve(slice,graph.geometries,snapshot);}
 const api={load,resolve,entities};root.LIU_SONG_MAP_MODEL=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
