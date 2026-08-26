import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function load(filename, globalName) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'data', filename), 'utf8'), context);
  return context.window[globalName];
}

function validateDataset({ label, data, startYear, endYear, startRow, states, sourceRange, fixedNonempty, appendixRows, auxiliaryRows }) {
  assert(data && typeof data === 'object', `${label}年表未載入`);
  assert(data.meta.source_sheet === 'Sheet1', `${label}來源工作表錯誤`);
  assert(data.meta.source_data_range === sourceRange, `${label}來源範圍錯誤`);
  assert(data.states.length === states, `${label}應有${states}個州列，實得${data.states.length}`);
  assert(new Set(data.states.map((state) => state.name)).size === states, `${label}州列名必須唯一`);
  assert(data.rows.length === endYear - startYear + 1, `${label}年度行數錯誤`);

  for (let index = 0; index < data.rows.length; index += 1) {
    const row = data.rows[index];
    assert(row.year === startYear + index, `${label}第${index + 1}行年份不連續`);
    assert(row.source_row === startRow + index, `${label}${row.year}年來源行不連續`);
    assert(row.cells.length === states, `${label}${row.year}年州格數錯誤`);
    assert(row.colors.length === states, `${label}${row.year}年整格字体色數錯誤`);
    assert(row.cells.every((value) => typeof value === 'string'), `${label}${row.year}年存在非文字州格`);
    assert(row.colors.every((value) => value === null || /^#[0-9A-F]{6}$/.test(value)), `${label}${row.year}年存在非法色值`);
    assert(['string', 'number'].includes(typeof row.auxiliary) && typeof row.appendix === 'string', `${label}${row.year}年附加欄型別錯誤`);
  }

  const actualFixed = data.rows.reduce((count, row) => count + row.cells.filter(Boolean).length, 0);
  const actualAppendix = data.rows.filter((row) => row.appendix).length;
  const actualAuxiliary = data.rows.filter((row) => row.auxiliary !== '').length;
  assert(actualFixed === fixedNonempty, `${label}非空州格應為${fixedNonempty}，實得${actualFixed}`);
  assert(actualAppendix === appendixRows, `${label}非空附錄行應為${appendixRows}，實得${actualAppendix}`);
  assert(actualAuxiliary === auxiliaryRows, `${label}非空附加欄應為${auxiliaryRows}，實得${actualAuxiliary}`);
  return {
    label,
    years: [startYear, endYear],
    rows: data.rows.length,
    states,
    coloredCells: data.rows.reduce((count, row) => count + row.colors.filter(Boolean).length + Number(Boolean(row.auxiliary_color)) + Number(Boolean(row.appendix_color)), 0),
  };
}

const liang = load('liang-governor-yearbook.js', 'LIANG_GOVERNOR_YEARBOOK');
const chen = load('chen-governor-yearbook.js', 'CHEN_GOVERNOR_YEARBOOK');
const reports = [
  validateDataset({ label: '蕭梁', data: liang, startYear: 502, endYear: 556, startRow: 258, states: 26, sourceRange: 'A258:AC312', fixedNonempty: 895, appendixRows: 39, auxiliaryRows: 47 }),
  validateDataset({ label: '南陳', data: chen, startYear: 557, endYear: 588, startRow: 321, states: 24, sourceRange: 'A321:AA352', fixedNonempty: 409, appendixRows: 14, auxiliaryRows: 7 }),
];

assert(liang.rows[0].reign === '天監元年' && liang.rows.at(-1).reign === '紹泰二年\n太平元年', '梁表首尾紀年錯誤');
assert(liang.rows.find((row) => row.year === 538).colors[0] === '#C00000', '538年宣城王大器整格深紅色缺失');
for (let year = 539; year <= 549; year += 1) {
  assert(liang.rows.find((row) => row.year === year).colors[0] === '#FFFF00', `${year}年宣城王大器整格黃色缺失`);
}
assert(liang.rows[0].colors[1] === '#FF0000', '502年安成王蕭秀所在整格紅色缺失');
assert(liang.rows.at(-1).appendix.includes('錢道戢東徐州刺史'), '556年梁表附錄缺文');

assert(chen.rows[0].reign === '太平二年\n永定元年' && chen.rows.at(-1).reign === '禎明二年', '陳表首尾紀年錯誤');
const chen570 = chen.rows.find((row) => row.year === 570);
assert(chen570.cells[0].includes('晉安王陳伯恭'), '570年晉安王陳伯恭原文缺失');
assert(chen570.colors[0] === '#BC6C64', '太建二年晉安王陳伯恭整格淡褐色缺失');
assert(chen.meta.legends.some((item) => item.label.includes('文帝皇子') && item.color === '#BC6C64'), '陳文帝皇子淡褐色圖例缺失');

const liangPage = fs.readFileSync(path.join(root, 'liang-governor-yearbook.html'), 'utf8');
const chenPage = fs.readFileSync(path.join(root, 'chen-governor-yearbook.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const yearbookApp = fs.readFileSync(path.join(root, 'liang-governor-yearbook-app.js'), 'utf8');
const mainApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert(liangPage.includes('data/liang-governor-yearbook.js'), '梁年表頁未載入梁資料');
assert(chenPage.includes('data/chen-governor-yearbook.js'), '陳年表頁未載入陳資料');
assert(indexHtml.includes('governorYearbookSwitch'), '主頁年表切換區缺失');
assert(mainApp.includes("currentDynasty.key==='chen'?'chen-governor-yearbook.html':'liang-governor-yearbook.html'"), '梁陳年表深鏈分流缺失');
assert(mainApp.includes("governorYearbookHref(year,record.state,'detail')"), '刺史詳情深鏈缺失');
assert(!yearbookApp.includes('filteredByYear'), '年份定位不得隱藏其他年份');
assert(yearbookApp.includes('record.colors?.[index]'), '年表未按整格字体色渲染');
assert(!yearbookApp.includes('appendColoredText'), '年表仍在只着色人物姓名');

console.log(JSON.stringify({ reports, deepLinks: '梁陳主頁切換、年份／州定位、返回狀態', display: '完整年表＋整格字体色' }, null, 2));
