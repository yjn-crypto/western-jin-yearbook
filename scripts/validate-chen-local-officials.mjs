import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const dataDir = path.join(siteDir, 'data');
const reportDir = path.join(siteDir, 'reports');
const dataOnly = process.argv.includes('--data-only');
const paths = {
  source: path.join(dataDir, 'chen-local-officials-source.json'),
  data: path.join(dataDir, 'chen-local-officials.json'),
  wrapper: path.join(dataDir, 'chen-local-officials.js'),
  manifest: path.join(dataDir, 'chen-local-officials-manifest.json'),
  report: path.join(reportDir, 'chen-local-officials-validation.json'),
  reportMarkdown: path.join(reportDir, 'chen-local-officials-validation.md'),
  chenData: path.join(dataDir, 'chen-data.js'),
  app: path.join(siteDir, 'app.js'),
  index: path.join(siteDir, 'index.html'),
  style: path.join(siteDir, 'style.css'),
};

const years = Array.from({ length: 32 }, (_, index) => 557 + index);
const displayRoles = new Set(['canonical', 'canonical_merged', 'canonical_split_part_1', 'derived_split_part_2']);
const chenScopes = new Set(['陈表', '跨朝含陈', '跨朝待分', '梁至陈受禅', '陈，地点未明']);
const localLevels = new Set(['郡级正任', '郡级代理', '郡级正任（待核）', '封国相（郡级）', '县级', '县级正任']);
const notServedStatuses = new Set(['baseline_not_served', 'appointed_not_served']);
const annualStatuses = new Set(['confirmed', 'probable']);
const boundaryStatuses = new Set(['confirmed', 'probable', 'unknown']);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const text = (value) => value === null || value === undefined ? '' : String(value).trim();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

function readWindowValue(filePath, property) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
  return context.window[property];
}

function parseYears(value) {
  return [...new Set((text(value).match(/(?<!\d)(?:55[7-9]|56\d|57\d|58[0-8])(?!\d)/g) ?? []).map(Number))]
    .sort((left, right) => left - right);
}

function activeInYear(entity, year) {
  return (entity?.phases ?? entity?.ph ?? []).some((phase) => {
    const start = Number(phase.start ?? phase.s);
    const end = Number(phase.end ?? phase.e);
    return Number.isFinite(start) && Number.isFinite(end) && year >= start && year <= end;
  });
}

function preservationCounts(source) {
  return {
    tenure_rows: source.tenures.length,
    distinct_official_ids: new Set(source.tenures.map((tenure) => tenure.official_id)).size,
    distinct_source_timeline_ids: new Set(source.tenures.map((tenure) => tenure.source_timeline_id)).size,
    // CS-0049-T2 is a preserved split derived from the same backup row as CS-0049.
    original_backup_rows: new Set(source.tenures.map((tenure) => tenure.original_backup?.source_row).filter(Boolean)).size,
    phase6_revision_rows: source.tenures.reduce((sum, tenure) => sum + (tenure.phase6_revisions?.length ?? 0), 0),
    change_log_rows: source.tenures.reduce((sum, tenure) => sum + (tenure.change_log?.length ?? 0), 0),
    legacy_year_end_decision_rows: source.tenures.reduce((sum, tenure) => sum + (tenure.legacy_year_end_decisions?.length ?? 0), 0),
  };
}

function annualCounts(records) {
  return {
    total: records.length,
    prefecture: records.filter((record) => record.administrative_link?.target_level === 'prefecture').length,
    county: records.filter((record) => record.administrative_link?.target_level === 'county').length,
    places: new Set(records.map((record) => `${record.administrative_link?.target_level}|${record.place}`)).size,
    confirmed: records.filter((record) => record.annual_presence_status === 'confirmed').length,
    probable: records.filter((record) => record.annual_presence_status === 'probable').length,
  };
}

function eligibleSourceTenure(tenure) {
  const fields = tenure.master_fields ?? {};
  return displayRoles.has(text(fields['记录角色']))
    && chenScopes.has(text(fields['朝代范围']))
    && localLevels.has(text(fields['层级']))
    && !notServedStatuses.has(text(fields['履任状态']));
}

