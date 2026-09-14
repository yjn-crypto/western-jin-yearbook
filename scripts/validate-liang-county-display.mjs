import fs from 'node:fs';
import assert from 'node:assert/strict';
import {root,createLiangContext} from './liang-snapshot-context.mjs';
const ctx=createLiangContext(),data=ctx.window.LIANG_COUNTY_REVIEWED;
const rows=[],snapshots=new Map(),allAttached=new Set(),allPending=new Set();
const flatten=snap=>Array.from(snap.states).flatMap(state=>state.rows.flatMap(row=>row.counties.map(county=>({state,row,county}))));
for(let year=502;year<=557;year++){
  const snap=ctx.buildLiangSnapshot(year);snapshots.set(year,snap);
  const flat=flatten(snap),seen=new Set();
  for(const {state,row,county} of flat){
    const a=county.reviewedAssignment;
    assert(a&&a.display_allowed);
    assert(year>=a.start&&year<=a.end);
    assert.equal(state.region,a.region);
    assert.equal(ctx.window.LIANG_COUNTY_MODEL.key(row.name),ctx.window.LIANG_COUNTY_MODEL.key(a.prefecture_name));
    assert.equal(county.name,a.name);
    const unique=`${state.id}|${row.id}|${county.id}|${county.name}`;
    assert(!seen.has(unique),`${year}: duplicate attachment ${unique}`);seen.add(unique);allAttached.add(county.id);
    if(['lc_0727','lc_0728'].includes(county.id))assert.equal(county.qiao,false);
  }
  for(const p of snap.pendingCountyAssignments)allPending.add(p.county.id);
  rows.push({year,attached_display_entries:flat.length,attached_county_records:new Set(flat.map(r=>r.county.id)).size,
    pending_assignments:snap.pendingCountyAssignments.length,pending_county_records:new Set(snap.pendingCountyAssignments.map(p=>p.county.id)).size});
}
const find=(year,name)=>flatten(snapshots.get(year)).filter(r=>r.county.name===name);
const checks=[];
function check(name,fn){fn();checks.push(name);}
check('海鹽549吳郡武原並見，548/550分屬舊新郡',()=>{
  assert.deepEqual(find(548,'海鹽').map(r=>r.row.name),['吳郡']);
  assert.deepEqual(find(549,'海鹽').map(r=>r.row.name).sort(),['吳郡','武原郡']);
  assert(find(549,'海鹽').every(r=>r.state.name==='吳州'));
  assert.deepEqual(find(550,'海鹽').map(r=>r.row.name),['武原郡']);
});
check('決口臨水529改名同年雙列',()=>{
  assert.equal(find(528,'決口').length,1);assert.equal(find(528,'臨水').length,0);
  assert.equal(find(529,'決口').length,1);assert.equal(find(529,'臨水').length,1);
  assert.equal(find(530,'決口').length,0);assert.equal(find(530,'臨水').length,1);
});
check('湖熟535省廢當年仍列，536不列',()=>{assert.equal(find(535,'湖熟').length,1);assert.equal(find(536,'湖熟').length,0);});
check('昆山535始列，不提前至534',()=>{assert.equal(find(534,'崑山').length,0);assert.equal(find(535,'崑山').length,1);});
check('新安郡梁安人工527起列且保留不確定',()=>{
  assert.equal(find(526,'梁安').filter(r=>r.county.id==='lc_0045').length,0);
  const match=find(527,'梁安').find(r=>r.county.id==='lc_0045');assert(match);assert(match.county.uncertain);
});
check('僅州5條未偽造郡，仍有待考出口',()=>{
  const ids=data.assignments.filter(a=>a.assignment_kind==='state_only').map(a=>a.county_id);
  assert.equal(new Set(ids).size,5);
  for(const id of ids){assert(!allAttached.has(id));assert(allPending.has(id));}
});
check('三郡549已見；武原550返揚，吳郡549不重複',()=>{
  const prefs=year=>snapshots.get(year).states.flatMap(s=>s.rows.map(r=>({state:s.name,id:r.id,name:r.name})));
  assert.equal(prefs(549).filter(r=>r.name==='武原郡').length,1);
  assert(prefs(549).some(r=>r.name==='富春郡'));assert(prefs(549).some(r=>r.id==='liang_s0001_p007'));
  assert(!prefs(548).some(r=>r.id==='liang_s0001_p006'||r.id==='liang_s0001_p007'));
  assert.equal(prefs(549).filter(r=>r.name==='吳郡').length,1);
});
const report={status:'pass',scope:'502—557共56年；實際執行app的州郡快照及共用縣掛接模型',
  checks,unique_county_records_ever_attached:allAttached.size,
  unique_county_records_never_attached:data.counties.length-allAttached.size,
  note:'記錄數不等於歷史實縣總數；改名、改屬年可有多個顯示項。待考條目列出不表示本年確實存在。',rows};
fs.writeFileSync(new URL('reports/liang-county-display-audit.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,years:rows.length,checks:checks.length,everAttached:allAttached.size,neverAttached:report.unique_county_records_never_attached,year535:rows.find(r=>r.year===535)}));
