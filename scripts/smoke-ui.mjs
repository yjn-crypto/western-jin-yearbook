import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => errors.push(error));
virtualConsole.on('error', (error) => errors.push(error));

const dom = await JSDOM.fromFile(path.join(root, 'index.html'), {
  url: pathToFileURL(path.join(root, 'index.html')).href,
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('頁面載入逾時')), 10000);
  dom.window.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
});

const document = dom.window.document;
const dynastySelect = document.getElementById('dynastySelect');
const yearSelect = document.getElementById('yearSelect');
const change = () => dynastySelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
const changeYear = () => yearSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

for (const config of [
  { key: 'liu-song', year: 464, title: '劉宋', map: false },
  { key: 'southern-qi', year: 497, title: '蕭齊', map: true },
  { key: 'southern-liang', year: 546, title: '蕭梁', map: true },
  { key: 'chen', year: 588, title: '南陳', map: true },
  { key: 'western-jin', year: 304, title: '西晉', map: false }
]) {
  dynastySelect.value = config.key;change();
  yearSelect.value = String(config.year);changeYear();
  assert.match(document.getElementById('pageTitle').textContent, new RegExp(config.title));
  assert.ok(Number(document.getElementById('stateCount').textContent) > 0, `${config.title}${config.year}年未渲染州`);
  assert.equal(document.getElementById('yearMapPanel').hidden, !config.map, `${config.title}地圖顯示狀態錯誤`);
}

dynastySelect.value = 'liu-song';change();yearSelect.value = '420';changeYear();
assert.equal(document.getElementById('stateCount').textContent, '0', '劉宋420年頁面未留空');
assert.match(document.getElementById('results').textContent, /沒有符合目前條件的政區/);

assert.equal(errors.length, 0, errors.map((error) => error.message).join('\n'));
dom.window.close();
console.log('五朝切換、預設年、420年空白與基準地圖UI煙霧測試通過。');
