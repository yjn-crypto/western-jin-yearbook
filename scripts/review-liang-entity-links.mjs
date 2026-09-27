// One pass creates the requested inventory and performs focused checks for this iteration.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {root,createLiangContext} from './liang-snapshot-context.mjs';
const current=createLiangContext(),baseline=createLiangContext();
delete baseline.window.LIANG_ENTITY_LINKS;
vm.runInContext(execFileSync('git',['show','HEAD:liang-county-model.js'],{cwd:root,encoding:'utf8'}),baseline);
vm.runInContext(execFileSync('git',['show','HEAD:data/liang-administrative-corrections.js'],{cwd:root,encoding:'utf8'}),baseline);
const d=current.window.LIANG_COUNTY_REVIEWED;
assert.equal(d.counties.length,744);assert.equal(d.assignments.length,753);
assert.equal(d.counties.reduce((n,c)=>n+c.manual_reviews.length,0),87);
const flatten=s=>s.states.flatMap(state=>state.rows.flatMap(row=>row.counties.map(county=>({state,row,county}))));
const oldEver=new Set(),newEver=new Set(),snapshot=new Map(),yearly=[],oldPending=new Map();
for(let y=502;y<=557;y++){
  const old=baseline.buildLiangSnapshot(y),now=current.buildLiangSnapshot(y);
  snapshot.set(y,now);
  for(const {county} of flatten(old))oldEver.add(county.id);
  for(const p of old.pendingCountyAssignments){if(!oldPending.has(p.county.id))oldPending.set(p.county.id,new Set());oldPending.get(p.county.id).add(p.reason);}
  const seen=new Set();
  for(const {state,row,county} of flatten(now)){
    newEver.add(county.id);
    const unique=`${state.id}|${row.id}|${county.id}|${county.name}`;
    assert(!seen.has(unique));seen.add(unique);
    if(county.entityLink){
      assert(county.entityLink.prefecture_ids.includes(row.id));
      assert(y>=county.entityLink.start&&y<=county.entityLink.end);
      assert(county.source.excerpt.includes('本輪實體連接'));
    }
  }
  yearly.push({year:y,before:flatten(old).length,after:flatten(now).length,pending:now.pendingCountyAssignments.length});
}
const find=(y,n)=>flatten(snapshot.get(y)).filter(x=>x.county.id===`lc_${String(n).padStart(4,'0')}`);
assert(find(535,598).every(x=>x.row.id==='liang_s0058_p009'));assert.equal(find(535,598).length,1);
assert.equal(find(535,617).length,1);
assert.equal(find(535,703)[0].row.id,'liang_s0143_p003');
assert.equal(find(502,704)[0].row.id,'liang_s0139_p017');
for(const y of [523,524,535,552,553,556,557])assert.equal(snapshot.get(y).states.filter(s=>s.region==='江表').flatMap(s=>s.rows).filter(p=>p.name==='東陽郡').length,1);
for(const y of [554,555])assert.equal(snapshot.get(y).states.filter(s=>s.region==='江表').flatMap(s=>s.rows).filter(p=>p.name==='東陽郡').length,0);
assert.equal(find(549,14).map(x=>x.row.name).sort().join('|'),'吳郡|武原郡');
assert.equal(flatten(snapshot.get(535)).filter(x=>x.county.name==='湖熟').length,1);
assert.equal(flatten(snapshot.get(536)).filter(x=>x.county.name==='湖熟').length,0);
assert.equal(flatten(snapshot.get(534)).filter(x=>x.county.name==='崑山').length,0);
assert.equal(flatten(snapshot.get(535)).filter(x=>x.county.name==='崑山').length,1);
assert.equal(find(535,88).length,1);assert.equal(find(536,88).length,0);
assert.equal(find(535,72)[0].county.qiao,false);
assert.equal(find(535,242)[0].row.id,'liang_s0042_p001');
assert.equal(find(535,248)[0].county.reviewedAssignment.prefecture_name,'西恆農、陳留二郡');
assert.equal(find(535,250)[0].county.uncertain,true);
for(const n of [268,337,678,679,686])assert(!newEver.has(`lc_${String(n).padStart(4,'0')}`));

