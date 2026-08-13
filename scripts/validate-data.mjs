import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['data/southern-data.js', 'data/southern-governors.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

const administrative = sandbox.window.SOUTHERN_DATA;
const governors = sandbox.window.SOUTHERN_GOVERNORS;
const expectedKeys = ['liu_song', 'southern_qi', 'southern_liang'];
assert.deepEqual(Object.keys(administrative.dynasties), expectedKeys);
assert.deepEqual(Object.keys(governors.dynasties), expectedKeys);

function validatePhases(phases, bounds, label) {
  assert.ok(Array.isArray(phases) && phases.length, `${label}缺少年代段`);
  for (const phase of phases) {
    assert.ok(Number.isInteger(phase.start) && Number.isInteger(phase.end), `${label}年代不是整數`);
    assert.ok(bounds[0] <= phase.start && phase.start <= phase.end && phase.end <= bounds[1], `${label}年代越界`);
  }
}

function active(entity, year) {
  return (entity.phases || []).some((phase) => phase.start <= year && year <= phase.end);
}

for (const key of expectedKeys) {
  const data = administrative.dynasties[key];
  const governorData = governors.dynasties[key];
  const bounds = data.meta.data_years;
  const ids = new Set();
  const claim = (id) => {
    assert.ok(id && !ids.has(id), `${key}出現重複或空ID：${id}`);
    ids.add(id);
  };

  for (const state of data.states) {
    claim(state.id);validatePhases(state.phases, bounds, `${key}/${state.name}`);
    for (const prefecture of state.prefectures) {
      claim(prefecture.id);validatePhases(prefecture.phases, bounds, `${key}/${state.name}/${prefecture.base_name}`);
      for (const county of prefecture.counties) {
        claim(county.id);validatePhases(county.phases, bounds, `${key}/${state.name}/${prefecture.base_name}/${county.base_name}`);
      }
    }
  }
  for (const appendix of data.county_appendices || []) {
    claim(appendix.id);
    for (const county of appendix.counties) {
      claim(county.id);validatePhases(county.phases, bounds, `${key}/${appendix.region}/${county.base_name}`);
    }
  }

  const [governorStart, governorEnd] = governorData.meta.years;
  for (let year = governorStart; year <= governorEnd; year += 1) {
    assert.ok(governorData.years[String(year)], `${key}方鎮年表缺${year}年`);
  }

  const year = data.meta.benchmark_year;
  const states = data.states.filter((state) => active(state, year));
  const prefectures = states.flatMap((state) => state.prefectures.filter((prefecture) => active(prefecture, year)));
  const counties = prefectures.flatMap((prefecture) => prefecture.counties.filter((county) => active(county, year)));
  const expected = data.meta.benchmark_counts;
  console.log(`${key} ${year}年沿革自動彙總：${states.length}州、${prefectures.length}郡、${counties.length}縣；書中基準：${expected.states}州、${expected.prefectures}郡、${expected.counties ?? '縣屬不詳'}縣。`);
}

const song = administrative.dynasties.liu_song;
assert.equal(song.states.filter((state) => active(state, 420)).length, 0, '劉宋420年必須留空');
const liang = administrative.dynasties.southern_liang;
assert.equal(liang.states.reduce((sum, state) => sum + state.prefectures.reduce((count, prefecture) => count + prefecture.counties.length, 0), 0), 0, '梁實縣不得猜附於郡');
assert.equal(liang.county_appendices.length, 9, '梁實縣存考應為九區');
assert.equal(liang.county_appendices.reduce((sum, appendix) => sum + appendix.counties.length, 0), 739, '梁實縣存考抽取數異常');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const key of ['liu-song', 'southern-qi', 'southern-liang']) {
  assert.match(html, new RegExp(`<option value="${key}">`), `${key}切換入口未啟用`);
}
assert.match(html, /data\/southern-data\.js/);
assert.match(html, /data\/southern-governors\.js/);
for (const file of [
  'assets/maps/reference/qi-497-regime-boundary.svg',
  'assets/maps/reference/liang-534-chgis.png',
  'assets/maps/reference/liang-555-max-chgis.png'
]) assert.ok(fs.statSync(path.join(root, file)).size > 0, `${file}缺失`);

console.log('宋齊梁資料結構、逐年方鎮、420年空白、梁縣九區與基準地圖檢查通過。');
