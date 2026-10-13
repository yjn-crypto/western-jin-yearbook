/* Southern Qi annual display. Auxiliary offices retain their hierarchy and separate counts. */
(function (global) {
  'use strict';
  const levels={state:'州',prefecture:'郡',county:'縣',administrative_office:'輔助行政機構'};
  const territories={territorial:'有實土',nonterritorial:'無實土',mixed:'實土與僑置情況並存',uncertain:'實土狀態未定'};
  const controls={attested:'有控制記載',nominal:'名義控制',disputed:'控制存疑',unknown:'控制範圍未詳'};
  const marks={underline:'有下劃線',no_underline:'無下劃線',unclear:'未辨清',missing:'OCR未識出',uncertain:'未定'};
  const relationKinds={origin:'原屬',hosted_at:'寄治',administrative_parent:'行政隸屬',control:'實際控制'};
  const method=[
    '南齊第一輪依《中國行政區劃通史》第七編、497年斷代表及第十編僑州郡縣考表，與《南齊書》對讀。展示479—502年；正文採479—501年的括號年份，不重算半年法。原有827項待考、61組結構問題及497年對讀差異均保留入口。',
    '479年只表示南齊成立以後的行政狀態。502年僅指齊梁交替以前的研究參考；由501年延續者逐條標示「邊界投射」，不稱502年末齊制。首次列入、原書時段及展示起訖不直接等於確切始置、廢省或失陷年份。',
    '僑州、僑郡、僑縣各依本級證據以下劃線標示；僑性未定明標，不能從上下級繼承。原頁線條、OCR識讀與原圖核驗分開。僑置、實土、控制、人口及行政活動是獨立屬性；荒或無民戶不直接證明僑置或無實土，不以494年統一撤除僑標。',
    '寧蠻府在雍州內另列輔助機構分組，所領郡縣各計一次；北部都尉亦另計輔助機構，不充作郡。上方州郡縣數只計目前主表；未定統屬保留原有父子層級，不憑同名補父級；不定年階段不據此另計本年。',
    '《南齊書》主志採490年斷限是《通史》的研究選擇，497年是另編斷代表，均不等於逐句觀察年。永明三年戶口簿為485年；永元元年地志、二年志、三年志分別為499、500、501年，未明年次的永元志保留499—501年範圍。引書缺載不自動證明機構不存在。',
    '地圖獨立採南齊年度資料、當年CHGIS治所和郡界、譚圖497年參考範圍；其他年度依有據沿革調整。參考範圍不等於逐年精確控制線，失守不等於法理撤銷。無可靠資料不造治所或新郡界，縣域面與縣界不展示；輔助機構無獨立州郡面。'
  ];
  const data=()=>global.SOUTHERN_QI_DATA;
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
    const verification={pdf_checked:'已核原圖',original_text_checked:'已核原典文字',local_ocr_text_checked:'已核本地OCR轉寫',local_epub_text_checked:'已核本地電子文本',ocr_only:'OCR轉寫',unresolved:'核讀待定'};
    const scopes={names_underlines_and_page_locator_only:'原圖僅核名稱、下劃線及頁碼，不代表整段逐字校讀'};
    const layers=list(data().paragraph_citations?.[id]?.layers).map(key=>data().source_layers[key]).filter(Boolean);
    const observation=s.observation_date;
    const reference=observation?.compilation_reference_only;
    const observationText=typeof observation==='number'?`${observation}年`:typeof observation==='string'?observation:observation?[
      observation.year!=null?`觀察年：${observation.year}`:'',
      Array.isArray(observation.source_scope)?`來源範圍：${observation.source_scope.join('—')}年`:'',
      reference?.tongshi_adopted_main_horizon!=null?`《通史》採主志斷限：${reference.tongshi_adopted_main_horizon}年`:'',
      reference?.project_snapshot!=null?`《通史》另編斷代表：${reference.project_snapshot}年`:'',
      reference?'上述研究斷面不等同逐句觀察年':'',observation.mode==='methodological_choice'?'作者的斷代研究選擇，非本條事件發生年':'',observation.note
    ].filter(Boolean).join('；'):'';
    const meta=[s.edition,verification[s.verification],s.correction_note,s.relevance,scopes[s.verification_scope]||'',s.quote_is_verbatim_original_pdf===false?'此段轉寫與原圖核驗範圍分開，不作原圖逐字引文。':'',observationText?`來源觀察時點：${observationText}`:'',...layers.map(layer=>`${layer.label}（觀察參照${layer.observation_horizon!=null?`${layer.observation_horizon}年`:layer.source_year_bounds?.join('—')||'未定'}）：${layer.qualification}`)];
    return {...s,southern_qi:true,source_title:s.title||s.source,book_page:bp[0],book_pages:bp,pdf_page:pp[0],pdf_pages:pp,
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
    const roles={attestation:'來源見載',foundation:'設置',abolition:'廢省',transfer:'轉屬',rename:'改名',observation:'觀察時點'},qualifiers={exact:'來源表列年',before:'此前',after:'此後',uncertain:'存疑',unknown:'未詳',circa:'約年'},bases={evidence_bounded_projection:'依證據約束作展示投射',earliest_compatible:'採不衝突的最早展示年',source_exact:'依來源明年',observation_anchor:'觀察錨點'};
    return [`${label}原文：${bound.raw_text||'未詳'}；原文時間範圍：${boundText(bound.source_bound)}。`,
      [roles[bound.event_role]?`史事性質：${roles[bound.event_role]}`:'',qualifiers[bound.qualifier]?`來源限定：${qualifiers[bound.qualifier]}`:'',bases[bound.display_basis]?`展示依據：${bases[bound.display_basis]}`:''].filter(Boolean).join('；'),
      `${label}研究約束：${boundText(bound.constrained_bound)}；展示年：${bound.display_year??'未定'}；${bound.is_exact_event_year?'本條另有確年事件依據':'非確切史事年份'}。`,
      bound.reason,bound.observation_model?.limit].filter(Boolean);
  }
  function annotation(item) {
    const r=item.record||item,extra=data().annotation_by_entity?.[r.entity_id]||{},paragraphs=[];
    paragraphs.push(`${levels[r.level]||'政區'}級僑置：${r.qiao===true?'僑置，名稱以下劃線標示':r.qiao===false?'本階段非僑置標記':'性質未定，不能默認為實州郡縣'}。實土：${territories[r.territorial_status]||'未定'}；控制：${controls[r.control_status]||'未詳'}。`);
    const population={unknown:'未詳',source_reports_no_registered_households:'來源記無登記民戶',uncertain:'未定'};
    const activity={unknown:'未詳',uncertain:'行政活動未定',active:'有活動記載',inactive:'無活動記載'};
    paragraphs.push(`人口記錄：${population[r.population_status]||r.population_status||'未詳'}；行政活動：${activity[r.administrative_activity]||r.administrative_activity||'未詳'}。人口缺載、荒或無民戶不直接判作僑置或無實土。`);
    if(r.level==='administrative_office')paragraphs.push('本條為輔助行政機構，另計機構數，不計入州、郡數；其下轄郡縣按各自層級各計一次。');
    if(item.year===479)paragraphs.push('交替年範圍：479年只指南齊成立後，不作整年齊制。');
    if(r.boundary_projection)paragraphs.push(`交替年邊界投射：本條由${item.year===502?501:'相鄰'}年资料延續列示，不能作整年存在、實控或確切置廢的證據；502年僅指齊梁交替前。`);
    const dc=r.date_context;
    if(dc){paragraphs.push(`原書時段：${dc.source_period_raw||'未詳'}。本階段展示：${dc.display_start??'未定'}—${dc.display_end??'未定'}年。`);paragraphs.push(...boundaryLines(dc.start_boundary,'起界'),...boundaryLines(dc.end_boundary,'終界'));for(const p of dc.excluded_periods||[])paragraphs.push(`本階段另排除：${p.start??p.display_start}—${p.end??p.display_end}；${p.reason||p.note||''}`);}
    paragraphs.push(...list(r.notes),...list(r.territorial_notes));
    const q=r.qiao_annotation||{};
    if(q.rule)paragraphs.push(q.rule);
    for(const context of q.context||[])paragraphs.push(`${relationKinds[context.kind]||'相關記錄'}：${context.label||'未詳'}；${list(context.notes).join('；')}；${context.temporal_applicability==='undated_research_context'?'未定年研究背景，不自動認作本年歸屬。':''}`);
    const markerIds=unique([...list(q.marker_ids),...list(q.snapshot_marker_ids)]);
    for(const id of markerIds){const m=data().markers[id];if(!m)continue;paragraphs.push(`標記 ${m.raw_name||r.name}：原頁${marks[m.source_mark]||m.source_mark||'未定'}；OCR${marks[m.ocr_mark]||m.ocr_mark||'未定'}；${m.pdf_checked?'已核原圖':'未核原圖'}${m.superseded?'（保留較早識讀，後續校讀另列）':''}。${m.note||''}`);}
    for(const id of unique([...list(r.relation_ids),...list(extra.relation_ids)])){const rel=data().relations[id];if(!rel)continue;paragraphs.push(`${relationKinds[rel.kind]||'關聯'}：${rel.object_label||data().entities?.[rel.object_id]?.base_name||rel.object_id||'未詳'}；展示${rel.display_start??'未定'}—${rel.display_end??'未定'}。${rel.boundary_notes||''}${rel.automatic_annual_application===false?'僅原文觀察，未自動作本年歸屬。':''}`);}
    for(const p of r.parent_observations||[])paragraphs.push(`原典歸屬觀察：${p.label||'未詳'}；${p.raw_date||'未單獨定年'}。${p.notes||''} 本項不自動取代上方年度行政隸屬。`);
    const decisionIds=unique([...list(r.decision_ids),...list(extra.decision_ids)]);
    for(const id of decisionIds){const d=data().decisions[id];if(d)paragraphs.push(`整理判斷 ${id}：${d.reason||''}${typeof d.before==='string'?` 原記錄：${d.before}。`:''}${typeof d.after==='string'?` 採用：${d.after}。`:''}`);}
    for(const id of r.phase_ids||[]){const p=data().phases[id];if(p&&id!==r.phase_id)paragraphs.push(`並見階段（不重複計數）：${p.name||r.name}；${p.period_raw||'年代未詳'}；展示${p.display_start??'未定'}—${p.display_end??'未定'}。${p.display_note||''}`);}
    for(const id of unique([...list(r.issue_ids),...list(extra.issue_ids)])){const issue=data().issues[id];paragraphs.push(`待考 ${id}：${issue?.description||issue?.summary||'保留原問題'}。${issue?.display_treatment||''}`);}
    for(const id of list(extra.territorialization_ids)){const t=data().territorialization[id];if(t)paragraphs.push(`土斷／實土記錄：${t.raw_date||''}；${t.judgment||''} ${t.limit||''}`);}
    if(r.unassigned_reason||r.reason)paragraphs.push(r.reason||pendingReason(r));
    const evidenceIds=unique([...list(r.evidence_ids),...list(q.evidence_ids),...list(r.territorial_evidence_ids),...list(extra.evidence_ids),...(q.context||[]).flatMap(c=>list(c.evidence_ids)),...markerIds.map(id=>data().markers[id]?.evidence_id),...decisionIds.flatMap(id=>list(data().decisions[id]?.supporting_evidence_ids))]);
    const sources=[{southern_qi:true,source_label:'年度沿革、侨置与展示依據',excerpt:unique(paragraphs).map(readable).join('\n\n')},...evidenceIds.map(sourceFor).filter(Boolean)];
    return {summary:`${r.name}：年度沿革與來源`,sources,kind:'southern-qi-note',label:`${r.name}：沿革與展示判斷`};
  }
  function adapt(record,index,level,year) {
    return {...record,id:record.entity_id||record.id,record,year,order:index,level,
      qiao:record.qiao,uncertain:!!record.uncertain||record.qiao===null||!!record.boundary_projection,
      entity:record,source:(record.evidence_ids||[]).map(sourceFor).find(Boolean)||null,
      phase:{raw:record.date_context?.source_period_raw,administrative_count:true},
      kingdom:false,ruler:null,chenFiefs:[],liangFiefs:[],fiveRankFiefs:[],counties:[]};
  }
  function buildSnapshot(year) {
    const annual=data().getYear(year),seen=new Set(),offices=[];
    const adopt=(r,index,level)=>{const id=r.entity_id||r.id;if(r.main_display===false||seen.has(id))return null;seen.add(id);return adapt(r,index,level,year);};
    const states=annual.states.map((r,index)=>{
      const state=adopt(r,index,'state');if(!state)return null;
      state.filterKey=`southern-qi:${state.id}`;state.group='southern-qi';state.groupLabel='南齊';state.rows=[];
      const appendChildren=(parent,chain=[])=>{
        for(const p of parent.prefectures||[]){const row=adopt(p,state.rows.length,p.level||'prefecture');if(!row)continue;row.office_chain=chain;row.counties=(p.counties||[]).map((c,j)=>adopt(c,j,'county')).filter(Boolean);state.rows.push(row);}
        const direct=(parent.direct_counties||[]).map((c,i)=>adopt(c,i,'county')).filter(Boolean);
        if(direct.length)state.rows.push({id:`${parent.entity_id}:parent-unresolved`,name:'',displayLabel:'郡屬未定',directCounties:true,office_chain:chain,phase:{administrative_count:false},counties:direct});
        for(const o of parent.administrative_offices||[]){
          const office=adopt(o,state.rows.length,'administrative_office');if(!office)continue;
          office.administrativeOfficeHeader=true;office.phase.administrative_count=false;office.office_chain=chain;
          state.rows.push(office);offices.push(office);appendChildren(o,[...chain,office.id]);
        }
      };
      appendChildren(r);return state;
    }).filter(Boolean);
    return {states,offices,virtualFiefs:[],annual,unassigned:annual.unassigned};
  }
  function pendingReason(record){return ({parent_unresolved:'行政上級尚未確定',parent_inactive:'候選上級本年未列入',multiple_parents:'存在多個上級候選',parent_not_present:'所屬上級本年未列入'})[record.unassigned_reason]||record.unassigned_reason||record.reason||'尚待核定。';}
  function pending(year) {
    const annual=data().getYear(year),seen=new Set();
    const walk=r=>{
      const id=r.entity_id||r.id;if(seen.has(id))return null;seen.add(id);
      const children=[...list(r.prefectures),...list(r.administrative_offices),...list(r.direct_counties),...list(r.counties)].map(walk).filter(Boolean);
      return {...r,year,pending_kind:'parentage',pending_children:children};
    };
    return {unassigned:(annual.unassigned||[]).map(walk).filter(Boolean),undated:(annual.undated_refs||[]).map(r=>({...r,year,pending_kind:'undated',pending_children:[]}))};
  }
  function boundaryNotice(year){return year===479?'479年 · 宋齊交替：本年只指南齊成立後的行政狀態，不表示整年均屬齊制，亦非各機構的確切始置年。':year===502?'502年 · 齊梁交替：本年僅作交替前的研究參考；由501年延續者逐條標示「邊界投射」，不宣稱502年末仍為齊制。':'';}
  global.SOUTHERN_QI_VIEW={buildSnapshot,annotation,pending,pendingReason,sourceFor,boundaryNotice,method};
})(window);