const key=current.window.LIANG_COUNTY_MODEL.key;
const originalPrefectures=baseline.window.LIANG_DATA.states.flatMap(s=>s.p.map(p=>({s,p})));
const classifications=[];
for(const county of d.counties.filter(c=>!oldEver.has(c.id))){
  const assignments=d.assignments.filter(a=>a.county_id===county.id),issues=assignments.flatMap(a=>a.issues||[]).join('；');
  const candidates=originalPrefectures.filter(t=>assignments.some(a=>key(t.p.n)===key(a.prefecture_name)));
  let category;
  if(assignments.some(a=>a.assignment_kind==='state_only'))category='僅知州，郡未詳';
  else if(/二郡合题|复合郡/.test(issues))category='合題實體連接';
  else if(!assignments.some(a=>a.display_allowed))category=/原核准附带疑点|字段|错配/.test(issues)?'來源或舊歸屬衝突':/重复/.test(issues)?'來源重複待整理':'年代或沿革邊界未定';
  else if(!candidates.length)category='州郡底表缺實體或異名';
  else if(!candidates.some(t=>key(t.s.r)===key(county.region)))category='資料分區不一致';
  else category='同地域同名或階段重疊';
  const links=current.window.LIANG_ENTITY_LINKS.county_links.filter(l=>l.county_id===county.id);
  classifications.push({county_id:county.id,record_id:county.record_id,name:county.name,region:county.region,
    category,resolved:newEver.has(county.id),assignments:assignments.map(a=>({id:a.id,prefecture:a.prefecture_name,state:a.state_name,start:a.start,end:a.end,display_allowed:a.display_allowed})),
    issues,original_pending_reasons:[...(oldPending.get(county.id)||[])],source:county.source,
    entity_link_ids:links.map(l=>l.id),resolution:links.map(l=>l.reason).join('；'),
    remaining_note:newEver.has(county.id)?'已至少在有郡段的年度連接；不表示所有年度或建廢年皆已解決。':category==='資料分區不一致'?'現有同名候選可能確為另一地區，須讀正文所屬州或補正歷史郡名；不可跨區自動取第一郡。':'保留可検索待考入口，原文及人工意見完整保留。'});
}
assert.equal(classifications.length,166);
const summary={baseline_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    county_records:744,assignment_records:753,manual_records:87,before_ever_attached:oldEver.size,
    after_ever_attached:newEver.size,before_never_attached:744-oldEver.size,after_never_attached:744-newEver.size,
    newly_attached:classifications.filter(c=>c.resolved).length,
    categories:Object.fromEntries([...new Set(classifications.map(c=>c.category))].map(k=>[k,{total:classifications.filter(c=>c.category===k).length,resolved:classifications.filter(c=>c.category===k&&c.resolved).length}])),
    checks:'一次502—557統計掃描，附具名實體、同名建平、東陽階段、海鹽549、湖熟535、崑山535、江乘535、侨郡實縣、人工暫系與僅州五條針對性檢查；未作全站回歸。'};
fs.writeFileSync(new URL('reports/liang-county-resolution-inventory.json',root),JSON.stringify({summary,yearly,records:classifications},null,2)+'\n');
const md=['# 梁代縣郡連接：本輪整理','',`原 ${summary.before_never_attached} 條全期未掛接中，本輪 ${summary.newly_attached} 條已可按明確實體連接；仍有 ${summary.after_never_attached} 條未掛接。`,
  '','744條縣記錄、753段、87條人工意見未改寫。新增郡和連接在獨立資料層。','',
  '| 原因 | 原166條 | 本輪已連接 |','| --- | ---: | ---: |',
  ...Object.entries(summary.categories).map(([k,v])=>`| ${k} | ${v.total} | ${v.resolved} |`),'',
  '可依地域上下文決定的同名郡已落實：泰昌、北井附治巫的建平郡，排除寧州同名郡；湘濱、重華保留人工巴陵郡；吳昌依正文附長沙。安成原有江表與嶺南地域保護保留，不另造人工待考。',
  '','原書二郡合題已有同地域底表行的十一條縣，直接連接合題實體。胡城、南頓保留人工陳留用名和來源陳南異文；濟陽保留暫系※。',
  '','新增正文漏提取的侨郡不從○、△推年。南琅邪與彭城分設確年、武進改蘭陵縣確年、若干南北郡異名及新增郡未知始年仍需考證。原書PDF版面尚未核驗。',
  '','東陽557前誤展502的重疊已修；婺州/縉州僅553、556兩個文獻錨年附東陽且保留※，554—555留待考，不補作連續任期。',
  '','本輪只做一次必要的縣層針對性檢查，不代表朝代最終驗收。',
  '','完整166項清單見 `liang-county-resolution-inventory.json`，逐條保留原原因、來源、連接ID和剩餘問題。',''].join('\n');
fs.writeFileSync(new URL('reports/liang-county-resolution.md',root),md);
console.log(JSON.stringify(summary,null,2));
