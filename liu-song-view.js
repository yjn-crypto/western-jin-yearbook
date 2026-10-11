/* Liu Song annual display. Source, date and territorial axes remain separate. */
(function (global) {
  'use strict';
  const levels={state:'州',prefecture:'郡',county:'縣'};
  const territories={territorial:'有實土',nonterritorial:'無實土',mixed:'實土與僑置情況並存',uncertain:'實土狀態未定'};
  const controls={attested:'有控制記載',nominal:'名義控制',disputed:'控制存疑',unknown:'控制範圍未詳'};
  const marks={underline:'有下劃線',no_underline:'無下劃線',unclear:'未辨清',missing:'OCR未識出',uncertain:'未定'};
  const relationKinds={origin:'原屬',hosted_at:'寄治',administrative_parent:'行政隸屬',control:'實際控制'};
  const method=[
    '劉宋首輪以《中國行政區劃通史》第六編、464年斷代表、宋代實州郡沿革附錄及第十編僑州郡縣考表為基礎，保存 Work 整理與《宋書》對讀的原有判斷。展示420—479年；《通史》正文範圍為421—478年，採書中括號年份，不重算半年法。',
    '420是晉宋交替年，479是宋齊交替年。部分條目由421或478年度資料作邊界延續投射，逐行標示；不把420視為整年宋制，也不將479條目說成該年年末宋制。首次列入、展示起訖及观察錨點均不必然是確切始置、廢省或失陷年份。原文說法、證據約束與展示界限在註釋中分列。',
    '僑州、僑郡、僑縣逐級以下劃線標記，不能從上下級繼承；僑置性質未定者明標「僑性未定」。原頁有無線、OCR識讀及原圖核驗分開保存。僑置、實土和政治控制是不同屬性，土斷不自動使全部僑機構實土化；原屬與寄治亦不充作行政父級。',
    '同一實體的並見來源阶段按entity_id只計一次；同名異地保持獨立。未定統屬保留在獨立清單，不補造父級；不定年階段不據此另計本年。頁面上方數量只計目前主表；研究年度總量另含未定統屬，不能把其交叉數再相加。',
    '《宋書》引《永初郡國志》、何志、徐志的時點分別保留。何志新立不等於443年始置，何志無亦不一律證明此後才置。內史、侯、相等官爵稱謂以升明末為觀察層，不能反推全宋爵期；本轮保留行政來源的郡國名稱，尚未建立封君或爵期。',
    '地圖使用本年可採用的CHGIS治所和州郡界，以及譚圖464、497年的參考範圍；465—468年按正文沿革逐年過渡，469年起採497年圖政權範圍作參考。參考斷面不等於本年逐界確證。無實土機構不畫面，缺坐標不造點，未知郡界不新作擬合，縣域面與縣界不展示。'
  ];
  const data=()=>global.LIU_SONG_DATA;
  const unique=values=>[...new Set(values.filter(Boolean))];
  const list=value=>value==null?[]:Array.isArray(value)?value:[value];
  const readable=value=>String(value??'')
    .replace(/\\n/g,'\n').replace(/\\underset\s*\{\\cdot\}\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\(?:text|mathrm|mathbf|mathit)\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\underline\s*\{([^{}]*)\}/g,'$1〔原文下劃線〕')
    .replace(/<u(?:\s[^>]*)?>([\s\S]*?)<\/u>/gi,'$1〔原文下劃線〕')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')
    .replace(/<(?:\/?[A-Za-z][^<>]*?)?(?=……|$)/g,'')
    .replace(/^\s*#{1,6}\s*/gm,'').replace(/\\(?:begin|end)\s*\{[^}]*\}/g,'')
    .replace(/\\(?:quad|qquad|hline|left|right)\b/g,' ').replace(/\\circ\b/g,'○').replace(/\\triangle\b/g,'△')
    .replace(/[\^_]\s*\{([^{}]*)\}/g,'$1').replace(/\\(?:underline|text|mathrm|mathbf|mathit)\s*\{/g,'')
    .replace(/[$}{]/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
    .replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').trim();
  function sourceFor(id) {
    const s=data().sources[id];if(!s)return null;
    const bp=list(s.book_page),pp=list(s.pdf_page);
    const verification={pdf_checked:'已核原圖',original_text_checked:'已核原典文字',ocr_only:'OCR轉寫',unresolved:'核讀待定'};
    const scopes={names_underlines_and_page_locator_only:'原圖僅核名稱、下劃線及頁碼，不代表整段逐字校讀'};
    const layers=list(data().paragraph_citations?.[id]?.layers).map(key=>data().source_layers[key]).filter(Boolean);
    const observation=s.observation_date;
    const reference=observation?.compilation_reference_only;
    const observationText=typeof observation==='string'?observation:observation?[
      observation.year!=null?`觀察年：${observation.year}`:'',
      Array.isArray(observation.source_scope)?`來源範圍：${observation.source_scope.join('—')}年`:'',
      reference?.main_geographical_horizon!=null?`地理編排參照：${reference.main_geographical_horizon}年`:'',
      reference?.noble_title_horizon!=null?`爵稱參照：${reference.noble_title_horizon}年`:'',
      reference?'上述編排參照不等同逐句觀察年':'',observation.note
    ].filter(Boolean).join('；'):'';
    const meta=[s.edition,verification[s.verification],s.correction_note,s.relevance,scopes[s.verification_scope]||'',s.quote_is_verbatim_original_pdf===false?'此段轉寫與原圖核驗範圍分開，不作原圖逐字引文。':'',observationText?`來源觀察時點：${observationText}`:'',...layers.map(layer=>`${layer.label}（觀察參照${layer.observation_horizon??'未定'}）：${layer.qualification}`)];
    return {...s,liu_song:true,source_title:s.title||s.source,book_page:bp[0],book_pages:bp,pdf_page:pp[0],pdf_pages:pp,
      source_label:[s.title||s.source,s.volume,s.chapter,bp.length?`書內第${bp.join('、')}頁`:'',pp.length?`PDF第${pp.join('、')}頁`:''].filter(Boolean).join(' · '),
      excerpt:readable(s.excerpt),editorial_label:'來源層與核讀說明',editorial_note:unique(meta).map(readable).join('；')};
  }
  function boundText(bound) {
    if(!bound||bound.lower_year==null&&bound.upper_year==null)return '未詳';
    if(bound.lower_year===bound.upper_year)return `${bound.lower_year}年`;
    return [bound.lower_year==null?'':`${bound.lower_year}年${bound.lower_inclusive===false?'後（不含）':'起'}`,bound.upper_year==null?'':`${bound.upper_year}年${bound.upper_inclusive===false?'前（不含）':'止'}`].filter(Boolean).join('—');
  }
  function boundaryLines(bound,label) {
    if(!bound)return [];
    return [`${label}原文：${bound.raw_text||'未詳'}；原文時間範圍：${boundText(bound.source_bound)}。`,
      `${label}研究約束：${boundText(bound.constrained_bound)}；展示年：${bound.display_year??'未定'}；${bound.is_exact_event_year?'本條另有確年事件依據':'非確切史事年份'}。`,
      bound.reason,bound.observation_model?.limit].filter(Boolean);
  }
  function annotation(item) {
    const r=item.record||item,extra=data().annotation_by_entity?.[r.entity_id]||{},paragraphs=[];
    paragraphs.push(`${levels[r.level]||'政區'}級僑置：${r.qiao===true?'僑置，名稱以下劃線標示':r.qiao===false?'本階段非僑置標記':'性質未定，不能默認為實州郡縣'}。實土：${territories[r.territorial_status]||'未定'}；控制：${controls[r.control_status]||'未詳'}。`);
    if(r.boundary_projection)paragraphs.push(`交替年邊界投射：本條由${item.year===420?421:item.year===479?478:'相鄰'}年資料延續列示，不能作整年存在或實控的確證。`);
    const dc=r.date_context;
    if(dc){paragraphs.push(`原書時段：${dc.source_period_raw||'未詳'}。本階段展示：${dc.display_start??'未定'}—${dc.display_end??'未定'}年。`);paragraphs.push(...boundaryLines(dc.start_boundary,'起界'),...boundaryLines(dc.end_boundary,'終界'));for(const p of dc.excluded_periods||[])paragraphs.push(`本階段另排除：${p.start??p.display_start}—${p.end??p.display_end}；${p.reason||p.note||''}`);}
    paragraphs.push(...list(r.notes),...list(r.territorial_notes));
    const q=r.qiao_annotation||{};
    if(q.rule)paragraphs.push(q.rule);
    for(const context of q.context||[])paragraphs.push(`${relationKinds[context.kind]||'相關記錄'}：${context.label||'未詳'}；${list(context.notes).join('；')}；${context.temporal_applicability==='undated_research_context'?'未定年研究背景，不自動認作本年歸屬。':''}`);
    const markerIds=unique([...list(q.marker_ids),...list(q.snapshot_marker_ids)]);
    for(const id of markerIds){const m=data().markers[id];if(!m)continue;paragraphs.push(`標記 ${m.raw_name||r.name}：原頁${marks[m.source_mark]||m.source_mark||'未定'}；OCR${marks[m.ocr_mark]||m.ocr_mark||'未定'}；${m.pdf_checked?'已核原圖':'未核原圖'}${m.superseded?'（保留較早識讀，後續校讀另列）':''}。${m.note||''}`);}
    for(const id of r.relation_ids||[]){const rel=data().relations[id];if(!rel)continue;paragraphs.push(`${relationKinds[rel.kind]||'關聯'}：${rel.object_label||data().entities?.[rel.object_id]?.base_name||rel.object_id||'未詳'}；展示${rel.display_start??'未定'}—${rel.display_end??'未定'}。${rel.boundary_notes||''}${rel.automatic_annual_application===false?'僅原文觀察，未自動作本年歸屬。':''}`);}
    for(const p of r.parent_observations||[])paragraphs.push(`原典歸屬觀察：${p.label||'未詳'}；${p.raw_date||'未單獨定年'}。${p.notes||''} 本項不自動取代上方年度行政隸屬。`);
    const decisionIds=unique([...list(r.decision_ids),...list(extra.decision_ids)]);
    for(const id of decisionIds){const d=data().decisions[id];if(d)paragraphs.push(`整理判斷 ${id}：${d.reason||''}${typeof d.before==='string'?` 原記錄：${d.before}。`:''}${typeof d.after==='string'?` 採用：${d.after}。`:''}`);}
    for(const id of r.phase_ids||[]){const p=data().phases[id];if(p&&id!==r.phase_id)paragraphs.push(`並見階段（不重複計數）：${p.name||r.name}；${p.period_raw||'年代未詳'}；展示${p.display_start??'未定'}—${p.display_end??'未定'}。${p.display_note||''}`);}
    for(const id of unique([...list(r.issue_ids),...list(extra.issue_ids)])){const issue=data().issues[id];paragraphs.push(`待考 ${id}：${issue?.description||issue?.summary||'保留原問題'}。${issue?.display_treatment||''}`);}
    for(const id of list(extra.territorialization_ids)){const t=data().territorialization[id];if(t)paragraphs.push(`土斷／實土記錄：${t.raw_date||''}；${t.judgment||''} ${t.limit||''}`);}
    if(r.unassigned_reason||r.reason)paragraphs.push(r.reason||pendingReason(r));
    const evidenceIds=unique([...list(r.evidence_ids),...list(q.evidence_ids),...list(r.territorial_evidence_ids),...list(extra.evidence_ids),...(q.context||[]).flatMap(c=>list(c.evidence_ids)),...markerIds.map(id=>data().markers[id]?.evidence_id),...decisionIds.flatMap(id=>list(data().decisions[id]?.supporting_evidence_ids))]);
    const sources=[{liu_song:true,source_label:'年度沿革、侨置与展示依據',excerpt:unique(paragraphs).map(readable).join('\n\n')},...evidenceIds.map(sourceFor).filter(Boolean)];
    return {summary:`${r.name}：年度沿革與來源`,sources,kind:'liu-song-note',label:`${r.name}：沿革與展示判斷`};
  }
  function adapt(record,index,level,year) {
    return {...record,id:record.entity_id||record.id,record,year,order:index,level,
      qiao:record.qiao,uncertain:!!record.uncertain||record.qiao===null||!!record.boundary_projection,
      entity:record,source:(record.evidence_ids||[]).map(sourceFor).find(Boolean)||null,
      phase:{raw:record.date_context?.source_period_raw,administrative_count:true},
      kingdom:false,ruler:null,chenFiefs:[],liangFiefs:[],fiveRankFiefs:[],counties:[]};
  }
  function buildSnapshot(year) {
    const annual=data().getYear(year),seen=new Set();
    const adopt=(r,index,level)=>{const id=r.entity_id||r.id;if(r.main_display===false||seen.has(id))return null;seen.add(id);return adapt(r,index,level,year);};
    const states=annual.states.map((r,index)=>{const state=adopt(r,index,'state');if(!state)return null;state.filterKey=`liu-song:${state.id}`;state.group='liu-song';state.groupLabel='劉宋';state.rows=[];
      for(const [i,p]of(r.prefectures||[]).entries()){const row=adopt(p,i,'prefecture');if(!row)continue;row.counties=(p.counties||[]).map((c,j)=>adopt(c,j,'county')).filter(Boolean);state.rows.push(row);}
      const direct=(r.direct_counties||[]).map((c,i)=>adopt(c,i,'county')).filter(Boolean);
      if(direct.length)state.rows.push({id:`${state.id}:parent-unresolved`,name:'',displayLabel:'郡屬未定',directCounties:true,phase:{administrative_count:false},counties:direct});
      return state;
    }).filter(Boolean);
    return {states,virtualFiefs:[],annual,unassigned:annual.unassigned};
  }
  function pendingReason(record){return ({parent_unresolved:'行政上級尚未確定',parent_inactive:'候選上級本年未列入',multiple_parents:'存在多個上級候選',parent_not_present:'所屬上級本年未列入'})[record.unassigned_reason]||record.unassigned_reason||record.reason||'尚待核定。';}
  function pending(year) {
    const annual=data().getYear(year),seen=new Set(),assigned=[];
    const walk=r=>{const id=r.entity_id||r.id;if(!seen.has(id)){seen.add(id);assigned.push({...r,year,pending_kind:'parentage'});}for(const p of r.prefectures||[])walk(p);for(const c of r.counties||[])walk(c);for(const c of r.direct_counties||[])walk(c);};
    for(const record of annual.unassigned||[])walk(record);
    const undated=(annual.undated_refs||[]).map(record=>({...record,year,pending_kind:'undated'}));
    return {unassigned:assigned,undated};
  }
  function boundaryNotice(year){return year===420?'420年 · 晉宋交替：本年部分條目由421年資料作邊界投射，逐行標明；不能視為整年宋制或確切始置。':year===479?'479年 · 宋齊交替：本年宋制指交替前時段；部分條目由478年資料投射，不稱479年末宋制，亦非確切廢置年。':'';}
  global.LIU_SONG_VIEW={buildSnapshot,annotation,pending,pendingReason,sourceFor,boundaryNotice,method};
})(window);