const checks = [];
function check(id, category, label, assertion, detail = '') {
  let pass = false;
  try {
    pass = typeof assertion === 'function' ? Boolean(assertion()) : Boolean(assertion);
    assert.ok(pass);
  } catch {
    pass = false;
  }
  checks.push({ id, category, label, status: pass ? 'PASS' : 'FAIL', detail });
}

const source = readJson(paths.source);
const data = readJson(paths.data);
const wrapper = readWindowValue(paths.wrapper, 'CHEN_LOCAL_OFFICIALS');
const manifest = readJson(paths.manifest);
const report = readJson(paths.report);
const chenData = readWindowValue(paths.chenData, 'CHEN_DATA');
const records = years.flatMap((year) => data.years?.[String(year)]?.local_officers ?? []);
const sourceById = new Map(source.tenures.map((tenure) => [tenure.official_id, tenure]));
const recordsByOfficial = new Map();
for (const record of records) {
  if (!recordsByOfficial.has(record.official_id)) recordsByOfficial.set(record.official_id, []);
  recordsByOfficial.get(record.official_id).push(record);
}

// Data preservation and artifact integrity.
const expectedPreservation = {
  tenure_rows: 502,
  distinct_official_ids: 502,
  distinct_source_timeline_ids: 501,
  original_backup_rows: 501,
  phase6_revision_rows: 11,
  change_log_rows: 232,
  legacy_year_end_decision_rows: 48,
};
const actualPreservation = preservationCounts(source);
check('DATA-01', 'preservation', '502条任次、原始备份、变更日志与第六阶段追溯完整保留',
  same(actualPreservation, expectedPreservation), JSON.stringify(actualPreservation));
check('DATA-02', 'preservation', '源快照和运行时元数据使用相同数据保全计数',
  same(source.preservation, expectedPreservation) && same(data.meta?.preservation, expectedPreservation));

const requiredManifestFiles = [
  'data/chen-local-officials-source.json',
  'data/chen-local-officials.json',
  'data/chen-local-officials.js',
  'reports/chen-local-officials-validation.json',
  'reports/chen-local-officials-validation.md',
];
const manifestFailures = [];
for (const entry of manifest.files ?? []) {
  const filePath = path.join(siteDir, ...String(entry.path).split('/'));
  if (!fs.existsSync(filePath)) manifestFailures.push(`${entry.path}:missing`);
  else if (fs.statSync(filePath).size !== entry.bytes || sha256(filePath) !== entry.sha256) manifestFailures.push(`${entry.path}:digest`);
}
check('DATA-03', 'integrity', 'manifest列出的发布文件字节数与SHA256一致',
  manifestFailures.length === 0 && requiredManifestFiles.every((name) => manifest.files?.some((entry) => entry.path === name)),
  manifestFailures.join('; '));
check('DATA-04', 'integrity', 'JSON与浏览器同步包装深度相同', same(data, wrapper));
check('DATA-05', 'semantics', '官员“本年曾任”语义与行政区划年末快照语义分离',
  data.meta?.official_semantics === 'annual_presence_not_year_end_current'
    && data.meta?.administrative_snapshot_semantics === 'year_end_geography_only'
    && Object.values(data.years ?? {}).every((node) => node.list_semantics === 'all_existing_master_tenures_confirmed_or_probable_present_during_year'
      && node.administrative_snapshot_semantics === 'year_end_only_for_geography_not_officers'
      && node.intra_year_succession_inferred === false));

// Annual schema and traceability.
check('DATA-06', 'schema', '557—588共32个连续年度节点',
  years.every((year) => data.years?.[String(year)]) && Object.keys(data.years ?? {}).length === 32);
check('DATA-07', 'schema', '年度记录ID和“年份+任次”键唯一',
  new Set(records.map((record) => record.annual_presence_id)).size === records.length
    && new Set(records.map((record) => `${record.year}|${record.official_id}`)).size === records.length,
  `records=${records.length}`);
