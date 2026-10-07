/* Focused replay and county-transfer checks; no full-site review. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const context = vm.createContext({window: {}});
for (const file of ['data/jin-data.js', 'data/jin-admin-review.js', 'jin-admin-review.js']) {
  vm.runInContext(read(file), context, {filename: file});
}
const raw = context.window.JIN_DATA;
const before = JSON.stringify(raw);
const reviewed = context.window.JIN_ADMIN_REVIEW.prepare(raw);
assert.notEqual(reviewed, raw);
assert.equal(context.window.JIN_ADMIN_REVIEW.prepare(raw), reviewed, 'Annual snapshots must reuse the cached view');
assert.equal(JSON.stringify(raw), before, 'The historical source remains unchanged');
const data = JSON.parse(read('data/jin-reviewed-annual-rows.json'));
const review = JSON.parse(read('data/jin-admin-review.json'));
assert.equal(review.source_sha256, crypto.createHash('sha256').update(read('data/jin-data.js')).digest('hex'));
const rows = year => data.years[year];
const row = (year, id) => rows(year).find(r => r.id === id);
const owners = (year, name) => rows(year).filter(r => r.counties.some(c => c.name === name)).map(r => r.id);
const county = (year, id) => rows(year).flatMap(r => r.counties).filter(c => c.id === id);

assert.equal(Object.keys(data.years).length, 51);
assert.equal(review.candidate_resolutions.length, 131);
for (const candidate of review.candidate_resolutions) assert.ok(candidate.retained_keys.length <= 1);
for (const [year, rs] of Object.entries(data.years)) {
  const keys = rs.flatMap(r => r.counties.map(c => c.entity_key));
  assert.equal(new Set(keys).size, keys.length, `${year}: scoped entity keys are unique`);
  assert.ok(rs.every(r => !r.transfer_origin_grouping), `${year}: no obsolete transfer-origin groups remain`);
  assert.equal(owners(year, '修武').length, Number(year)<=311?1:0, `${year}: Xiu-wu follows its one valid parent, ending with that parent`);
}
assert.deepEqual(owners(279, '修武'), ['p008']);
assert.deepEqual(owners(280, '修武'), ['p007']);
assert.deepEqual(owners(272, '範'), ['p017'], 'Attested by 272 is not a known transfer happening in 272');
assert.deepEqual(owners(280, '東阿'), ['p016']);
assert.deepEqual(owners(279, '南充國'), ['p106']);
assert.deepEqual(owners(281, '南充國'), ['p108']);
assert.ok(row(281, 'p052'));
assert.deepEqual(row(281, 'p052').counties.map(c => c.name), ['下洛', '潘', '涿鹿']);
assert.ok(owners(281, '於陵').length);
assert.equal(county(266,'c0516').length,0);
assert.equal(county(266,'c0515').length,0);
assert.equal(county(266,'c0031')[0].transfer_destination_id,'p004');
assert.equal(county(266,'c0031')[0].transfer_origin_id,'p071');
assert.equal(county(266,'c0031')[0].transfer_event_certainty,'dated_in_source');
assert.match(county(266,'c0031')[0].year_note,/本年初屬雍州京兆郡；266年轉屬司州上洛郡/);
assert.equal(county(266,'c0032')[0].transfer_destination_id,'p004');
assert.equal(county(266,'c0028')[0].transfer_event_certainty,'inferred_source_year');
assert.equal(county(266,'c0028')[0].transfer_event_year,null);
assert.equal(county(266,'c0217')[0].transfer_event_certainty,'inferred_source_year');
assert.equal(county(266,'c0217')[0].transfer_event_year,null);
const geographicTransfers = Object.values(data.years).flatMap(rs=>rs.flatMap(r=>r.counties)).filter(c=>c.transfer_event_certainty==='dated_in_source');
assert.equal(geographicTransfers.length,141,'Dated source transfers remain; the superseded Yangxia return is removed by the Word ruling');
for (const c of geographicTransfers) {
  assert.equal(c.prefecture_id,c.transfer_destination_id,'The event-year text is already in the destination');
  assert.equal(c.state_id,c.transfer_destination_state_id);
  assert.ok(c.transfer_origin_id && c.transfer_origin_state_id,'The pre-change state and prefecture remain traceable');
  assert.match(c.year_note,/本年初屬.*；\d+年轉屬/);
}

assert.deepEqual(owners(281, '陳'), ['p025']);
assert.deepEqual(owners(282, '陳'), ['p025']);
assert.equal(row(281, 'p026'),undefined,'Withdrawn Chen is not artificially kept for its former counties');
assert.equal(row(280, 'p166'),undefined,'Withdrawn Xinye is not artificially kept for its former counties');
assert.equal(row(285, 'p104'),undefined,'Withdrawn Xindu is not artificially kept for its former counties');
assert.match(county(281,'c0231')[0].year_note,/本年初屬豫州陳國；281年轉屬豫州梁國/);
for (const name of ['武邑', '武遂', '觀津']) {
  assert.deepEqual(owners(289, name), ['p036']);
  assert.deepEqual(owners(290, name), ['p036']);
  assert.deepEqual(owners(291, name), ['p036']);
  assert.deepEqual(owners(304, name), ['p036']);
}
assert.deepEqual(owners(304, '歷陽'), ['p205']);
assert.deepEqual(owners(305, '歷陽'), ['p205']);
assert.deepEqual(owners(304, '陽羨'), ['p206']);
assert.deepEqual(owners(305, '陽羨'), ['p206']);
assert.equal(row(304, 'p224').state_name, '江州', 'Whole-commandery state transfer is not postponed');
assert.equal(row(303, 'p132').state_id, 's13');
assert.ok(!row(303, 'p132').counties.some(c => c.name === '滇池'));
assert.ok(row(303, 'p137').counties.some(c => c.name === '滇池'), 'County joins its new commandery in the event year');
assert.ok(row(304, 'p137').counties.some(c => c.name === '滇池'));
assert.deepEqual(owners(316, '華容'), ['p161']);
assert.deepEqual(owners(316, '永世'), ['p189']);

// Real homonyms are deliberately independent; name equality is not deduplication.
for (const [name, count] of [['黎陽', 2], ['舞陽', 2], ['平夷', 2], ['永寧', 2], ['東安', 2], ['西平', 2]]) {
  assert.equal(owners(281, name).length, count, `${name}: real homonyms remain`);
}
for (const [id, name] of [['c1022','睢陵'],['c1230','下雋'],['c1183','汎陽'],['c1043','郯'],['c1500','陽羨']]) {
  for (const year of Object.keys(data.years)) for (const c of county(year,id)) assert.equal(c.name,name);
}
assert.equal(county(281,'c0679')[0].name,'樂城');
assert.equal(county(283,'c0679')[0].name,'成固');
assert.equal(county(281,'c0701')[0].name,'什');
assert.match(county(281,'c0701')[0].year_note,/什邡/);
assert.equal(county(281,'c0949')[0].name,'新香');
assert.match(county(281,'c0949')[0].year_note,/新沓/);
assert.equal(county(281,'c0981')[0].name,'黔');
assert.match(county(281,'c0981')[0].year_note,/黔陬/);
console.log('Jin administrative review OK: replay cache, immutable source, 51 slices, 131 candidates, bounded dates, 141 event-year destinations with old-affiliation notes, no obsolete origin groups, scoped IDs and real homonyms.');
