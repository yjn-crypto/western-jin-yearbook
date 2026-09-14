/* Shared geography join for the browser and the officials build. */
(function (global) {
  'use strict';
  const key=value=>String(value||'').replace(/[\s、，,（）()]/g,'').replace(/宿豫/g,'宿預').replace(/恆/g,'恒');

  function correctedPrefecture(entity) {
    const correction=global.LIANG_ADMINISTRATIVE_CORRECTIONS?.prefectures?.[entity.id];
    if(!correction)return entity;
    return {...entity,ph:(entity.ph||[]).map(phase=>Number(phase.start)===correction.original_start
      ? {...phase,start:correction.start??phase.start,end:correction.end??phase.end,raw:correction.raw,source:correction.source} : phase),research_source:correction.source};
  }

  function reviewSource(county,assignment) {
    const references=[county.source,assignment.source].filter(Boolean);
    const manual=county.manual_reviews||[];
    return {
      source_label:references.map(s=>`${s.workbook||global.LIANG_COUNTY_REVIEWED?.meta?.workbook||'縣郡複核表'} · ${s.sheet}第${s.row}行`).join('；'),
      excerpt:[
        `${assignment.name}：${assignment.prefecture_name||assignment.state_name||'歸屬未定'}。`,
        `展示時段：${assignment.start}—${assignment.end}；${assignment.start_kind||''}；${assignment.end_kind||''}。`,
        '此層保留改屬／省廢當年；展示邊界不一律等於史料確定的建廢年。',
        ...references.map(s=>s.excerpt).filter(Boolean),
        ...manual.map(m=>`人工確認（${m.sheet}第${m.row}行）：${m.confirmation||'未填'}。${m.notes||''}`),
        ...(assignment.issues||[]).map(x=>typeof x==='string'?x:JSON.stringify(x))
      ].filter(Boolean).join('\n\n'),
      editorial_note:assignment.uncertain?'本條含暫定歸屬或年代不確，正文以※標示。':''
    };
  }

  function attachCounties(states,year) {
    const data=global.LIANG_COUNTY_REVIEWED;
    if(!data)return {pending:[],attached:0};
    const byId=new Map(data.counties.map(c=>[c.id,c]));
    const targets=[];
    for(const state of states)for(const row of state.rows){row.counties=[];targets.push({state,row});}
    const pending=[],seen=new Set();
    let attached=0;
    for(const assignment of data.assignments){
      if(Number(year)<Number(assignment.start)||Number(year)>Number(assignment.end))continue;
      const county=byId.get(assignment.county_id);
      if(!county)throw new Error(`Unknown reviewed county: ${assignment.county_id}`);
      const source=reviewSource(county,assignment);
      const candidates=assignment.display_allowed&&assignment.prefecture_name
        ? targets.filter(({state,row})=>key(state.region)===key(assignment.region)
          &&key(row.name)===key(assignment.prefecture_name)
          &&(!assignment.state_name||key(state.name)===key(assignment.state_name))) : [];
      if(candidates.length!==1){
        const reason=assignment.assignment_kind==='state_only'?'人工意見僅定位到州，所屬郡仍未詳。'
          : !assignment.display_allowed?'本條年代或資料仍待覆核，未投射到年度郡縣。'
          : !assignment.prefecture_name?'所屬郡仍未詳。'
          : candidates.length>1?'同地域本年有多個同名郡，未能唯一連接。'
          : '所定郡在本年、同地域的政區底表未見；仍保留人工意見，不反推郡的存在。';
        pending.push({county,assignment,source,reason});continue;
      }
      // A renaming year may deliberately show both old and new names.
      const {state,row}=candidates[0],unique=`${state.id}|${row.id}|${county.id}|${assignment.name}`;
      if(seen.has(unique))continue;
      seen.add(unique);
      const correction=global.LIANG_QIAO_SOURCES?.county_corrections?.[county.id];
      const entity={...county,n:assignment.name,source,q:correction?correction.qiao:county.q,qi:correction?null:county.qi};
      if(correction)source.excerpt+=`\n\n本輪侨置複核：${correction.source.excerpt}`;
      const phase={start:assignment.start,end:assignment.end,name:assignment.name,
        raw:`${assignment.start}—${assignment.end}（縣表展示時段）`,source,uncertain:assignment.uncertain};
      row.counties.push({id:county.id,name:assignment.name,order:Number(county.id.replace(/\D/g,'')),
        uncertain:!!assignment.uncertain,timeless:false,qiao:!!entity.q,
        source,entity,phase,reviewedAssignment:assignment,kingdom:false,ruler:null,
        fiveRankFiefs:[],chenFiefs:[],liangFiefs:[],localOfficers:[]});
      attached++;
    }
    for(const {row} of targets)row.counties.sort((a,b)=>a.order-b.order);
    return {pending,attached};
  }
  global.LIANG_COUNTY_MODEL={correctedPrefecture,attachCounties,reviewSource,key};
})(typeof window==='undefined'?globalThis:window);