const annualFields = ['annual_presence_id', 'official_id', 'person_id', 'person', 'place', 'office', 'full_title', 'level', 'year',
  'annual_presence_status', 'confidence', 'tenure_boundary_status', 'annual_presence_basis', 'reasoning_source', 'display_style', 'display_italic',
  'intra_year_order', 'intra_year_order_status', 'display_order', 'administrative_link', 'technical_trace'];
const missingAnnual = records.flatMap((record) => annualFields.filter((field) => !Object.hasOwn(record, field))
  .map((field) => `${record.annual_presence_id}:${field}`));
check('DATA-08', 'schema', '每条年度记录均有两类确定性、confidence/reasoning source、挂接与技术追溯字段', missingAnnual.length === 0, `missing=${missingAnnual.length}`);
const invalidStatus = records.filter((record) => !annualStatuses.has(record.annual_presence_status)
  || !boundaryStatuses.has(record.tenure_boundary_status)
  || record.confidence !== record.annual_presence_status
  || JSON.stringify(record.reasoning_source) !== JSON.stringify(record.annual_presence_basis)
  || (record.annual_presence_status === 'confirmed' && (record.display_style !== 'normal' || record.display_italic !== false))
  || (record.annual_presence_status === 'probable' && (record.display_style !== 'italic' || record.display_italic !== true)));
check('DATA-09', 'semantics', '年度任职确定性与任期边界确定性独立，字体规则正确',
  invalidStatus.length === 0
    && records.some((record) => record.annual_presence_status === 'confirmed' && record.tenure_boundary_status === 'unknown')
    && records.some((record) => record.annual_presence_status === 'confirmed' && record.tenure_boundary_status === 'probable'),
  `invalid=${invalidStatus.length}`);

const tenureFields = ['official_id', 'person_id', 'person', 'place', 'office', 'full_title', 'level', 'tenure_nature', 'tenure_status',
  'tenure_conclusion_status', 'tenure_boundary_status', 'tenure_time', 'evidence_text', 'time_anchors',
  'comprehensive_analysis', 'career_links', 'technical_trace'];
const projectedIds = [...new Set(records.map((record) => record.official_id))];
const incompleteTenures = projectedIds.filter((officialId) => {
  const tenure = data.tenures_by_id?.[officialId];
  return !tenure || tenureFields.some((field) => !Object.hasOwn(tenure, field))
    || !text(tenure.evidence_text) || !text(tenure.comprehensive_analysis) || !text(tenure.full_title);
});
check('DATA-10', 'display-data', '所有投射任次均保留完整官衔、史料原文、综合考证、时间锚点和职业链',
  incompleteTenures.length === 0, `projected_tenures=${projectedIds.length}; incomplete=${incompleteTenures.length}`);
const traceFailures = records.filter((record) => {
  const tenure = data.tenures_by_id?.[record.official_id];
  return !tenure || !sourceById.has(record.official_id) || record.person_id !== tenure.person_id
    || record.person !== tenure.person || record.place !== tenure.place || record.office !== tenure.office
    || record.full_title !== tenure.full_title || record.tenure_boundary_status !== tenure.tenure_boundary_status
    || record.technical_trace?.source_timeline_id !== tenure.technical_trace?.source_timeline_id
    || record.technical_trace?.evidence_id !== tenure.technical_trace?.evidence_id
    || record.technical_trace?.evidence_mapping_id !== tenure.technical_trace?.evidence_mapping_id;
});
check('DATA-11', 'traceability', '年度记录与任次详情的ID、证据映射和源行追溯一致', traceFailures.length === 0, `failures=${traceFailures.length}`);

// Every source row has exactly one explained disposition.
const expectedDisposition = {
  unprojectable_no_annual_evidence: 42,
  projected: 226,
  outside_chen_scope: 210,
  excluded_not_served: 21,
  alias_not_displayed: 3,
};
const dispositionById = new Map(data.source_disposition.map((row) => [row.official_id, row]));
const dispositionCounts = {};
for (const row of data.source_disposition) dispositionCounts[row.state] = (dispositionCounts[row.state] ?? 0) + 1;
const dispositionMismatches = data.source_disposition.filter((row) => {
  const actual = (recordsByOfficial.get(row.official_id) ?? []).map((record) => record.year).sort((a, b) => a - b);
  return !same(actual, row.projected_years ?? []);
});
check('DATA-12', 'projection', '502条任次逐条说明投射或排除原因，年份与运行时记录一致',
  data.source_disposition.length === 502 && dispositionById.size === 502
    && same(dispositionCounts, expectedDisposition) && dispositionMismatches.length === 0,
  `counts=${JSON.stringify(dispositionCounts)}; mismatches=${dispositionMismatches.length}`);
