import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const dataDir = path.join(siteDir, 'data');
const jsonPath = path.join(dataDir, 'chen-prefectural-officers.json');
const scriptPath = path.join(dataDir, 'chen-prefectural-officers.js');
const manifestPath = path.join(dataDir, 'chen-prefectural-officers-manifest.json');
const chenDataPath = path.join(dataDir, 'chen-data.js');
const appPath = path.join(siteDir, 'app.js');
const indexPath = path.join(siteDir, 'index.html');
const stylePath = path.join(siteDir, 'style.css');

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

function readWindowValue(filePath, property) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  return context.window[property];
}

function phases(entity) {
  return entity?.phases || entity?.ph || [];
}

function activePhase(entity, year) {
  return phases(entity).find((phase) => {
    const start = Number(phase.start ?? phase.s);
    const end = Number(phase.end ?? phase.e);
    return Number.isFinite(start) && Number.isFinite(end) && year >= start && year <= end;
  }) || null;
}

const checks = [];
function check(id, label, assertion, detail = '') {
  try {
    assert.ok(assertion);
    checks.push({ id, label, status: 'PASS', detail });
  } catch {
    checks.push({ id, label, status: 'FAIL', detail });
  }
}

const data = readJson(jsonPath);
const wrapper = readWindowValue(scriptPath, 'CHEN_PREFECTURAL_OFFICERS');
const manifest = readJson(manifestPath);
const chenData = readWindowValue(chenDataPath, 'CHEN_DATA');
const appSource = fs.readFileSync(appPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const styleSource = fs.readFileSync(stylePath, 'utf8');
const manifestEntry = manifest.files.find((entry) => entry.path === 'chen_prefectural_officers_web.json');
const years = Array.from({ length: 32 }, (_, index) => 557 + index);
const records = years.flatMap((year) => data.years?.[String(year)]?.prefectural_officers || []);

check('P8-01', 'JSON按第七阶段manifest校验', Boolean(manifestEntry)
  && fs.statSync(jsonPath).size === manifestEntry.bytes
  && sha256(jsonPath) === manifestEntry.sha256,
`${fs.statSync(jsonPath).size} bytes; ${sha256(jsonPath)}`);
check('P8-02', '同步JS包装与发布JSON深度相等', JSON.stringify(wrapper) === JSON.stringify(data));
check('P8-03', '557—588年度连续完整', years.every((year) => data.years?.[String(year)]) && Object.keys(data.years || {}).length === 32);
check('P8-04', '发布总数39且排除数元数据为9', records.length === 39 && data.meta?.approved_record_count === 39 && data.meta?.excluded_record_count === 9, `released=${records.length}`);

const statusCounts = records.reduce((counts, record) => {
  counts[record.year_end_status] = (counts[record.year_end_status] || 0) + 1;
  return counts;
}, {});
check('P8-05', 'confirmed/probable/unresolved为5/34/0', statusCounts.confirmed === 5 && statusCounts.probable === 34 && !statusCounts.unresolved, JSON.stringify(statusCounts));
check('P8-06', '只接受行级批准且已选择记录', records.every((record) => record.publication_approved === true && record.selected_as_year_end_current === true));
check('P8-07', '确定性与字体规则一致', records.every((record) => (
  record.year_end_status === 'confirmed'
  && record.confidence === 'confirmed'
  && record.display_style === 'normal'
  && record.display_italic === false
) || (
  record.year_end_status === 'probable'
  && record.confidence === 'probable'
  && record.display_style === 'italic'
  && record.display_italic === true
)));

const requiredProperties = [
  'official_id','person_id','year_end_decision_id','evidence_id','evidence_ids','evidence_mapping_id',
  'confidence','reasoning_source','audit_issue_id','phase6_revision_ids','adjudication_id','source_locator',
  'source_timeline_id','normalized_tenure_id','tenure_group_id','administrative_link','governor_link'
];
const missingProperties = records.flatMap((record) => requiredProperties
  .filter((property) => !Object.prototype.hasOwnProperty.call(record, property))
  .map((property) => `${record.year}|${record.year_end_decision_id}|${property}`));
check('P8-08', 'ID、证据、推理、审计与第六阶段追溯字段完整保留', missingProperties.length === 0, `missing=${missingProperties.length}`);

const decisionIds = records.map((record) => record.year_end_decision_id);
const yearOfficialKeys = records.map((record) => `${record.year}|${record.official_id}`);
check('P8-09', '渲染键唯一且不误用official_id全局唯一', new Set(decisionIds).size === 39
  && new Set(yearOfficialKeys).size === 39
  && new Set(records.map((record) => record.official_id)).size === 38);

const orderingFailures = [];
for (const year of years) {
  const node = data.years[String(year)];
  const annual = node.prefectural_officers || [];
  const actual = annual.map((record) => Number(record.annual_order));
  const expected = annual.map((_, index) => index + 1);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) orderingFailures.push(`${year}:annual_order`);
  const sorted = [...annual].sort((left, right) => Number(left.administrative_link.state_order) - Number(right.administrative_link.state_order)
    || Number(left.administrative_link.prefecture_order) - Number(right.administrative_link.prefecture_order));
  if (sorted.map((record) => record.year_end_decision_id).join('|') !== annual.map((record) => record.year_end_decision_id).join('|')) orderingFailures.push(`${year}:state_prefecture_order`);
  if (node.intra_year_succession_inferred !== false) orderingFailures.push(`${year}:succession`);
}
check('P8-10', '逐年顺序连续且只表示州序郡序', orderingFailures.length === 0, `failures=${orderingFailures.length}`);

