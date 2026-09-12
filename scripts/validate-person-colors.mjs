import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// A minimal DOM exercises the production appenders without introducing a
// browser dependency. Browser interaction and font availability are separate QA.
class Element {
  constructor(tag = 'span') {
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.classList = { add() {} };
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  set textContent(value) { this.children = [{ textContent: String(value) }]; }
  get textContent() { return this.children.map(child => child.textContent).join(''); }
}
const context = { window: {}, document: {
  createElement: tag => new Element(tag),
  createTextNode: value => ({ textContent: String(value) }),
} };
for (const file of [
  'data/chen-governor-yearbook.js', 'data/chen-yearbook-formats.js',
  'data/chen-fiefs.js', 'data/chen-governors.js', 'data/chen-local-officials.js',
  'data/chen-royal-identities.js', 'governor-source-format.js', 'chen-person-formats.js',
]) vm.runInNewContext(fs.readFileSync(root + file, 'utf8'), context, { filename: file });
const app = fs.readFileSync(root + 'app.js', 'utf8');
const start = app.indexOf('  function appendChenPersonColors(');
const end = app.indexOf('  function createChenColoredAuxButton(', start);
assert.ok(start >= 0 && end > start, 'body colour appender exists');
vm.runInNewContext(app.slice(start, end) + '\nwindow.appendBody = appendChenPersonColors;', context);

const { CHEN_PERSON_FORMATS: people, CHEN_YEARBOOK_FORMATS: formats,
  CHEN_GOVERNOR_YEARBOOK: yearbook, CHEN_GOVERNORS: governors,
  CHEN_ROYAL_IDENTITIES: identities, GOVERNOR_SOURCE_FORMAT: renderer } = context.window;
const sourceBefore = JSON.stringify({ formats, governors, fiefs: context.window.CHEN_FIEFS });
const ink = color => !color || /^(?:#000(?:000)?|black|inherit|currentcolor)$/i.test(color);
const fontKeys = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration',
  'textDecorationLine', 'textDecorationStyle', 'textDecorationColor', 'verticalAlign',
  'backgroundColor', 'letterSpacing'];
const font = style => Object.fromEntries(fontKeys.filter(key => style[key] !== undefined)
  .map(key => [key, key === 'verticalAlign' && !['baseline', 'super', 'sub'].includes(style[key]) ? 'baseline' : style[key]]));
function sourceCharacters(cell) {
  const runs = cell.runs?.map(run => run.text).join('') === cell.text
    ? cell.runs : [{ text: cell.text, style: {} }];
  return runs.flatMap(run => run.text.split('').map(character => ({ character, style: { ...cell.style, ...run.style } })));
}
function renderedCharacters(node, inherited = {}) {
  const style = { ...inherited, ...node.style };
  return node.children ? node.children.flatMap(child => renderedCharacters(child, style))
    : node.textContent.split('').map(character => ({ character, style }));
}
const count = { sourceCells: 0, nonemptyCells: 0, sourceCharacters: 0, sourcePeople: 0,
  sourceNonChen: 0, bodyLines: 0, bodyPeople: 0, bodyNonChen: 0, bodySourceFonts: 0,
  officePhraseOccurrences: 0, sourceRecolouredNameOccurrences: 0, sourceNameFills: 0,
  sourceNonNameBlackenedCharacters: 0, familyYearChecks: 0 };
const corrected = [];
const knownPeople = new Set();
const officePhrases = ['刺史', '都督', '監', '不行', '宣惠', '持節', '即位', '長史', '司馬', '將軍', '卸任', '未拜', '太守'];
function checkSemanticColour(value, year, state, characters, label) {
  const matches = people.matches(value, year, state);
  let previousEnd = 0;
  for (const match of matches) {
    assert.ok(match.index >= previousEnd, `${label}: name matches never overlap`);
    assert.equal(value.slice(match.index, match.index + match.length), match.text, `${label}: original name spelling`);
    assert.ok(match.person.aliases.has(match.text), `${label}: match belongs to a known person's aliases`);
    assert.doesNotMatch(match.text, /監|刺史|都督|長史|將軍|持節|即位|宣惠|不行/, `${label}: title range excludes office/prose`);
    previousEnd = match.index + match.length;
  }
  for (let index = 0; index < characters.length; index++) {
    const match = matches.find(item => item.index <= index && index < item.index + item.length);
    const color = characters[index].style.color;
    if (!match) assert.ok(ink(color), `${label}: non-name character ${value[index]} at ${index} must be black, got ${color}`);
    else if (!/^[陳陈]/.test(match.person.name)) assert.equal(color?.toUpperCase(), '#00B050', `${label}: ${match.text} is green`);
    else if (match.colorStyle) assert.equal(color?.toUpperCase(), match.colorStyle.color.toUpperCase(), `${label}: ${match.text} uses annual identity`);
  }
  for (const phrase of officePhrases) for (const hit of value.matchAll(new RegExp(phrase, 'g'))) {
    if (phrase === '司馬' && value.slice(hit.index).startsWith('司馬消難')) continue; // compound surname, not the office
    count.officePhraseOccurrences++;
    for (let index = hit.index; index < hit.index + phrase.length; index++) {
      assert.ok(ink(characters[index].style.color), `${label}: ${phrase} remains black`);
    }
  }
  return matches;
}
function checkCell(cell, year = null, state = null) {
  const matches = year ? people.matches(cell.text, year, state) : [];
  const element = new Element('td');
  renderer.appendCell(element, cell, { personMatches: matches });
  assert.equal(element.textContent, cell.text, `${cell.address}: full original cell string`);
  const expected = sourceCharacters(cell), actual = renderedCharacters(element);
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index++) {
    // Decorations are deliberately placed on spans rather than the parent.
    const expectedFont = font(expected[index].style), actualFont = font(actual[index].style);
    if (!('textDecoration' in expectedFont)) delete actualFont.textDecoration;
    if (!('verticalAlign' in expectedFont)) delete actualFont.verticalAlign;
    assert.deepEqual(actualFont, expectedFont, `${cell.address}: font/background at character ${index}`);
    if (/\S/u.test(expected[index].character) && !ink(expected[index].style.color)
      && !matches.some(match => match.index <= index && index < match.index + match.length)) count.sourceNonNameBlackenedCharacters++;
  }
  if (year) checkSemanticColour(cell.text, year, state, actual, `${year} ${cell.address}`);
  else assert.ok(actual.every(character => ink(character.style.color)), `${cell.address}: headers remain black`);
  for (const match of matches) {
    knownPeople.add(match.person.name);
    count.sourcePeople++;
    if (!/^[陳陈]/.test(match.person.name)) count.sourceNonChen++;
    const oldColors = new Set(expected.slice(match.index, match.index + match.length).map(item => item.style.color).filter(Boolean));
    const newColors = new Set(actual.slice(match.index, match.index + match.length).map(item => item.style.color).filter(Boolean));
    if ([...oldColors].some(color => !newColors.has(color))) {
      count.sourceRecolouredNameOccurrences++;
      if ([...oldColors].every(ink)) count.sourceNameFills++;
      corrected.push({ year, address: cell.address, text: match.text, from: [...oldColors], to: [...newColors], reason: match.colorStyle?.category });
    }
  }
  count.sourceCells++;
  count.nonemptyCells += Boolean(cell.text);
  count.sourceCharacters += [...cell.text].length;
}
for (const header of formats.headers) checkCell(header);
for (const row of formats.rows) {
  checkCell(row.reign, row.year);
  row.cells.forEach((cell, index) => checkCell(cell, row.year, yearbook.states[index].name));
  for (const [key, state] of [['auxiliary', '州資'], ['spacer', ''], ['appendix', '附錄']]) checkCell(row[key], row.year, state);
}
for (const [yearText, year] of Object.entries(governors.years)) for (const record of year.records) for (const line of record.summary_lines) {
  const element = new Element('div');
  context.window.appendBody(element, line, Number(yearText), record.state);
  assert.equal(element.textContent, line, `${yearText} ${record.state}: full body string`);
  const actual = renderedCharacters(element);
  const matches = checkSemanticColour(line, Number(yearText), record.state, actual, `${yearText} ${record.state}`);
  count.bodyLines++;
  for (const match of matches) {
    count.bodyPeople++;
    if (!/^[陳陈]/.test(match.person.name)) count.bodyNonChen++;
    if (match.source) {
      count.bodySourceFonts++;
      const expected = sourceCharacters(match.source.payload);
      for (let index = 0; index < expected.length; index++) {
        for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecorationLine', 'textDecorationStyle']) {
          assert.equal(actual[match.index + index].style[key], expected[index].style[key], `${yearText} ${record.state} ${match.text}: source ${key}`);
        }
      }
    }
  }
}