const notServed = source.tenures.filter((tenure) => notServedStatuses.has(text(tenure.master_fields?.['履任状态'])));
check('DATA-13', 'projection', '21条“未拜/未任/未之镇”等明确未履任任次无年度投射',
  notServed.length === 21 && notServed.every((tenure) => dispositionById.get(tenure.official_id)?.state === 'excluded_not_served'
    && !recordsByOfficial.has(tenure.official_id)), `excluded=${notServed.length}`);
const aliases = source.tenures.filter((tenure) => !displayRoles.has(text(tenure.master_fields?.['记录角色'])));
check('DATA-14', 'projection', '3条别名记录只作追溯且不重复显示',
  aliases.length === 3 && aliases.every((tenure) => dispositionById.get(tenure.official_id)?.state === 'alias_not_displayed'
    && !recordsByOfficial.has(tenure.official_id)), `aliases=${aliases.length}`);

// Tests A/B: exact frozen before/after counts and complete record lists.
const expectedYearCounts = {
  562: { total: 56, prefecture: 47, county: 9, places: 40, confirmed: 28, probable: 28 },
  563: { total: 42, prefecture: 33, county: 9, places: 34, confirmed: 10, probable: 32 },
};
const oldYearCounts = {
  562: { total: 3, prefecture: 3, county: 0, places: 3, confirmed: 1, probable: 2 },
  563: { total: 2, prefecture: 2, county: 0, places: 2, confirmed: 0, probable: 2 },
};
for (const year of [562, 563]) {
  const yearRecords = data.years[String(year)].local_officers;
  const actual = annualCounts(yearRecords);
  const reportNode = year === 562 ? report.test_a : report.test_b;
  check(`TEST-${year}`, 'acceptance', `${year}年修改前后计数和全部长官清单正确`,
    same(actual, expectedYearCounts[year]) && same(reportNode?.before, oldYearCounts[year])
      && same(reportNode?.after, expectedYearCounts[year]) && same(reportNode?.records, yearRecords),
    `before=${JSON.stringify(oldYearCounts[year])}; after=${JSON.stringify(actual)}`);
}

// Test C: exact annual 丹阳尹 fixture; compare as sets because intra-year order may be unknown.
const expectedDanyang = {
  558: ['CS-0032:confirmed', 'CS-0033:confirmed'],
  559: ['CS-0032:confirmed', 'CS-0033:confirmed', 'CS-0034:confirmed', 'CS-0036:probable'],
  560: ['CS-0034:confirmed', 'CS-0036:probable'], 561: ['CS-0036:confirmed', 'CS-0037:confirmed'],
  562: ['CS-0037:confirmed', 'CS-0038:confirmed'], 563: ['CS-0038:confirmed'],
  564: ['CS-0038:confirmed', 'CS-0039:confirmed'], 565: ['CS-0039:confirmed', 'CS-0040:confirmed'],
  566: ['CS-0040:confirmed'], 567: ['CS-0040:confirmed', 'CS-0041:confirmed', 'CS-0042:confirmed'],
  568: ['CS-0042:probable'], 569: ['CS-0042:confirmed', 'CS-0044:confirmed'],
  570: ['CS-0042:probable', 'CS-0044:confirmed'], 571: ['CS-0042:probable', 'CS-0044:confirmed'],
  572: ['CS-0042:probable', 'CS-0044:confirmed', 'CS-0045:probable'],
  575: ['CS-0046:probable'], 576: ['CS-0046:probable'], 577: ['CS-0046:probable', 'CS-0047:confirmed'],
  578: ['CS-0046:probable'], 579: ['CS-0046:probable', 'CS-0049:probable'],
  580: ['CS-0048:probable', 'CS-0049:probable'],
  581: ['CS-0048:confirmed', 'CS-0049-T2:confirmed', 'CS-0050:confirmed'],
  582: ['CS-0049-T2:confirmed', 'CS-0051:confirmed'], 583: ['CS-0051:confirmed'],
  586: ['CS-0053:confirmed', 'CS-0054:confirmed'], 587: ['CS-0054:confirmed', 'CS-0055:confirmed'],
  588: ['CS-0055:probable'],
};
const danyangFailures = [];
const danyangReport = [];
for (const year of years) {
  const annual = data.years[String(year)].local_officers
    .filter((record) => record.place === '丹阳' && record.office.includes('丹阳尹'));
  const actual = annual.map((record) => `${record.official_id}:${record.annual_presence_status}`).sort();
  const expected = [...(expectedDanyang[year] ?? [])].sort();
  if (!same(actual, expected)) danyangFailures.push({ year, expected, actual });
  danyangReport.push({ year, records: annual.map((record) => ({ official_id: record.official_id, person: record.person, office: record.office, status: record.annual_presence_status })) });
}
check('TEST-C', 'acceptance', '557—588丹阳尹记录逐年对应冻结人工裁决投射',
  danyangFailures.length === 0 && same(report.test_c_danyang_yin, danyangReport),
  `rows=${danyangReport.flatMap((row) => row.records).length}; failures=${danyangFailures.length}`);

