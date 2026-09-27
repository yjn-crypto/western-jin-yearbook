/* Shared geography join for the browser and the officials build. */
(function (global) {
  'use strict';
  const key=value=>String(value||'').replace(/[\s、，,（）()]/g,'').replace(/宿豫/g,'宿預').replace(/恆/g,'恒');

  function correctedPrefecture(entity) {
    const correction=global.LIANG_ADMINISTRATIVE_CORRECTIONS?.prefectures?.[entity.id];
    if(!correction)return entity;
    return {...entity,ph:(entity.ph||[]).map(phase=>(correction.original_raw
      ? phase.raw===correction.original_raw : Number(phase.start)===correction.original_start)
      ? {...phase,start:correction.start??phase.start,end:correction.end??phase.end,raw:correction.raw,source:correction.source} : phase),research_source:correction.source};
  }

  function supplementalPrefectures(states,year) {
    for(const entity of global.LIANG_ENTITY_LINKS?.supplemental_prefectures||[]) {
      const state=states.find(s=>s.id===entity.state_id);
      if(!state||state.rows.some(row=>row.id===entity.id))continue;
      const phase=entity.ph.find(p=>Number(year)>=p.start&&Number(year)<=p.end);
      if(!phase)continue;
      state.rows.push({id:entity.id,name:phase.name||entity.n,order:entity.o,
        uncertain:!!phase.uncertain,qiao:!!entity.q,source:phase.source,
        entity,phase,directCounties:false,unknownPrefecture:false,kingdom:false,
        ruler:null,fiveRankFiefs:[],chenFiefs:[],liangFiefs:[],counties:[]});
      state.rows.sort((a,b)=>a.order-b.order);
    }
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
    supplementalPrefectures(states,year);
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
      const links=(global.LIANG_ENTITY_LINKS?.county_links||[]).filter(link=>link.assignment_id===assignment.id);
      const activeLinks=links.filter(link=>Number(year)>=link.start&&Number(year)<=link.end);
      const entityLink=activeLinks.length===1?activeLinks[0]:null;
      const canDisplay=assignment.display_allowed||(entityLink?.override_machine_hold&&!county.manual_reviews?.length);
      // Explicit mappings retain source section and stable entity IDs. A name is never
      // matched globally merely because no candidate exists in the county's book section.
      const candidates=links.length
        ? (canDisplay&&entityLink?targets.filter(({row})=>entityLink.prefecture_ids.includes(row.id)):[])
        : canDisplay&&assignment.prefecture_name
        ? targets.filter(({state,row})=>key(state.region)===key(assignment.region)
          &&key(row.name)===key(assignment.prefecture_name)
          &&(!assignment.state_name||key(state.name)===key(assignment.state_name))) : [];
      if(entityLink){
        source.source_label+=`；${entityLink.source.source_label}`;
        source.excerpt+=`\n\n本輪實體連接：${entityLink.reason}\n${entityLink.source.excerpt}\n${entityLink.source.editorial_note||''}`;
        source.entity_link_id=entityLink.id;
      }
      if(candidates.length!==1){
        const reason=assignment.assignment_kind==='state_only'?'人工意見僅定位到州，所屬郡仍未詳。'
          : !canDisplay?'本條年代或資料仍待覆核，未投射到年度郡縣。'
          : links.length&&!entityLink?'已據地域與原文定位郡實體；本年超出已證或現有郡段，不補造年度歸屬。'
          : !assignment.prefecture_name?'所屬郡仍未詳。'
          : candidates.length>1?'同地域本年有多個同名郡，未能唯一連接。'
          : '所定郡在本年、同地域的政區底表未見；仍保留人工意見，不反推郡的存在。';
        pending.push({county,assignment,source,reason,entityLink});continue;
      }
      // A renaming year may deliberately show both old and new names.
      const {state,row}=candidates[0],unique=`${state.id}|${row.id}|${county.id}|${assignment.name}`;
      if(seen.has(unique))continue;
      seen.add(unique);
      const correction=global.LIANG_QIAO_SOURCES?.county_corrections?.[county.id];
      const entity={...county,n:assignment.name,source,q:correction?correction.qiao:county.q,qi:correction?null:county.qi};
      if(correction)source.excerpt+=`\n\n本輪侨置複核：${correction.source.excerpt}`;
      const uncertain=!!(assignment.uncertain||entityLink?.uncertain);
      const phase={start:Math.max(assignment.start,entityLink?.start??assignment.start),
        end:Math.min(assignment.end,entityLink?.end??assignment.end),name:assignment.name,
        raw:`${assignment.start}—${assignment.end}（縣表展示時段；與所屬郡有效時段相交）`,source,uncertain};
      row.counties.push({id:county.id,name:assignment.name,order:Number(county.id.replace(/\D/g,'')),
        uncertain,timeless:false,qiao:!!entity.q,
        source,entity,phase,reviewedAssignment:assignment,entityLink,kingdom:false,ruler:null,
        fiveRankFiefs:[],chenFiefs:[],liangFiefs:[],localOfficers:[]});
      attached++;
    }
    for(const {row} of targets)row.counties.sort((a,b)=>a.order-b.order);
    return {pending,attached};
  }
  global.LIANG_COUNTY_MODEL={correctedPrefecture,supplementalPrefectures,attachCounties,reviewSource,key};
})(typeof window==='undefined'?globalThis:window);
