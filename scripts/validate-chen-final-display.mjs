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
for (const file of ['data/chen-governor-yearbook.js', 'data/chen-yearbook-formats.js',
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
for (const name of ['appendChenPersonColors', 'createChenColoredAuxButton', 'appendLocalOfficerName',
  'createLocalOfficerButton', 'activeChenDisplay', 'chenFiefText']) vm.runInContext(extract(name), context);

// The two real user examples: the whole fief badge, and a coloured royal title
// alongside an uncoloured office, including an uncertain annual occurrence.
const pengze = fiefs.records.find(record => record.id === 'chen_fief_0017');
const display = context.activeChenDisplay(pengze, 588);
const label = context.chenFiefText({record: pengze, display});
const badge = context.createChenColoredAuxButton(label, {summary: '彭澤國'}, 'fief-badge', 588, display.people);
assert.equal(badge.textContent, '侯國·魯覽');
assert.ok(badge.classList.contains('chen-fief-uniform'));
assert.equal(badge.style['--person-color'], '#00B050');
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
assert.equal(JSON.stringify({officials, fiefs}), before, 'presentation must not rewrite the source data');
console.log('Chen final display OK: whole fief colour, local royal title/name, black offices, annual italics, marquis governors, and unchanged Songyang occurrence.');
