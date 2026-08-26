import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
const htmlSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cssSource=fs.readFileSync(path.join(root,'style.css'),'utf8');

function extractFunction(source,name) {
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`app.js 缺少 ${name}()`);
  const bodyStart=source.indexOf('{',start);
  let depth=0;
  for(let cursor=bodyStart;cursor<source.length;cursor+=1) {
    if(source[cursor]==='{')depth+=1;
    else if(source[cursor]==='}') {
      depth-=1;
      if(depth===0)return source.slice(start,cursor+1);
    }
  }
  throw new Error(`${name}() 函數括號不完整`);
}

const assignGovernorIndexes=vm.runInNewContext(`(${extractFunction(appSource,'assignGovernorIndexes')})`);
const southernPrefectureDisplayName=vm.runInNewContext(`(${extractFunction(appSource,'southernPrefectureDisplayName')})`);
const mergeGovernorRecords=vm.runInNewContext(`(${extractFunction(appSource,'mergeGovernorRecords')})`);
const appendGovernorExtra=vm.runInNewContext(`(${extractFunction(appSource,'appendGovernorExtra')})`,{
  normalizeName:(value)=>String(value||'').replace(/\s/g,''),
  mergeGovernorRecords
});
const coreGovernorStates=new Set(['揚州','江州','郢州','湘州','豫州','交州'].map((value)=>value.replace(/州$/,'')));
const chooseGovernorTarget=vm.runInNewContext(`(${extractFunction(appSource,'chooseGovernorTarget')})`,{
  normalizeName:(value)=>String(value||'').replace(/州$/,''),
  CORE_SOUTHERN_GOVERNOR_STATES:coreGovernorStates,
  governorStateContinuity:(state)=>state.continuity||0
});
const coreJiang={id:'liang_s0008',name:'江州',rows:Array(10),continuity:55,order:8};
const emptyJiang={id:'liang_s0146',name:'江州',rows:[],continuity:1,order:146};
assert.equal(chooseGovernorTarget([emptyJiang,coreJiang],{state:'江州'}),coreJiang,'正史江州應按大州與上下年連續性匹配，不得列入另見之州');
const coreYing={id:'liang_s0058',name:'郢州',rows:Array(11),continuity:55,order:58};
const emptyYing={id:'liang_s0034',name:'郢州',rows:[],continuity:2,order:34};
assert.equal(chooseGovernorTarget([emptyYing,coreYing],{state:'郢州'}),coreYing,'正史郢州應按大州與上下年連續性匹配，不得列入另見之州');
assert.equal(chooseGovernorTarget([{id:'a',name:'潼州',rows:[{}],continuity:2},{id:'b',name:'潼州',rows:[{}],continuity:2}],{state:'潼州'}),null,'非核心同名州缺乏上下文時不得強配');
const sample=[
  {name:'揚州',group:'chen',governor:{}},
  {name:'江州',group:'chen',governor:null},
  {name:'後梁荊州',group:'later_liang',governor:{}},
  {name:'廣州',group:'chen',governor:{}}
];
assignGovernorIndexes(sample,'chen');
assert.deepEqual(sample.map((state)=>state.governorIndex),[1,null,null,2],'只應依州序連續編號同政權、有方鎮資料的州');

sample[0].governor=null;
sample[1].governor={};
assignGovernorIndexes(sample,'chen');
assert.deepEqual(sample.map((state)=>state.governorIndex),[null,1,null,2],'切換年份後應從1重編並清除舊號');

assert.equal(southernPrefectureDisplayName({name:'始興郡',chenFiefs:[{}]}),'始興國','陳代郡級附著封國後應改顯示為國');
assert.equal(southernPrefectureDisplayName({name:'始興郡',chenFiefs:[]}),'始興郡','沒有封國的郡不得改名');
assert.equal(southernPrefectureDisplayName({name:'丹陽郡',fiveRankFiefs:[{}]}),'丹陽郡','西晉五等爵不得套用梁陳顯示規則');

const mergedGovernor=mergeGovernorRecords(
  {state:'高州',summary_lines:['周迪'],evidence_lines:['考證甲'],source_page_index:611},
  {state:'高州',summary_lines:['侯安都'],editorial_notes:['校勘乙'],source_page_index:615}
);
assert.deepEqual(JSON.parse(JSON.stringify(mergedGovernor.summary_lines)),['周迪','侯安都'],'同州同年多條方鎮記錄不得互相覆蓋');
assert.deepEqual(JSON.parse(JSON.stringify(mergedGovernor.source_page_indexes)),[611,615],'合併後必須保留全部年表頁序');
assert.deepEqual(JSON.parse(JSON.stringify(mergedGovernor.evidence_lines)),['考證甲'],'合併後必須保留考證');
assert.deepEqual(JSON.parse(JSON.stringify(mergedGovernor.editorial_notes)),['校勘乙'],'合併後必須保留人工校勘');

const governorExtras=[];
appendGovernorExtra(governorExtras,{state:'潼州',summary_lines:['刺史甲'],source_page_index:500},'政區表未列此州。');
appendGovernorExtra(governorExtras,{state:'潼 州',summary_lines:['刺史乙'],source_page_index:501},'政區表未列此州。');
assert.equal(governorExtras.length,1,'另見之州的同州多條方鎮記錄也必須合併');
assert.deepEqual(JSON.parse(JSON.stringify(governorExtras[0].summary_lines)),['刺史甲','刺史乙'],'另見之州合併後必須保留全部人物');
assert.deepEqual(JSON.parse(JSON.stringify(governorExtras[0].source_page_indexes)),[500,501],'另見之州合併後必須保留全部頁序');

