import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
class Element {
  constructor() { this.children=[];this.style={};this.dataset={};this.classList={add(){}}; }
  appendChild(child) { this.children.push(child);return child; }
  replaceChildren(...children) { this.children=children; }
  setAttribute() {}
  set textContent(text) { this.children=text?[{textContent:String(text)}]:[]; }
  get textContent() { return this.children.map(child=>child.textContent).join(''); }
}
const context=vm.createContext({window:{},document:{createElement:()=>new Element(),createTextNode:text=>({textContent:String(text)})},
  currentDynasty:{key:'chen',label:'南陳',years:[557,588]},CORE_SOUTHERN_GOVERNOR_STATES:new Set(['揚','江','郢','湘','豫','交'])});
const load=file=>vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
for(const file of ['data/chen-data.js','data/chen-local-officials.js','data/chen-governors.js','data/chen-royal-identities.js',
  'data/chen-fiefs.js','data/chen-governor-yearbook.js','data/chen-yearbook-formats.js','governor-source-format.js'])load(file);
const oldOfficials=context.window.CHEN_LOCAL_OFFICIALS,oldGovernors=context.window.CHEN_GOVERNORS;
const before=JSON.stringify([oldOfficials,oldGovernors,context.window.CHEN_DATA,context.window.CHEN_YEARBOOK_FORMATS]);
load('data/chen-588-supplement.js');load('chen-person-formats.js');
assert.equal(JSON.stringify([oldOfficials,oldGovernors,context.window.CHEN_DATA,context.window.CHEN_YEARBOOK_FORMATS]),before,'no mutation to original records, map hierarchy or workbook');
const {CHEN_LOCAL_OFFICIALS:officials,CHEN_GOVERNORS:governors,CHEN_PERSON_FORMATS:people}=context.window;
for(const year of Object.keys(oldOfficials.years))if(year!=='588')assert.equal(officials.years[year],oldOfficials.years[year],`unchanged official year ${year}`);
for(const year of Object.keys(oldGovernors.years))if(year!=='588')assert.equal(governors.years[year],oldGovernors.years[year],`unchanged governor year ${year}`);

const app=fs.readFileSync(new URL('app.js',root),'utf8');
function extract(name) {
  const start=app.indexOf(`  function ${name}(`);assert.ok(start>=0,name);
  const rest=app.slice(start+3),end=rest.search(/\n  (?:(?:async )?function |(?:const|let) )/);
  return app.slice(start,end<0?undefined:start+3+end);
}
for(const name of ['normalizeName','activePhase','localOfficerRecords','sortLocalOfficers','localOfficerDetachedReason','attachLocalOfficers',
  'governorData','governorRecords','governorSummaryLines','governorStateContinuity','chooseGovernorTarget','mergeGovernorRecords','appendGovernorExtra',
  'assignGovernorIndexes','attachGovernors','appendLocalOfficerName','appendChenPersonColors'])vm.runInContext(extract(name),context);
const states=context.window.CHEN_DATA.regimes.chen.states.filter(state=>context.activePhase(state,588)).map(state=>({
  id:state.id,name:state.name,order:state.order,group:'chen',entity:state,
  rows:state.prefectures.filter(pref=>context.activePhase(pref,588)).map(pref=>({id:pref.id,counties:pref.counties.filter(county=>context.activePhase(county,588)).map(county=>({id:county.id}))}))}));
const detached=context.attachLocalOfficers(states,588);
context.attachGovernors(states,588,'chen');
const expected=[['任忠','ch_p0015'],['徐璒','ch_p0044'],['呂忠肅','ch_p0046'],['柳璿','ch_p0046'],['蕭廉','ch_p0045'],
  ['陸仲容','ch_p0041'],['王誦','ch_p0047'],['馬頲','ch_p0043'],['任瓘','ch_p0050'],['徐綜','ch_p0191'],['曾孝廣','ch_p0161'],['毛爽','ch_p0200']];
