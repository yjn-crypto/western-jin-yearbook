/* Targeted regressions for the 2026-10-04 Jin text/display change. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.style = {setProperty(name, value) { this[name] = value; }};
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].filter(Boolean).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children) { this.children = children; }
  insertBefore(child, before) {
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  set textContent(value) { this.children = String(value) ? [{textContent: String(value)}] : []; }
  get textContent() { return this.children.map(child => child.textContent).join(''); }
}
const counters = new Map();
const context = vm.createContext({window: {}, document: {
  createElement: tag => new Element(tag),
  createTextNode: text => ({textContent: String(text)})
}});
context.$ = id => {
  if (!counters.has(id)) counters.set(id, new Element('span'));
  return counters.get(id);
};
context.currentDynasty = {key: 'western-jin', label: '西晉'};
context.createCitationButton = () => null;
context.createAuxButton = (label, info, className = '') => {
  const button = new Element('button');
  button.textContent = label; button.className = className; button.info = info;
  return button;
};
for (const file of ['data/jin-data.js', 'data/jin-admin-review.js', 'jin-admin-review.js',
  'data/princes.js', 'data/jin-ruler-constraints.js', 'data/five-rank-fiefs.js',
  'data/jin-multi-kingdoms.js', 'jin-kingdom-table.js']) {
  vm.runInContext(read(file), context, {filename: file});
}
const app = read('app.js');
function extract(name) {
  const start = app.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `Application function missing: ${name}`);
  const rest = app.slice(start + 3);
  const end = rest.search(/\n  (?:(?:async )?function |(?:const|let) )/);
  return app.slice(start, end < 0 ? undefined : start + 3 + end);
}
for (const name of ['activePhase', 'effectiveOrder', 'isKingdom', 'baseFiefName',
  'chineseNumber', 'reignYearLabel', 'findJinRuler', 'findJinFiveRank',
  'jinPrefectureFiefRank', 'jinFiveRankLabel', 'jinConstraintNote', 'jinFiveRankInfo', 'jinRulerInfo', 'buildJinSnapshot',
  'itemDisplayName', 'itemDisplaysAsKingdom', 'appendFiefDetails', 'makeNameSpan',
  'createGovernorIndexButton', 'renderLocalOfficerBox', 'renderState', 'renderSummary']) {
  vm.runInContext(extract(name), context, {filename: `app.js:${name}`});
}
const table = context.window.JIN_KINGDOM_TABLE;
const sourceBefore = JSON.stringify({data: context.window.JIN_DATA,
  princes: context.window.JIN_PRINCES, research: context.window.JIN_MULTI_KINGDOMS});

function administrativeShape(states) {
  // Presentation may reorder prefectures; base names, county ordering and parent IDs must survive.
  return plain(states.map(state => ({id: state.id, name: state.name,
    rows: state.rows.map(row => ({id: row.id, name: row.name,
      counties: row.counties.map(county => ({id: county.id, name: county.name}))
    })).sort((a, b) => a.id.localeCompare(b.id))
  })).sort((a, b) => a.id.localeCompare(b.id)));
}
function walk(element) {
  return [element, ...(element.children || []).flatMap(walk)];
}
function stateOf(snapshot, rowId) {
  const state = snapshot.states.find(item => item.rows.some(row => row.id === rowId));
  assert.ok(state, `Missing administrative row ${rowId}`);
  return state;
}
function rowOf(snapshot, rowId) {
  return stateOf(snapshot, rowId).rows.find(row => row.id === rowId);
}
function rowElement(article, rowId) {
  const result = walk(article).find(item => item.tagName === 'tr' && item.dataset.entityId === rowId);
  assert.ok(result, `Missing rendered row ${rowId}`);
  return result;
}
function assertAdministrativeCount(states, expected, label) {
  context.renderSummary(states, []);
  assert.equal(Number(context.$('prefCount').textContent), expected, label);
}

// A null start must never establish an incumbent. Independently attested incumbents
// with an unknown accession date are allowed, with no calculated accession-year label.
const originalPrinces = context.window.JIN_PRINCES;
try {
  context.window.JIN_PRINCES = {records: [{id: 'test-undated', fief: '測試', title: '測試王',
    person: '已知姓名', start: null, end: 311, sequence: 999}]};
  assert.equal(context.findJinRuler('測試國', 281).status, 'gap');
  assert.equal(context.findJinRuler('測試國', 304).status, 'gap');
  context.window.JIN_PRINCES.records[0].attested_years = [281];
  const attested = context.findJinRuler('測試國', 281);
  assert.equal(attested.status, 'matched');
  assert.equal(attested.label, '測試王已知姓名');
  assert.equal(context.findJinRuler('測試國', 280).status, 'gap');
  assert.equal(context.findJinRuler('測試國', 282).status, 'gap');
  assert.ok(context.jinRulerInfo(attested, 281).paragraphs.every(text => !text.includes('null')));
  assert.ok(context.jinRulerInfo(attested, 281).paragraphs.every(text => !text.includes('表列在位')));
  context.window.JIN_PRINCES.records[0].attested_years = [];
  context.window.JIN_PRINCES.records[0].attested_periods = [{start: 303, end: 305}];
  assert.equal(context.findJinRuler('測試國', 304).label, '測試王已知姓名');
  assert.equal(context.findJinRuler('測試國', 302).status, 'gap');
  assert.equal(context.findJinRuler('測試國', 306).status, 'gap');
  context.window.JIN_PRINCES.records.push({id: 'test-dated', fief: '測試', title: '測試王',
    person: '有年可考', start: 303, end: 311, sequence: 1});
  assert.equal(context.findJinRuler('測試國', 304).record, null, 'Two independently attested people must not silently select one');
} finally {
  context.window.JIN_PRINCES = originalPrinces;
}
const oldNullRows = JSON.parse(read('reports/jin-text-audit-20261004.json')).null_accession_display_rows;
assert.equal(oldNullRows.length, 46, 'The reviewed regression fixture must retain all 46 formerly affected rows');
for (const old of oldNullRows) {
  const ruler = context.findJinRuler(old.name, old.year);
  if (ruler.status === 'matched') {
    const record = ruler.record;
    const independentlyAttested = (record.attested_years || []).includes(old.year)
      || (record.attested_periods || []).some(period => period.start <= old.year && old.year <= period.end);
    assert.ok(record.start != null || independentlyAttested || (record.constraint?.certain_periods||[]).some(([a,b])=>a<=old.year&&old.year<=b),
      `${old.year} ${old.name}: an undated successor cannot fill an earlier vacant year`);
  }
}
assert.notEqual(context.findJinRuler('陳留國', 304).record?.person, '曹虔嗣');

// Apply the presentation layer to the application's own annual snapshot, and compare
// against the same application path with only that layer disabled. This detects lost
// members, duplicate members, accidental county moves and changes to source names.
const snapshots = new Map();
const applyRelations = table.apply;
for (let year = 266; year <= 316; year++) {
  let base;
  try {
    table.apply = () => {};
    base = administrativeShape(context.buildJinSnapshot(year).states);
  } finally {
    table.apply = applyRelations;
  }
  const snapshot = context.buildJinSnapshot(year);
  assert.deepEqual(administrativeShape(snapshot.states), base,
    `${year}: kingdom presentation must preserve every base prefecture, county and state affiliation`);
  for (const state of snapshot.states) {
    const before = administrativeShape([state]);
    const display = table.displayRows(state);
    const baseCountyIds = state.rows.flatMap(row => row.counties.map(county => `${row.id}/${county.id}`)).sort();
    const shownCountyIds = display.flatMap(row => row.counties.map(county => `${row.countyGroupParent || row.id}/${county.id}`)).sort();
    assert.deepEqual(plain(shownCountyIds), plain(baseCountyIds), `${year} ${state.name}: display groups must partition counties exactly once`);
    assert.deepEqual(administrativeShape([state]), before, `${year}: displayRows must not mutate administrative rows`);
  }
  snapshots.set(year, snapshot);
}
// The original 304 proofread snapshot remains an immutable before-change record.
// The user expressly authorized this review's corrections; compare every current
// annual slice to the separately generated Python pipeline consumed by the maps.
const baseline = JSON.parse(read('reports/jin-304-reviewed-baseline-20261004.json'));
assert.equal(baseline.states.flatMap(state=>state.rows).reduce((n,row)=>n+row.counties.length,0),1244);
const reviewed = JSON.parse(read('data/jin-reviewed-annual-rows.json'));
function rowShape(rows) {
  return plain(rows.map(row=>({id:row.id,name:row.name,state_id:row.state_id,
    counties:row.counties.map(county=>({id:county.id,name:county.name})).sort((a,b)=>a.id.localeCompare(b.id))
  })).sort((a,b)=>(a.state_id+'/'+a.id).localeCompare(b.state_id+'/'+b.id)));
}
for (const [year,snapshot] of snapshots) {
  const actual=snapshot.states.flatMap(state=>state.rows.map(row=>({...row,state_id:state.id})));
  assert.deepEqual(rowShape(actual),rowShape(reviewed.years[year]),`${year}: text and map must consume the same reviewed annual rows`);
}

for (let year = 312; year <= 316; year++) {
  const snapshot = snapshots.get(year);
  const residual = snapshot.states.find(state => state.id === 's01');
  assert.ok(residual?.residual, `${year}: residual Sili grouping must remain visible`);
  assert.deepEqual(plain(residual.rows.map(row => row.id).sort()), ['p002', 'p003']);
  assert.equal(residual.rows.reduce((count, row) => count + row.counties.length, 0), 14);
  context.renderSummary([residual], []);
  assert.equal(context.$('stateCount').textContent, '0', 'A historical grouping is not a newly extended state phase');
  assert.equal(context.$('prefCount').textContent, '2');
  assert.equal(context.$('countyCount').textContent, '14');
  assert.match(context.renderState(residual, year).textContent, /原轄存續郡縣/);
}

const in289 = snapshots.get(289);
const yang = stateOf(in289, 'p192');
const wuIndex = yang.rows.findIndex(row => row.id === 'p192');
const wuRows = yang.rows.slice(wuIndex, wuIndex + 3);
assert.deepEqual(plain(wuRows.map(row => row.id)), ['p192', 'p189', 'p193'],
  'Wu must be immediately followed by its Danyang and Wuxing subsidiary commanderies');
assert.deepEqual(plain(wuRows.map(row => row.displayName)), ['吳國', '丹楊支郡', '吳興支郡']);
assert.ok(table.joinsNext(wuRows[0], wuRows[1]));
assert.ok(table.joinsNext(wuRows[1], wuRows[2]));
assert.equal(table.joinsNext(wuRows[2], yang.rows[wuIndex + 3]), false);
assertAdministrativeCount([{...yang, rows: wuRows}], 3, 'The three actual commanderies of Wu must still count as three');
const yangHtml = context.renderState(yang, 289);
assert.ok(rowElement(yangHtml, 'p192').classList.contains('jin-kingdom-continues'));
assert.ok(rowElement(yangHtml, 'p189').classList.contains('jin-kingdom-continues'));

const guanghanState = stateOf(in289, 'p103');
const guanghan = rowOf(in289, 'p103');
assert.equal(guanghanState.name, '梁州');
assert.equal(guanghan.displayName, '廣漢支郡');
assert.equal(guanghan.jinKingdom.crossState, true);
assert.equal(guanghan.jinKingdom.primaryId, 'p115');
assert.equal(stateOf(in289, 'p115').name, '益州');
const liangHtml = context.renderState(guanghanState, 289);
const guanghanHtml = rowElement(liangHtml, 'p103');
assert.match(guanghanHtml.textContent, /屬成都國/);
assert.equal(guanghanHtml.classList.contains('jin-kingdom-continues'), false,
  'A subsidiary in another state must keep its table boundary');
assert.equal(table.joinsNext(rowOf(in289, 'p115'), guanghan), false);
const chengduIds = new Set(['p115', 'p103', 'p116', 'p117']);
const chengduStates = in289.states.map(state => ({...state, rows: state.rows.filter(row => chengduIds.has(row.id))})).filter(state => state.rows.length);
assertAdministrativeCount(chengduStates, 4, 'The actual four commanderies of Chengdu must count as four, across their original states');

// Chen inside Liang is a presentation partition of the existing county list, not
// an additional administrative commandery. The Oct 7 Word instruction includes
// Yangxia and removes the formerly independent Chen row.
const chenCountyIds = new Set(['c0231', 'c0232', 'c0233', 'c0234']);
for (const year of [281, 282, 289, 304]) {
  const snapshot = snapshots.get(year);
  const state = stateOf(snapshot, 'p025');
  const parent = rowOf(snapshot, 'p025');
  const saved = administrativeShape([state]);
  const display = table.displayRows(state);
  const group = display.find(row => row.displayCountyGroup && row.countyGroupParent === 'p025');
  assert.ok(group, `${year}: the reviewed Chen county group must be displayed under Liang`);
  assert.match(group.displayName, /陳支郡/);
  const expectedIds = parent.counties.filter(county => chenCountyIds.has(county.id)).map(county => county.id);
  assert.deepEqual(plain(group.counties.map(county => county.id)), plain(expectedIds));
  const parentIndex = display.findIndex(row => row.id === 'p025');
  assert.equal(display[parentIndex + 1].id, group.id);
  assert.ok(table.joinsNext(display[parentIndex], group));
  assert.ok(!display[parentIndex].counties.some(county => chenCountyIds.has(county.id)), 'Grouped counties must not be rendered twice');
  assert.deepEqual(administrativeShape([state]), saved, 'The display partition must not alter the base Liang county list');
  const onlyLiang = {...state, rows: [parent]};
  assertAdministrativeCount([onlyLiang], 1, 'The unestablished Chen administrative unit must not inflate the prefecture count');
  const rendered = context.renderState(onlyLiang, year);
  assert.equal(walk(rendered).find(item => item.classList?.contains('state-meta')).textContent, '1 郡級政區');
  assert.ok(rowElement(rendered, group.id).classList.contains('jin-subsidiary-row'));
  assert.ok(rowElement(rendered, 'p025').classList.contains('jin-kingdom-continues'));
  if (year === 304) {
    assert.equal(group.counties.length, 4);
    assert.ok(group.counties.some(county => county.id === 'c0233' && county.name === '陽夏'));
    assert.ok(!snapshot.states.some(state=>state.rows.some(row=>row.id==='p026')));
  }
}
// The Oct 7 display choice places Jiyang under Donghai from 306 until the
// 311 abolition; its original state remains unchanged.
for(const year of [305,306,311,312]){
  const snapshot=snapshots.get(year);
  const donghai=rowOf(snapshot,'p152');
  const rendered=context.renderState({...stateOf(snapshot,'p152'),rows:[donghai]},year);
  assert.equal(rendered.textContent.includes('另見：濟陽支郡（範圍待考）'),false);
  assertAdministrativeCount([{...stateOf(snapshot,'p152'),rows:[donghai]}],1,'The primary commandery counts once');
  const jiyang=rowOf(snapshot,'p015');
  assert.equal(jiyang.jinKingdom?.primaryId,year>=306&&year<311?'p152':undefined);
}
assert.equal(JSON.stringify({data: context.window.JIN_DATA,
  princes: context.window.JIN_PRINCES, research: context.window.JIN_MULTI_KINGDOMS}), sourceBefore,
  'The complete check must not mutate source data or the reviewed research layer');
console.log('Jin kingdom display OK: all 51 annual text slices match reviewed map rows; original 304 fixture retained; uncertain rulers guarded; residual Sili, cross-state subsidiaries and display-only Chen groups counted correctly.');