assert.match(appSource,/assignGovernorIndexes\(states,targetGroup\);/,'attachGovernors() 必須在每個年度快照完成後編號');
assert.match(appSource,/target\.governor=mergeGovernorRecords\(target\.governor,displayRecord\)/,'同州同年多條方鎮記錄必須先合併再編號');
assert.match(appSource,/appendGovernorExtra\(extras,displayRecord,/,'未唯一附著的同州多條方鎮記錄也必須合併');
assert.match(appSource,/createGovernorIndexButton\(state\.governor,year,state\.governorIndex\)/,'州標題必須建立方鎮索引');
assert.match(appSource,/button\.textContent=`\{\$\{index\}\}`/,'索引顯示格式必須為 {n}');
assert.match(appSource,/button\.dataset\.info=registerAuxInfo\(governorInfo\(record,year\)\)/,'索引必須連到原方鎮考證卡片');
assert.match(htmlSource,/id="governorLegend"[^>]*>[\s\S]*?\{1\}[\s\S]*?逐年重編/,'圖例必須說明年度 {n} 索引');
assert.match(cssSource,/\.governor-index-link\s*\{/,'方鎮索引必須有獨立樣式');
assert.match(appSource,/else if \(oldRow\.name!==row\.name\)/,'行政變動比較必須繼續使用底層原名');
assert.match(appSource,/label:itemDisplayName\(row\)/,'動態地圖熱點必須使用逐年顯示名');
assert.match(appSource,/mapFeaturesWithSnapshotNames\(window\.CHEN_MAP_588\?\.features\|\|\[\],snapshot\)/,'588年地圖熱點必須套用逐年顯示名且保留原ID');

function loadGovernorData(filename,globalName) {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'data',filename),'utf8'),context,{filename});
  const data=context.window[globalName];
  assert.ok(data?.years,`${filename} 缺少逐年資料`);
  return data;
}

const chenContext={window:{}};
for(const filename of ['chen-data.js','chen-fiefs.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root,'data',filename),'utf8'),chenContext,{filename});
}
const activeAt=(phases,year)=>(phases||[]).find((phase)=>Number(phase.start)<=year&&year<=Number(phase.end));
const normalizeFiefName=(value)=>String(value||'').replace(/\s/g,'').replace(/(王國|公國|侯國|伯國|子國|男國|國|郡)$/,'');
const chen588Rows=[];
for(const state of chenContext.window.CHEN_DATA.regimes.chen.states||[]) {
  if(!activeAt(state.phases,588))continue;
  for(const prefecture of state.prefectures||[]) {
    const phase=activeAt(prefecture.phases,588);if(!phase)continue;
    chen588Rows.push({id:prefecture.id,name:phase.name||prefecture.base_name,chenFiefs:[],liangFiefs:[]});
  }
}
const chen588ByName=new Map();
for(const row of chen588Rows) {
  const key=normalizeFiefName(row.name);if(!chen588ByName.has(key))chen588ByName.set(key,[]);chen588ByName.get(key).push(row);
}
for(const record of chenContext.window.CHEN_FIEFS.records||[]) {
  if(record.level!=='prefecture')continue;
  const phase=activeAt(record.phases,588);if(!phase)continue;
  let targets=chen588ByName.get(normalizeFiefName(phase.fief))||[];
  const targetId=phase.target_id||record.target_id;
  if(targetId)targets=chen588Rows.filter((row)=>row.id===targetId);
  if(targets.length===1)targets[0].chenFiefs.push({record,phase});
}
const wu588=chen588Rows.find((row)=>row.name==='吳郡');
assert.ok(wu588?.chenFiefs.length,'588年吳郡必須實際附著吳國封爵');
assert.equal(southernPrefectureDisplayName(wu588),'吳國','588年吳郡必須顯示為吳國');
const danyang588=chen588Rows.find((row)=>row.name==='丹陽郡');
assert.ok(danyang588&&!danyang588.chenFiefs.length,'588年丹陽郡應作無封國對照');
assert.equal(southernPrefectureDisplayName(danyang588),'丹陽郡','無封國的588年丹陽郡必須仍顯示為郡');

const datasets=[
  ['南陳',loadGovernorData('chen-governors.js','CHEN_GOVERNORS')],
  ['蕭梁',loadGovernorData('liang-governors.js','LIANG_GOVERNORS')]
];
for(const [label,data] of datasets) {
  const years=Object.entries(data.years);
  assert.ok(years.length>0,`${label}方鎮資料不得為空`);
  let visibleRecords=0;
  for(const [year,entry] of years) {
    assert.ok(Array.isArray(entry.records),`${label}${year}年 records 必須是陣列`);
    for(const record of entry.records) {
      assert.equal(typeof record.state,'string',`${label}${year}年方鎮條目缺州名`);
      assert.ok(Array.isArray(record.summary_lines),`${label}${year}年${record.state} summary_lines 必須是陣列`);
      if(record.summary_lines.some((line)=>String(line||'').trim()))visibleRecords+=1;
    }
  }
  assert.ok(visibleRecords>0,`${label}方鎮資料沒有可顯示州記錄`);
  console.log(`${label}：${years.length}個年度、${visibleRecords}條可顯示州記錄`);
}

console.log('方鎮年度 {n} 索引與梁陳郡國顯示驗證通過。');
