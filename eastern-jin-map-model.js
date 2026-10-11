/* Eastern Jin annual geography uses explicit display entity IDs.  The Western
 * Jin outline is contextual and has no bearing on current-year inclusion. */
(function(root){
  'use strict';
  const cache=new Map();
  let geometryPromise;
  async function json(url){
    const response=await fetch(url);
    if(!response.ok)throw new Error(`東晉地圖資料讀取失敗：${url} (${response.status})`);
    if(url.endsWith('.gz'))return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    return response.json();
  }
  function entities(snapshot){
    const result=new Map();
    for(const s of snapshot.states||[]){
      result.set(s.id||s.entity_id,s);
      for(const p of s.rows||s.prefectures||[]){
        result.set(p.id||p.entity_id,p);
        for(const c of p.counties||[])result.set(c.id||c.entity_id,c);
      }
    }
    return result;
  }
  function resolve(slice,geometries,snapshot){
    const current=entities(snapshot);
    const coverage={...slice.coverage};
    const missing=new Map();
    for(const id of coverage.missing_real_prefecture_ids||[])missing.set(id,'本年實郡尚缺可用面界；有据治所另行顯示。');
    for(const id of [...coverage.unlocated_county_ids||[],...coverage.unlocated_prefecture_ids||[],...coverage.unlocated_state_ids||[]]){
      const entity=current.get(id);
      missing.set(id,entity?.qiao?'侨置實體尚缺本年寄治坐標；未使用原籍位置。':'未找到可唯一匹配的本年CHGIS位置或有据原圖位置。');
    }
    coverage.unmapped_details=[...missing].map(([id,reason])=>({entity_id:id,name:current.get(id)?.name||id,reason}));
    const features=slice.features.filter(f=>!f.properties.entity_id||current.has(f.properties.entity_id)).map(f=>{
      const entity=current.get(f.properties.entity_id);
      return {type:'Feature',geometry:f.geometry||geometries[f.geometry_id],properties:{...f.properties,
        ...(entity?{name:entity.name,display_name:entity.name,qiao:Boolean(entity.qiao)}:{})}};
    });
    return {year:slice.year,width:1600,height:1300,extent:[94,16,132,43],plot:[72,150,1528,1170],
      title:`${slice.year}年　東晉州郡縣`,
      subtitle:'CHGIS有效郡面優先；州面隨本年所屬郡面合併。境內未定歸屬處同底色，西晉外緣只作參照。',
      geojson:{type:'FeatureCollection',features},coverage,
      status:`本年已繪${coverage.prefecture_areas}個郡級參考面，其中${coverage.chgis_prefecture_areas||0}個直接採用CHGIS；${coverage.county_seats}處縣治。`,
      sourcePriority:true,threeBasemap:true,easternJin:true,fiefColors:{},
      notes:['本圖為東晉第一輪資料框架。當年有效且地望可明確匹配的CHGIS郡面優先採用，缺處沿用已採用舊郡面。州面嚴格由本年所屬郡面合併，沒有另一套獨立州界。',
        '政權內部未落實到具體郡的區塊使用同一底色，不據此補造州郡、改郡數或畫出假邊界。底色只填封閉內洞，不使用凸包連接不同外部區域。',
        '縣域面和縣界不公開；侨郡縣的原籍坐標不冒作寄治。無可靠位置者只保留正文。',
        '正文只明確寄治地、尚無獨立治所證據的侨郡，以寄治地CHGIS位置放置名稱參考，不畫該侨郡的治所符號。',
        ...(slice.year===382?['382年以使用者指定譚圖的政權面作底色參考，不用其州面硬裁郡；該圖本身未獨立確認年款。《通史》明載寧州373失陷、384復得，本年排除寧州，保留兩源衝突說明。']:[])]};
  }
  async function load(year,snapshot){
    if(!cache.has(year))cache.set(year,json(`data/eastern-jin-maps/annual/${year}.json`));
    if(!geometryPromise)geometryPromise=json('data/eastern-jin-maps/geometries.json.gz');
    const [slice,graph]=await Promise.all([cache.get(year),geometryPromise]);
    return resolve(slice,graph.geometries,snapshot);
  }
  const api={load,resolve,entities};root.EASTERN_JIN_MAP_MODEL=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
