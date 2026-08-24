(() => {
  'use strict';

  const DYNASTIES = {
    'western-jin': {
      key: 'western-jin', label: '西晉', theme: 'metal', data: window.JIN_DATA,
      years: window.JIN_DATA ? window.JIN_DATA.meta.years : [266,316], defaultYear: 304,
      subtitle: '選擇公元年份，按州查看該年年末的郡國與所轄縣級政區。'
    },
    'southern-liang': {
      key: 'southern-liang', label: '蕭梁', theme: 'fire', data: window.LIANG_DATA,
      years: window.LIANG_DATA ? window.LIANG_DATA.meta.years : [502,557], defaultYear: 546,
      subtitle: '選擇公元年份，查看蕭梁州郡縣、都督／刺史、封爵與僑置政區。'
    },
    chen: {
      key: 'chen', label: '南陳', theme: 'earth', data: window.CHEN_DATA,
      years: window.CHEN_DATA ? [557,window.CHEN_DATA.meta.years[1]] : [557,588], defaultYear: 588,
      subtitle: '選擇紀年，查看南陳州郡縣、方鎮長官、封爵及同時期後梁、王琳政區。'
    }
  };

  const $ = (id) => document.getElementById(id);
  const dynastySelect = $('dynastySelect');
  const yearSelect = $('yearSelect');
  const stateSelect = $('stateSelect');
  const searchInput = $('searchInput');
  const changedOnly = $('changedOnly');
  const results = $('results');
  const sourceModal = $('sourceModal');
  const sourceModalClose = $('sourceModalClose');
  const yearMapPanel = $('yearMapPanel');
  const yearMapViewport = $('yearMapViewport');
  const yearMapStage = $('yearMapStage');
  const yearMapImage = $('yearMapImage');
  const yearMapOverlay = $('yearMapOverlay');
  const yearMapZoomValue = $('yearMapZoomValue');
  const yearMapLoadUhd = $('yearMapLoadUhd');
  const yearMapUhd = $('yearMapUhd');
  const yearMapCsv = $('yearMapCsv');
  const yearMapGeoJson = $('yearMapGeoJson');
  const yearMapExport = $('yearMapExport');
  const yearMapNote = $('yearMapNote');
  const textMapLinkControl = $('textMapLinkControl');
  const textMapLinkToggle = $('textMapLinkToggle');
  const liangReviewPanel = $('liangReviewPanel');
  const liangReviewCount = $('liangReviewCount');
  const liangGovernorYearbookSwitch = $('liangGovernorYearbookSwitch');
  const liangGovernorYearbookLink = $('liangGovernorYearbookLink');
  const citationRegistry = new Map();
  const auxInfoRegistry = new Map();
  let auxInfoSequence = 0;
  let currentDynasty = DYNASTIES['western-jin'];
  let currentMap = null;
  let currentMapFeatures = [];
  let mapZoom = 1;
  let mapUhdLoaded = false;
  let mapDrag = null;
  const initialParams = new URLSearchParams(window.location.search);
  const requestedDynasty = initialParams.get('dynasty');
  const requestedYear = Number(initialParams.get('year')) || null;
  const requestedState = initialParams.get('state') || '';
  const EXTRA_GOVERNOR_FILTER_PREFIX = 'governor-extra:';
  let initialLocationApplied = false;

  function formatYearLabel(year) {
    if (currentDynasty.key === 'chen') {
      if (Number(year)===557) return '永定元年·丁丑（557）';
      return window.CHEN_GOVERNORS?.year_labels?.[String(year)] || `公元${year}年`;
    }
    if (currentDynasty.key === 'southern-liang') {
      const label=window.LIANG_GOVERNORS?.years?.[String(year)]?.label || '';
      return label.match(/^.*?[（(]\d{3}[）)]/)?.[0] || `公元${year}年`;
    }
    return `公元 ${year} 年`;
  }

  function normalizeName(value) {
    return String(value || '')
      .replace(/[\s·`?？※、，,。；;（）()\[\]]/g, '')
      .replace(/錢唐/g, '錢塘')
      .replace(/[鍾鐘]/g, '鍾')
      .replace(/脩/g, '修')
      .replace(/候官/g, '侯官')
      .replace(/(王國|公國|侯國|伯國|子國|男國|國|郡|尹|縣|州)$/g, '')
      .replace(/臺/g, '台');
  }

  function activePhase(entity, year) {
    return (entity.phases || entity.ph || [])
      .filter((phase) => Number(phase.start) <= year && year <= Number(phase.end))
      .sort((a,b) => Number(b.start) - Number(a.start))[0] || null;
  }

  function effectiveOrder(entity, phase, year) {
    if (phase && Number.isFinite(Number(phase.order))) return Number(phase.order);
    const override = (entity.order_overrides || [])
      .filter((item) => Number(item.start) <= year && year <= Number(item.end))
      .sort((a,b) => Number(b.start) - Number(a.start))[0];
    return override ? Number(override.order) : Number(entity.order ?? entity.o ?? 0);
  }

  function sourceKey(source) {
    if (!source) return '';
    return `${source.book_page || ''}|${source.pdf_page || ''}|${source.excerpt || ''}|${source.editorial_note || ''}|${source.origin || ''}`;
  }

  function dedupeSources(sources) {
    const seen = new Set();
    const out = [];
    for (const source of sources || []) {
      const key = sourceKey(source);
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push(source);
    }
    return out;
  }

  function isKingdom(name, level, phase) {
    if (phase && typeof phase.is_fief === 'boolean') return phase.is_fief;
    if (level !== 'prefecture') return false;
    const n = String(name || '');
    if (n.includes('屬國都尉')) return false;
    return /(王國|公國|侯國|國)$/.test(n);
  }

  function mapById(items) { return new Map((items || []).map((item) => [item.id,item])); }

  function makeChange(summary, sources, kind, label) {
    return { summary, sources: dedupeSources(sources), kind, label, number: null };
  }

  function makeAnnotation(summary, sources, kind, label) {
    return { summary, sources: dedupeSources(sources), kind, label, number: null, annotation: true };
  }

  function yearNote(entity, year) {
    const note = entity?.year_notes?.[String(year)];
    if (!note) return null;
    const sources = Array.isArray(note.sources) ? note.sources : [note.source || entity.source].filter(Boolean);
    return makeAnnotation(note.summary || '人工校勘註記', sources, 'editorial-note', note.label || note.summary || '人工校勘註記');
  }

  function qiaoNote(entity, phase, year) {
    const note = phase?.qiao_annotation || entity?.qiao_annotation;
    if (note) {
      const sources = Array.isArray(note.sources) ? note.sources : [note.source || phase?.source || entity?.source].filter(Boolean);
      return makeAnnotation(note.summary || '僑置政區註記', sources, 'qiao-note', note.label || note.summary || '僑置政區註記');
    }
    const info=entity?.qi || entity?.qiao_info;
    if (!info) return null;
    const parts=[];
    if (info.original_state) parts.push(`原屬州：${info.original_state}`);
    if (info.original_prefecture) parts.push(`原屬郡：${info.original_prefecture}`);
    if (info.marker==='liang_only') parts.push('僑置考表：梁有陳無');
    else if (info.marker==='chen_only') parts.push('僑置考表：陳有梁無');
    else if (info.marker==='both') parts.push('僑置考表：梁、陳皆有');
    const summary=parts.join('；') || '僑置政區註記';
    const origin=[info.original_state,info.original_prefecture].filter(Boolean).join('·');
    const source={
      book_page:info.qiao_table_page_index || null,
      excerpt:`《中國行政區劃通史》僑州郡縣考表：${summary}。`,
      origin
    };
    return makeAnnotation(summary,[source],'qiao-note',summary);
  }

  // ---------- 西晉封國補充 ----------
  function baseFiefName(name) {
    return String(name || '').replace(/(王國|公國|侯國|國)$/g,'').trim();
  }

  function chineseNumber(value) {
    const n = Number(value), d = ['零','一','二','三','四','五','六','七','八','九'];
    if (!Number.isInteger(n) || n <= 0) return String(value);
    if (n < 10) return d[n];
    if (n === 10) return '十';
    if (n < 20) return `十${d[n-10]}`;
    if (n < 100) return `${d[Math.floor(n/10)]}十${n%10 ? d[n%10] : ''}`;
    return String(n);
  }

  function reignYearLabel(year,start) {
    const n = Number(year)-Number(start)+1;
    return n === 1 ? '元年' : `${chineseNumber(n)}年`;
  }

  function findJinRuler(name,year) {
    const records = (window.JIN_PRINCES && window.JIN_PRINCES.records) || [];
    const fief = baseFiefName(name);
    const all = records.filter((r) => r.fief === fief);
    const active = all.filter((r) => Number(r.start) <= year && (r.end == null || year <= Number(r.end)));
    if (!active.length) return {status:all.length?'gap':'absent',fief,label:'國主未詳',records:all};
    active.sort((a,b) => Number(b.start)-Number(a.start) || Number(b.sequence||0)-Number(a.sequence||0));
    const record = active[0];
    return {status:'matched',fief,record,active,label:`${record.title}${record.person}之${reignYearLabel(year,record.start)}`};
  }

  function findJinFiveRank(entityId,year) {
    const records = (window.JIN_FIVE_RANK_FIEFS && window.JIN_FIVE_RANK_FIEFS.records) || [];
    const out=[];
    for (const record of records) {
      const period=(record.target_periods||[]).find((p)=>p.target_id===entityId && Number(p.start)<=year && year<=Number(p.end));
      if (period) out.push({record,period});
    }
    return out;
  }

  function jinFiveRankLabel(match) {
    const names=match.period.holder_names||[];
    const holder=names.length ? `·${names.join('／')}` : '·封君未詳';
    const inferred=match.period.uncertain || !match.period.holder_exact ? '（推定）' : '';
    return `${match.record.classification}${holder}${inferred}`;
  }

  function jinFiveRankInfo(match,year) {
    const {record,period}=match;
    return {
      title:'五等爵封國資料', summary:`${record.fief}：${jinFiveRankLabel(match)}`,
      paragraphs:[
        `所選年份：公元${year}年。爵等：${record.classification}。`,
        record.description ? `封授說明：${record.description}` : '',
        `本年封君：${(period.holder_names||[]).join('、') || '未詳'}。`,
        period.uncertain ? '本條起訖或承襲年代不完整，故以「推定」標示。' : '',
        window.JIN_FIVE_RANK_FIEFS?.meta?.caveat || ''
      ].filter(Boolean),
      sourceLabel:`${record.source_page_title || '維基百科封爵列表'}${record.source_pdf_page ? `（下載版第 ${record.source_pdf_page} 頁）` : ''}`,
      sourceUrl:record.source_url
    };
  }

  function jinRulerInfo(ruler,year) {
    if (!ruler || ruler.status !== 'matched') {
      return {title:'宗室封國資料',summary:'國主未詳',paragraphs:['現有藩王年表未能提供覆蓋本年的唯一國主。']};
    }
    const r=ruler.record;
    return {
      title:'宗室封國資料', summary:ruler.label,
      paragraphs:[`所選年份：公元${year}年。`,`王號：${r.title}。國主：${r.person}。`,`表列在位：${r.start}—${r.end ?? '未詳'}年。`],
      sourceLabel:'維基百科〈晉朝藩王列表〉', sourceUrl:window.JIN_PRINCES?.meta?.source_url
    };
  }

  // ---------- 南陳封爵補充 ----------
  function activeChenFiefPhase(record,year) {
    return (record.phases||[]).find((p)=>Number(p.start)<=year && year<=Number(p.end)) || null;
  }

  function activeChenDisplay(record,year) {
    return (record.display_periods||[])
      .filter((p)=>Number(p.start)<=year && year<=Number(p.end))
      .sort((a,b)=>Number(b.start)-Number(a.start))[0] || null;
  }

  function activeChenEditorialNotes(record,year) {
    return (record.editorial_notes||[])
      .filter((n)=>Number(n.year)===year || (Number(n.start)<=year && year<=Number(n.end)))
      .map((n)=>n.text)
      .filter(Boolean);
  }

  function chenHolderNames(record,year) {
    let candidates=(record.holders||[]).filter((h)=>Number(h.start)<=year && year<=Number(h.end) && h.person && !/[？?]/.test(h.person));
    const nonPosthumous=candidates.filter((h)=>!String(h.time_text||'').includes('追封'));
    if (nonPosthumous.length) candidates=nonPosthumous;
    const exact=candidates.filter((h)=>!h.uncertain);
    if (exact.length) {
      const latest=Math.max(...exact.map((h)=>Number(h.start)));
      candidates=exact.filter((h)=>Number(h.start)===latest);
    } else if (candidates.length) {
      const latest=Math.max(...candidates.map((h)=>Number(h.start)));
      candidates=candidates.filter((h)=>Number(h.start)===latest);
    }
    return [...new Set(candidates.map((h)=>h.person))];
  }

  function chenFiefText(match) {
    const {record,phase,holders,display}=match;
    if (display?.text) return display.text;
    const people=holders.length ? holders.join('／') : '封君未詳';
    if (record.kind === 'prince') return `${phase.fief}王·${people}`;
    if (record.level === 'prefecture' && record.rank === '公') return `郡公·${people}`;
    return `${record.rank}國·${people}`;
  }

  function chenFiefInfo(match,year) {
    const {record,phase,holders,reason,display}=match;
    const holderRows=(record.holders||[]).map((h)=>`${h.title || record.label}：${h.person || '未詳'}${h.time_text ? `（${h.time_text}）` : ''}`);
    const editorialNotes=activeChenEditorialNotes(record,year);
    return {
      title:record.kind==='prince'?'南陳宗室王國資料':'南陳開國爵資料',
      summary:`${phase.fief}國：${chenFiefText(match)}`,
      paragraphs:[
        `所選年份：${formatYearLabel(year)}。表列封國存續：${phase.raw || `${phase.start}—${phase.end}`}。`,
        `本年狀態：${chenFiefText(match)}。${display?.mourning?'本年按服喪期處理。':''}${display?.inferred?'本年起訖屬本文依考據規則推定。':''}${display?.uncertain?'本年資料不足，按存疑規則以斜體顯示。':''}`,
        ...editorialNotes.map((t)=>`本文考據註記：${t}`),
        `本年封君／承襲人：${holders.join('、') || display?.people?.join('、') || '未詳'}。`,
        record.original_affiliation ? `原屬：${record.original_affiliation}。` : '',
        reason ? `未附於郡縣的原因：${reason}。` : '',
        record.description ? `年表說明：${record.description}` : '',
        `原年表所列承襲：${holderRows.join('；') || '未詳'}。`
      ].filter(Boolean),
      sourceLabel:record.source_title || '維基百科南朝封爵年表', sourceUrl:record.source_url
    };
  }

  // ---------- 蕭梁封爵補充 ----------
  function activeLiangFiefPhase(record,year) {
    return (record.phases||[]).find((p)=>Number(p.start)<=year && year<=Number(p.end)) || null;
  }

  function resolveLiangHolder(record,year) {
    const holders=record.holders||[];
    let exact=holders.filter((h)=>h.start!=null&&h.end!=null&&Number(h.start)<=year&&year<=Number(h.end));
    if (exact.length) {
      const nonPosthumous=exact.filter((h)=>!h.posthumous);
      if (nonPosthumous.length) exact=nonPosthumous;
      exact.sort((a,b)=>Number(b.start)-Number(a.start));
      return {status:exact[0].uncertain?'uncertain':'exact',holder:exact[0]};
    }
    const prev=holders.filter((h)=>!h.posthumous&&h.end!=null&&Number(h.end)<year).sort((a,b)=>Number(b.end)-Number(a.end))[0];
    const next=holders.filter((h)=>!h.posthumous&&h.start!=null&&Number(h.start)>year).sort((a,b)=>Number(a.start)-Number(b.start))[0];
    if (prev&&next&&Number(next.start)===Number(prev.end)+3&&year>=Number(prev.end)+1&&year<=Number(prev.end)+2) {
      return {status:'mourning',holder:{person:'世子服喪'},prev,next};
    }
    const loose=holders.find((h)=>h.start==null||h.end==null);
    return {status:'uncertain',holder:loose||{person:'封君存疑'},prev,next};
  }

  function liangFiefText(match) {
    const {record,phase,status,holder}=match;
    const person=holder?.person||'封君存疑';
    if (status==='mourning') return `${phase.fief}${record.rank==='王'?'王':'國'}·世子服喪`;
    if (record.kind==='prince'||record.rank==='王') return `${phase.fief}王·${person}${status==='uncertain'?' ※':''}`;
    return `${record.rank}國·${person}${status==='uncertain'?' ※':''}`;
  }

  function liangFiefInfo(match,year) {
    const {record,phase,status,holder,reason,prev,next}=match;
    const holderRows=(record.holders||[]).map((h)=>`${h.person||'未詳'}：${h.start??'？'}—${h.end??'？'}${h.relation?`（${h.relation}）`:''}${h.posthumous?'（追封）':''}`);
    return {
      title:record.kind==='prince'?'蕭梁宗室王國資料':'蕭梁開國爵資料',
      summary:`${phase.fief}國：${liangFiefText(match)}`,
      paragraphs:[
        `所選年份：${formatYearLabel(year)}。表列封國存續：${phase.start}—${phase.end}年。`,
        `本年狀態：${liangFiefText(match)}。`,
        status==='mourning'&&prev&&next ? `本文按承襲規則將${prev.person}卒後至${next.person}襲封前的兩年標作服喪。` : '',
        status==='uncertain' ? '本年封君或承襲起訖缺乏完整材料，故以「※」和存疑底色顯示。' : '',
        reason ? `未附於郡縣的原因：${reason}。` : '',
        record.note ? `年表說明：${record.note}` : '',
        `原年表所列承襲：${holderRows.join('；') || '未詳'}。`
      ].filter(Boolean),
      sourceLabel:'維基百科南朝封爵列表',
      sourceUrl:record.source_url
    };
  }

  function activeFiefText(match) {
    return currentDynasty.key==='southern-liang' ? liangFiefText(match) : chenFiefText(match);
  }

  function activeFiefInfo(match,year) {
    return currentDynasty.key==='southern-liang' ? liangFiefInfo(match,year) : chenFiefInfo(match,year);
  }

  // ---------- 蕭梁、南陳都督／刺史 ----------
  function governorData() {
    return currentDynasty.key==='southern-liang' ? window.LIANG_GOVERNORS : window.CHEN_GOVERNORS;
  }

  function governorRecords(year) {
    return governorData()?.years?.[String(year)]?.records || [];
  }

  function governorSummaryLines(record) {
    return (record?.summary_lines||[])
      .map((line)=>String(line||'').replace(/^#+\s*/, '').trim())
      .filter(Boolean);
  }

  function governorInfo(record,year) {
    const summary=governorSummaryLines(record);
    const evidence=record.evidence_lines || [];
    const data=governorData();
    return {
      title:'都督/刺史與方鎮史料',
      summary:`${formatYearLabel(year)} · ${record.state}`,
      paragraphs:[
        ...(summary.length ? summary.map((line,index)=>`${index===0?'年表所列：':'　'}${line}`) : ['本年年表未列可考長官。']),
        ...((record.editorial_notes||[]).map((t)=>`人工校勘：${t}`)),
        record.source_page_index ? `方鎮年表資料頁序：${record.source_page_index}。` : '',
        ...(evidence.length ? ['相關考證與史料：', ...evidence] : [])
      ].filter(Boolean),
      sourceLabel:data?.meta?.source || '魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》方鎮年表',
      actionLabel:currentDynasty.key==='southern-liang' ? `在蕭梁刺史年表定位${record.state}` : '',
      actionUrl:currentDynasty.key==='southern-liang' ? governorYearbookHref(year,record.state,'detail') : ''
    };
  }

  function governorYearbookHref(year,state='',from='main') {
    const url=new URL('liang-governor-yearbook.html',window.location.href);
    if(year)url.searchParams.set('year',String(year));
    if(state)url.searchParams.set('state',state);
    if(from)url.searchParams.set('from',from);
    return url.href;
  }

  function updateLiangGovernorYearbookSwitch(year) {
    if(!liangGovernorYearbookLink)return;
    liangGovernorYearbookLink.href=governorYearbookHref(year,'','main');
  }

  function attachGovernors(states,year,targetGroup) {
    const extras=[];
    for (const state of states) state.governor=null;
    for (const record of governorRecords(year)) {
      const summaryLines=governorSummaryLines(record);
      if (!summaryLines.length) continue;
      const displayRecord={...record,summary_lines:summaryLines};
      const key=normalizeName(record.state);
      const candidates=states.filter((s)=>s.group===targetGroup && normalizeName(s.name)===key);
      let target=null;
      if (record.target_id) target=candidates.find((s)=>s.id===record.target_id) || null;
      else if (candidates.length===1) target=candidates[0];
      if (target) target.governor=displayRecord;
      else extras.push({...displayRecord,reason:candidates.length>1?`本年${currentDynasty.label}政區表存在多個同名州，未自動附著。`:`方鎮年表有長官條目，但本年${currentDynasty.label}州郡縣政區表未列此州。`});
    }
    return extras;
  }

  function buildJinSnapshot(year) {
    const states=[];
    const data=window.JIN_DATA;
    for (const stateEntity of data.states||[]) {
      const sp=activePhase(stateEntity,year); if (!sp) continue;
      const state={id:stateEntity.id,name:sp.name||stateEntity.name,order:stateEntity.order,filterKey:`jin:${stateEntity.id}`,group:'jin',groupLabel:'西晉',uncertain:!!sp.uncertain,source:sp.source||stateEntity.source,entity:stateEntity,phase:sp,rows:[]};
      for (const pe of stateEntity.prefectures||[]) {
        const pp=activePhase(pe,year); if (!pp) continue;
        const row={id:pe.id,name:pp.name||pe.base_name,order:effectiveOrder(pe,pp,year),uncertain:!!pp.uncertain,source:pp.source||pe.source,entity:pe,phase:pp,kingdom:isKingdom(pp.name||pe.base_name,'prefecture',pp),ruler:null,fiveRankFiefs:findJinFiveRank(pe.id,year),chenFiefs:[],counties:[]};
        if (row.kingdom) row.ruler=findJinRuler(row.name,year);
        for (const ce of pe.counties||[]) {
          const cp=activePhase(ce,year); if (!cp) continue;
          const name=cp.name||ce.base_name;
          const kingdom=isKingdom(name,'county',cp);
          row.counties.push({id:ce.id,name,order:effectiveOrder(ce,cp,year),uncertain:!!cp.uncertain,timeless:!!cp.timeless||!!ce.timeless,source:cp.source||ce.source,entity:ce,phase:cp,kingdom,fiefAnnotation:cp.fief_annotation||ce.fief_annotation||null,ruler:kingdom?findJinRuler(name,year):null,fiveRankFiefs:findJinFiveRank(ce.id,year),chenFiefs:[]});
        }
        row.counties.sort((a,b)=>a.order-b.order); state.rows.push(row);
      }
      state.rows.sort((a,b)=>a.order-b.order); states.push(state);
    }
    states.sort((a,b)=>a.order-b.order);
    return {states,virtualFiefs:[]};
  }

  let liangCountyIndex=null;
  let liangCountyMethodIndex=null;

  function buildLiangCountyIndexes() {
    if (liangCountyIndex) return;
    liangCountyIndex=new Map();
    for (const county of window.LIANG_DATA?.counties||[]) {
      const key=normalizeName(county.p);
      if (!liangCountyIndex.has(key)) liangCountyIndex.set(key,[]);
      liangCountyIndex.get(key).push(county);
    }
    liangCountyMethodIndex=new Map();
    for (const item of window.LIANG_COUNTY_OVERLAY?.assignments||[]) {
      const [county,prefecture,method,region]=item;
      liangCountyMethodIndex.set(`${normalizeName(prefecture)}|${normalizeName(county)}|${region||''}`,method||'');
    }
  }

  function liangSource(label,phase,extra='') {
    const raw=phase?.raw || `${phase?.start??502}—${phase?.end??557}`;
    return {excerpt:[`${label}沿革斷限：${raw}。`,extra].filter(Boolean).join('')};
  }

  function attachLiangFiefs(states,year) {
    const prefMap=new Map(),countyMap=new Map();
    for (const state of states) for (const row of state.rows) {
      const pk=normalizeName(row.name);if(!prefMap.has(pk))prefMap.set(pk,[]);prefMap.get(pk).push(row);
      for (const county of row.counties) {const ck=normalizeName(county.name);if(!countyMap.has(ck))countyMap.set(ck,[]);countyMap.get(ck).push(county);}
    }
    const virtual=[];
    for (const record of window.LIANG_FIEFS?.records||[]) {
      const phase=activeLiangFiefPhase(record,year);if(!phase)continue;
      const targetMap=record.level==='prefecture'?prefMap:countyMap;
      const targets=targetMap.get(normalizeName(phase.fief))||[];
      const resolved=resolveLiangHolder(record,year);
      const match={record,phase,...resolved,display:{uncertain:resolved.status==='uncertain',mourning:resolved.status==='mourning'},changed:Number(phase.start)===year||Number(resolved.holder?.start)===year};
      if (targets.length===1) targets[0].liangFiefs.push(match);
      else {
        match.reason=targets.length===0
          ? `本年蕭梁州郡縣表沒有同名${record.level==='prefecture'?'郡':'縣'}可供附著`
          : `本年存在${targets.length}個同名政區，尚無法唯一定位`;
        virtual.push(match);
      }
    }
    const rankOrder={王:0,公:1,侯:2,伯:3,子:4,男:5};
    virtual.sort((a,b)=>(rankOrder[a.record.rank]-rankOrder[b.record.rank])||a.phase.fief.localeCompare(b.phase.fief,'zh-Hant'));
    return virtual;
  }

  function buildLiangSnapshot(year) {
    buildLiangCountyIndexes();
    const states=[];
    for (const stateEntity of window.LIANG_DATA?.states||[]) {
      const sp=activePhase(stateEntity,year);if(!sp)continue;
      const state={
        id:stateEntity.id,name:sp.name||stateEntity.n,order:effectiveOrder(stateEntity,sp,year),filterKey:`liang:${stateEntity.id}`,
        group:'liang',groupLabel:'蕭梁',region:stateEntity.r||'',uncertain:!!sp.uncertain,qiao:!!stateEntity.q,
        source:liangSource(sp.name||stateEntity.n,sp),entity:stateEntity,phase:sp,rows:[]
      };
      for (const prefEntity of stateEntity.p||[]) {
        const pp=activePhase(prefEntity,year);if(!pp)continue;
        const prefName=pp.name||prefEntity.n;
        const row={
          id:prefEntity.id,name:prefName,order:effectiveOrder(prefEntity,pp,year),uncertain:!!pp.uncertain,qiao:!!prefEntity.q,
          source:liangSource(prefName,pp),entity:prefEntity,phase:pp,directCounties:false,unknownPrefecture:false,
          kingdom:false,ruler:null,fiveRankFiefs:[],chenFiefs:[],liangFiefs:[],counties:[]
        };
        const counties=liangCountyIndex.get(normalizeName(prefName))||[];
        for (let index=0;index<counties.length;index++) {
          const countyEntity=counties[index],countyName=countyEntity.n;
          const method=liangCountyMethodIndex.get(`${normalizeName(prefName)}|${normalizeName(countyName)}|${countyEntity.r||''}`)||'';
          const cp={start:502,end:557,name:countyName,raw:'梁實縣靜態附入'};
          row.counties.push({
            id:countyEntity.id,name:countyName,order:index+1,uncertain:false,timeless:false,qiao:!!countyEntity.q,
            source:liangSource(countyName,cp,method?`歸屬方法：${method}。`:''),entity:countyEntity,phase:cp,
            kingdom:false,ruler:null,fiveRankFiefs:[],chenFiefs:[],liangFiefs:[]
          });
        }
        state.rows.push(row);
      }
      state.rows.sort((a,b)=>a.order-b.order);states.push(state);
    }
    states.sort((a,b)=>a.order-b.order);
    const virtualFiefs=attachLiangFiefs(states,year);
    const extraGovernorStates=attachGovernors(states,year,'liang');
    return {states,virtualFiefs,extraGovernorStates};
  }

  function buildChenRegimeStates(regimeKey,year,groupOrder) {
    const reg=window.CHEN_DATA.regimes[regimeKey];
    const states=[];
    for (const se of reg.states||[]) {
      const sp=activePhase(se,year); if (!sp) continue;
      const state={id:se.id,name:sp.name||se.name,order:Number(se.order||0),filterKey:`${regimeKey}:${se.id}`,group:regimeKey,groupLabel:reg.label,groupOrder,uncertain:!!sp.uncertain,source:sp.source||se.source,entity:se,phase:sp,rows:[]};
      for (const pe of se.prefectures||[]) {
        const pp=activePhase(pe,year); if (!pp) continue;
        const row={id:pe.id,name:pp.name||pe.base_name,order:effectiveOrder(pe,pp,year),uncertain:!!pp.uncertain,qiao:!!(pp.qiao ?? pe.qiao),source:pp.source||pe.source,entity:pe,phase:pp,directCounties:!!pe.direct_counties,unknownPrefecture:!!pe.unknown_prefecture,displayLabel:pe.display_label||'',emptyCountyLabel:Object.prototype.hasOwnProperty.call(pe,'empty_county_label')?pe.empty_county_label:null,kingdom:isKingdom(pp.name||pe.base_name,'prefecture',pp),ruler:null,fiveRankFiefs:[],chenFiefs:[],counties:[]};
        for (const ce of pe.counties||[]) {
          const cp=activePhase(ce,year); if (!cp) continue;
          row.counties.push({id:ce.id,name:cp.name||ce.base_name,order:effectiveOrder(ce,cp,year),uncertain:!!cp.uncertain,timeless:!!cp.timeless||!!ce.timeless,qiao:!!(cp.qiao ?? ce.qiao),source:cp.source||ce.source,entity:ce,phase:cp,kingdom:false,ruler:null,fiveRankFiefs:[],chenFiefs:[]});
        }
        row.counties.sort((a,b)=>a.order-b.order); state.rows.push(row);
      }
      state.rows.sort((a,b)=>a.order-b.order); states.push(state);
    }
    states.sort((a,b)=>a.order-b.order); return states;
  }

  function attachChenFiefs(chenStates,year) {
    const prefMap=new Map(), countyMap=new Map();
    for (const state of chenStates) for (const row of state.rows) {
      const pk=normalizeName(row.name); if (!prefMap.has(pk)) prefMap.set(pk,[]); prefMap.get(pk).push(row);
      for (const county of row.counties) { const ck=normalizeName(county.name); if (!countyMap.has(ck)) countyMap.set(ck,[]); countyMap.get(ck).push(county); }
    }
    const virtual=[];
    for (const record of window.CHEN_FIEFS?.records || []) {
      const phase=activeChenFiefPhase(record,year); if (!phase) continue;
      const key=normalizeName(phase.fief);
      const targetMap=record.level==='prefecture' ? prefMap : countyMap;
      let targets=targetMap.get(key)||[];
      const explicitTarget=phase.target_id || record.target_id;
      if (explicitTarget) {
        const all=[...prefMap.values(),...countyMap.values()].flat();
        targets=all.filter((t)=>t.id===explicitTarget);
      }
      const display=activeChenDisplay(record,year);
      const holders=display?.people ? display.people : chenHolderNames(record,year);
      const match={record,phase,display,holders,changed:Number(phase.start)===year || Number(display?.start)===year || (record.holders||[]).some((h)=>Number(h.start)===year)};
      if (targets.length===1) targets[0].chenFiefs.push(match);
      else {
        match.reason=record.unmatched_reason || (targets.length===0
          ? `本年南陳實州郡縣中沒有可唯一對應的同名${record.level==='prefecture'?'郡':'縣'}`
          : `本年存在${targets.length}個同名政區，無法無歧義定位`);
        virtual.push(match);
      }
    }
    const rankOrder={王:0,公:1,侯:2,伯:3,子:4,男:5};
    virtual.sort((a,b)=>(rankOrder[a.record.rank]-rankOrder[b.record.rank]) || a.phase.fief.localeCompare(b.phase.fief,'zh-Hant'));
    return virtual;
  }

  function buildChenSnapshot(year) {
    const chen=buildChenRegimeStates('chen',year,0);
    const virtualFiefs=attachChenFiefs(chen,year);
    const later=buildChenRegimeStates('later_liang',year,2);
    const wang=buildChenRegimeStates('wang_lin',year,3);
    const states=[...chen,...later,...wang];
    const extraGovernorStates=attachGovernors(states,year,'chen');
    return {states,virtualFiefs,extraGovernorStates};
  }

  function buildSnapshot(year) {
    if (currentDynasty.key==='chen') return buildChenSnapshot(year);
    if (currentDynasty.key==='southern-liang') return buildLiangSnapshot(year);
    return buildJinSnapshot(year);
  }

  function compareSnapshots(current,previous,year) {
    const previousStateMap=mapById(previous.states), removedChanges=[];
    for (const state of current.states) {
      const oldState=previousStateMap.get(state.id), stateNotes=[], stateSources=[];
      if (!oldState) { stateNotes.push(`${state.name}於本年年末見於表中`); stateSources.push(state.source); }
      else if (oldState.name!==state.name) { stateNotes.push(`${oldState.name}改稱${state.name}`); stateSources.push(state.source,oldState.source); }
      state.annotation=yearNote(state.entity,year);
      state.qiaoAnnotation=qiaoNote(state.entity,state.phase,year);
      const oldPrefMap=mapById(oldState?oldState.rows:[]);
      for (const row of state.rows) {
        const oldRow=oldPrefMap.get(row.id), rowNotes=[], rowSources=[];
        if (!oldRow) { rowNotes.push(`${row.name || '州直領縣'}為本年新增、復置或改隸至本州`); rowSources.push(row.source); }
        else if (oldRow.name!==row.name) { rowNotes.push(`${oldRow.name || '州直領縣'}改稱${row.name || '州直領縣'}`); rowSources.push(row.source,oldRow.source); }
        row.annotation=yearNote(row.entity,year);
        row.qiaoAnnotation=qiaoNote(row.entity,row.phase,year);
        const oldCountyMap=mapById(oldRow?oldRow.counties:[]);
        for (const county of row.counties) {
          const old=oldCountyMap.get(county.id);
          if (!old) county.change=makeChange(`${county.name}為本年新增、復置、改名或改隸至${row.name || state.name}`,[county.source],'county',`${state.name}·${row.name || '州直領'}：${county.name}`);
          else if (old.name!==county.name) county.change=makeChange(`${old.name}改稱${county.name}`,[county.source,old.source],'county',`${state.name}·${row.name || '州直領'}：${old.name}→${county.name}`);
          county.annotation=yearNote(county.entity,year);
          county.qiaoAnnotation=qiaoNote(county.entity,county.phase,year);
        }
        if (oldRow) {
          const now=mapById(row.counties), removed=oldRow.counties.filter((c)=>!now.has(c.id));
          if (removed.length) {
            rowNotes.push(`${removed.map((c)=>c.name).join('、')}於本年不再隸屬${row.name}`); rowSources.push(...removed.map((c)=>c.source));
            for (const c of removed) removedChanges.push(makeChange(`${c.name}於${formatYearLabel(year)}年末已不見於${row.name}所轄`,[c.source],'removed-county',`${state.name}·${row.name}：撤出／廢省 ${c.name}`));
          }
        }
        if (rowNotes.length) row.change=makeChange(rowNotes.join('；'),rowSources,'prefecture',`${state.name}：${row.name}`);
      }
      if (oldState) {
        const now=mapById(state.rows), removed=oldState.rows.filter((r)=>!now.has(r.id));
        if (removed.length) {
          stateNotes.push(`${removed.map((r)=>r.name).join('、')}於本年不再隸屬${state.name}`); stateSources.push(...removed.map((r)=>r.source));
          for (const r of removed) removedChanges.push(makeChange(`${r.name}於${formatYearLabel(year)}年末已不見於${state.name}所轄`,[r.source],'removed-prefecture',`${state.name}：撤出／廢省 ${r.name}`));
        }
      }
      if (stateNotes.length) state.change=makeChange(stateNotes.join('；'),stateSources,'state',`${state.groupLabel}·${state.name}`);
    }
    const currentMap=mapById(current.states);
    for (const old of previous.states) if (!currentMap.has(old.id)) removedChanges.push(makeChange(`${old.name}於${formatYearLabel(year)}年末已不見於州級政區表中`,[old.source],'removed-state',`${old.groupLabel}：撤出／廢省 ${old.name}`));

    citationRegistry.clear(); let number=0;
    const register=(change)=>{if(!change||change.number)return; change.number=++number; citationRegistry.set(number,change);};
    for (const state of current.states) { register(state.change); register(state.annotation); register(state.qiaoAnnotation); for (const row of state.rows) {register(row.change); register(row.annotation); register(row.qiaoAnnotation); for (const c of row.counties) {register(c.change); register(c.annotation); register(c.qiaoAnnotation);}} }
    for (const c of removedChanges) register(c);
    return {states:current.states,virtualFiefs:current.virtualFiefs,extraGovernorStates:current.extraGovernorStates||[],removedChanges};
  }

  function createCitationButton(change) {
    if (!change?.number) return null;
    const b=document.createElement('button'); b.type='button'; b.className='citation-link'; b.textContent=`[${change.number}]`; b.dataset.citation=String(change.number); b.title='查看變動依據'; return b;
  }

  function registerAuxInfo(info) {
    const id=`aux-${++auxInfoSequence}`; auxInfoRegistry.set(id,info); return id;
  }

  function createAuxButton(text,info,className='') {
    const id=registerAuxInfo(info);
    const b=document.createElement('button'); b.type='button'; b.className=['fief-detail-button',className].filter(Boolean).join(' '); b.textContent=text; b.dataset.info=id; b.title=info.summary||'查看資料'; return b;
  }

  function liangPersonColorMatches(text,year) {
    if (currentDynasty.key!=='southern-liang') return [];
    const value=String(text||''),candidates=[];
    for (const person of window.LIANG_PERSON_COLORS?.people||[]) {
      const yearStyle=person.years?.[String(year)];
      if (!yearStyle) continue;
      const seen=new Set();
      for (const alias of [person.name,...(person.aliases||[])]) {
        if (!alias||seen.has(alias)) continue;seen.add(alias);
        let from=0,index;
        while ((index=value.indexOf(alias,from))!==-1) {candidates.push({index,length:alias.length,text:alias,person,yearStyle});from=index+alias.length;}
      }
      if (person.name?.startsWith('蕭')) {
        const given=person.name.slice(1).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const royalPattern=new RegExp(`[\\u3400-\\u9fff]{1,8}王${given}`,'gu');
        for (const match of value.matchAll(royalPattern)) candidates.push({index:match.index,length:match[0].length,text:match[0],person,yearStyle});
      }
    }
    candidates.sort((a,b)=>a.index-b.index||b.length-a.length);
    const accepted=[];let end=-1;
    for (const match of candidates) {if(match.index<end)continue;accepted.push(match);end=match.index+match.length;}
    return accepted;
  }

  function appendLiangPersonColors(container,text,year) {
    const value=String(text||''),matches=liangPersonColorMatches(value,year);
    if (!matches.length) {container.appendChild(document.createTextNode(value));return;}
    let cursor=0;
    for (const match of matches) {
      if(match.index>cursor)container.appendChild(document.createTextNode(value.slice(cursor,match.index)));
      const span=document.createElement('span');span.className='liang-person-color';span.style.color=match.yearStyle.color;
      span.dataset.category=match.yearStyle.category;span.title=`${match.person.name}：${match.yearStyle.category}（據梁代刺史表，${year}年）`;span.textContent=match.text;container.appendChild(span);
      cursor=match.index+match.length;
    }
    if(cursor<value.length)container.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function createLiangColoredAuxButton(text,info,className='',year=null) {
    const button=createAuxButton('',info,className);appendLiangPersonColors(button,text,year);button.setAttribute('aria-label',text);return button;
  }

  function renderGovernorBox(record,year) {
    const lines=(record?.summary_lines||[]).filter((line)=>String(line||'').trim());
    if (!lines.length) return null;
    const box=document.createElement('section');box.className='state-governor-box';box.setAttribute('aria-label',`${record.state}都督與刺史`);
    const label=document.createElement('button');label.type='button';label.className='state-governor-label';label.textContent='都督/刺史';label.dataset.info=registerAuxInfo(governorInfo(record,year));label.title='展開本年完整方鎮考證與史料';box.appendChild(label);
    const entries=document.createElement('div');entries.className='state-governor-entries';
    for (const line of lines) {const p=document.createElement('p');if(currentDynasty.key==='southern-liang')appendLiangPersonColors(p,line,year);else p.textContent=line;entries.appendChild(p);}
    box.appendChild(entries);return box;
  }

  function appendFiefDetails(container,item,level,year) {
    if (currentDynasty.key==='western-jin') {
      if (item.ruler) container.appendChild(createAuxButton(item.ruler.label,jinRulerInfo(item.ruler,year),'fief-badge ruler-year'));
      for (const match of item.fiveRankFiefs||[]) container.appendChild(createAuxButton(jinFiveRankLabel(match),jinFiveRankInfo(match,year),'fief-badge five-rank-note'));
      if (level==='county' && item.fiefAnnotation) {
        container.appendChild(createAuxButton(item.fiefAnnotation.label || '封國',{
          title:'縣級封國資料',summary:`${item.name}：${item.fiefAnnotation.label || '封國'}`,
          paragraphs:[item.fiefAnnotation.note || '本書正文保存此縣的封國性質。'],sources:[item.source]
        },'fief-badge county-fief-note'));
      }
    } else if (currentDynasty.key==='southern-liang') {
      for (const match of item.liangFiefs||[]) {const cls=['fief-badge','liang-fief-note',match.changed?'changed':'',match.status==='uncertain'?'editorial-uncertain':'',match.status==='mourning'?'mourning':''].filter(Boolean).join(' ');container.appendChild(createLiangColoredAuxButton(liangFiefText(match),liangFiefInfo(match,year),cls,year));}
    } else {
      for (const match of item.chenFiefs||[]) { const cls=['fief-badge','chen-fief-note',match.changed?'changed':'',match.display?.uncertain?'editorial-uncertain':'',match.display?.mourning?'mourning':''].filter(Boolean).join(' '); container.appendChild(createAuxButton(chenFiefText(match),chenFiefInfo(match,year),cls)); }
    }
  }

  function itemFiefLabels(item) {
    return [
      ...(item.chenFiefs||[]).map(chenFiefText),
      ...(item.liangFiefs||[]).map(liangFiefText),
      ...(item.fiveRankFiefs||[]).map(jinFiveRankLabel)
    ];
  }

  function makeNameSpan(item,className='',info=null) {
    const wrap=document.createElement('span'); wrap.className='name-with-citation';
    if (item.id) wrap.dataset.entityId=item.id;
    const name=document.createElement(info?'button':'span');
    if (info) { name.type='button'; name.dataset.info=registerAuxInfo(info); name.title='查看本州都督/刺史與方鎮考證'; }
    name.textContent=item.name; name.className=[className,info?'state-governor-name':'',item.kingdom?'kingdom':'',item.change?'changed':'',item.uncertain?'uncertain':'',item.qiao?'qiao':'',item.timeless&&!item.qiao?'no-date':''].filter(Boolean).join(' '); wrap.appendChild(name);
    const citation=createCitationButton(item.change); if (citation) wrap.appendChild(citation);
    const annotation=createCitationButton(item.annotation); if (annotation) wrap.appendChild(annotation);
    const qiaoAnnotation=createCitationButton(item.qiaoAnnotation); if (qiaoAnnotation) wrap.appendChild(qiaoAnnotation);
    return wrap;
  }

  function stateMatches(state) {
    const selected=stateSelect.value, query=normalizeName(searchInput.value.trim());
    if (selected && state.filterKey!==selected) return false;
    if (changedOnly.checked) {
      const any=state.change || state.rows.some((r)=>r.change || r.counties.some((c)=>c.change));
      if (!any) return false;
    }
    if (!query) return true;
    const text=[state.name,...(state.governor?.summary_lines||[]),...state.rows.flatMap((r)=>[r.name,...itemFiefLabels(r),...r.counties.flatMap((c)=>[c.name,...itemFiefLabels(c)])])].join(' ');
    return normalizeName(text).includes(query);
  }

  function filteredStateCopy(state) {
    const query=normalizeName(searchInput.value.trim());
    if (!query) return state;
    if (state.governor && normalizeName([state.name,...(state.governor.summary_lines||[])].join(' ')).includes(query)) return state;
    const copy={...state,rows:[]};
    for (const row of state.rows) {
      const rowText=normalizeName([row.name,...itemFiefLabels(row)].join(' '));
      const counties=row.counties.filter((c)=>normalizeName([c.name,...itemFiefLabels(c)].join(' ')).includes(query));
      if (rowText.includes(query) || counties.length) copy.rows.push({...row,counties:rowText.includes(query)?row.counties:counties});
    }
    return copy;
  }

  function renderState(state,year) {
    const article=document.createElement('article'); article.className='state-card';
    article.dataset.entityId=state.id;
    const heading=document.createElement('header'); heading.className='state-heading';
    const h2=document.createElement('h2'); h2.appendChild(makeNameSpan(state,'',state.governor?governorInfo(state.governor,year):null));
    if (currentDynasty.key==='chen' && state.group!=='chen') { const badge=document.createElement('span'); badge.className='regime-badge'; badge.textContent=state.groupLabel; h2.appendChild(badge); }
    const meta=document.createElement('span'); meta.className='state-meta'; const prefCount=state.rows.filter((r)=>!r.directCounties).length; meta.textContent=`${prefCount} 郡級政區`; if(state.region)meta.textContent+=` · ${state.region}`; if(state.rows.some((r)=>r.directCounties)) meta.textContent+=`，另有郡無考縣`;
    heading.append(h2,meta); article.appendChild(heading);
    if (state.governor) article.appendChild(renderGovernorBox(state.governor,year));
    const wrap=document.createElement('div'); wrap.className='table-wrap'; const table=document.createElement('table');
    const thead=document.createElement('thead'), hr=document.createElement('tr');
    for (const label of ['郡、國及郡級政區','所屬縣級政區']) {const th=document.createElement('th');th.textContent=label;hr.appendChild(th);} thead.appendChild(hr);table.appendChild(thead);
    const tbody=document.createElement('tbody');
    for (const row of state.rows) {
      const tr=document.createElement('tr'), td1=document.createElement('td'), td2=document.createElement('td');
      tr.dataset.entityId=row.id;
      if (row.directCounties) { const d=document.createElement('span'); d.className='direct-counties-label'; d.textContent=`（${row.displayLabel || '郡無考'}）`; td1.appendChild(d); } else td1.appendChild(makeNameSpan(row,'pref-name'));
      if (row.kingdom) {const b=document.createElement('span');b.className='type-badge kingdom';b.textContent='封國';td1.appendChild(b);}
      appendFiefDetails(td1,row,'prefecture',year);
      const ref=document.createElement('span');ref.className='source-ref';
      ref.textContent=currentDynasty.key==='southern-liang'
        ? `沿革：${row.phase?.raw||'梁代縣級歸屬靜態附入'}`
        : row.source?.book_page?`沿革：書內第 ${row.source.book_page} 頁`:'沿革：頁碼待校';
      td1.appendChild(ref);
      if (!row.counties.length) {
        if (row.emptyCountyLabel === '') {
          td2.textContent='';
        } else {
          const e=document.createElement('span');e.className='empty';e.textContent=row.emptyCountyLabel || '本年無可顯示的縣級政區';td2.appendChild(e);
        }
      } else {
        const list=document.createElement('div');list.className='county-list';
        for (const c of row.counties) {const item=makeNameSpan(c,'county-item');appendFiefDetails(item,c,'county',year);list.appendChild(item);} td2.appendChild(list);
      }
      tr.append(td1,td2);tbody.appendChild(tr);
    }
    table.appendChild(tbody);wrap.appendChild(table);article.appendChild(wrap);return article;
  }

  function renderVirtualFiefs(items,year) {
    const query=normalizeName(searchInput.value.trim());
    const visible=items.filter((m)=>!query || normalizeName(`${m.phase.fief}${activeFiefText(m)}${m.reason}`).includes(query));
    if (!visible.length || stateSelect.value || changedOnly.checked) return null;
    const card=document.createElement('article');card.className='virtual-fief-card';
    const h=document.createElement('h2');h.textContent=currentDynasty.key==='southern-liang'?'未唯一定位的蕭梁封爵':'未定位／疑似虛封封爵';card.appendChild(h);
    const list=document.createElement('div');list.className='virtual-fief-list';
    for (const match of visible) {
      const item=document.createElement('div');item.className='virtual-fief-item';
      { const cls=['fief-badge',currentDynasty.key==='southern-liang'?'liang-fief-note':'chen-fief-note',match.changed?'changed':'',match.display?.uncertain?'editorial-uncertain':'',match.display?.mourning?'mourning':''].filter(Boolean).join(' '); const label=`${match.phase.fief}國　${activeFiefText(match)}`;item.appendChild(currentDynasty.key==='southern-liang'?createLiangColoredAuxButton(label,activeFiefInfo(match,year),cls,year):createAuxButton(label,activeFiefInfo(match,year),cls)); }
      const reason=document.createElement('span');reason.className='virtual-fief-reason';reason.textContent=match.reason;item.appendChild(reason);list.appendChild(item);
    }
    card.appendChild(list);return card;
  }

  function renderExtraGovernorStates(items,year) {
    const query=normalizeName(searchInput.value.trim());
    const selected=stateSelect.value;
    const selectedExtraState=selected.startsWith(EXTRA_GOVERNOR_FILTER_PREFIX)
      ? normalizeName(selected.slice(EXTRA_GOVERNOR_FILTER_PREFIX.length))
      : '';
    const visible=(items||[]).filter((r)=>(!selectedExtraState || normalizeName(r.state)===selectedExtraState)
      && (!query || normalizeName([r.state,...(r.summary_lines||[]),...(r.evidence_lines||[])].join(' ')).includes(query)));
    if (!visible.length || (selected && !selectedExtraState) || changedOnly.checked) return null;
    const card=document.createElement('article');card.className='governor-extra-card';
    const h=document.createElement('h2');h.textContent='方鎮表另見之州';card.appendChild(h);
    const note=document.createElement('p');note.className='governor-extra-note';note.textContent=`下列州在本年方鎮年表中有長官資料，但未能唯一附著於本年${currentDynasty.label}州郡縣政區表。其原因可能涉及同名州、遙領、僑置、短暫設置或目前政區基底未收，故只作方鎮資料列示，不據此直接增改行政區劃。`;card.appendChild(note);
    const list=document.createElement('div');list.className='governor-extra-list';
    for (const record of visible) {
      const item=document.createElement('div');item.className='governor-extra-item';
      item.appendChild(createAuxButton(record.state,governorInfo(record,year),'governor-extra-button'));
      const brief=document.createElement('div');brief.className='governor-extra-summary';
      for (const line of record.summary_lines||[]) {const p=document.createElement('p');if(currentDynasty.key==='southern-liang')appendLiangPersonColors(p,line,year);else p.textContent=line;brief.appendChild(p);}
      item.appendChild(brief);
      list.appendChild(item);
    }
    card.appendChild(list);return card;
  }

  function renderResults(states,virtualFiefs,extraGovernorStates,year) {
    results.replaceChildren();
    const filtered=states.filter(stateMatches).map(filteredStateCopy).filter((s)=>s.rows.length || !normalizeName(searchInput.value.trim()));
    if (currentDynasty.key==='western-jin') {
      if (!filtered.length) {results.innerHTML='<div class="no-results">沒有符合目前條件的政區。</div>';return filtered;}
      for (const s of filtered) results.appendChild(renderState(s,year)); return filtered;
    }
    if (currentDynasty.key==='southern-liang') {
      let anything=false;
      if (filtered.length) {
        const section=document.createElement('section');section.className='regime-section';
        const heading=document.createElement('h2');heading.className='regime-heading';heading.textContent='蕭梁州郡縣';
        const small=document.createElement('small');small.textContent='502—557年逐年州郡；梁實縣靜態附入';heading.appendChild(small);section.appendChild(heading);
        for(const state of filtered)section.appendChild(renderState(state,year));results.appendChild(section);anything=true;
      }
      const extraGovernors=renderExtraGovernorStates(extraGovernorStates,year);if(extraGovernors){results.appendChild(extraGovernors);anything=true;}
      const virtual=renderVirtualFiefs(virtualFiefs,year);if(virtual){results.appendChild(virtual);anything=true;}
      if(!anything)results.innerHTML='<div class="no-results">沒有符合目前條件的政區或封爵。</div>';
      return filtered;
    }
    const groups=[['chen','南陳州郡縣'],['later_liang','後梁政區'],['wang_lin','王琳政權政區']];
    let anything=false;
    for (const [key,label] of groups) {
      const groupStates=filtered.filter((s)=>s.group===key);
      if (key==='later_liang') {
        const extraGovernors=renderExtraGovernorStates(extraGovernorStates,year); if (extraGovernors){results.appendChild(extraGovernors);anything=true;}
        const virtual=renderVirtualFiefs(virtualFiefs,year); if (virtual){results.appendChild(virtual);anything=true;}
      }
      if (!groupStates.length) continue;
      const section=document.createElement('section');section.className='regime-section';
      const heading=document.createElement('h2');heading.className='regime-heading';heading.textContent=label;
      const small=document.createElement('small');small.textContent=key==='chen'?'陳朝本土政區':key==='later_liang'?'政權存續期間顯示':'王琳勢力存續期間顯示';heading.appendChild(small);section.appendChild(heading);
      for (const s of groupStates) section.appendChild(renderState(s,year));results.appendChild(section);anything=true;
    }
    if (!anything) results.innerHTML='<div class="no-results">沒有符合目前條件的政區或封爵。</div>';
    return filtered;
  }

  function filterRemoved(changes) {
    const query=normalizeName(searchInput.value.trim());
    return changes.filter((c)=>(!query||normalizeName(c.label).includes(query)) && (!changedOnly.checked||true));
  }

  function renderSummary(states,removed) {
    const pref=states.reduce((n,s)=>n+s.rows.filter((r)=>!r.directCounties).length,0), county=states.reduce((n,s)=>n+s.rows.reduce((m,r)=>m+r.counties.length,0),0);
    const changes=states.reduce((n,s)=>n+(s.change?1:0)+s.rows.reduce((m,r)=>m+(r.change?1:0)+r.counties.filter((c)=>c.change).length,0),0)+removed.length;
    $('stateCount').textContent=states.length;$('prefCount').textContent=pref;$('countyCount').textContent=county;$('changeCount').textContent=changes;
  }

  function renderChangePanel(states,removed) {
    const changes=[];for(const s of states){if(s.change)changes.push(s.change);for(const r of s.rows){if(r.change)changes.push(r.change);for(const c of r.counties)if(c.change)changes.push(c.change);}}changes.push(...removed);
    const panel=$('changePanel'),list=$('changeList');list.replaceChildren();if(!changes.length){panel.hidden=true;return;}
    const group=document.createElement('div');group.className='change-groups';for(const c of changes){const span=document.createElement('span');span.className='change-index-item';span.textContent=c.label;const b=createCitationButton(c);if(b)span.appendChild(b);group.appendChild(span);}list.appendChild(group);panel.hidden=false;
  }

  function openCitation(number) {
    const change=citationRegistry.get(Number(number));if(!change)return;
    $('sourceModalTitle').textContent=`註釋 [${change.number}]`;$('sourceModalSummary').textContent=change.summary;const body=$('sourceModalBody');body.replaceChildren();
    if(!change.sources.length){const p=document.createElement('p');p.textContent='此項頁碼仍待校勘。';body.appendChild(p);} else for(const source of change.sources){appendSourceEntry(body,source);}
    sourceModal.hidden=false;document.body.classList.add('modal-open');sourceModalClose.focus();
  }

  function appendSourceEntry(body,source) {
    const article=document.createElement('article');article.className='source-entry';const h=document.createElement('h3');
    h.textContent=`${source.book_page?`書內第 ${source.book_page} 頁`:'書內頁碼待校'}（${source.pdf_page?`PDF 第 ${source.pdf_page} 頁`:'PDF頁碼待校'}）`;
    const p=document.createElement('p');p.textContent=source.excerpt||'摘錄待補。';article.append(h,p);
    if(source.origin){const o=document.createElement('p');o.className='qiao-origin';o.textContent=`原屬：${source.origin}`;article.appendChild(o);}
    if(source.editorial_note){const n=document.createElement('p');n.className='editorial-note';n.textContent=`人工校勘：${source.editorial_note}`;article.appendChild(n);}body.appendChild(article);
  }

  function openAuxInfo(id) {
    const info=auxInfoRegistry.get(id);if(!info)return;$('sourceModalTitle').textContent=info.title||'封國資料';$('sourceModalSummary').textContent=info.summary||'';const body=$('sourceModalBody');body.replaceChildren();
    if(info.actionUrl){const a=document.createElement('a');a.className='aux-info-action';a.href=info.actionUrl;a.textContent=info.actionLabel||'開啟相關年表';body.appendChild(a);}
    for(const t of info.paragraphs||[]){const p=document.createElement('p');p.className='aux-info-paragraph';p.textContent=t;body.appendChild(p);}for(const s of info.sources||[])appendSourceEntry(body,s);
    if(info.sourceLabel){const a=document.createElement('article');a.className='source-entry';const h=document.createElement('h3');h.textContent='補充資料來源';const p=document.createElement('p');p.textContent=info.sourceLabel;a.append(h,p);body.appendChild(a);}
    sourceModal.hidden=false;document.body.classList.add('modal-open');sourceModalClose.focus();
  }

  function closeModal(){sourceModal.hidden=true;document.body.classList.remove('modal-open');}

  function clearMapLinkHighlights() {
    document.querySelectorAll('.map-hotspot.is-active,.map-linked-active').forEach((node)=>node.classList.remove('is-active','map-linked-active'));
  }

  function mapFeatureById(entityId) {
    return currentMapFeatures.find((feature)=>feature.entity_id===entityId) || null;
  }

  function highlightMapEntity(entityId,{scrollToMap=false}={}) {
    if (yearMapPanel.hidden) return;
    const feature=mapFeatureById(entityId), hotspot=yearMapOverlay.querySelector(`[data-entity-id="${entityId}"]`);
    if (!feature || !hotspot) return;
    clearMapLinkHighlights();hotspot.classList.add('is-active');
    const stageWidth=yearMapStage.clientWidth,stageHeight=yearMapStage.clientHeight;
    if (stageWidth && stageHeight) {
      yearMapViewport.scrollTo({
        left:Math.max(0,feature.x/currentMap.width*stageWidth-yearMapViewport.clientWidth/2),
        top:Math.max(0,feature.y/currentMap.height*stageHeight-yearMapViewport.clientHeight/2),
        behavior:'smooth'
      });
    }
    if (scrollToMap) yearMapPanel.scrollIntoView({behavior:'smooth',block:'start'});
    $('yearMapStatus').textContent=`已在地圖定位：${feature.label}（${feature.level==='state'?'州':feature.level==='prefecture'?'郡級':'縣級'}）`;
  }

  function revealTextEntity(entityId) {
    let target=results.querySelector(`.name-with-citation[data-entity-id="${entityId}"]`);
    if (!target && (stateSelect.value || searchInput.value || changedOnly.checked)) {
      stateSelect.value='';searchInput.value='';changedOnly.checked=false;render();
      target=results.querySelector(`.name-with-citation[data-entity-id="${entityId}"]`);
    }
    if (!target) {
      $('yearMapStatus').textContent='此治所已進入地圖，但目前年表沒有可唯一聯動的同一實體。';
      return;
    }
    clearMapLinkHighlights();target.classList.add('map-linked-active');
    const hotspot=yearMapOverlay.querySelector(`[data-entity-id="${entityId}"]`);if(hotspot)hotspot.classList.add('is-active');
    target.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>target.classList.remove('map-linked-active'),2600);
  }

  const SVG_NS='http://www.w3.org/2000/svg';
  const MAP_EXPORT_STYLE=`
    text{font-family:"Noto Serif CJK TC","Songti TC","PMingLiU",serif}.dynamic-map-title{fill:#302b27;font-size:46px;font-weight:700;letter-spacing:3px}.dynamic-map-subtitle{fill:#665d54;font-size:16px}.dynamic-regime{stroke-width:2.2;fill-opacity:.62;fill-rule:evenodd}.dynamic-rebellion{fill-opacity:.8;stroke-dasharray:12 7}.dynamic-regime-label{fill:#fffdf2;stroke:rgba(40,32,25,.72);stroke-width:2.6;paint-order:stroke;font-size:42px;font-weight:700;letter-spacing:5px}.dynamic-rebellion-label{font-size:23px;letter-spacing:1px}.dynamic-state-boundary{fill:none;stroke:#60392d;stroke-width:2.2}.dynamic-pref-boundary{fill:none;stroke:#776d55;stroke-width:1.1}.dynamic-supplement-boundary{stroke-dasharray:5 4;opacity:.72}.dynamic-state-dot{fill:#6a382d;stroke:#fff8e8;stroke-width:.9}.dynamic-prefecture-dot{fill:#a85e52;stroke:#fff8e8;stroke-width:.6}.dynamic-county-dot{fill:#365f70}.dynamic-map-label{paint-order:stroke;stroke:rgba(255,252,240,.94);stroke-width:2.3;stroke-linejoin:round;dominant-baseline:central}.dynamic-state-area-label{fill:#4d3028;font-size:24.5px;font-weight:700;letter-spacing:2px}.dynamic-state-seat-label{fill:#562f28;font-size:22.5px;font-weight:700}.dynamic-prefecture-area-label{fill:#3f4a38;font-size:16.5px;font-weight:700}.dynamic-prefecture-seat-label{fill:#684a3f;font-size:10.8px}.dynamic-county-seat-label{fill:#264f60;font-size:8.6px}.dynamic-fief-label{fill:#754476;font-weight:700}.is-uncertain{font-style:italic}`;

  function svgNode(tag,attributes={},text='') {
    const node=document.createElementNS(SVG_NS,tag);
    for(const [key,value] of Object.entries(attributes)) if(value!=null) node.setAttribute(key,String(value));
    if(text) node.textContent=text;
    return node;
  }

  function activeMapRecords(records,year,spatialStep=120) {
    const priority={'CHGIS V6':0,'western-jin-yearbook＋CHGIS V6':0,'CHGIS V4':1,'CHGIS V5':2};
    const active=(records||[]).filter((item)=>Number(item.b)<=year&&year<=Number(item.e));
    active.sort((a,b)=>(priority[a.s]??5)-(priority[b.s]??5));
    const seen=new Set(),out=[];
    for(const item of active) {
      const key=`${item.k}|${Math.round(Number(item.x||0)/spatialStep)}|${Math.round(Number(item.y||0)/spatialStep)}`;
      if(seen.has(key)) continue;
      seen.add(key);out.push(item);
    }
    return out;
  }

  function chenTerritoryFeature(year,kind='territory') {
    return (window.CHEN_TERRITORIES?.features||[]).find((item)=>
      Number(item?.properties?.year)===Number(year) && item?.properties?.kind===kind
    ) || null;
  }

  function chenTerritorySource(year) {
    const feature=chenTerritoryFeature(year);
    if(!feature)return 'ChinaXMap 572年斷面近似';
    const relation=feature.properties.year_relation==='exact'?'本年圖':`近年${feature.properties.source_year}年圖`;
    return `史圖館${relation}矢量化`;
  }

  function drawRegimes(year,root,map) {
    const paths=map.regimes||{};
    const add=(key,fill,stroke,label,x,y,pathOverride='',extraClass='')=>{
      const path=pathOverride||paths[key];
      if(!path)return;
      root.appendChild(svgNode('path',{d:path,class:`dynamic-regime ${extraClass}`.trim(),fill,stroke,'fill-rule':'evenodd'}));
      root.appendChild(svgNode('text',{x,y,'text-anchor':'middle','dominant-baseline':'central',class:'dynamic-regime-label'},label));
    };
    const territory=chenTerritoryFeature(year);
    const rebellion=chenTerritoryFeature(year,'rebellion');
    const chenPath=territory?.properties?.svgPath||paths.chen;
    if(year<=576) {
      add('northZhou','#d8b05b','#6d5a2b','北周',2050,1310);
      add('northQi','#82a8a2','#3d625f','北齊',3350,1410);
      add('chen','#c98075','#6c3733','陳',2767,2907,chenPath);
      add('laterLiang','#9a83aa','#57436c','後梁',2820,2050);
    } else {
      add('sui','#d8b05b','#6d5a2b',year>=581?'隋':'北周',2425,1435);
      add('chen','#c98075','#6c3733','陳',2767,2907,chenPath);
      if(year<=587)add('laterLiang','#9a83aa','#57436c','後梁',2820,2050);
    }
    if(rebellion?.properties?.svgPath) {
      add('rebellion','#398b51','#1f6034','廣州叛亂',2775,3035,rebellion.properties.svgPath,'dynamic-rebellion');
      root.lastElementChild?.classList.add('dynamic-rebellion-label');
    }
  }

  function mapDistance(a,b) { return Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y)); }

  function chooseEntitySeat(name,level,seats,parent,group) {
    const key=normalizeName(name);
    let candidates=seats.filter((item)=>item.k===key);
    if(group==='chen') {
      const southern=candidates.filter((item)=>Number(item.x)>=2250&&Number(item.y)>=1620);
      if(southern.length)candidates=southern;
    }
    if(parent&&candidates.length>1)candidates.sort((a,b)=>mapDistance(a,parent)-mapDistance(b,parent));
    return candidates[0]||null;
  }

  function resolveSnapshotFeatures(snapshot,seatsByLevel) {
    const features=[],byId=new Map();
    for(const state of snapshot.states) {
      const stateSeat=chooseEntitySeat(state.name,'state',seatsByLevel.state,null,state.group);
      if(stateSeat) {
        const feature={entity_id:state.id,level:'state',label:state.name,x:stateSeat.x,y:stateSeat.y,entity:state};
        features.push(feature);byId.set(state.id,feature);
      }
      for(const row of state.rows) {
        const prefSeat=chooseEntitySeat(row.name,'prefecture',seatsByLevel.prefecture,stateSeat,state.group);
        if(prefSeat) {
          const feature={entity_id:row.id,level:'prefecture',label:row.name,x:prefSeat.x,y:prefSeat.y,entity:row,state};
          features.push(feature);byId.set(row.id,feature);
        }
        for(const county of row.counties) {
          const countySeat=chooseEntitySeat(county.name,'county',seatsByLevel.county,prefSeat||stateSeat,state.group);
          if(!countySeat)continue;
          const feature={entity_id:county.id,level:'county',label:county.name,x:countySeat.x,y:countySeat.y,entity:county,state,row};
          features.push(feature);byId.set(county.id,feature);
        }
      }
    }
    return {features,byId};
  }

  function dynamicFiefLabels(snapshot,resolved,seatsByLevel) {
    const labels=[];
    const append=(feature,matches)=>{
      if(!feature||!matches?.length)return;
      const names=[],ids=[],uncertain=[];
      for(const match of matches) {
        const record=match.record,phase=match.phase;
        const label=record.kind==='prince'?`${phase.fief}國`:`${phase.fief}${record.rank}國`;
        if(!names.includes(label))names.push(label);
        ids.push(record.id);uncertain.push(Boolean(phase.uncertain||match.display?.uncertain));
      }
      labels.push({text:names.join('／'),x:feature.x,y:feature.y,level:feature.level,entityId:feature.entity_id,fiefIds:ids,uncertain:uncertain.some(Boolean)});
    };
    for(const feature of resolved.features)append(feature,feature.entity?.chenFiefs||[]);
    for(const match of snapshot.virtualFiefs||[]) {
      const level=match.record.level;
      const candidates=seatsByLevel[level].filter((item)=>item.k===normalizeName(match.phase.fief)&&Number(item.x)>=2250&&Number(item.y)>=1620);
      if(candidates.length===1)append({x:candidates[0].x,y:candidates[0].y,level,entity_id:''},[match]);
    }
    return labels;
  }

  function labelWidth(text,fontSize) {
    let units=0;
    for(const char of String(text||''))units+=/\s/.test(char)?.35:/[\x00-\xff]/.test(char)?.62:1;
    return units*fontSize+5;
  }

  function labelCandidates(label) {
    const {x,y,fontSize,kind}=label,d=kind.includes('area')?fontSize*1.1:fontSize*1.05;
    if(kind.includes('area'))return [[x,y,'middle'],[x,y-d,'middle'],[x,y+d,'middle']];
    return [[x+d,y,'start'],[x-d,y,'end'],[x,y-d,'middle'],[x,y+d,'middle'],[x+d*.75,y-d*.72,'start'],[x-d*.75,y+d*.72,'end']];
  }

  function placeAndDrawLabels(root,labels,level,plot) {
    const occupied=[];
    labels.sort((a,b)=>b.priority-a.priority||a.y-b.y||a.x-b.x);
    for(const label of labels) {
      const width=labelWidth(label.text,label.fontSize),height=label.fontSize*1.22;
      let placement=null;
      for(const [x,y,anchor] of labelCandidates(label)) {
        const left=anchor==='middle'?x-width/2:anchor==='end'?x-width:x;
        const box=[left,y-height/2,left+width,y+height/2];
        if(box[0]<plot[0]||box[1]<plot[1]||box[2]>plot[2]||box[3]>plot[3])continue;
        if(occupied.some((other)=>!(box[2]+1<other[0]||other[2]+1<box[0]||box[3]+1<other[1]||other[3]+1<box[1])))continue;
        placement={x,y,anchor,box};break;
      }
      if(!placement)continue;
      occupied.push(placement.box);
      const classes=['dynamic-map-label',`dynamic-${label.kind}-label`];
      if(label.fief)classes.push('dynamic-fief-label');
      if(label.uncertain)classes.push('is-uncertain');
      const text=svgNode('text',{x:placement.x,y:placement.y,'text-anchor':placement.anchor,class:classes.join(' '),'data-label-level':level},label.text);
      if(label.fiefIds?.length)text.dataset.fiefIds=label.fiefIds.join(' ');
      root.appendChild(text);
    }
  }

  function appendHotspots(root,features) {
    for(const feature of features) {
      const circle=svgNode('circle',{cx:feature.x,cy:feature.y,r:feature.level==='state'?20:feature.level==='prefecture'?15:11,class:`map-hotspot map-hotspot-${feature.level}`,tabindex:0,role:'button','aria-label':`定位到${feature.label}`});
      circle.dataset.entityId=feature.entity_id;
      circle.appendChild(svgNode('title',{},feature.label));root.appendChild(circle);
    }
  }

  function renderDynamicMap(year,snapshot,map) {
    const stateAreas=activeMapRecords(map.stateAreas,year,190);
    const prefAreas=activeMapRecords(map.prefAreas,year,120);
    const seatsByLevel={
      state:activeMapRecords(map.stateSeats,year,75),
      prefecture:activeMapRecords(map.prefSeats,year,55),
      county:activeMapRecords(map.countySeats,year,34),
    };
    const resolved=resolveSnapshotFeatures(snapshot,seatsByLevel);
    const fiefs=dynamicFiefLabels(snapshot,resolved,seatsByLevel);
    const suppressed=new Set(fiefs.map((item)=>`${item.level}|${Math.round(item.x)}|${Math.round(item.y)}`));
    const labels={state:[],prefecture:[],county:[]};
    const root=yearMapOverlay;
    root.replaceChildren();
    root.appendChild(svgNode('text',{x:650,y:92,class:'dynamic-map-title'},`公元${year}年　南陳與同時期政權州郡縣封國`));
    root.appendChild(svgNode('text',{x:650,y:145,class:'dynamic-map-subtitle'},`共用地形：CHGIS DEM　｜　行政點面：CHGIS V6＋V4／V5補充　｜　政權疆域：${chenTerritorySource(year)}`));
    drawRegimes(year,root,map);
    for(const area of stateAreas) {
      root.appendChild(svgNode('path',{d:area.d,class:`dynamic-state-boundary${area.s==='CHGIS V5'?' dynamic-supplement-boundary':''}`}));
      labels.state.push({text:area.n,x:area.x,y:area.y,fontSize:24.5,kind:'state-area',priority:1000});
    }
    for(const area of prefAreas) {
      root.appendChild(svgNode('path',{d:area.d,class:`dynamic-pref-boundary${area.s==='CHGIS V5'?' dynamic-supplement-boundary':''}`}));
      labels.prefecture.push({text:area.n,x:area.x,y:area.y,fontSize:16.5,kind:'prefecture-area',priority:900});
    }
    const specs=[['state','state-seat',22.5,560,4.1],['prefecture','prefecture-seat',10.8,500,2.9],['county','county-seat',8.6,400,2]];
    for(const [level,kind,fontSize,priority,radius] of specs)for(const seat of seatsByLevel[level]) {
      root.appendChild(svgNode('circle',{cx:seat.x,cy:seat.y,r:radius,class:`dynamic-${level}-dot`}));
      if(!suppressed.has(`${level}|${Math.round(seat.x)}|${Math.round(seat.y)}`))labels[level].push({text:seat.n,x:seat.x,y:seat.y,fontSize,kind,priority});
    }
    for(const fief of fiefs)labels[fief.level].push({...fief,fontSize:fief.level==='prefecture'?12.5:10.2,kind:`${fief.level}-seat`,priority:1300,fief:true});
    for(const level of ['state','prefecture','county'])placeAndDrawLabels(root,labels[level],level,map.plot);
    appendHotspots(root,resolved.features);
    return resolved.features;
  }

  function applyMapZoom(next,{clientX=null,clientY=null}={}) {
    if(!currentMap)return;
    const oldWidth=yearMapStage.clientWidth||yearMapViewport.clientWidth;
    const oldHeight=yearMapStage.clientHeight||oldWidth*currentMap.height/currentMap.width;
    const rect=yearMapViewport.getBoundingClientRect();
    const anchorX=clientX==null?yearMapViewport.clientWidth/2:clientX-rect.left;
    const anchorY=clientY==null?yearMapViewport.clientHeight/2:clientY-rect.top;
    const contentX=(yearMapViewport.scrollLeft+anchorX)/oldWidth;
    const contentY=(yearMapViewport.scrollTop+anchorY)/oldHeight;
    mapZoom=Math.min(6,Math.max(1,Number(next)||1));
    const fitWidth=Math.max(320,yearMapViewport.clientWidth-2);
    yearMapStage.style.width=`${Math.round(fitWidth*mapZoom)}px`;
    yearMapZoomValue.value=`${Math.round(mapZoom*100)}%`;
    requestAnimationFrame(()=>{
      yearMapViewport.scrollLeft=Math.max(0,contentX*yearMapStage.clientWidth-anchorX);
      yearMapViewport.scrollTop=Math.max(0,contentY*yearMapStage.clientHeight-anchorY);
    });
    if(currentMap.year===588&&mapZoom>=1.6&&!mapUhdLoaded)load588Uhd();
  }

  function resetMapView() {
    mapZoom=1;yearMapViewport.scrollLeft=0;yearMapViewport.scrollTop=0;applyMapZoom(1);
  }

  function load588Uhd() {
    if(currentMap?.year!==588||mapUhdLoaded)return;
    yearMapImage.src=currentMap.uhd;mapUhdLoaded=true;
    yearMapLoadUhd.textContent='588年超高清原圖已載入';yearMapLoadUhd.disabled=true;
    $('yearMapStatus').textContent=`已載入588年9600×8256超高清原圖；${currentMapFeatures.length}個治所熱點仍可定位文字。`;
  }

  function renderYearMap(year,snapshot) {
    const dynamic=currentDynasty.key==='chen'?window.CHEN_DYNAMIC_MAP:null;
    const liang=currentDynasty.key==='southern-liang';
    yearMapPanel.hidden=!dynamic&&!liang;textMapLinkControl.hidden=!dynamic;
    results.classList.toggle('text-map-link-enabled',Boolean(dynamic&&textMapLinkToggle.checked));
    if(!dynamic&&!liang){currentMap=null;currentMapFeatures=[];yearMapOverlay.replaceChildren();return;}
    if(liang) {
      const early=year<=544;
      const src=early?'assets/maps/reference/liang-534-chgis.png':'assets/maps/reference/liang-555-max-chgis.png';
      const width=early?4800:3960,height=early?4128:4290,referenceYear=early?534:555;
      currentMap={year,width,height,uhd:src,reference:true};currentMapFeatures=[];mapUhdLoaded=false;
      yearMapOverlay.replaceChildren();yearMapOverlay.setAttribute('viewBox',`0 0 ${width} ${height}`);
      yearMapOverlay.setAttribute('aria-label',`${referenceYear}年蕭梁CHGIS基準地圖`);
      yearMapImage.src=src;yearMapImage.alt=`公元${referenceYear}年蕭梁CHGIS基準地圖`;
      $('yearMapTitle').textContent=`公元${year}年蕭梁政區 · ${referenceYear}年CHGIS基準斷面`;
      $('yearMapStatus').textContent=`所選${year}年顯示最接近的${referenceYear}年CHGIS基準地圖；地圖只作空間參考，不將該年邊界外推為逐年精確疆域。`;
      yearMapNote.textContent='蕭梁州郡沿革按502—557年逐年重建；目前只有534年與555年兩個CHGIS基準斷面。地圖不承擔逐年邊界判定，表格資料仍以《中國行政區劃通史》沿革為準。';
      yearMapUhd.hidden=true;yearMapCsv.hidden=true;yearMapGeoJson.hidden=true;yearMapExport.hidden=true;yearMapLoadUhd.hidden=true;
      resetMapView();return;
    }
    yearMapUhd.hidden=false;yearMapCsv.hidden=false;yearMapGeoJson.hidden=false;yearMapExport.hidden=false;
    const territory=chenTerritoryFeature(year);
    const territoryNote=territory
      ? `${year}年陳境採史圖館${territory.properties.source_year}年圖矢量化${territory.properties.year_relation==='exact'?'':'（最近可用年份）'}。${year===569?'廣州叛亂區仍計入陳境，另以綠色叛亂層疊加。':''}`
      : '本年尚無史圖館分期矢量，政權疆域仍以ChinaXMap 572年斷面近似。';
    yearMapNote.textContent=year===588
      ? '588年顯示人工覆核原圖；政權疆域以ChinaXMap 572年斷面近似，州郡縣治所與邊界以CHGIS V6為主、V4／V5補足。放大至160%後才載入約31 MB超高清檔案。'
      : `${year===557?'557年只繪製疆域，不反向補造行政資料。':'558—587年共用一份地形底圖，州郡縣、封國及可用邊界按年即時繪製。'}${territoryNote} 州郡縣治所與邊界以CHGIS V6為主、V4／V5補足；缺坐標者不臆測。`;
    currentMap={year,width:dynamic.width,height:dynamic.height,uhd:dynamic.map588.uhd};
    yearMapOverlay.setAttribute('viewBox',`0 0 ${dynamic.width} ${dynamic.height}`);
    yearMapOverlay.setAttribute('aria-label',`${year}年州郡縣治所可點擊定位圖層`);
    $('yearMapTitle').textContent=`公元${year}年南陳與同時期政權州郡縣封國`;
    $('yearMapUhd').href=dynamic.map588.uhd;$('yearMapCsv').href=dynamic.map588.csv;
    mapUhdLoaded=false;yearMapLoadUhd.disabled=false;yearMapLoadUhd.hidden=year!==588;yearMapLoadUhd.textContent='載入588年超高清原圖';
    if(year===588) {
      yearMapImage.src=dynamic.map588.preview;
      yearMapOverlay.replaceChildren();
      currentMapFeatures=window.CHEN_MAP_588?.features||[];
      appendHotspots(yearMapOverlay,currentMapFeatures);
      $('yearMapStatus').textContent=`588年先載入4.2 MB完整預覽；放大至160%或點擊按鈕後載入約31 MB原圖。${currentMapFeatures.length}個治所可與文字雙向定位。`;
    } else {
      yearMapImage.src=dynamic.base;
      currentMapFeatures=renderDynamicMap(year,snapshot,dynamic);
      $('yearMapStatus').textContent=`${year}年以共用地形和年度向量層即時繪製；${currentMapFeatures.length}個年表政區取得可用坐標，可與下方文字雙向定位。`;
    }
    yearMapImage.alt=`公元${year}年南陳與同時期政權州郡縣封國地形圖`;
    resetMapView();
  }

  async function exportCurrentYearMap() {
    if(!currentMap)return;
    if(currentMap.year===588) {
      const link=document.createElement('a');link.href=currentMap.uhd;link.download='588年_隋陳州郡縣封國地形圖_超高清.png';link.click();return;
    }
    const button=$('yearMapExport'),oldText=button.textContent;
    button.disabled=true;button.textContent='正在匯出…';
    try {
      const width=2400,height=2064,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      const base=new Image();base.src=yearMapImage.currentSrc||yearMapImage.src;await base.decode();context.drawImage(base,0,0,width,height);
      const clone=yearMapOverlay.cloneNode(true);
      clone.querySelectorAll('.map-hotspot').forEach((node)=>node.remove());
      clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));
      const defs=svgNode('defs'),style=svgNode('style',{},MAP_EXPORT_STYLE);defs.appendChild(style);clone.insertBefore(defs,clone.firstChild);
      const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob),overlay=new Image();overlay.src=url;await overlay.decode();context.drawImage(overlay,0,0,width,height);URL.revokeObjectURL(url);
      const png=await new Promise((resolve)=>canvas.toBlob(resolve,'image/png'));
      const downloadUrl=URL.createObjectURL(png),link=document.createElement('a');link.href=downloadUrl;link.download=`${currentMap.year}年_南陳州郡縣封國動態地圖.png`;link.click();
      setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);
      $('yearMapStatus').textContent=`已匯出${currentMap.year}年2400×2064 PNG；588年另保留9600×8256人工覆核原圖。`;
    } catch(error) {
      console.error(error);$('yearMapStatus').textContent='瀏覽器未能完成PNG匯出；請稍後重試或改用桌面瀏覽器。';
    } finally {button.disabled=false;button.textContent=oldText;}
  }

  function updateMethod() {
    const box=$('methodContent');box.replaceChildren();const paras=currentDynasty.key==='chen' ? [
      '頁面依據《中國行政區劃通史·三國兩晉南朝卷（下）》陳代實州郡縣沿革，按書中州、郡、縣原有次序重建公元558—588年各年年末狀態。永定元年（557）只新增史圖館疆域圖入口，行政區劃表仍明示原資料始於558年。原書明言陳代材料屬輯考、僅得其涯略，故疑字與年代不明者保留「※」。',
      '南陳州郡縣列在前；不能與本年南陳實際郡縣唯一對應的王國、郡公國及縣級開國爵，集中列於「未定位／疑似虛封封爵」。這一區並不等同於一律判定虛封：若史料或制度可證其並非虛封（如二王後），將在註記中明示。其後依次列後梁、王琳政權。後梁或王琳政區在其存續期結束後自動消失。',
      '宗室王國只在郡級政區旁標示王號與姓名，不計算元年、二年。郡公附於郡級，開國公侯伯子男附於縣級，標作公國、侯國、伯國、子國、男國。點擊小字可查看封爵年表、承襲與資料限制。封君卒後若襲封年份無明文而親屬關係、卒年可確，原則上以第三年記新封君，中間兩年記世子服喪；史料明載優先。最後可確年份以後材料不足者，以斜體表示存疑。',
      '封爵資料只是制度注記。南朝封君通常不到封國，網頁不以爵國名稱反推實際行政機構；只有本年能唯一對應一個南陳郡或縣時，才把爵號附在該政區旁。但是，儘管在行政上，封君已經基本喪失了對封國的干預，但封國在制度、禮儀、經濟等諸多層面的實在性確是確定無疑的。因此，我們認為，在唐朝不開國以前，仍有必要在郡縣旁邊標註封國與封君。',
      '陳代僑郡縣另依本書第十編侨州郡縣考表補充。梁、陳欄中，○所標為梁，△或明確屬陳者用於陳代判定。陳代不再把無實土侨州作為州級政區另列，州名及原有統屬不因此改變；僑郡、僑縣名稱以下劃線標示。若正文未標年代而原本以暗色顯示，一旦由侨置表確認為僑郡縣，以下劃線優先，不再變暗。點擊其註釋可見「原屬」與考表依據。',
      '方鎮長官另據魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》之「陳方鎮年表」。該表以年為經、州為緯，州下列都督、刺史等人物，並記官銜、月份、遷轉及考證。本頁在各州表內以「都督/刺史」逐人分行列出年表原有的人物、時間與官銜；州名及「都督/刺史」標題均可點擊展開完整考證。方鎮表有長官而本年政區表未列的州，另置「方鎮表另見之州」，只作政治史資料提示，不據此直接增改行政區劃。',
      '明州、利州等正文只知所領縣而所領郡乏考者，表格標為「郡無考」，不使用後世概念「州直領」。地圖治所與可用行政界線以CHGIS V6為主，V4補州界、V5補郡界；沒有坐標者不臆造位置。永定元年至天嘉三年、太建五年至太建十一年改用使用者保存的史圖館相應或最近年份地圖矢量化疆域，其餘年份仍明示採ChinaXMap 572年斷面近似。太建元年廣州叛亂區保留在陳境內，另疊加叛亂面。'
    ] : currentDynasty.key==='southern-liang' ? [
      '頁面依據《中國行政區劃通史·三國兩晉南朝卷（下）》第八編，按書中原有次序重建公元502—557年蕭梁州、郡級政區的逐年年末狀態。原書以問號、「前」「後」等表示的斷限仍以「※」保留，不改作確定年份。',
      '梁代實縣目前不做逐年變化：優先採用梁縣考證中的直接關係，其次採用齊末統屬，再以558年陳代統屬補充。744個梁實縣條目中，556個已確認所屬郡並靜態附入，188個多候選或無對應條目留待人工校勘，不強行放入任何郡。',
      '僑州、僑郡、僑縣以下劃線顯示；能由第十編僑州郡縣考表精確匹配者，可點擊註釋查看原屬州郡與考表頁序。梁代保留僑州，不套用南陳“不列無實土僑州”的規則。',
      '宗室王國、郡公與縣級開國爵依蕭梁封爵資料附於同名政區；只有本年能唯一匹配的政區才直接附入，無同名政區或存在多個同名政區者集中列入「未唯一定位的蕭梁封爵」。封君起訖不明、承襲空檔與服喪仍按原頁規則明示。',
      '都督、刺史等長官依《魏晉南北朝方鎮年表新編》梁方鎮年表逐年附入各州，每位人物獨佔一行；點擊州名或「都督/刺史」可查看年表頁序。方鎮表有條目而本年政區表沒有唯一對應州者，另列「方鎮表另見之州」，不據官銜反推行政建置。',
      '地圖僅顯示534年與555年兩個CHGIS基準斷面：544年以前選用534年圖，545年以後選用555年圖。它們只提供鄰近年份的空間參考，不把單年邊界外推為502—557年逐年精確疆域。',
      '都督／刺史與封國國君的人名色彩取自「梁代職官查詢換算系統」刺史年表：皇弟紅、皇子深紅、庶姓綠、皇弟皇子之庶子藍、嗣王紫、疏屬褐、昭明太子諸子橙、皇太子諸子黃、蕃王洋紅、特封郡王玫紅。色彩按「人物＋年份」逐年套用，同一人物跨年身份變化時保留各年的來源顏色；該年表中當年未見的人物保持原樣。只有同一人物同一年顏色互相衝突時，才不自動著色並等待人工覆核。'
    ] : [
      '頁面依據《中國行政區劃通史·三國兩晉南朝卷（上）》西晉州郡縣沿革重建，州、郡、縣均按原文次序排列。',
      '年末口徑依本編凡例處理；與上一年年末相比的新置、復置、廢省、改名、改屬等變化以加粗和右上角註釋標示。',
      '郡級宗室王國補列國主及年次；五等爵封國另以小字標示，起訖或承襲不完整者明示推定。'
    ];
    for(const t of paras){const p=document.createElement('p');p.textContent=t;box.appendChild(p);}
    $('footerText').textContent=currentDynasty.key==='chen'
      ? '資料依據：《中國行政區劃通史·三國兩晉南朝卷（下）》南朝陳政區；魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》方鎮長官；史圖館中國歷代疆域變遷地圖；封爵資料另見頁面說明。'
      : currentDynasty.key==='southern-liang'
        ? '資料依據：《中國行政區劃通史·三國兩晉南朝卷（下）》蕭梁政區；《魏晉南北朝方鎮年表新編》梁方鎮年表；封爵與僑置資料見頁面說明。'
        : '資料依據：《中國行政區劃通史·三國兩晉南朝卷（上）》西晉州郡縣沿革。';
  }

  function populateYears() {
    yearSelect.replaceChildren();const [start,end]=currentDynasty.years;
    for(let y=start;y<=end;y++){const o=document.createElement('option');o.value=String(y);o.textContent=formatYearLabel(y);if(y===currentDynasty.defaultYear)o.selected=true;yearSelect.appendChild(o);}
  }

  function populateStates(year) {
    stateSelect.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='全部州';stateSelect.appendChild(first);
    const snap=buildSnapshot(year);
    const groups=new Map();for(const s of snap.states){if(!groups.has(s.groupLabel))groups.set(s.groupLabel,[]);groups.get(s.groupLabel).push(s);}
    for(const [label,states] of groups){const og=document.createElement('optgroup');og.label=label;for(const s of states){const o=document.createElement('option');o.value=s.filterKey;o.textContent=s.name;og.appendChild(o);}stateSelect.appendChild(og);}
    if(currentDynasty.key==='southern-liang'&&snap.extraGovernorStates?.length){
      const fixedNames=new Set(snap.states.map((state)=>normalizeName(state.name)));
      const extras=[...new Set(snap.extraGovernorStates.map((record)=>record.state).filter((state)=>state&&!fixedNames.has(normalizeName(state))))];
      if(extras.length){
        const og=document.createElement('optgroup');og.label='方鎮表附錄州';
        for(const state of extras){const o=document.createElement('option');o.value=`${EXTRA_GOVERNOR_FILTER_PREFIX}${state}`;o.textContent=state;og.appendChild(o);}
        stateSelect.appendChild(og);
      }
    }
  }

  function render() {
    const year=Number(yearSelect.value);auxInfoRegistry.clear();auxInfoSequence=0;
    updateLiangGovernorYearbookSwitch(year);
    const chenAdministrativeBaseline=currentDynasty.key==='chen'&&year===558;
    const current=buildSnapshot(year), baseline=year===currentDynasty.years[0]||chenAdministrativeBaseline, previous=baseline?current:buildSnapshot(year-1), compared=compareSnapshots(current,previous,year);
    const visible=renderResults(compared.states,compared.virtualFiefs,compared.extraGovernorStates,year), removed=filterRemoved(compared.removedChanges);
    renderSummary(visible,removed);renderChangePanel(visible,removed);
    renderYearMap(year,current);
    $('statusText').textContent=currentDynasty.key==='chen'&&year===557
      ? '永定元年（557）只顯示史圖館矢量化疆域；現有《中國行政區劃通史》州郡縣資料從558年開始，故本年不反向補造行政區劃表。'
      : baseline
      ? `${formatYearLabel(year)}為${currentDynasty.label}行政資料起始年，不以缺失的前一年判定變動；州、郡、縣保留原書次序。`
      : `${formatYearLabel(year)}所示為年末狀態；與${formatYearLabel(year-1)}年末相比的行政區劃變動以加粗及註釋標示。${currentDynasty.key==='chen'?'陳代資料屬OCR初抽取與輯考重建；各州「都督/刺史」逐人分行列示，州名可點擊查看完整方鎮考證，後梁、王琳只在政權存續年份顯示。':currentDynasty.key==='southern-liang'?`蕭梁州郡逐年重建；556個已確認梁實縣靜態附入，另有${window.LIANG_COUNTY_OVERLAY?.meta?.manual_review||188}個待人工判斷。各州「都督/刺史」逐人分行列示。`:''}`;
    document.title=`${currentDynasty.label}·${formatYearLabel(year)}年末州郡縣表`;
  }

  function switchDynasty() {
    currentDynasty=DYNASTIES[dynastySelect.value]||DYNASTIES['western-jin'];document.body.dataset.theme=currentDynasty.theme;
    $('pageTitle').textContent=`${currentDynasty.label}年末州郡縣表`;$('pageSubtitle').textContent=currentDynasty.subtitle;
    $('fiefLegend').innerHTML=currentDynasty.key==='chen'
      ? '<i class="legend-ruler">始興王·某某／侯國·某某</i> 南朝封爵；<i class="legend-ruler fief-uncertain-legend">斜體</i> 承襲存疑'
      : currentDynasty.key==='southern-liang'
        ? '<i class="legend-ruler">長沙王·某某／侯國·某某</i> 南朝封爵；<i class="legend-ruler fief-uncertain-legend">斜體</i> 承襲存疑'
        : '<i class="legend-ruler">某王之二年</i> 國主年次';
    const hasSouthernLayers=currentDynasty.key==='chen'||currentDynasty.key==='southern-liang';
    const qiaoLegend=$('qiaoLegend'); if(qiaoLegend) qiaoLegend.hidden=!hasSouthernLayers;
    const governorLegend=$('governorLegend'); if(governorLegend) governorLegend.hidden=!hasSouthernLayers;
    const liangColorLegend=$('liangColorLegend');if(liangColorLegend)liangColorLegend.hidden=currentDynasty.key!=='southern-liang';
    if(liangReviewPanel)liangReviewPanel.hidden=currentDynasty.key!=='southern-liang';
    if(liangGovernorYearbookSwitch)liangGovernorYearbookSwitch.hidden=currentDynasty.key!=='southern-liang';
    if(liangReviewCount)liangReviewCount.textContent=window.LIANG_COUNTY_OVERLAY?.meta?.manual_review||188;
    searchInput.value='';changedOnly.checked=false;populateYears();
    if(!initialLocationApplied&&requestedDynasty===currentDynasty.key&&requestedYear&&[...yearSelect.options].some((option)=>Number(option.value)===requestedYear))yearSelect.value=String(requestedYear);
    populateStates(Number(yearSelect.value));
    if(!initialLocationApplied&&requestedDynasty===currentDynasty.key&&requestedState){const option=[...stateSelect.options].find((item)=>normalizeName(item.textContent)===normalizeName(requestedState));if(option)stateSelect.value=option.value;}
    initialLocationApplied=true;syncMainLocation();updateMethod();render();
  }

  function syncMainLocation() {
    const url=new URL(window.location.href);
    if(currentDynasty.key==='western-jin')url.searchParams.delete('dynasty');else url.searchParams.set('dynasty',currentDynasty.key);
    if(currentDynasty.key==='southern-liang'){
      url.searchParams.set('year',String(yearSelect.value));
      const selected=stateSelect.selectedOptions[0];
      if(stateSelect.value&&selected)url.searchParams.set('state',selected.textContent);else url.searchParams.delete('state');
    }else{
      url.searchParams.delete('year');url.searchParams.delete('state');
    }
    history.replaceState(null,'',url);
  }

  dynastySelect.addEventListener('change',switchDynasty);
  yearSelect.addEventListener('change',()=>{populateStates(Number(yearSelect.value));syncMainLocation();render();});
  stateSelect.addEventListener('change',()=>{syncMainLocation();render();});searchInput.addEventListener('input',render);changedOnly.addEventListener('change',render);
  document.addEventListener('click',(event)=>{
    const c=event.target.closest('[data-citation]');if(c){openCitation(c.dataset.citation);return;}
    const i=event.target.closest('[data-info]');if(i){openAuxInfo(i.dataset.info);return;}
    const hotspot=event.target.closest('.map-hotspot');if(hotspot){revealTextEntity(hotspot.dataset.entityId);return;}
    const entity=event.target.closest('.name-with-citation[data-entity-id]');if(entity&&textMapLinkToggle.checked)highlightMapEntity(entity.dataset.entityId,{scrollToMap:true});
    if(event.target.matches('[data-close-modal]'))closeModal();
  });
  yearMapOverlay.addEventListener('keydown',(event)=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.map-hotspot')){event.preventDefault();revealTextEntity(event.target.dataset.entityId);}});
  textMapLinkToggle.addEventListener('change',()=>{
    results.classList.toggle('text-map-link-enabled',textMapLinkToggle.checked&&!yearMapPanel.hidden);
    if(!yearMapPanel.hidden)$('yearMapStatus').textContent=textMapLinkToggle.checked
      ? '文字定位地圖已開啟；點擊普通州郡縣名稱可返回地圖。頁碼註釋、封國與方鎮說明仍按原方式開啟。'
      : `文字定位地圖已關閉；仍可從地圖的 ${currentMapFeatures.length} 個治所熱點定位到下方文字。`;
  });
  $('yearMapZoomIn').addEventListener('click',()=>applyMapZoom(mapZoom*1.25));
  $('yearMapZoomOut').addEventListener('click',()=>applyMapZoom(mapZoom/1.25));
  $('yearMapFit').addEventListener('click',resetMapView);
  $('yearMapReset').addEventListener('click',()=>{resetMapView();clearMapLinkHighlights();});
  yearMapLoadUhd.addEventListener('click',load588Uhd);
  $('yearMapExport').addEventListener('click',exportCurrentYearMap);
  yearMapViewport.addEventListener('wheel',(event)=>{
    if(!currentMap)return;
    event.preventDefault();applyMapZoom(mapZoom*(event.deltaY<0?1.14:1/1.14),{clientX:event.clientX,clientY:event.clientY});
  },{passive:false});
  yearMapViewport.addEventListener('pointerdown',(event)=>{
    if(event.button!==0||event.target.closest('.map-hotspot'))return;
    mapDrag={id:event.pointerId,x:event.clientX,y:event.clientY,left:yearMapViewport.scrollLeft,top:yearMapViewport.scrollTop};
    yearMapViewport.classList.add('is-dragging');yearMapViewport.setPointerCapture(event.pointerId);
  });
  yearMapViewport.addEventListener('pointermove',(event)=>{
    if(!mapDrag||mapDrag.id!==event.pointerId)return;
    yearMapViewport.scrollLeft=mapDrag.left-(event.clientX-mapDrag.x);yearMapViewport.scrollTop=mapDrag.top-(event.clientY-mapDrag.y);
  });
  const finishMapDrag=(event)=>{if(!mapDrag||mapDrag.id!==event.pointerId)return;mapDrag=null;yearMapViewport.classList.remove('is-dragging');};
  yearMapViewport.addEventListener('pointerup',finishMapDrag);yearMapViewport.addEventListener('pointercancel',finishMapDrag);
  window.addEventListener('resize',()=>{if(currentMap)applyMapZoom(mapZoom);});
  sourceModalClose.addEventListener('click',closeModal);document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!sourceModal.hidden)closeModal();});

  if(requestedDynasty&&DYNASTIES[requestedDynasty])dynastySelect.value=requestedDynasty;
  switchDynasty();
})();
