/* Eastern Jin display adapter. Research records remain unchanged. */
(function (global) {
  'use strict';

  const levelNames = {state:'州',prefecture:'郡',county:'縣'};
  const confidenceNames = {high:'較高',medium:'中等',low:'較低'};
  const method = [
    '東晉第一輪以《中國行政區劃通史》第五編實州郡縣沿革、第十編僑州郡縣考表及附錄為基礎，接續 Work 整理的證據與《晉書》《宋書》對讀，列示317—420年各年州郡縣。沿用正文括號中的公元年份；年度展示不另作上下半年換算。',
    '「某年後」「某年前」、問號及候選年份均保留原文。在既有材料不相衝突的範圍內採最早可行展示起年，並優先採用有直接歸屬證據的州郡關係。展示起訖不是確切置廢年；更晚的排他性證據或前後沿革會收窄範圍。每項機器判斷、原有候選與證據保留於註釋及人工核對文檔。',
    '僑州、僑郡、僑縣逐級以下劃線標示，互不沿襲：僑州所領不必全為僑郡，實郡所領亦可有僑縣。原屬、寄治及下劃線識讀依據可點擊註釋查看。僑置標記未能確定者以※說明，不能按普通實州郡縣默認處理。',
    '尚無可行年代或不能判定歸屬的條目保留於「暫緩接入」清單，不計入本年州郡縣總數。表中加粗表示相較前一年首次列入、改名或改屬；首次列入並不必然是始置，撤出亦不必然是廢省。',
    '本輪建立行政沿革框架；封國制度與封君專題另待整理。地圖以本年郡面及州屬為核心，優先採當年有效的CHGIS郡面與治所；州面由所屬郡面合併，隨郡分合、轉屬自動改變。CHGIS州面只補缺失範圍、校核外緣，不另裁郡面。同一位置或界線擇一取源，譚圖和西晉參考界只補缺口，不相互裁空。沿用西晉政權外框，只在本年正文所列東晉實控政區內繪州郡界；政權內部歸屬或資料未定區域也保持東晉底色，不造失地白洞或無據內界。外框用作共同展示範圍，不表示東晉實際控制整個西晉版圖。382年譚圖僅作該斷面的補充參照，僑置原籍不作寄治地點。'
  ];

  function data() { return global.EASTERN_JIN_DATA; }
  function sourceFor(id) {
    const value=data().sources[id];
    if (!value) return null;
    // Presentation only: keep the OCR original in the research/source records.
    const readable=text=>String(text||'')
      .replace(/\\n/g,'\n').replace(/\\underset\s*\{\\cdot\}\s*\{([^{}]*)\}/g,'$1')
      .replace(/\\(?:text|mathrm|mathbf|mathit)\s*\{([^{}]*)\}/g,'$1')
      .replace(/\\underline\s*\{([^{}]*)\}/g,'$1〔原文下劃線〕')
      .replace(/<u(?:\s[^>]*)?>([\s\S]*?)<\/u>/gi,'$1〔原文下劃線〕')
      .replace(/<br\s*\/?\s*>|<\/(?:p|div|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')
      .replace(/<(?:\/?[A-Za-z][^<>]*?)?(?=……|$)/g,'')
      .replace(/^\s*#{1,6}\s*/gm,'').replace(/\\(?:begin|end)\s*\{[^}]*\}/g,'')
      .replace(/\\(?:quad|qquad|hline|left|right)\b/g,' ').replace(/\\circ\b/g,'○').replace(/\\triangle\b/g,'△')
      .replace(/[\^_]\s*\{([^{}]*)\}/g,'$1').replace(/\\(?:underline|text|mathrm|mathbf|mathit)\s*\{/g,'')
      .replace(/[$}{]/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
      .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
      .replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').trim();
    const pages=Array.isArray(value.book_page)?value.book_page:[value.book_page].filter(Boolean);
    const pdfPages=Array.isArray(value.pdf_page)?value.pdf_page:[value.pdf_page].filter(Boolean);
    return {...value,excerpt:readable(value.excerpt),editorial_note:readable(value.editorial_note),eastern_jin:true,source_title:value.title||value.source||'',book_page:pages[0],book_pages:pages,
      pdf_page:pdfPages[0],pdf_pages:pdfPages,
      source_label:[value.title||value.source,value.chapter,pages.length?`書內第${pages.join('、')}頁`:'',pdfPages.length?`PDF第${pdfPages.join('、')}頁`:''].filter(Boolean).join(' · '),
      editorial_label:'資料整理說明'};
  }

  function annotation(item) {
    const record=item.record||item;
    const paragraphs=[];
    const qiao=record.qiao;
    paragraphs.push(`${levelNames[record.level]||'政區'}級僑置標記：${qiao===true?'僑置，名稱以下劃線標示':qiao===false?'本條未標為僑置':'尚待核定'}。`);
    for (const period of record.periods||[]) paragraphs.push([...new Set([
      `本條展示時段：${period.start}—${period.end}年`,period.raw?`原書斷限：${period.raw}`:'',period.start_note,period.end_note
    ].filter(Boolean).map(text=>text.replace(/[。；]+$/,'')))].join('；')+'。');
    for (const context of record.context||[]) paragraphs.push([
      `${context.kind==='origin'?'原屬':context.kind==='hosted_at'?'寄治':'相關記錄'}：${context.label||'未詳'}`,...(context.notes||[])
    ].filter(Boolean).join('；'));
    paragraphs.push(...(record.notes||[]));
    for (const id of record.machine_decision_ids||[]) {
      const decision=data().decisions[id];
      if (!decision) continue;
      paragraphs.push(`機器判斷 ${id}｜${decision.label||''}：${decision.decision||''}。${decision.reason||''}${decision.confidence?` 判斷把握：${confidenceNames[decision.confidence]||decision.confidence}。`:''}${decision.display_summary?` 展示採用：${decision.display_summary}。`:''}${decision.manual_review?` 人工核對：${typeof decision.manual_review==='string'?decision.manual_review:'待核對。'}`:''}`);
    }
    const qiaoNote=record.qiao_annotation;
    if (qiaoNote) {
      const text=typeof qiaoNote==='string'?qiaoNote:[qiaoNote.note,qiaoNote.origin,qiaoNote.mark,qiaoNote.method,qiaoNote.status,qiaoNote.rule].filter(value=>typeof value==='string').join('；');
      if (text) paragraphs.push(`僑置識讀：${text}`);
    }
    if (record.issue_ids?.length) paragraphs.push(`待考記錄編號：${record.issue_ids.join('、')}。`);
    if (record.unassigned_reason||record.reason) paragraphs.push(record.unassigned_reason||record.reason);
    const ids=[...new Set([...(record.evidence_ids||[]),...(record.context||[]).flatMap(context=>context.evidence_ids||[]),...(record.qiao_annotation?.evidence_ids||[])])];
    const sources=[{eastern_jin:true,source_label:'沿革、僑置及本輪展示判斷',excerpt:[...new Set(paragraphs)].join('\n\n')}];
    sources.push(...ids.map(sourceFor).filter(Boolean));
    return {summary:`${record.name}：沿革、僑置與展示依據`,sources,kind:'eastern-jin-note',label:`${record.name}：沿革與展示判斷`};
  }

  function adapt(record,order,level) {
    const source=(record.evidence_ids||[]).map(sourceFor).find(Boolean)||null;
    return {...record,id:record.id||record.entity_id,name:record.name,level,record,
      order,qiao:record.qiao===true,uncertain:!!record.uncertain||record.qiao===null,
      source,entity:record,phase:{...(record.periods||[])[0],administrative_count:true},
      kingdom:false,ruler:null,chenFiefs:[],liangFiefs:[],fiveRankFiefs:[],counties:[]};
  }

  function buildSnapshot(year) {
    const annual=data().annual[String(year)];
    const states=annual.states.map((record,index)=>{
      const state={...adapt(record,index,'state'),filterKey:`eastern-jin:${record.id||record.entity_id}`,group:'eastern-jin',groupLabel:'東晉',rows:[]};
      state.rows=(record.prefectures||[]).map((prefecture,prefIndex)=>{
        const row=adapt(prefecture,prefIndex,'prefecture');
        row.counties=(prefecture.counties||[]).map((county,countyIndex)=>adapt(county,countyIndex,'county'));
        return row;
      });
      if(record.direct_counties?.length) state.rows.push({id:`${state.id}:unidentified-prefecture`,name:'',displayLabel:'郡屬未定',directCounties:true,
        phase:{administrative_count:false},counties:record.direct_counties.map((county,index)=>adapt(county,index,'county'))});
      return state;
    });
    return {states,virtualFiefs:[],annual};
  }

  function pending(year) {
    const annual=data().annual[String(year)],byId=new Map();
    for (const record of [...(annual.unassigned||[]),...(annual.undated_refs||[])]) {
      const id=record.id||record.entity_id;
      if (!byId.has(id)) byId.set(id,record);
    }
    return [...byId.values()];
  }

  global.EASTERN_JIN_VIEW={buildSnapshot,annotation,pending,method};
})(window);