for(const [person,id] of expected) {
  const row=states.flatMap(state=>state.rows).find(row=>row.id===id);
  const matches=row.localOfficers.filter(record=>record.person===person);assert.equal(matches.length,1,`${person} attached once to ${id}`);
  const node=new Element();context.appendLocalOfficerName(node,matches[0],588);assert.equal(node.children[0].style.color,'#00B050',`${person} green`);
}
assert.ok(detached.some(({record})=>record.person==='黃正始'&&record.administrative_link.prefecture_id==='ch_p0053'));
assert.equal(people.fiefStyle('黃正始',588).color,'#00B050');
assert.ok(!context.localOfficerRecords(588).some(record=>record.official_id==='CS-0162'));
assert.ok(context.localOfficerRecords(587).some(record=>record.official_id==='CS-0162'));
assert.ok(context.localOfficerRecords(588).some(record=>record.office==='琅邪彭城二郡太守'),'previous dual-prefecture correction retained');
const ren=officials.tenures_by_id['USR588-01'];assert.equal(ren.tenure_time.start_lower,588);assert.match(ren.tenure_time.display,/推定/);assert.match(ren.full_title,/中二千石/);
assert.equal(states.flatMap(state=>state.rows).find(row=>row.id==='ch_p0046').localOfficers.length,2,'both Nankang neishi retained');
assert.ok(officials.years[588].local_officers.filter(record=>record.place==='南康').every(record=>record.intra_year_order_status==='unresolved'));
assert.match(officials.years[588].local_officers.find(record=>record.official_id==='CS-0387').display_correction,/永新侯陳君范/);
assert.equal(people.displayName('陈君范',588).text,'鄱陽國世子陳君范');assert.equal(people.fiefStyle('陈君范',588).color,'#7030A0');

for(const [name,stateId] of [['黃恪','ch_s0006'],['畢寶','ch_s0040'],['鄔居業','ch_s0042'],['錢季卿','ch_s0054'],
  ['顧覺','ch_s0046'],['戴智烈','ch_s0049'],['熊門超','ch_s0058'],['呂子廓','ch_s0062']]) {
  const governor=states.find(state=>state.id===stateId).governor;
  const lines=governor.summary_lines.filter(line=>line.includes(name));assert.equal(lines.length,1,`${name} appears once in correct state`);
  const node=new Element();context.appendChenPersonColors(node,lines[0],588,governor.state);
  assert.equal(node.textContent,lines[0]);
  const match=people.matches(lines[0],588,governor.state).find(match=>match.text.includes(name));assert.ok(match,`${name} recognized`);assert.equal(match.colorStyle.color,'#00B050');
  assert.equal(node.style.color,'#000000','office prose stays black');
}
const xu=states.find(state=>state.id==='ch_s0006').governor;
assert.ok(xu.editorial_notes.some(note=>/高級僚佐/.test(note)&&/陳彥、蕭摩訶/.test(note)));
assert.ok(xu.summary_lines.some(line=>/黃恪.*職銜存疑/.test(line)));
const ying=governors.years[588].records.find(record=>record.state==='郢州');
assert.ok(!ying.summary_lines.some(line=>/^[【\[]?郢州[】\]]$/.test(line)));assert.ok(ying.summary_lines.some(line=>line.includes('荀法尚')));assert.ok(ying.summary_lines.some(line=>line.includes('南平王嶷')));
assert.equal(officials.years[588].local_officers.length,oldOfficials.years[588].local_officers.length-1+13);
for(const html of ['index.html','chen-governor-yearbook.html']){
  const src=fs.readFileSync(new URL(html,root),'utf8');assert.ok(src.includes('data/chen-588-supplement.js'));assert.ok(src.indexOf('data/chen-588-supplement.js')<src.indexOf('chen-person-formats.js'));
}
console.log('588 supplement OK: 13 local officers, 8 governors, exact attachments and green names; Ren Zhong 588 inferred start, Junfan alternative, Xu Jian removal only in 588; original sources and all other years preserved.');
