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
// 2026-09-12 final correction: named kinship, correct title, and colour stay
// separate; neither a matching surname nor a county marquis proves succession.
assert.equal(people.fiefStyle('魯覽', 588)?.color, '#00B050', 'actual Pengze holder is green');
assert.equal(people.fiefStyle('鲁岚', 588)?.color, '#00B050', 'unlisted non-Chen name still green');
assert.notEqual(people.canonicalName('鲁岚'), people.canonicalName('魯覽'), 'different names are never silently merged');
assert.equal(people.displayName('鲁岚', 588).text, '鲁岚', 'non-Chen source spelling remains intact');
assert.equal(people.displayName('魯覽', 588).title, '', 'do not add unsolicited titles to non-Chen names');
assert.equal(people.decorateText('魯覽、魯廣達 刺史。', 588), '魯覽、魯廣達 刺史。', 'non-Chen prose remains unchanged');
assert.equal(people.displayName('陈君范', 588).text, '鄱陽國世子陳君范', 'user-specified title is shown without changing source data');
assert.equal(people.fiefStyle('陈君范', 588)?.color, '#7030A0', 'user-specified Shizi exception uses violet');
assert.equal(people.fiefStyle('陈仲华', 588)?.color, '#00B050', 'user-specified Chen Zhonghua exception uses green');
assert.match(people.identityStyle('陈君范', 588).source, /使用者2026-09-13/);
for (const marker of ['封君未詳', '姓名未詳', '？', '陳氏', '某氏', '世子', '服喪', '後嗣']) assert.equal(people.fiefStyle(marker, 588), null, `${marker}: placeholder is not a non-Chen name`);
const byFiefId = id => context.window.CHEN_FIEFS.records.find(record => record.id === id);
const pengze = context.window.CHEN_FIEFS.records.find(record => record.holders.some(holder => holder.person === '魯覽'));
for (const year of [563, 565, 588]) assert.equal(people.fiefRecordStyle(pengze, year)?.color, '#00B050', `${year}: mourning and uncertain Lu Lan remain green`);
assert.equal(people.fiefRecordStyle(byFiefId('chen_fief_0026'), 588)?.predecessor, '馬明', 'pre-Chen deceased holder can supply surname of unnamed successors');
const transition = { holders: [{ person: '周某甲', start: 560, end: 569 }, { person: '陳方慶', start: 570, end: 579 }], display_periods: [{ start: 580, end: 588, people: [], text: '侯國·封君未詳' }] };
transition.holders[0].person = '周文育';
assert.equal(people.fiefRecordStyle(transition, 588), null, 'a later named Chen grant stops inherited non-Chen color');
assert.equal(people.fiefRecordStyle({ ...transition, holders: transition.holders.slice(0, 1) }, 588)?.predecessor, '周文育', 'unnamed successor gets only predecessor surname category');
assert.equal(people.fiefRecordStyle({ holders: [{ person: '周文育', start: 588, end: 588 }], display_periods: [{ start: 580, end: 587, people: [] }] }, 585), null, 'a future grant is never used to color an earlier unnamed holder');
const fiefCss = fs.readFileSync(root + 'style.css', 'utf8');
assert.match(fiefCss, /\.fief-detail-button\.fief-badge\.chen-fief-uniform,\s*\.fief-detail-button\.fief-badge\.chen-fief-uniform:hover\s*\{[^}]*color: var\(--person-color\)/, 'whole-box identity color wins over uncertainty, mourning, and hover');
assert.match(fiefCss, /\.chen-fief-note\.editorial-uncertain[^}]*font-style:\s*italic/, 'uncertainty retains its separate italic display');
assert.notEqual(people.canonicalName('陈番'), people.canonicalName('陳蕃'), 'different Chen lineage members remain distinct');
for (const name of ['陳黨', '陳正理', '陳擬', '陳褒', '陳諠', '陳祏', '陳敬雅', '陳敬泰']) {
  const year = name === '陳擬' ? 558 : 588;
  assert.equal(people.fiefStyle(name, year)?.color, '#984807', `${name}: named remote clan is brown, including successors to a marquisate`);
}
assert.equal(people.fiefStyle('陳方慶', 588)?.color, '#0070C0', 'Linru marquis stays blue');
assert.equal(people.fiefStyle('陳元基', 588)?.color, '#0070C0', 'Boyi eldest son, no inherited kingship');
assert.equal(people.fiefStyle('陳番', 588)?.color, '#0070C0', 'Boren eldest son, no inherited kingship');
assert.equal(people.fiefStyle('陳蕃', 588)?.color, '#C00000', 'Houzhu son is a separate person');
for (const [name, before, after] of [['陳方泰',563,564],['陳至澤',572,573],['陳孝寬',582,583],['陳鄷',585,586]]) {
  assert.equal(people.fiefStyle(name, before)?.color, '#0070C0', `${name}: mourning/pre-succession is blue`);
  assert.equal(people.fiefStyle(name, after)?.color, '#7030A0', `${name}: only effective inherited kingship is purple`);
}
assert.equal(people.displayName('陈叔达', 587).text, '義陽王陳叔達');
assert.equal(people.displayName('陈慧纪', 584).text, '宜黃侯陳慧紀');
assert.equal(people.displayName('陈正理', 588).text, '遂興侯陳正理');
assert.equal(people.displayName('陈孝宽', 582).title, '河東國世子');
assert.equal(people.displayName('陳蕃', 588).title, '吳郡王');
assert.equal(people.displayName('陳叔忠', 588).title, '', 'unsupported same-name Yongcheng title is not assigned');
assert.equal(people.decorateText('始興王伯茂 鎮東將軍、刺史。', 563), '始興王陳伯茂 鎮東將軍、刺史。');
for (const [yearText, year] of Object.entries(governors.years)) for (const record of year.records) for (const line of record.summary_lines) {
  const decorated = people.decorateText(line, Number(yearText), record.state);
  for (const match of people.matches(decorated, Number(yearText), record.state)) {
    if (match.source) assert.equal(match.source.payload.text, match.text, 'new complete names cannot render back to old workbook fragments');
  }
  const element = new Element('div'); context.window.appendBody(element, decorated, Number(yearText), record.state);
  assert.equal(element.textContent, decorated, 'production renderer preserves the decorated title and full name');
}
for (const name of Object.keys(identities.remote_relatives)) for (let year = 557; year <= 588; year++) {
  assert.notEqual(people.fiefStyle(name, year)?.color, '#7030A0', `${year} ${name}: marquis inheritance is never purple`);
}
for (const name of ['蕭韶', '蕭泰', '寧逵', '魯天念', '吳世興', '顧覺', '黃偲', '鄧嵩', '熊門超', '呂子廓', '戴智烈']) {
  assert.ok(knownPeople.has(name), `${name}: supplemental source roster is exercised by a real cell`);
}
assert.equal(JSON.stringify({ formats, governors, fiefs: context.window.CHEN_FIEFS }), sourceBefore, 'source strings, rich runs and historical data are not mutated');
const chenCorrections = corrected.filter(item => /陳/.test(item.text));
console.log('PASS: source/body person colours, black official prose, original text/font preservation, and annual royal-family validation.');
console.log(JSON.stringify({ ...count, distinctSourcePeople: knownPeople.size, chenCorrections }, null, 2));