const chenStates = chenData?.regimes?.chen?.states || [];
const attached = [];
const detached = [];
const targetFailures = [];
for (const record of records) {
  const link = record.administrative_link || {};
  if (link.hierarchy_active_in_year !== true || link.state_assignment_asserted !== true) {
    detached.push(record);
    continue;
  }
  const stateMatches = chenStates.filter((state) => state.id === link.state_id && activePhase(state, record.year));
  const prefectureMatches = stateMatches.flatMap((state) => (state.prefectures || []).filter((prefecture) => prefecture.id === link.prefecture_id && activePhase(prefecture, record.year)));
  if (stateMatches.length !== 1 || prefectureMatches.length !== 1) targetFailures.push(record.year_end_decision_id);
  else attached.push(record);
}
check('P8-11', '35条只按本年有效州郡稳定ID唯一挂接', attached.length === 35 && targetFailures.length === 0, `attached=${attached.length}; failures=${targetFailures.length}`);
check('P8-12', '557年4条只进入未断言集合', detached.length === 4 && detached.every((record) => record.year === 557), `detached=${detached.length}`);

const governorRecordUnmatched = records.filter((record) => Number(record.governor_link?.governor_record_match_count || 0) === 0);
const governorYearbookUnmatched = records.filter((record) => Number(record.governor_link?.governor_yearbook_state_match_count || 0) === 0);
check('P8-13', '刺史零匹配保持5/4且不参与补配', governorRecordUnmatched.length === 5 && governorYearbookUnmatched.length === 4, `${governorRecordUnmatched.length}/${governorYearbookUnmatched.length}`);

const attachFunction = appSource.match(/function attachPrefecturalOfficers[\s\S]*?\n  }\n\n  \/\/ ---------- 蕭梁、南陳都督/)?.[0] || '';
check('P8-14', '运行时使用双断言、政权键和精确ID', attachFunction.includes("administrative.regime_key!=='chen'")
  && attachFunction.includes('administrative.hierarchy_active_in_year!==true')
  && attachFunction.includes('administrative.state_assignment_asserted!==true')
  && attachFunction.includes('state.id===administrative.state_id')
  && attachFunction.includes('row.id===administrative.prefecture_id')
  && !attachFunction.includes('normalizeName'));
check('P8-15', '运行时只消费平铺发布数组', appSource.includes('yearData?.prefectural_officers||[]') && !appSource.includes('prefectural_officers_by_state'));
check('P8-16', '数据脚本先于app.js同步载入', indexSource.indexOf('data/chen-prefectural-officers.js') > indexSource.indexOf('data/chen-governors.js')
  && indexSource.indexOf('data/chen-prefectural-officers.js') < indexSource.indexOf('app.js'));
check('P8-17', '郡行与未断言区均有渲染入口', appSource.includes('renderPrefecturalOfficerBox(row.prefecturalOfficers,year)')
  && appSource.includes('renderDetachedPrefecturalOfficers(detachedPrefecturalOfficers,year)'));
check('P8-18', 'confirmed正常与probable斜体样式独立', styleSource.includes('.prefectural-officer-entry.confirmed { font-style: normal; }')
  && styleSource.includes('.prefectural-officer-entry.probable { font-style: italic; }')
  && styleSource.includes('.prefectural-officer-detached-button.confirmed { font-style: normal; }')
  && styleSource.includes('.prefectural-officer-detached-button.probable { font-style: italic; }'));
check('P8-19', '全39条都有唯一展示去向', attached.length + detached.length === 39 && targetFailures.length === 0, `attached=${attached.length}; detached=${detached.length}`);
const publicSourceMasterPath = manifest.source_master?.path || '';
const containsLocalUserPath = /^[A-Za-z]:[\\/]/.test(publicSourceMasterPath)
  || /^\/(?:Users|home)\//i.test(publicSourceMasterPath)
  || /(?:^|[\\/])(?:Users|home)[\\/][^\\/]+/i.test(publicSourceMasterPath);
check('P8-20', '网站manifest不含本机绝对用户路径', Boolean(publicSourceMasterPath) && !containsLocalUserPath, publicSourceMasterPath);

const failed = checks.filter((item) => item.status === 'FAIL');
const result = {
  validation: 'chen-prefectural-officers',
  release_gate: failed.length ? 'FAIL' : 'PASS',
  counts: {
    years: years.length,
    released: records.length,
    attached: attached.length,
    detached: detached.length,
    confirmed: statusCounts.confirmed || 0,
    probable: statusCounts.probable || 0,
    unresolved: statusCounts.unresolved || 0,
    governor_record_unmatched: governorRecordUnmatched.length,
    governor_yearbook_state_unmatched: governorYearbookUnmatched.length
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
