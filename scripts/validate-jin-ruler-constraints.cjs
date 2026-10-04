const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = {window:{}};
vm.createContext(context);
for (const file of ['data/princes.js','data/five-rank-fiefs.js','data/jin-ruler-constraints.js','jin-kingdom-table.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const w=context.window, api=w.JIN_KINGDOM_TABLE;
const princes=w.JIN_PRINCES.records, fiefs=w.JIN_FIVE_RANK_FIEFS.records;
const before=JSON.stringify({princes,fiefs});
const ruler=(fief,year)=>api.rulerAt(princes,fief,year);
const five=(id,year)=>api.fiveRankAt(fiefs.find(r=>r.id===id),year);

// False early successors and indefinite predecessors are different failure modes.
for(const [fief,year] of [['陳留',304],['安平',304],['東海',313],['梁',315],['燕',281],['樂平',290],['代',300]]) {
  assert.equal(ruler(fief,year).record,null,`${fief} ${year} must remain unnamed`);
}
assert.equal(ruler('齊',304).record.person,'司馬超');
assert.equal(ruler('燕',302).record.person,'司馬幾');
assert.equal(ruler('燕',302).display_start,null);
assert.equal(ruler('樂成',314).record,null);
assert.equal(ruler('樂成',316).record.person,'司馬欽');
assert.equal(ruler('樂成',316).accession_known,false);
assert.equal(ruler('秦',294).record,null);
assert.equal(ruler('秦',300).record.person,'司馬郁');
assert.equal(ruler('秦',300).display_start,null);
assert.equal(ruler('清河',308).record,null,'both holders are attested during this year');
assert.equal(ruler('清河',308).active.length,2);
assert.equal(ruler('西陽',305).record,null);
assert.equal(ruler('西陽',307).display_start,306,'restoration starts a new reign count');
assert.equal(five('fr0001',274).record,null,'unknown accession must not fill a predecessor gap');
assert.equal(five('fr0001',300).record.person,'石統');
assert.equal(five('fr0001',300).display_start,null);
assert.equal(five('fr0001',311).record,null,'310s endpoint is not exact 319');
assert.equal(five('fr0013',306).record,null,'posthumous recipient is not a living annual holder');
assert.equal(five('fr0263',304).record,null);
assert.equal(five('fr0059',298).record,null,'a decade of accession is not an accession year');
assert.equal(five('fr0059',300).record.person,'司馬宗');
assert.equal(five('fr0059',300).accession_known,false);
assert.equal(five('fr0219',275).display_start,null,'an end-only OCR field must not become year one');

const overlays=JSON.parse(fs.readFileSync(path.join(root,'data/jin-fief-research/reviewed-kingdom-display-20261004.json'),'utf8')).records;
const qin=overlays.find(r=>r.id==='QIN_YU');
assert.equal(api.reviewedRulerAt(princes,qin,294).record,null,'manual holder must not bypass constraints');
assert.equal(api.reviewedRulerAt(princes,qin,300).display_start,null);
let checked=0;
for(let year=266;year<=316;year++) {
  for(const fief of new Set(princes.map(r=>r.fief))) {
    const result=ruler(fief,year);
    assert.equal(result.all.length,princes.filter(r=>r.fief===fief).length,'whole genealogy retained');
    for(const active of result.active) {
      assert.ok(!['eastern_jin','after_western_jin'].includes(active.constraint.dynasty));
      assert.ok(active.constraint.certain_periods.some(([a,b])=>a<=year&&year<=b));
    }
    checked++;
  }
  for(const f of fiefs) {
    const result=api.fiveRankAt(f,year);
    assert.ok(result.holder_names.length<=1);
    assert.equal(result.all.length,f.holders.length);
    if(result.record)assert.equal(result.record.constraint.posthumous,false);
    checked++;
  }
  for(const overlay of overlays.filter(r=>r.begin<=year&&year<=r.end)) {
    const result=api.reviewedRulerAt(princes,overlay,year);
    if(result.record)assert.equal(ruler(overlay.kingdom_name,year).record?.person,result.record.person);
  }
}
assert.equal(JSON.stringify({princes,fiefs}),before,'source records remain unchanged');
assert.equal(Object.keys(w.JIN_RULER_CONSTRAINTS.princes).length,princes.length);
assert.equal(Object.keys(w.JIN_RULER_CONSTRAINTS.five_rank).length,
  fiefs.reduce((total,f)=>total+f.holders.reduce((n,h)=>n+Math.max(1,h.periods.length),0),0));
console.log(`Jin ruler constraints passed: ${checked} annual lookups; full source genealogies preserved.`);