// Directed checks cover semantic boundary cases independently of the matcher.
for (const [year, value, name, expectedColor] of [
  [583, '新蔡王叔齊 宣惠將軍、刺史。', '陳叔齊', '#FF0000'],
  [583, '建安王叔卿 都督、刺史，不行。', '陳叔卿', '#FF0000'],
  [584, '晉熙王陳叔文 刺史。', '陳叔文', '#FF0000'],
  [575, '陳裒 刺史。', '陳褒', '#984807'],
  [557, '梁長沙蕃王蕭韶益州刺史', '蕭韶', '#00B050'],
  [585, '江州司馬吳世興、持節都督南川諸軍事周羅睺', '吳世興', '#00B050'],
]) {
  const element = new Element('div'); context.window.appendBody(element, value, year);
  const matches = checkSemanticColour(value, year, null, renderedCharacters(element), `directed ${year} ${name}`);
  const match = matches.find(item => item.person.name === name);
  assert.ok(match, `${name} is recognized`);
  assert.equal(match.colorStyle?.color, expectedColor, `${year} ${name} explicit expected colour`);
}
assert.equal(people.matches('宣惠將軍、持節、即位、監、不行', 583).length, 0, 'official prose must never become a person');
for (const name of ['陳叔寶', '陳叔陵', '陳叔獻']) assert.equal(people.identityStyle(name, 583), null, `${name}: current emperor or already dead is excluded`);
for (const family of identities.families) for (const period of family.periods) for (let year = period.start; year <= period.end; year++) {
  for (const child of family.children) {
    const name = `陳${child}`;
    if ((identities.deaths[name] ?? Infinity) < year || identities.emperors.some(item => item.name === name && year >= item.start && year <= item.end)) continue;
    assert.equal(people.identityStyle(name, year)?.color, period.color, `${year} ${name}: same-father annual colour`);
    count.familyYearChecks++;
  }
}
assert.equal(people.identityStyle('陳伯山', 566), null, 'year with intra-year succession uses original formatting instead of full-year familial override');
assert.equal(people.identityStyle('陳方泰', 583)?.color, '#7030A0', 'existing fief succession supplies violet');
assert.equal(people.identityStyle('陳法武', 557), null, 'surname alone never proves royal kinship');
for (const name of ['蕭韶', '蕭泰', '寧逵', '魯天念', '吳世興', '顧覺', '黃偲', '鄧嵩', '熊門超', '呂子廓', '戴智烈']) {
  assert.ok(knownPeople.has(name), `${name}: supplemental source roster is exercised by a real cell`);
}
assert.equal(JSON.stringify({ formats, governors, fiefs: context.window.CHEN_FIEFS }), sourceBefore, 'source strings, rich runs and historical data are not mutated');
const chenCorrections = corrected.filter(item => /陳/.test(item.text));
console.log('PASS: source/body person colours, black official prose, original text/font preservation, and annual royal-family validation.');
console.log(JSON.stringify({ ...count, distinctSourcePeople: knownPeople.size, chenCorrections }, null, 2));
