import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const context = { window: {} };
for (const file of ['data/chen-governors.js','data/liang-governors.js','data/chen-fiefs.js','data/chen-royal-identities.js','data/liang-person-colors.js',
  'data/chen-governor-yearbook.js','data/chen-yearbook-formats.js','governor-source-format.js','chen-person-formats.js','governor-history.js']) {
  vm.runInNewContext(fs.readFileSync(root + file, 'utf8'), context, { filename: file });
}
const { CHEN_GOVERNORS: chen, GOVERNOR_HISTORY: history } = context.window;
const find = (year, state) => chen.years[year].records.find(item => item.state === state);
const refs = (year, state, person) => {
  const record = find(year, state), line = record.summary_lines.find(item => item.startsWith(person));
  assert.ok(line, `${year} ${state} ${person} exists`);
  return history.references(record, line, year, chen, 'chen');
};
assert.equal(refs(563, '東揚州', '始興王伯茂')[0].year, 562);
assert.match(refs(563, '東揚州', '始興王伯茂')[0].line, /鎮東將軍、刺史/);
assert.equal(refs(584, '南徐州', '蕭摩訶')[0].year, 582, 'two-year omission retains actual source date');
assert.equal(refs(587, '南徐州', '蕭摩訶')[0].year, 582, 'long unchanged runs retain source year instead of mislabelling it as last year');
const huiji = refs(588, '荊州', '陳慧紀');
assert.deepEqual(Array.from(huiji, item => item.year), [587, 584]);
assert.match(huiji[1].line, /都督荊信二州諸軍事/);
assert.match(huiji[0].yearLabel, /禎明元年.*587/);
assert.ok(huiji[1].evidence.length, 'previous full original evidence remains available');
assert.equal(refs(588, '揚州', '會稽王莊').length, 0, 'new full appointment must not borrow predecessor title');
const record = (line, extra = {}) => ({ state: '測試州', summary_lines: [line], ...extra });
const dataset = rows => ({ years: Object.fromEntries(rows.map(([year, records]) => [year, { records }])) });
const query = data => history.references(record('甲某'), '甲某', 588, data, 'chen');
assert.equal(query(dataset([[587, [record('甲某 都督測試州諸軍事、刺史。遷他州。')]]])).length, 0, 'departure stops carry-forward');
assert.equal(query(dataset([[587, [record('乙某 刺史。')]], [586, [record('甲某 刺史。')]]])).length, 0, 'replacement breaks chain');
assert.equal(query(dataset([[586, [record('甲某 刺史。')]]])).length, 0, 'absent data year breaks chain');
assert.equal(query(dataset([[587, [record('甲某 刺史。'), record('甲某 監州。')]]])).length, 0, 'ambiguous same-year titles are not guessed');
assert.equal(query(dataset([[587, [{state:'測試州',summary_lines:[]}]], [586, [record('甲某 刺史。')]]]))[0].year, 586, 'explicit blank state row may be traversed for a currently named person');
assert.equal(history.references(record(''), '', 588, chen, 'chen').length, 0, 'blank current row never fabricates a current holder');
const liang = context.window.LIANG_GOVERNORS;
const linchuan = liang.years[545].records.find(item => item.state === '南徐州');
const liangReferences = history.references(linchuan, linchuan.summary_lines[0], 545, liang, 'southern-liang');
assert.deepEqual(Array.from(liangReferences, item => item.year), [544,543], 'Liang royal label remains identifiable in a no-space promotion line');
console.log('PASS: governor title references, source years/evidence, long omissions, and tenure boundaries.');