if (process.argv.includes('--write-color-table')) {
  const occurrenceYears = new Map(), originalNames = new Map();
  function addOccurrence(name, year) {
    if (!/^[陳陈]/u.test(name || '')) return;
    const canonical = people.canonicalName(name);
    if (!occurrenceYears.has(canonical)) occurrenceYears.set(canonical, new Set());
    if (!originalNames.has(canonical)) originalNames.set(canonical, new Set());
    originalNames.get(canonical).add(name);
    if (Number.isInteger(Number(year)) && year >= 557 && year <= 588) occurrenceYears.get(canonical).add(Number(year));
  }
  for (const row of formats.rows) for (const cell of [...row.cells, row.auxiliary, row.appendix]) {
    for (const match of people.matches(cell.text, row.year)) addOccurrence(match.person.name, row.year);
  }
  for (const [year, data] of Object.entries(governors.years)) for (const record of data.records) for (const line of record.summary_lines) {
    for (const match of people.matches(line, year, record.state)) addOccurrence(match.person.name, year);
  }
  const local = context.window.CHEN_LOCAL_OFFICIALS;
  for (const tenure of Object.values(local.tenures_by_id)) addOccurrence(tenure.person);
  for (const [year, data] of Object.entries(local.years)) for (const record of data.local_officers) addOccurrence(record.person, Number(year));
  for (const record of context.window.CHEN_FIEFS.records) {
    for (const holder of record.holders) addOccurrence(holder.person);
    for (let year = 557; year <= 588; year++) {
      if (!record.phases.some(phase => year >= phase.start && year <= phase.end)) continue;
      const period = record.display_periods?.find(period => year >= period.start && year <= period.end);
      if (period) for (const person of period.people || []) addOccurrence(typeof person === 'string' ? person : person.person, year);
      else for (const holder of record.holders) if (year >= holder.start && year <= holder.end) addOccurrence(holder.person, year);
    }
  }
  const table = [];
  for (const [name, years] of [...occurrenceYears].sort(([a],[b]) => a.localeCompare(b, 'zh-Hant'))) {
    let previous;
    for (const year of [...years].sort((a,b) => a-b)) {
      const label = people.displayName(name, year), style = people.fiefStyle(name, year);
      const noIdentity = !style || style.pending && /待核/.test(style.category);
      const reason = [noIdentity ? '身份未有明確依據，不按陳姓推宗室' : '', style?.pending && !noIdentity ? '身份／承襲年度沿用現表推定' : '', label.pending ? label.source || '爵號未確定' : ''].filter(Boolean).join('；');
      const row = { name, original: [...originalNames.get(name)].join('／'), start: year, end: year,
        title: label.title || '未見確定爵號', category: style?.category || '身份待核', color: style?.color || '#000000',
        evidence: (style?.source || '現有來源未能確認親屬或承襲關係').replace(new RegExp(String(year), 'g'), '該年'),
        titleEvidence: label.source, url: style?.source_url || (/卷十五/.test(style?.source || '') ? 'https://zh.wikisource.org/zh/陳書/卷15' : /卷十四/.test(style?.source || '') ? 'https://zh.wikisource.org/zh/陳書/卷14' : /卷二十八|同父兄弟/.test(style?.source || '') ? 'https://zh.wikisource.org/zh/陳書/卷28' : ''),
        pending: Boolean(noIdentity || style?.pending || label.pending), reason };
      const groupKey = item => JSON.stringify([item.name, item.title, item.category, item.color, item.pending]);
      if (previous && previous.end + 1 === year && groupKey(previous) === groupKey(row)) {
        previous.end = year;
        if (row.titleEvidence !== previous.titleEvidence) previous.titleEvidence = '原年表同年爵號／現有封國有效年度；分年依據見 displayName API';
      } else { table.push(row); previous = row; }
    }
    if (!years.size) table.push({ name, original: [...originalNames.get(name)].join('／'), start:'', end:'', title:'待核', category:'年份／身份待核', color:'#000000', evidence:'具名見現有來源，但無有效顯示年度；未以姓氏推定宗室', titleEvidence:'', url:'', pending:true, reason:'年度或身份未詳' });
  }
  const columns = ['人物','原始写法','起年','迄年','年度段','爵号','身份','显示色值','颜色依据','爵号依据','史料链接','是否待核','待核原因','用户修订色值','用户修订身份','用户备注'];
  const range = row => row.start === '' ? '待核' : row.start === row.end ? String(row.start) : `${row.start}—${row.end}`;
  const values = row => [row.name,row.original,row.start,row.end,range(row),row.title,row.category,row.color,row.evidence,row.titleEvidence,row.url,row.pending?'是':'否',row.reason,'','',''];
  const csv = [columns, ...table.map(values)].map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n');
  fs.writeFileSync(root + 'reports/chen-royal-colors.csv', '\uFEFF' + csv + '\r\n');
  const escape = value => String(value ?? '').replaceAll('|','／').replaceAll('\n',' ');
  const markdown = [
    '# 陈氏颜色与爵号校对表', '',
    '2026-09-13。供直接改表使用；CSV 包含证据、爵号来源及三列用户修订空栏。只列现有年表、封国表或地方长官表实际出现的陈姓人物与显示年度，年度不代表新增任期或生卒。未知身份保持黑色待核；已有原表颜色但亲属未核实者仍明确标记待核。', '',
    '规则：非陈姓全部绿色；卷十五所列远支宗室及明确的袭侯子孙用褐系；紫色一般授予有袭王依据且已到现表承袭阶段的人物，服丧未袭王不紫。本次用户明确指定例外：鄱阳国世子陈君范用嗣王紫色，子国陈仲华用异姓绿色；这是显示修订，不新增已袭王的史料判定。陈元基、陈番在卷二十八被称长子，表中按皇子之子蓝色处理，没有改称庶出。陈番与后主子陈蕃保持分离。陈叔忠的同名永城王条与卷二十八“未及封”相冲突，暂不补爵。', '',
    '史料核对：[《陈书》卷十四](https://zh.wikisource.org/zh/陳書/卷14)（南康王世系及方庆封侯）、[卷十五](https://zh.wikisource.org/zh/陳書/卷15)（远支宗室及县侯）、[卷二十八](https://zh.wikisource.org/zh/陳書/卷28)（帝子、元基与番、孝宽承袭）。方泰564、至泽573、酆586等承袭年度沿用用户既有服丧考定，推定与不确定性列入待核；不重写源任期。', '',
    `共 ${occurrenceYears.size} 人、${table.length} 个年度段。更新命令：node scripts/validate-person-colors.mjs --write-color-table。`, '',
    '| 人物 | 原始写法 | 年度段 | 爵号 | 身份 | 色值 | 待核 | 说明 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...table.map(row => '| ' + [row.name,row.original,range(row),row.title,row.category,row.color,row.pending?'是':'否',row.reason || row.evidence].map(escape).join(' | ') + ' |'), '',
  ].join('\n');
  fs.writeFileSync(root + 'reports/chen-royal-colors.md', markdown);
  console.log(`Wrote Chen colour review table: ${occurrenceYears.size} people, ${table.length} periods.`);
}
