(()=>{
'use strict';

const RAW=window.LIANG_DATA||{meta:{},states:[],counties:[]};
const GOV=window.LIANG_GOVERNORS||{years:{}};
const O=window.LIANG_COUNTY_OVERLAY||{meta:{}};
const F=window.LIANG_FIEFS||{records:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s??'')
  .replace(/[\s·`？?※、，,。；;：:（）()【】\[\]○△—－-]/g,'')
  .replace(/錢唐/g,'錢塘').replace(/[鍾鐘]/g,'鍾').replace(/脩/g,'修').replace(/候官/g,'侯官')
  .replace(/(王國|公國|侯國|伯國|子國|男國|國|郡|尹|縣|州)$/g,'')
  .replace(/臺/g,'台');

function phasesOf(e){return e?.ph||e?.phases||[]}
function activePhase(e,y){
  return phasesOf(e)
    .filter(p=>Number(p.start)<=y&&y<=Number(p.end))
    .sort((a,b)=>Number(b.start)-Number(a.start))[0]||null;
}
function entityName(e,phase){return phase?.name||e?.n||e?.name||''}
function isUncertain(e,phase){return Boolean(phase?.uncertain||e?.uncertain)}
function entityQiao(e){return Boolean(e?.q||e?.qiao)}
function qiaoInfo(e){return e?.qi||e?.qiao_info||null}

const countiesByPref=new Map();
for(const c of RAW.counties||[]){
  const pref=c.p||c.prefecture||'';
  if(!pref) continue;
  const k=norm(pref);
  if(!countiesByPref.has(k)) countiesByPref.set(k,[]);
  countiesByPref.get(k).push(c);
}
for(const arr of countiesByPref.values()) arr.sort((a,b)=>String(a.n||a.name||'').localeCompare(String(b.n||b.name||''),'zh-Hant'));

function qiaoText(e){
  if(!entityQiao(e)) return '';
  const qi=qiaoInfo(e);
  if(!qi) return '僑置；原屬州、郡尚未完成逐條結構化。';
  const bits=[];
  if(qi.original_state) bits.push(`原屬州：${qi.original_state}`);
  if(qi.original_prefecture) bits.push(`原屬郡：${qi.original_prefecture}`);
  if(qi.marker==='liang_only') bits.push('侨置表：梁有陳無');
  else if(qi.marker==='chen_only') bits.push('侨置表：陳有梁無');
  else if(qi.marker==='both') bits.push('侨置表：梁、陳皆有');
  if(qi.qiao_table_page_index!=null) bits.push(`侨置表頁序：${qi.qiao_table_page_index}`);
  return bits.join('；')||'僑置。';
}
function qiaoNote(e){
  const text=qiaoText(e); if(!text) return '';
  return `<span class="qiao-note" title="${esc(text)}">${esc(text)}</span>`;
}

function resolveHolder(record,year){
  const holders=record.holders||[];
  let exact=holders.filter(h=>h.start!=null&&h.end!=null&&Number(h.start)<=year&&year<=Number(h.end));
  if(exact.length){
    const nonPost=exact.filter(h=>!h.posthumous);
    if(nonPost.length) exact=nonPost;
    exact.sort((a,b)=>Number(b.start)-Number(a.start));
    const h=exact[0];
    return {status:h.uncertain?'uncertain':'exact',holder:h};
  }
  const prev=holders.filter(h=>!h.posthumous&&h.end!=null&&Number(h.end)<year).sort((a,b)=>Number(b.end)-Number(a.end))[0];
  const next=holders.filter(h=>!h.posthumous&&h.start!=null&&Number(h.start)>year).sort((a,b)=>Number(a.start)-Number(b.start))[0];
  if(prev&&next&&Number(next.start)===Number(prev.end)+3&&year>=Number(prev.end)+1&&year<=Number(prev.end)+2){
    return {status:'mourning',holder:{person:'世子服喪'},prev,next};
  }
  const loose=holders.find(h=>h.start==null||h.end==null);
  return {status:'uncertain',holder:loose||{person:'封君存疑'},prev,next};
}

function activeFiefs(year){
  const out=[];
  for(const record of F.records||[]){
    const phase=(record.phases||[]).find(p=>Number(p.start)<=year&&year<=Number(p.end));
    if(!phase) continue;
    out.push({record,phase,...resolveHolder(record,year)});
  }
  return out;
}
function fiefLabel(match){
  const {record,phase,status,holder}=match;
  const who=holder?.person||'封君存疑';
  if(status==='mourning') return `${phase.fief}${record.rank==='王'?'王':'國'}·世子服喪`;
  if(record.kind==='prince'||record.rank==='王') return `${phase.fief}王·${who}${status==='uncertain'?' ※':''}`;
  return `${phase.fief}${record.rank}國·${who}${status==='uncertain'?' ※':''}`;
}
function fiefMatches(level,name,year){
  const key=norm(name);
  return activeFiefs(year).filter(x=>x.record.level===level&&norm(x.phase.fief)===key);
}
function fiefBadges(level,name,year){
  return fiefMatches(level,name,year).map(x=>{
    const cls=x.status==='mourning'?'mourning':x.status==='uncertain'?'doubt':'fief';
    const title=[
      `封爵：${fiefLabel(x)}`,
      `存續：${x.phase.start}—${x.phase.end}`,
      x.record.note||'',
      x.record.source_url?`來源：${x.record.source_url}`:''
    ].filter(Boolean).join('；');
    return `<span class="badge ${cls}" title="${esc(title)}">${esc(fiefLabel(x))}</span>`;
  }).join('');
}
function fiefSearchText(level,name,year){return fiefMatches(level,name,year).map(fiefLabel).join(' ')}

function govsFor(stateName,year){
  return (GOV.years?.[String(year)]?.records||[]).filter(r=>norm(r.state)===norm(stateName));
}
function statesAt(year){
  const showUncertain=$('showUncertain').checked;
  const out=[];
  for(const s of RAW.states||[]){
    const sp=activePhase(s,year); if(!sp) continue;
    if(!showUncertain&&isUncertain(s,sp)) continue;
    const prefs=[];
    for(const p of s.p||s.prefectures||[]){
      const pp=activePhase(p,year); if(!pp) continue;
      if(!showUncertain&&isUncertain(p,pp)) continue;
      const pname=entityName(p,pp);
      prefs.push({entity:p,phase:pp,name:pname,counties:countiesByPref.get(norm(pname))||[]});
    }
    out.push({entity:s,phase:sp,name:entityName(s,sp),region:s.r||s.region||'其他',prefs});
  }
  return out.sort((a,b)=>Number(a.entity.o||a.entity.order||0)-Number(b.entity.o||b.entity.order||0));
}

function populateStateFilter(year,preserve=true){
  const select=$('stateFilter');
  const old=preserve?select.value:'';
  const names=[]; const seen=new Set();
  for(const s of statesAt(year)){
    const key=norm(s.name); if(seen.has(key)) continue; seen.add(key); names.push(s.name);
  }
  select.replaceChildren();
  const all=document.createElement('option'); all.value=''; all.textContent='全部州'; select.append(all);
  for(const name of names){const o=document.createElement('option');o.value=norm(name);o.textContent=name;select.append(o)}
  if([...select.options].some(o=>o.value===old)) select.value=old;
}

function renderGovernorBox(govs){
  if(!govs.length) return '';
  return `<div class="governor-box"><strong>方鎮長官</strong>${govs.map(g=>`<p><span class="badge governor">刺史表</span> ${esc((g.summary_lines||[]).join('；'))}</p>`).join('')}</div>`;
}

function render(){
  const year=Number($('yearSelect').value);
  const query=norm($('searchInput').value);
  const selected=$('stateFilter').value;
  const snapshot=statesAt(year);
  let stateCount=0,prefCount=0,countyCount=0,govCount=0;
  let html='',currentRegion='';
  const presentStateNames=new Set();

  for(const s of snapshot){
    if(selected&&norm(s.name)!==selected) continue;
    presentStateNames.add(norm(s.name));
    const govs=govsFor(s.name,year);
    const stateSearch=[s.name,...govs.flatMap(g=>g.summary_lines||[])].join(' ');
    const stateHit=!query||norm(stateSearch).includes(query);
    const rows=[];

    for(const p of s.prefs){
      const prefSearch=`${p.name} ${fiefSearchText('prefecture',p.name,year)}`;
      const prefHit=!query||norm(prefSearch).includes(query);
      const matchedCounties=p.counties.filter(c=>{
        if(!query) return true;
        const cname=c.n||c.name||'';
        return norm(`${cname} ${fiefSearchText('county',cname,year)} ${qiaoText(c)}`).includes(query);
      });
      if(stateHit||prefHit||matchedCounties.length){
        rows.push({...p,displayCounties:(stateHit||prefHit)?p.counties:matchedCounties});
      }
    }
    if(query&&!stateHit&&!rows.length) continue;

    if(s.region!==currentRegion){currentRegion=s.region;html+=`<h2 class="region-title">${esc(currentRegion)}</h2>`}
    stateCount++; prefCount+=rows.length; countyCount+=rows.reduce((n,r)=>n+r.displayCounties.length,0); govCount+=govs.length;
    html+=`<article class="state-card">
      <div class="state-head">
        <div><h3 class="${entityQiao(s.entity)?'qiao':''} ${isUncertain(s.entity,s.phase)?'uncertain':''}">${esc(s.name)}${isUncertain(s.entity,s.phase)?' ※':''}</h3>${qiaoNote(s.entity)}</div>
        <div class="state-meta">${esc(s.phase.raw||'')}${s.region?` · ${esc(s.region)}`:''}</div>
      </div>
      ${renderGovernorBox(govs)}
      <div class="pref-list">`;
    for(const p of rows){
      html+=`<div class="pref-row">
        <div class="pref-name ${entityQiao(p.entity)?'qiao':''} ${isUncertain(p.entity,p.phase)?'uncertain':''}">
          ${esc(p.name)}${isUncertain(p.entity,p.phase)?' ※':''}${fiefBadges('prefecture',p.name,year)}
          ${qiaoNote(p.entity)}<span class="source-note">${esc(p.phase.raw||'')}</span>
        </div>
        <div class="county-list">`;
      if(p.displayCounties.length){
        html+=p.displayCounties.map(c=>{
          const name=c.n||c.name||'';
          const q=entityQiao(c); const qi=qiaoText(c);
          return `<span class="county ${q?'qiao':''}" title="${esc(qi||c.method||'')}">${esc(name)}${fiefBadges('county',name,year)}${q?'<small> 僑</small>':''}</span>`;
        }).join('');
      }else html+='<span class="source-note">本輪無已確認縣級歸屬</span>';
      html+='</div></div>';
    }
    html+='</div></article>';
  }

  $('results').innerHTML=html||'<div class="empty panel">沒有符合條件的政區。</div>';
  const fiefCount=activeFiefs(year).length;
  $('stats').innerHTML=[['州級',stateCount],['郡級',prefCount],['已附縣',countyCount],['本年封國',fiefCount],['方鎮條目',govCount]]
    .map(([label,value])=>`<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('');

  const unmatched=(GOV.years?.[String(year)]?.records||[]).filter(r=>!presentStateNames.has(norm(r.state)));
  const box=$('unmatched');
  if(unmatched.length){
    box.hidden=false;
    box.innerHTML=`<h2>方鎮表另見之州</h2><p class="source-note">下列州只表示《梁方鎮年表》本年有長官記錄；不據此反推或新增行政州。</p>${unmatched.map(r=>`<details><summary>${esc(r.state)}</summary><p>${esc((r.summary_lines||[]).join('；'))}</p></details>`).join('')}`;
  }else{box.hidden=true;box.innerHTML=''}
  updateMap(year);
}

let zoom=1;
function setZoom(next){zoom=Math.max(.35,Math.min(3,Number(next)||1));$('liangMap').style.width=`${zoom*100}%`}
function updateMap(year){
  const early=year<=544;
  $('liangMap').src=early?'assets/maps/reference/liang-534-chgis.png':'assets/maps/reference/liang-555-max-chgis.png';
  $('mapCaption').textContent=`所選 ${year} 年：顯示 ${early?'534':'555'} 年 CHGIS 基準斷面（只作空間參考）`;
}

for(let y=502;y<=557;y++){
  const o=document.createElement('option');o.value=String(y);o.textContent=`${y}年`;if(y===546)o.selected=true;$('yearSelect').append(o);
}
populateStateFilter(546,false);
$('methodText').textContent='州、郡按《中國行政區劃通史》502—557年逐年重建；梁縣不做逐年變化，梁本文／齊末關係優先，558年陳代統屬補充。744個梁實縣中556個已自動確認所屬郡，188個留待人工判斷。侨州郡縣以下劃線顯示；能由侨置表精確匹配者附原屬州、郡，不能精確匹配者不猜補。封爵層使用服喪／存疑規則；方鎮表與行政區存在與否分層處理。';
$('reviewCount').textContent=O.meta?.manual_review??RAW.county_review_count??188;

$('yearSelect').addEventListener('change',()=>{populateStateFilter(Number($('yearSelect').value));render()});
$('stateFilter').addEventListener('change',render);
$('showUncertain').addEventListener('change',()=>{populateStateFilter(Number($('yearSelect').value));render()});
$('searchInput').addEventListener('input',render);
$('zoomIn').addEventListener('click',()=>setZoom(zoom*1.2));
$('zoomOut').addEventListener('click',()=>setZoom(zoom/1.2));
$('fitMap').addEventListener('click',()=>setZoom(1));
render();
})();
