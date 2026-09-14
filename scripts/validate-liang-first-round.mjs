import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {root,createLiangContext,extractFunction} from './liang-snapshot-context.mjs';
const context=createLiangContext();
for(const file of ['data/liang-local-officials.js','data/liang-governors.js','data/liang-governor-sources.js'])
  vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
const {LIANG_LOCAL_OFFICIALS:officials,LIANG_GOVERNORS:governors,LIANG_GOVERNOR_SOURCES:sources,LIANG_QIAO_SOURCES:qiao}=context.window;
const app=fs.readFileSync(new URL('app.js',root),'utf8');
const reviewed=JSON.parse(fs.readFileSync(new URL('data/liang-officials-reviewed.json',root)));
assert.equal(officials.meta.source_master_sha256,crypto.createHash('sha256').update(fs.readFileSync(new URL('data/liang-officials-reviewed.json',root))).digest('hex'));
context.currentDynasty={key:'southern-liang',label:'蕭梁'};
for(const name of ['localOfficerData','localOfficerRecords','localOfficerTenure','localOfficerDetachedReason','sortLocalOfficers','governorData','governorRecords'])
  vm.runInContext(extractFunction(app,name),context);
// The context stubs annotations during geographic builds; explicitly execute
// the real attachment function after each independent geography snapshot.
context.attachAnnual=vm.runInContext(`(${extractFunction(app,'attachLocalOfficers').trim()}\n)`,context);
let annualCount=0,attached=0,detached=0;
for(let year=502;year<=557;year++){
  const snap=context.buildLiangSnapshot(year);
  const unmatched=context.attachAnnual(snap.states,year);
  const actual=[...unmatched.map(r=>r.record),...snap.states.flatMap(s=>s.rows.flatMap(r=>[
    ...r.localOfficers,...r.counties.flatMap(c=>c.localOfficers)]))];
  const expected=reviewed.records.filter(r=>r.annual_presence_years.includes(year));
  assert.deepEqual(actual.map(r=>r.official_id).sort(),expected.map(r=>r.official_id).sort());
  assert.equal(new Set(actual.map(r=>r.annual_presence_id)).size,actual.length);
  for(const r of actual){
    const source=reviewed.records.find(s=>s.official_id===r.official_id);
    assert.equal(r.tenure_status,source.tenure_status);
    assert.equal(r.intra_year_order,null);
    assert.equal(r.projection_method,'reviewed_annual_anchor');
    assert.equal(r.tenure_boundary_status,'unknown');
    if(r.administrative_link.attach_to_snapshot)assert.equal(r.administrative_link.active_candidate_count,1);
  }
  annualCount+=actual.length;detached+=unmatched.length;attached+=actual.length-unmatched.length;
}
assert.equal(annualCount,30);assert.equal(attached,24);assert.equal(detached,6);
assert.equal(reviewed.excluded.length,8);
assert.equal(reviewed.records.filter(r=>r.tenure_status==='appointment_only').length,6);
assert.equal(context.localOfficerRecords(535).some(r=>r.official_id==='LIANG-EPUB-0026'),false,'謝征兩錨不得插入535');
assert.match(app,/appointmentOnly\?'〔授官〕'/);
// Preserve pending review data through comparison as well as construction.
context.mapById=items=>new Map(items.map(i=>[i.id,i]));context.citationRegistry=new Map();
vm.runInContext(extractFunction(app,'compareSnapshots'),context);
const pending=[{reason:'test unresolved assignment'}];
const compared=context.compareSnapshots({states:[],pendingCountyAssignments:pending},{states:[]},535);
assert.equal(compared.pendingCountyAssignments,pending);
let aligned=0,unmatched=0;
for(const [year,bucket] of Object.entries(governors.years)){
  const actual=context.governorRecords(Number(year));
  assert.equal(actual.length,bucket.records.length);
  for(let index=0;index<actual.length;index++){
    assert.equal(JSON.stringify(actual[index].summary_lines),JSON.stringify(bucket.records[index].summary_lines));
    const extra=sources.years[year][index];
    if(extra){
      aligned++;assert.equal(extra.state,bucket.records[index].state);
      assert.equal(extra.original_source_page_index,bucket.records[index].source_page_index);
      assert.equal(actual[index].source_verified,'unique_year_state_and_summary_alignment');
    }else{unmatched++;assert.equal(actual[index].source_alignment_pending,true);}
  }
}
assert.equal(aligned,sources.meta.matched_records);assert.equal(unmatched,sources.meta.unmatched_records);
assert.equal(Object.keys(qiao.pages).length,15);
assert.equal(qiao.pages['693'].book_page,1592);assert.equal(qiao.pages['693'].pdf_page,694);
assert.equal(qiao.county_corrections.lc_0727.qiao,false);
assert.equal(qiao.county_corrections.lc_0728.qiao,false);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
for(const m of html.matchAll(/<script src="([^"?]+)(?:\?[^" ]*)?"/g))assert.ok(fs.existsSync(new URL(m[1],root)),`Missing script: ${m[1]}`);
console.log(JSON.stringify({status:'pass',tenures:29,annualCount,attached,detached,appointmentOnly:6,excluded:8,governorAligned:aligned,governorPending:unmatched,qiaoPages:15}));
