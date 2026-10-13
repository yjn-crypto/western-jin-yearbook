/* Southern Qi geography: dated CHGIS plus the 497 Southern Qi atlas reference. */
(function(root){
 'use strict';
 const cache=new Map();let geometryPromise;
 async function json(url){const r=await fetch(url);if(!r.ok)throw new Error(`南齊地圖讀取失敗：${r.status} ${url}`);return url.endsWith('.gz')?new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json():r.json();}
 function entities(snapshot){
  const result=new Map();
  function visit(row){const id=row.id||row.entity_id;if(id)result.set(id,row);for(const p of row.rows||row.prefectures||[])visit(p);for(const c of row.counties||[])visit(c);for(const c of row.direct_counties||[])visit(c);for(const o of row.administrative_offices||[])visit(o);}
  for(const s of snapshot.states||[])visit(s);for(const o of snapshot.administrative_offices||[])visit(o);for(const r of snapshot.unassigned||snapshot.annual?.unassigned||[])visit(r);return result;
 }
 function resolve(slice,geometries,snapshot){
  const current=entities(snapshot),coverage={...slice.coverage},missing=new Map();
  for(const id of coverage.missing_prefecture_area_ids||[])missing.set(id,'尚無同年可靠郡面；只呈現有據治所及州域參考，不擬合新郡界。');
  for(const id of coverage.unlocated_ids||[])missing.set(id,current.get(id)?.qiao===true?'侨置機構缺少可確認的本年寄治坐標；未將原籍冒作寄治。':'尚無可確認的本年治所點；原圖文字位置不冒作治所。');
  coverage.unmapped_details=[...missing].filter(([id])=>current.has(id)).map(([id,reason])=>({entity_id:id,name:current.get(id).name,reason}));
  const features=slice.features.filter(f=>!f.properties.entity_id||current.has(f.properties.entity_id)).map(f=>{
   const e=current.get(f.properties.entity_id);
   return {type:'Feature',geometry:f.geometry||geometries[f.geometry_id],properties:{...f.properties,...(e?{name:e.name,display_name:e.name,qiao:e.qiao,territorial_status:e.territorial_status,population_status:e.population_status,administrative_activity:e.administrative_activity}:{})}};
  });
  const seats=new Map();
  for(const f of features)if(f.geometry.type==='Point'&&f.properties.coordinate_role==='administrative_seat'){const key=f.geometry.coordinates.map(n=>n.toFixed(6)).join(',');if(!seats.has(key))seats.set(key,[]);seats.get(key).push(f);}
  for(const same of seats.values())if(same.length>1){const names=[...new Set(same.map(f=>f.properties.name))].join('、');for(const f of same)f.properties.seat_note=(f.properties.seat_note||'')+'；同址機構：'+names;}
  return {year:slice.year,width:1600,height:1300,extent:[96,16,124,39],plot:[72,150,1528,1170],title:`${slice.year}年　南齊州郡縣`,
   subtitle:`${coverage.basemap_year}圖範圍參考；州域按本年分合，郡界只採同年CHGIS；無新擬合郡界。`,
   geojson:{type:'FeatureCollection',features},coverage,sourcePriority:true,threeBasemap:true,southernQi:true,fiefColors:{},
   status:`本年 ${coverage.state_areas} 個州域、${coverage.shared_state_areas} 個共同參考區，${coverage.prefecture_areas} 個CHGIS郡面、${coverage.county_seats} 處縣治。`,
   notes:['本輪使用南齊自身年度資料、同年CHGIS及齊魏497年南齊矢量底圖；沒有沿用劉宋或西晉的行政圖層與期段。','497年原圖提供完整行政範圍參考；其他年度依本年統属分合及可靠CHGIS郡面調整，不冒稱逐年精確軍事戰線，失守不等於法理撤銷。','原圖共同範圍缺少可靠內界時保留未分界提示。480—482巴州分荊、益相關郡而無完整舊界處作共同參考；480—483南豫省並依年度郡屬合入豫州。','郡面與郡界只採同年CHGIS，沒有新增擬合郡界或縣界。政權參考範圍內未分配部分保持同色，不據補色區冒作新郡。','治所優先CHGIS原坐標；497圖古治所圈僅在同一實體來源階段補缺，跨年沿用標為參考，不據同名或原籍猜定侨寄地。','宁蠻府與北部都尉為輔助机构，所轄郡縣歸其上級州；不另造州郡面。同址機構只畫最高級符號並保留全部名稱。侨置、實土、人口與機構活動分別保留。',...(slice.year===479?['479年僅表示南齊成立以後的研究參考，不宣稱全年均屬齊制。']:slice.year===502?['502年僅表示齊梁交替前的研究參考；由501延續者按原資料逐條標明投射，不宣稱502年末仍為齊制。']:[])]};
 }
 async function load(year,snapshot){if(!cache.has(year))cache.set(year,json(`data/southern-qi-maps/annual/${year}.json`));if(!geometryPromise)geometryPromise=json('data/southern-qi-maps/geometries.json.gz');const [slice,graph]=await Promise.all([cache.get(year),geometryPromise]);return resolve(slice,graph.geometries,snapshot);}
 const api={load,resolve,entities};root.SOUTHERN_QI_MAP_MODEL=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
