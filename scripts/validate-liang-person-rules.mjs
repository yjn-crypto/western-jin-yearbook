// A focused check for this iteration; no full-project or browser regression run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const context = vm.createContext({ window: {} });
for (const file of ['data/liang-person-colors.js', 'data/liang-fiefs.js', 'data/liang-local-officials.js',
  'data/liang-person-evidence.js', 'liang-fief-rules.js', 'liang-person-formats.js']) {
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), context, { filename: file });
}
const { LIANG_PERSON_FORMATS: names, LIANG_FIEF_RULES: fiefs } = context.window;
const records = context.window.LIANG_FIEFS.records;
const wuping = records.find(record => record.phases.some(phase => phase.fief === '吳平'));
assert.equal(fiefs.resolveHolder(wuping, 523).holder.person, '蕭昺');
assert.equal(fiefs.resolveHolder(wuping, 535).holder, null, '蕭昺不能越過523年終界');
const synthetic = { holders: [{ person: '前任', start: 510, end: 520 }, { person: '後任', start: 523, end: 530 }] };
assert.notEqual(fiefs.resolveHolder(synthetic, 521).status, 'mourning', '三年數字差不能推定服喪');
assert.equal(fiefs.resolveHolder({ holders: [{ person: '蕭懿', start: 502, end: 502, posthumous: true }] }, 502).holder, null);
assert.equal(fiefs.resolveHolder({ holders: [{ person: '甲君', start: null, end: null }, { person: '乙君', start: null, end: null }] }, 535).holder, null);
let boundaryChecks = 0;
for (const record of records) for (let year = 502; year <= 557; year++) {
  const { holder } = fiefs.resolveHolder(record, year);
  if (!holder) continue;
  assert(!holder.posthumous);
  assert(holder.start == null || Number(holder.start) <= year);
  assert(holder.end == null || year <= Number(holder.end));
  boundaryChecks++;
}
assert.equal(names.canonicalName('萧子显'), '蕭子顯');
assert.equal(names.canonicalName('范云'), '范雲', '范姓不能按範字轉換');
assert.equal(names.personStyle('陈拟', 555).color, '#00B050', '梁代不套陳代陳姓身份色');
assert.equal(names.personStyle('萧子显', 537).color, '#000000', '僅同姓不能授予皇族色');
assert.equal(names.personStyle('蕭秀', 504).color, '#FF0000', '梁書有界皇弟證據補源表空年');
assert.equal(names.personStyle('蕭秀', 519).color, '#000000', '身份補證不得越過卒年');
assert.equal(names.personStyle('蕭機', 520).color, '#7030A0', '明載襲封年才補嗣王色');
assert.equal(names.displayName('张齐', 502).title, '安昌侯');
assert.equal(names.displayName('张齐', 503).title, '', '授封單年錨點不自行填滿後年');
assert.equal(names.displayName('留异', 556).title, '永興侯');
assert.equal(names.displayName('蕭昺', 535).title, '');
assert.equal(names.displayName('蕭偉', 518).title, '', '改封當年的兩個爵號不擅自二選一');
const line = '正月临川王宏 使持节 都督扬州 刺史，陈拟任义兴太守';
const matches = names.matches(line, 504);
assert(matches.some(match => match.person.name === '蕭宏' && match.text === '临川王宏'));
assert(!matches.some(match => /正月|都督|刺史|太守|持节/.test(match.text)), '日期官職不得納入姓名色');
assert.equal(names.decorateText('留异 领东阳太守', 556), '永興侯留異 领东阳太守');
assert.equal(names.decorateText('永兴侯留异 领东阳太守', 556), '永兴侯留异 领东阳太守');
// Every previously known annual source colour retains its exact value.
let annualColors = 0;
for (const person of context.window.LIANG_PERSON_COLORS.people) for (const [year, style] of Object.entries(person.years)) {
  assert.equal(names.personStyle(person.name, year).color, style.color);
  annualColors++;
}
let annualRows = 0, matchedRows = 0, colouredRows = 0;
const pending = [];
for (const [year, row] of Object.entries(context.window.LIANG_LOCAL_OFFICIALS.years)) for (const item of row.local_officers) {
  annualRows++;
  const match = names.matches(item.person, year).find(match => match.start === 0 && match.end === item.person.length);
  if (match) matchedRows++;
  if (match?.style?.color && match.style.color !== '#000000') colouredRows++;
  else pending.push({ year: Number(year), person: item.person, source: match?.style?.source || '未識別' });
}
assert.equal(matchedRows, annualRows, '已審地方官姓名應可識別，不取決於是否出現在刺史表');
// Local primary-source anchors are optional for checkout portability.
let sourceAnchors = 0;
const localSource = new URL('../work/epub/LS-paragraphs.json', import.meta.url);
if (fs.existsSync(localSource)) {
  const paragraphs = new Map(JSON.parse(fs.readFileSync(localSource, 'utf8')).paragraphs.map(item => [item.paragraph_id, item]));
  for (const item of [...context.window.LIANG_PERSON_EVIDENCE.people, ...context.window.LIANG_PERSON_EVIDENCE.titles]) {
    for (const evidence of item.evidence || []) if (evidence.book === '梁书') {
      const paragraph = paragraphs.get(evidence.paragraph_id);
      assert.equal([...paragraph.text].slice(evidence.quote_start, evidence.quote_end).join(''), evidence.quote);
      sourceAnchors++;
    }
  }
}
console.log(JSON.stringify({ boundaryChecks, preservedAnnualColors: annualColors, annualRows, matchedRows, colouredRows, pending, verifiedLocalSourceAnchors: sourceAnchors }, null, 2));