// Test D: explicit anchors are independent of uncertain tenure boundaries.
const anchorPairs = source.tenures.flatMap((tenure) => eligibleSourceTenure(tenure)
  ? parseYears(tenure.master_fields?.['年内在任锚']).map((year) => ({ official_id: tenure.official_id, year })) : []);
const missingAnchors = anchorPairs.filter(({ official_id, year }) => !records.some((record) => record.official_id === official_id
  && record.year === year && record.annual_presence_status === 'confirmed'));
const manualPairs = source.tenures.flatMap((tenure) => eligibleSourceTenure(tenure)
  ? parseYears(tenure.master_fields?.['已采用年末年份']).map((year) => ({ official_id: tenure.official_id, year })) : []);
const missingManual = manualPairs.filter(({ official_id, year }) => !records.some((record) => record.official_id === official_id && record.year === year));
check('TEST-D', 'acceptance', '全部明确在任锚点及既有人工逐年结论至少进入相应年度',
  anchorPairs.length === 23 && missingAnchors.length === 0 && missingManual.length === 0,
  `anchors=${anchorPairs.length}; missing=${missingAnchors.length}; manual=${manualPairs.length}; manual_missing=${missingManual.length}`);

// Test E plus county and multiple-incumbent rules.
check('TEST-E', 'acceptance', '五百余条任次全部保留且859条年度记录来自226条可投射任次',
  records.length === 859 && data.meta?.projectable_tenure_count === 226 && data.meta?.annual_record_count === 859
    && Object.values(expectedDisposition).reduce((sum, count) => sum + count, 0) === 502,
  `annual=${records.length}; disposition=${JSON.stringify(dispositionCounts)}`);
const countyRecords = records.filter((record) => record.administrative_link?.target_level === 'county');
check('DATA-15', 'county', '县级长官按相同规则投射并在可挂接时保留州郡县三级ID',
  countyRecords.length > 0 && countyRecords.every((record) => !record.administrative_link.attach_to_snapshot
    || (record.administrative_link.state_id && record.administrative_link.prefecture_id && record.administrative_link.county_id)),
  `county_records=${countyRecords.length}`);
const multiMap = new Map();
for (const record of records) {
  const key = `${record.year}|${record.administrative_link?.target_level}|${record.place}`;
  if (!multiMap.has(key)) multiMap.set(key, []);
  multiMap.get(key).push(record);
}
const multiGroups = [...multiMap.values()].filter((group) => group.length > 1);
check('DATA-16', 'ordering', '同一地点同一年多任完整保留；未知先后明确标记“年内先后未详”',
  multiGroups.length === 139 && multiGroups.every((group) => group.every((record) => record.intra_year_order_status !== 'unknown'
    || record.intra_year_order_note === '年内先后未详')), `multi_groups=${multiGroups.length}`);

