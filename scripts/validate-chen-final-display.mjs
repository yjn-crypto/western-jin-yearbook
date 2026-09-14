import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {};
    this.style = {setProperty(name, value) { this[name] = value; }};
    const classes = new Set();
    this.classList = {add: (...names) => names.forEach(name => classes.add(name)), contains: name => classes.has(name)};
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  set textContent(value) { this.children = String(value) ? [{textContent: String(value)}] : []; }
  get textContent() { return this.children.map(child => child.textContent).join(''); }
}
const context = vm.createContext({window: {}, document: {
  createElement: tag => new Element(tag), createTextNode: text => ({textContent: String(text)})
}});
for (const file of ['data/chen-data.js', 'data/chen-governor-yearbook.js', 'data/chen-yearbook-formats.js',
  'data/chen-fiefs.js', 'data/chen-governors.js', 'data/chen-local-officials.js',
  'data/chen-royal-identities.js', 'governor-source-format.js', 'chen-person-formats.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), context, {filename: file});
}
const {CHEN_PERSON_FORMATS: people, CHEN_LOCAL_OFFICIALS: officials, CHEN_FIEFS: fiefs} = context.window;
const before = JSON.stringify({officials, fiefs});
const app = fs.readFileSync(new URL('app.js', root), 'utf8');
function extract(name) {
  const start = app.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const rest = app.slice(start + 3), end = rest.search(/\n  (?:(?:async )?function |(?:const|let) )/);
  return app.slice(start, end < 0 ? undefined : start + 3 + end);
}
context.createAuxButton = (text, info, className) => {
  const element = new Element('button'); element.textContent = text;
  element.className = className; element.title = info.summary; return element;
};
context.localOfficerInfo = record => ({summary: record.person});
context.currentDynasty = {key:'chen',label:'南陳'};
for (const name of ['appendChenPersonColors', 'createChenColoredAuxButton', 'appendLocalOfficerName',
  'createLocalOfficerButton', 'activeChenDisplay', 'chenFiefText', 'localOfficerRecords',
  'localOfficerDetachedReason', 'sortLocalOfficers', 'attachLocalOfficers']) vm.runInContext(extract(name), context);

// The two real user examples: the whole fief badge, and a coloured royal title
// alongside an uncoloured office, including an uncertain annual occurrence.
const pengze = fiefs.records.find(record => record.id === 'chen_fief_0017');
const display = context.activeChenDisplay(pengze, 588);
const label = context.chenFiefText({record: pengze, display});
const badge = context.createChenColoredAuxButton(label, {summary: '彭澤國'}, 'fief-badge', 588, display.people);
assert.equal(badge.textContent, '侯國·魯覽');
assert.ok(badge.classList.contains('chen-fief-uniform'));
assert.equal(badge.style['--person-color'], '#00B050');
const huaHua = fiefs.records.find(record => record.id === 'chen_fief_0018');
const unnamedDisplay = context.activeChenDisplay(huaHua, 588);
const unnamedMatch = {record: huaHua, display: unnamedDisplay, holders: []};
const unnamedLabel = context.chenFiefText(unnamedMatch);
const unnamedBadge = context.createChenColoredAuxButton(unnamedLabel, {summary: '懷化國'}, 'fief-badge editorial-uncertain', 588, [], unnamedMatch);
assert.equal(unnamedBadge.textContent, '侯國·封君未詳', 'a surname inference must not invent the successor name');
assert.equal(unnamedBadge.style['--person-color'], '#00B050');
assert.match(unnamedBadge.title, /侯曉/);
assert.ok(unnamedBadge.className.includes('editorial-uncertain'), 'the uncertain status class is preserved');
for (const [person, expectedColor, expectedText] of [
  ['陈君范', '#7030A0', '鄱陽國世子陳君范'], ['陈仲华', '#00B050', '新夷子陳仲華']
]) {
  const name = new Element('span');
  context.appendLocalOfficerName(name, {person}, 588);
  assert.equal(name.textContent, expectedText);
  assert.equal(name.children[0].style.color, expectedColor);
}
for (const year of [587, 588]) {
  const record = officials.years[year].local_officers.find(item => item.person === '陈叔达');
  const button = context.createLocalOfficerButton(record, year, `local-officer-entry ${record.annual_presence_status}`);
  assert.match(button.textContent, /[義义][陽阳]王[陳陈]叔[達达]/);
  assert.equal(button.style.color, '#000000');
  assert.equal(button.children[0].style.color, '#FF0000');
  assert.equal(button.children[1].textContent, '　丹阳尹');
  assert.equal(button.children[0].style.fontStyle, undefined, 'the name inherits the annual status italics');
  assert.ok(button.className.endsWith(record.annual_presence_status));
  assert.equal(button.dataset.annualPresenceId, record.annual_presence_id);
}

for (const [name, year] of [['陳慧紀', 588], ['陳方慶', 585]]) {
  const decorated = people.decorateText(`${name} 刺史。`, year);
  assert.match(decorated, /侯[陳陈]/, `${name} must include its marquis title`);
  const element = new Element('p'); context.appendChenPersonColors(element, decorated, year);
  assert.equal(element.textContent, decorated, 'source font rendering cannot erase added title/name');
  assert.ok(element.textContent.endsWith(' 刺史。'));
}

// Explanation only this pass: the existing 585 ± 3 projection must remain intact.
const songyang = officials.years[588].local_officers.find(item => item.official_id === 'CS-0260');
assert.ok(songyang);
assert.equal(songyang.annual_presence_status, 'probable');

// Only the user-identified 588 pair is merged and attached; keep every other
// annual record, the original source IDs, and all Xu Jian dates intact.
const displayed = context.localOfficerRecords(588);
const combined = displayed.find(record => record.official_id === 'CS-0431');
assert.equal(combined.office, '琅邪彭城二郡太守');
assert.equal(combined.administrative_link.state_id, 'ch_s0001');
assert.equal(combined.administrative_link.prefecture_id, 'ch_p0002');
assert.equal(combined.combined_source_ids.length, 2);
assert.ok(!displayed.some(record => record.official_id === 'CS-0438'));
const states = [{id:'ch_s0001',group:'chen',rows:[{id:'ch_p0002',counties:[]}]}];
const actualYangzhou = context.window.CHEN_DATA.regimes.chen.states.find(state => state.id === 'ch_s0001');
assert.ok(actualYangzhou.prefectures.some(row => row.id === 'ch_p0002' && row.phases.some(phase => phase.start <= 588 && phase.end >= 588)), 'the corrected target is the actual active dual prefecture');
const detached = context.attachLocalOfficers(states, 588);
assert.ok(states[0].rows[0].localOfficers.some(record => record.official_id === 'CS-0431'));
assert.ok(!detached.some(({record}) => ['CS-0431','CS-0438'].includes(record.official_id)));
for (const [year, data] of Object.entries(officials.years)) {
  const visible = context.localOfficerRecords(year);
  const expected = data.local_officers.filter(record => ['confirmed','probable'].includes(record.annual_presence_status));
  assert.equal(visible.length, expected.length - (year === '588' ? 1 : 0));
  for (const record of expected) if (year !== '588' || !['CS-0431','CS-0438'].includes(record.official_id)) {
    assert.equal(JSON.stringify(visible.find(item => item.annual_presence_id === record.annual_presence_id)), JSON.stringify(record), `unchanged annual record ${record.annual_presence_id}`);
  }
}
assert.equal(JSON.stringify({officials, fiefs}), before, 'presentation must not rewrite the source data');
console.log('Chen final display OK: fief colours, royal names, black offices, annual italics, merged 588 dual-prefecture appointment, and all other annual/source records unchanged.');
