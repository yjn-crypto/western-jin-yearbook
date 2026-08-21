import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'data', 'liang-governor-yearbook.js'), 'utf8'), context);
const data = context.window.LIANG_GOVERNOR_YEARBOOK;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(data && typeof data === 'object', 'LIANG_GOVERNOR_YEARBOOK was not loaded');
assert(data.meta.source_sheet === 'Sheet1', 'unexpected source worksheet');
assert(data.meta.source_data_range === 'A258:AC312', 'unexpected source range');
assert(data.states.length === 26, `expected 26 state columns, got ${data.states.length}`);
assert(new Set(data.states.map((state) => state.name)).size === 26, 'state column names must be unique');
assert(data.states[0].name === '揚州', 'the first state column must be 揚州');
assert(data.rows.length === 55, `expected 55 Liang rows, got ${data.rows.length}`);

for (let index = 0; index < data.rows.length; index += 1) {
  const row = data.rows[index];
  assert(row.year === 502 + index, `non-contiguous year at row ${index}`);
  assert(row.source_row === 258 + index, `non-contiguous source row at year ${row.year}`);
  assert(row.cells.length === 26, `year ${row.year} does not have 26 fixed-state cells`);
  assert(row.cells.every((value) => typeof value === 'string'), `year ${row.year} contains a non-string state cell`);
}

const first = data.rows[0];
const last = data.rows.at(-1);
const fixedNonempty = data.rows.reduce((count, row) => count + row.cells.filter(Boolean).length, 0);
const appendixNonemptyRows = data.rows.filter((row) => row.appendix).length;
const countRows = data.rows.filter((row) => row.royal_outpost_count !== '').length;

assert(first.year === 502 && first.reign === '天監元年', 'unexpected first Liang year');
assert(first.cells[0].includes('四月，臨川王蕭宏'), '502 揚州 source text is missing');
assert(last.year === 556 && last.reign === '紹泰二年\n太平元年', 'unexpected last Liang year');
assert(last.appendix.includes('錢道戢東徐州刺史'), '556 appendix source text is missing');
const dingzhouIndex = data.states.findIndex((state) => state.name === '定州');
assert(dingzhouIndex >= 0 && !last.cells[dingzhouIndex] && last.appendix.includes('定州刺史'), '556 定州 appendix fallback case is missing');
assert(fixedNonempty === 895, `expected 895 non-empty fixed-state cells, got ${fixedNonempty}`);
assert(appendixNonemptyRows === 39, `expected 39 non-empty appendix rows, got ${appendixNonemptyRows}`);
assert(countRows === 47, `expected 47 populated royal-outpost count rows, got ${countRows}`);

const pageHtml = fs.readFileSync(path.join(root, 'liang-governor-yearbook.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert(pageHtml.includes('data/liang-governor-yearbook.js'), 'dedicated page does not load its source data');
assert(indexHtml.includes('liangGovernorYearbookSwitch'), 'main page switch is missing');
assert(appJs.includes("governorYearbookHref(year,record.state,'detail')"), 'governor-detail deep link is missing');
assert(appJs.includes('requestedState'), 'main-page return state handling is missing');

console.log(JSON.stringify({
  years: [first.year, last.year],
  rows: data.rows.length,
  stateColumns: data.states.length,
  fixedNonemptyCells: fixedNonempty,
  appendixNonemptyRows,
  royalOutpostCountRows: countRows,
  appendixFallbackCase: '556 定州',
  deepLinkChecks: 'main switch, detail year/state, return state',
}, null, 2));