// Attached rows must resolve uniquely by active IDs; detached rows must retain false assertions.
const adminFailures = [];
const chenStates = chenData?.regimes?.chen?.states ?? [];
for (const record of records) {
  const link = record.administrative_link ?? {};
  if (!link.attach_to_snapshot) {
    if (link.hierarchy_active_in_year === true || link.state_assignment_asserted === true) adminFailures.push(`${record.annual_presence_id}:asserted-detached`);
    continue;
  }
  if (link.hierarchy_active_in_year !== true || link.state_assignment_asserted !== true) adminFailures.push(`${record.annual_presence_id}:unasserted-attached`);
  const states = chenStates.filter((state) => state.id === link.state_id && activeInYear(state, record.year));
  const prefectures = states.flatMap((state) => (state.prefectures ?? []).filter((prefecture) => prefecture.id === link.prefecture_id && activeInYear(prefecture, record.year)));
  if (states.length !== 1 || prefectures.length !== 1) adminFailures.push(`${record.annual_presence_id}:prefecture`);
  if (link.target_level === 'county') {
    const counties = prefectures.flatMap((prefecture) => (prefecture.counties ?? []).filter((county) => county.id === link.county_id && activeInYear(county, record.year)));
    if (counties.length !== 1) adminFailures.push(`${record.annual_presence_id}:county`);
  }
}
check('DATA-17', 'attachment', '只有本年有效的稳定州郡县ID被挂接，未断言记录保持分离', adminFailures.length === 0,
  `attached=${records.filter((record) => record.administrative_link?.attach_to_snapshot).length}; detached=${records.filter((record) => !record.administrative_link?.attach_to_snapshot).length}; failures=${adminFailures.length}`);

// Validation report must describe the generated data exactly.
const reportCountFailures = years.filter((year) => !same(report.counts?.by_year?.[String(year)], annualCounts(data.years[String(year)].local_officers)));
check('REPORT-01', 'report', 'JSON/Markdown报告存在且逐年计数与运行时数据一致',
  fs.existsSync(paths.reportMarkdown) && report.release_gate === 'PASS' && reportCountFailures.length === 0,
  `year_failures=${reportCountFailures.length}`);
check('REPORT-02', 'report', '生成报告的A—G测试全部通过',
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].every((id) => report.tests?.some((test) => test.id === id && test.pass === true)));
check('REPORT-03', 'report', '报告逐条处置表与运行时源处置表一致', same(report.source_disposition, data.source_disposition));

