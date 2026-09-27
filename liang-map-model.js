/* Liang only: source-region constraints are search windows, never territory. */
(function(){
  'use strict';
  const windows={
    '江表':[113,24,123,33.7], '淮南':[113,30,122,34.8],
    '淮北':[112,32,123,37], '河南':[109,31.5,117,36.5],
    '江漢':[108,28,116.5,34], '嶺南':[103,18,118,27],
    '沅湘':[107,24,115.5,30.8], '巴漢':[103,29,111.5,35],
    '蜀中（含南中）':[97,21,110,33.5]
  };
  const variants={'钱':'錢','塘':'塘','扬':'揚','东':'東','阳':'陽','兴':'興','宁':'寧','晋':'晉','长':'長','吴':'吳','临':'臨','丰':'豐','县':'縣','国':'國','庐':'廬','陈':'陳','广':'廣','义':'義','乐':'樂','随':'隨','郧':'鄖','寿':'壽','龙':'龍','汉':'漢','乡':'鄉','归':'歸','兰':'蘭','乌':'烏','浔':'潯','寻':'尋','会':'會','怀':'懷','齐':'齊','齐':'齊','绥':'綏','锡':'錫','凉':'涼','涟':'漣','巩':'鞏','历':'歷','泾':'涇','谯':'譙','兖':'兗','蒋':'蔣','脩':'修','鍾':'鐘','臺':'台','琅琊':'琅邪'};
  function key(value){return String(value||'').replace(/琅琊/g,'琅邪').replace(/候官/g,'侯官').replace(/錢唐|钱唐/g,'錢塘').replace(/[\u3400-\u9fff]/g,c=>variants[c]||c).replace(/[\s※？?]/g,'').replace(/(郡|縣|國|州|尹)$/,'');}
  function within(record,region){const box=windows[region];return !!box&&record.lon>=box[0]&&record.lat>=box[1]&&record.lon<=box[2]&&record.lat<=box[3];}
  function active(records,year){
    const result=[];
    for(const record of [...records].filter(r=>r.b<=year&&year<=r.e).sort((a,b)=>Number(b.s==='CHGIS V6')-Number(a.s==='CHGIS V6')||b.b-a.b)){
      const duplicate=result.find(r=>key(r.n)===key(record.n)&&Math.abs(r.lon-record.lon)<.015&&Math.abs(r.lat-record.lat)<.015);
      if(!duplicate)result.push(record);
    }
    return result;
  }
  function contains(area,x,y){
    let inside=false;
    for(const ring of area.d.match(/M[^M]+/g)||[]){
      const values=(ring.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number),points=[];
      for(let i=0;i+1<values.length;i+=2)points.push([values[i],values[i+1]]);
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [px,py]=points[i],[qx,qy]=points[j];
        if((py>y)!==(qy>y)&&x<(qx-px)*(y-py)/(qy-py)+px)inside=!inside;
      }
    }
    return inside;
  }
  function resolve(snapshot,year,map){
    const seats={state:active(map.stateSeats,year),prefecture:active(map.prefSeats,year),county:active(map.countySeats,year)};
    const areas=map.prefAreas.filter(a=>a.b<=year&&year<=a.e),entities=[],features=[],unlocated=[],byId=new Map();
    for(const state of snapshot.states){
      entities.push({entity:state,state,level:'state'});
      for(const row of state.rows){
        if(!row.unknownPrefecture)entities.push({entity:row,state,row,level:'prefecture'});
        for(const county of row.counties)entities.push({entity:county,state,row,level:'county'});
      }
    }
    for(const item of entities){
      const {entity,state,row,level}=item, names=new Set([key(entity.name)]);
      let candidates=seats[level].filter(r=>[r.n,...(r.aliases||[])].some(n=>names.has(key(n)))&&within(r,state.region));
      let method='年度有效名稱＋原書地域窗口內唯一候選（地理參考）';
      const parent=level==='county'&&byId.get(row.id),parentAreas=parent&&areas.filter(a=>key(a.n)===key(row.name)&&contains(a,parent.x,parent.y));
      if(parentAreas?.length===1){
        candidates=candidates.filter(r=>contains(parentAreas[0],r.x,r.y));
        method+='＋已連接上級郡的CHGIS本年參考面包含';
      }
      const peers=entities.filter(other=>other.level===level&&key(other.entity.name)===key(entity.name)&&other.entity.id!==entity.id
        && (other.state.region===state.region||candidates.some(candidate=>within(candidate,other.state.region))));
      // A source-region duplicate cannot be assigned by data order or proximity.
      if(candidates.length!==1||peers.length){
        unlocated.push({...item,reason:peers.length?'地域窗口內有多個同名實體競合，仍需更細的定位依據':!candidates.length?'CHGIS本年無符合名稱及地域的治所':'CHGIS本年同地域有多個同名治所',candidate_ids:candidates.map(c=>c.i)});
        continue;
      }
      const seat=candidates[0],feature={...item,entity_id:entity.id,label:entity.displayName||entity.name,x:seat.x,y:seat.y,seat,
        mapKey:`entity:${entity.id}`,method,uncertain:true};
      features.push(feature);byId.set(entity.id,feature);
    }
    const boundaries=[];
    for(const feature of features.filter(f=>f.level==='prefecture')){
      const candidates=areas.filter(a=>key(a.n)===key(feature.entity.name)&&contains(a,feature.x,feature.y));
      if(candidates.length===1)boundaries.push({area:candidates[0],feature});
    }
    return {features,unlocated,byId,boundaries,seats};
  }
  function geojson(resolved,year){
    return {type:'FeatureCollection',name:`蕭梁${year}年已連接治所（地理參考）`,sources:window.LIANG_DYNAMIC_MAP?.sources||[],features:resolved.features.map(f=>({type:'Feature',
      geometry:{type:'Point',coordinates:[f.seat.lon,f.seat.lat]},properties:{year,entity_id:f.entity_id,name:f.label,level:f.level,
        region:f.state.region,source:f.seat.s,source_id:f.seat.source_id,sys_id:f.seat.i,begin:f.seat.b,end:f.seat.e,
        begin_rule:f.seat.begin_rule,end_rule:f.seat.end_rule,dbf_row:f.seat.dbf_row,method:f.method,location_status:'reference_match',
        coordinate_note:f.seat.s==='CHGIS V4'?'V4 DBF geographic attributes; datum not independently transformed':'V6 WGS84'}}))};
  }
  window.LIANG_MAP_MODEL={resolve,geojson,key,contains,windows};
})();