// Front-end static contract. Use --data-only while the UI patch is still under construction.
if (dataOnly) {
  checks.push({ id: 'UI', category: 'frontend', label: '前端静态契约', status: 'SKIP', detail: '--data-only' });
} else {
  const appSource = fs.readFileSync(paths.app, 'utf8');
  const indexSource = fs.readFileSync(paths.index, 'utf8');
  const styleSource = fs.readFileSync(paths.style, 'utf8');
  const attachStart = appSource.indexOf('function attachLocalOfficers');
  const attachEnd = attachStart < 0 ? -1 : appSource.indexOf('\n  // ----------', attachStart);
  const attachSource = attachStart < 0 ? '' : appSource.slice(attachStart, attachEnd > attachStart ? attachEnd : attachStart + 14000);
  check('UI-01', 'frontend', '新地方长官脚本先于app.js载入且旧39条脚本退出入口',
    indexSource.includes('data/chen-local-officials.js') && indexSource.indexOf('data/chen-local-officials.js') < indexSource.indexOf('app.js')
      && !indexSource.includes('data/chen-prefectural-officers.js'));
  check('UI-02', 'frontend', '运行时读取全部local_officers且不以旧批准布尔值过滤',
    appSource.includes('CHEN_LOCAL_OFFICIALS') && appSource.includes('local_officers') && !appSource.includes('CHEN_PREFECTURAL_OFFICERS')
      && !appSource.includes('record.publication_approved') && !appSource.includes('record.selected_as_year_end_current'));
  check('UI-03', 'frontend', '州郡县只按稳定ID和attach_to_snapshot机械挂接',
    attachSource.includes('attach_to_snapshot') && attachSource.includes('state_id') && attachSource.includes('prefecture_id')
      && attachSource.includes('county_id') && !attachSource.includes('normalizeName'));
  check('UI-04', 'frontend', '郡、县及未连接区均有地方长官渲染入口',
    /renderLocalOfficer/i.test(appSource) && /county[^\n]{0,150}localOfficers|localOfficers[^\n]{0,150}county/i.test(appSource)
      && appSource.includes('detachedLocalOfficers'));
  check('UI-05', 'frontend', '列表显示人名与官职；confirmed正常、probable斜体',
    appSource.includes('annual_presence_status') && appSource.includes('record.person') && appSource.includes('record.office')
      && /\.local-officer-entry\.confirmed\s*\{[^}]*font-style:\s*normal/s.test(styleSource)
      && /\.local-officer-entry\.probable\s*\{[^}]*font-style:\s*italic/s.test(styleSource));
  const detailStart = appSource.indexOf('function renderLocalOfficerDetail');
  const detailEnd = detailStart < 0 ? -1 : appSource.indexOf('\n  function openAuxInfo', detailStart);
  const detailSource = detailStart < 0 ? '' : appSource.slice(detailStart, detailEnd > detailStart ? detailEnd : detailStart + 16000);
  const labels = ['人名', '完整官銜', '任職時間', '確定性', '任職性質', '史料原文', '時間錨點', '綜合考證', '前後任或職業鏈資訊', '技術資訊 / 數據追溯'];
  const positions = labels.map((label) => detailSource.indexOf(label));
  check('UI-06', 'frontend', '人物详情按用户规定顺序显示且技术追溯置底',
    positions.every((position) => position >= 0) && positions.every((position, index) => index === 0 || position > positions[index - 1]),
    JSON.stringify(Object.fromEntries(labels.map((label, index) => [label, positions[index]]))));
  check('UI-07', 'frontend', '详情使用实际史料与综合考证，技术信息默认折叠',
    detailSource.includes('evidence_text') && detailSource.includes('comprehensive_analysis')
      && /createElement\(['"]details['"]\)/.test(detailSource) && !/\.open\s*=\s*true/.test(detailSource));
  check('UI-08', 'frontend', '官员检索包含显示字段和隐藏追溯ID',
    /localOfficerSearchText|local-officer-search/i.test(appSource) && appSource.includes('official_id')
      && appSource.includes('person_id') && appSource.includes('evidence_id'));
  const forbidden = ['年末长官', '年末郡级长官', '年末郡級長官', '年末采用', '年末採用', '年末批准'];
  const hits = forbidden.filter((phrase) => appSource.includes(phrase) || indexSource.includes(phrase));
  check('UI-09', 'frontend', '官员界面不再称“年末长官/年末采用”', hits.length === 0, hits.join(', '));
  check('UI-10', 'frontend', '南陈标题去除年末，资料与方法明确年末原则只适用于行政区划',
    appSource.includes('南陳·') && appSource.includes('州郡縣表')
      && appSource.includes('該「年末」原則僅適用於行政區劃，不適用於官員年表')
      && appSource.includes('同一州、郡或縣在同一年中可能列有多任長官'));
}

const failed = checks.filter((item) => item.status === 'FAIL');
const result = {
  validation: 'chen-local-officials',
  scope: dataOnly ? 'data-only' : 'full',
  release_gate: failed.length ? 'FAIL' : 'PASS',
  counts: {
    source_tenures: actualPreservation.tenure_rows,
    projectable_tenures: data.meta?.projectable_tenure_count ?? null,
    annual_records: records.length,
    county_records: countyRecords.length,
    attached: records.filter((record) => record.administrative_link?.attach_to_snapshot).length,
    detached: records.filter((record) => !record.administrative_link?.attach_to_snapshot).length,
    checks: checks.length,
    passed: checks.filter((item) => item.status === 'PASS').length,
    failed: failed.length,
    skipped: checks.filter((item) => item.status === 'SKIP').length,
  },
  checks,
};
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
