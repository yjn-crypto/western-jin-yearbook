import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const sourcePath = path.join(siteDir, 'data', 'chen-local-officials-source.json');
const oldPath = path.join(siteDir, 'data', 'chen-prefectural-officers.json');
const jsonPath = path.join(siteDir, 'data', 'chen-local-officials.json');
const scriptPath = path.join(siteDir, 'data', 'chen-local-officials.js');
const manifestPath = path.join(siteDir, 'data', 'chen-local-officials-manifest.json');
const reportDir = path.join(siteDir, 'reports');
const reportJsonPath = path.join(reportDir, 'chen-local-officials-validation.json');
const reportMarkdownPath = path.join(reportDir, 'chen-local-officials-validation.md');

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
const text = (value) => value === null || value === undefined ? '' : String(value).trim();
const number = (value) => value === null || value === undefined || value === ''
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const splitIds = (value) => [...new Set(text(value).split(/[；;,、\s]+/).map((item) => item.trim()).filter(Boolean))];
const targetYears = Array.from({ length: 32 }, (_, index) => 557 + index);

const DISPLAY_ROLES = new Set([
  'canonical',
  'canonical_merged',
  'canonical_split_part_1',
  'derived_split_part_2',
]);
const CHEN_SCOPES = new Set(['陈表', '跨朝含陈', '跨朝待分', '梁至陈受禅', '陈，地点未明']);
const ANCHOR_ONLY_SCOPES = new Set(['跨朝待分']);
const NOT_SERVED = new Set(['baseline_not_served', 'appointed_not_served']);
const COUNTY_LEVELS = new Set(['县级', '县级正任']);
const PREFECTURE_LEVELS = new Set(['郡级正任', '郡级代理', '郡级正任（待核）', '封国相（郡级）']);
const SERVICE_UNCERTAIN = new Set(['appointed_service_unknown', 'nominal_or_uncertain', 'text_uncertain']);

function parseYears(value) {
  return [...new Set((text(value).match(/(?<!\d)(?:55[7-9]|56\d|57\d|58[0-8])(?!\d)/g) ?? []).map(Number))].sort((a, b) => a - b);
}

function rangeYears(left, right) {
  const start = Math.max(557, Math.min(left, right));
  const end = Math.min(588, Math.max(left, right));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function boundaryStatus(main) {
  const sl = number(main['起任下界']);
  const su = number(main['起任上界']);
  const el = number(main['卸任或后官下界']);
  const eu = number(main['卸任或后官上界']);
  if (sl === null || su === null || el === null || eu === null) return 'unknown';
  if (sl === su && el === eu
    && text(main['起任确定性']) === 'confirmed'
    && text(main['终止确定性']) === 'confirmed') return 'confirmed';
  return 'probable';
}

function addBasis(map, year, basis) {
  if (!Number.isInteger(year) || year < 557 || year > 588) return;
  if (!map.has(year)) map.set(year, []);
  const signature = `${basis.type}|${basis.source_field}|${basis.source_value}|${basis.strength}`;
  if (!map.get(year).some((item) => `${item.type}|${item.source_field}|${item.source_value}|${item.strength}` === signature)) {
    map.get(year).push(basis);
  }
}

function projectTenure(tenure) {
  const main = tenure.master_fields;
  const role = text(main['记录角色']);
  const scope = text(main['朝代范围']);
  const level = text(main['层级']);
  const service = text(main['履任状态']);
  if (!DISPLAY_ROLES.has(role)) return { state: 'alias_not_displayed', records: [] };
  if (NOT_SERVED.has(service)) return { state: 'excluded_not_served', records: [] };
  if (!CHEN_SCOPES.has(scope)) return { state: 'outside_chen_scope', records: [] };
  if (!COUNTY_LEVELS.has(level) && !PREFECTURE_LEVELS.has(level)) return { state: 'unsupported_level', records: [] };

  const basisByYear = new Map();
  const anchorYears = parseYears(main['年内在任锚']);
  const adoptedYears = parseYears(main['已采用年末年份']);
  for (const year of anchorYears) {
    addBasis(basisByYear, year, {
      type: 'explicit_in_year_anchor',
      label: '主表明确在任锚点',
      strength: 'confirmed',
      source_field: '年内在任锚',
      source_value: text(main['年内在任锚']),
    });
  }
  for (const year of adoptedYears) {
    addBasis(basisByYear, year, {
      type: 'existing_manual_annual_decision',
      label: '既有人工逐年采用结论',
      strength: text(main['年末采用等级']) === 'confirmed' ? 'confirmed' : 'probable',
      source_field: '已采用年末年份',
      source_value: text(main['已采用年末年份']),
    });
  }

  // “跨朝待分”不据边界扩大为南陈任期；但主表已有的本年在任锚必须保留。
  if (ANCHOR_ONLY_SCOPES.has(scope)) {
    const records = [...basisByYear.entries()].sort(([a], [b]) => a - b).map(([year, bases]) => ({
      year,
      annual_presence_status: bases.some((basis) => basis.strength === 'confirmed') ? 'confirmed' : 'probable',
      annual_presence_basis: bases,
    }));
    return { state: records.length ? 'projected' : 'unprojectable_no_annual_evidence', records };
  }

  const sl = number(main['起任下界']);
  const su = number(main['起任上界']);
  const el = number(main['卸任或后官下界']);
  const eu = number(main['卸任或后官上界']);
  const startValues = [sl, su].filter((value) => value !== null);
  const endValues = [el, eu].filter((value) => value !== null);
  const earliestStart = startValues.length ? Math.min(...startValues) : null;
  const latestStart = startValues.length ? Math.max(...startValues) : null;
  const earliestEnd = endValues.length ? Math.min(...endValues) : null;
  const latestEnd = endValues.length ? Math.max(...endValues) : null;
  const exactStart = sl !== null && su !== null && sl === su;
  const exactEnd = el !== null && eu !== null && el === eu;

  if (earliestStart !== null) {
    for (const year of rangeYears(earliestStart, latestStart)) {
      const confirmed = exactStart
        && text(main['起任确定性']) === 'confirmed'
        && !SERVICE_UNCERTAIN.has(service);
      addBasis(basisByYear, year, {
        type: exactStart ? 'explicit_appointment_year' : 'possible_appointment_window',
        label: exactStart ? '明确任命年份' : '主表起任区间覆盖',
        strength: confirmed ? 'confirmed' : 'probable',
        source_field: '起任下界/起任上界',
        source_value: `${sl ?? '空'}—${su ?? '空'}；${text(main['起任确定性']) || '未标'}`,
      });
    }
  }

  if (earliestEnd !== null && service !== 'former') {
    for (const year of rangeYears(earliestEnd, latestEnd)) {
      const confirmed = exactEnd
        && text(main['终止确定性']) === 'confirmed'
        && !SERVICE_UNCERTAIN.has(service)
        && (text(main['任次结论等级']) === 'confirmed' || ['actual', 'acting', 'concurrent'].includes(service));
      addBasis(basisByYear, year, {
        type: exactEnd ? 'explicit_departure_year' : 'possible_departure_window',
        label: exactEnd ? '明确卸任或后官年份' : '主表卸任或后官区间覆盖',
        strength: confirmed ? 'confirmed' : 'probable',
        source_field: '卸任或后官下界/卸任或后官上界',
        source_value: `${el ?? '空'}—${eu ?? '空'}；${text(main['终止确定性']) || '未标'}`,
      });
    }
  }

  if (earliestStart !== null && latestEnd !== null && earliestStart <= latestEnd) {
    for (const year of rangeYears(earliestStart, latestEnd)) {
      const guaranteed = su !== null && el !== null && year >= su && year <= el;
      const confirmed = guaranteed && text(main['任次结论等级']) === 'confirmed';
      addBasis(basisByYear, year, {
        type: 'tenure_interval_overlap',
        label: confirmed ? '确定任期覆盖本年' : '推定任期可能覆盖本年',
        strength: confirmed ? 'confirmed' : 'probable',
        source_field: '规范任期边界',
        source_value: `${sl ?? '空'}—${su ?? '空'} / ${el ?? '空'}—${eu ?? '空'}`,
      });
    }
  }

  const existingPresenceYears = [...new Set([...anchorYears, ...adoptedYears])].sort((a, b) => a - b);
  if (existingPresenceYears.length) {
    const firstPresence = existingPresenceYears[0];
    const lastPresence = existingPresenceYears.at(-1);
    if (earliestStart !== null && earliestStart < firstPresence) {
      for (const year of rangeYears(earliestStart, firstPresence)) {
        addBasis(basisByYear, year, {
          type: 'bounded_to_existing_presence', label: '由既有在任年份与起任边界夹定', strength: 'probable',
          source_field: '规范任期边界+既有在任年份', source_value: `${earliestStart}—${firstPresence}`,
        });
      }
    }
    if (latestEnd !== null && latestEnd > lastPresence) {
      for (const year of rangeYears(lastPresence, latestEnd)) {
        addBasis(basisByYear, year, {
          type: 'bounded_from_existing_presence', label: '由既有在任年份与终止边界夹定', strength: 'probable',
          source_field: '既有在任年份+规范任期边界', source_value: `${lastPresence}—${latestEnd}`,
        });
      }
    }
    if (firstPresence < lastPresence) {
      for (const year of rangeYears(firstPresence, lastPresence)) {
        addBasis(basisByYear, year, {
          type: 'between_existing_presence_points', label: '两项既有在任年份之间', strength: 'probable',
          source_field: '既有在任年份', source_value: `${firstPresence}—${lastPresence}`,
        });
      }
    }
  }

  const records = [...basisByYear.entries()].sort(([a], [b]) => a - b).map(([year, bases]) => ({
    year,
    annual_presence_status: bases.some((basis) => basis.strength === 'confirmed') ? 'confirmed' : 'probable',
    annual_presence_basis: bases,
  }));
  return { state: records.length ? 'projected' : 'unprojectable_no_annual_evidence', records };
}

function activePhase(phases, year) {
  return (phases ?? []).find((phase) => {
    const start = number(phase.start ?? phase.s);
    const end = number(phase.end ?? phase.e);
    return start !== null && end !== null && year >= start && year <= end;
  }) ?? null;
}

function normalizePlace(value, level) {
  let normalized = text(value).normalize('NFKC')
    .replace(/[\s·`?？※、，,。；;（）()\[\]「」『』]/g, '')
    .replace(/臺/g, '台')
    .replace(/錢唐/g, '钱塘')
    .replace(/候官/g, '侯官');
  normalized = level === 'prefecture'
    ? normalized.replace(/(王国|公国|侯国|伯国|子国|男国|二郡|国|郡|尹)$/g, '')
    : normalized.replace(/(县)$/g, '');
  return normalized;
}

const adminEntities = source.administrative_entities.filter((entity) => entity.level !== 'state');
function candidatesFor(tenure, year) {
  const main = tenure.master_fields;
  const targetLevel = COUNTY_LEVELS.has(text(main['层级'])) ? 'county' : 'prefecture';
  const key = normalizePlace(main['地点'], targetLevel);
  const sameName = adminEntities.filter((entity) => entity.level === targetLevel
    && normalizePlace(entity.simplified_name, targetLevel) === key);
  const globallyUnique = [...new Map(sameName.map((entity) => [
    `${entity.id}|${entity.state_id}|${entity.prefecture_id ?? ''}`,
    entity,
  ])).values()];
  const active = globallyUnique.filter((entity) => activePhase(entity.state_phases ?? entity.phases, year)
    && (targetLevel !== 'county' || activePhase(entity.prefecture_phases, year))
    && activePhase(entity.phases, year));
  return { targetLevel, key, globallyUnique, active };
}

function administrativeLink(tenure, year) {
  const { targetLevel, key, globallyUnique, active } = candidatesFor(tenure, year);
  const selected = active.length === 1 ? active[0] : globallyUnique.length === 1 ? globallyUnique[0] : null;
  const activeSelected = active.length === 1;
  const status = activeSelected
    ? 'matched_active_snapshot_entity'
    : active.length > 1
      ? 'ambiguous_active_administrative_name'
      : globallyUnique.length === 1
        ? 'entity_known_not_active_in_snapshot'
        : globallyUnique.length > 1
          ? 'ambiguous_administrative_name'
          : 'unmatched_administrative_name';
  return {
    target_level: targetLevel,
    link_status: status,
    link_method: 'normalized_name_unique_at_target_level',
    normalized_place_key: key,
    attach_to_snapshot: activeSelected,
    hierarchy_active_in_year: activeSelected,
    state_assignment_asserted: activeSelected,
    active_candidate_count: active.length,
    global_candidate_count: globallyUnique.length,
    state_id: selected?.state_id ?? null,
    state_name: selected ? source.administrative_entities.find((item) => item.level === 'state' && item.id === selected.state_id)?.simplified_name ?? null : null,
    state_order: selected ? number(selected.state_order) : null,
    prefecture_id: selected?.prefecture_id ?? (targetLevel === 'prefecture' ? selected?.id ?? null : null),
    prefecture_name: selected ? source.administrative_entities.find((item) => item.level === 'prefecture' && item.id === selected.prefecture_id)?.simplified_name ?? (targetLevel === 'prefecture' ? selected.simplified_name : null) : null,
    prefecture_order: selected ? number(targetLevel === 'prefecture' ? selected.order : selected.prefecture_order) : null,
    county_id: targetLevel === 'county' ? selected?.county_id ?? selected?.id ?? null : null,
    county_name: targetLevel === 'county' ? selected?.simplified_name ?? null : null,
    county_order: targetLevel === 'county' && selected ? number(selected.order) : null,
    candidate_ids: globallyUnique.map((entity) => entity.id),
  };
}

function originalBackup(tenure, key) {
  return tenure.original_backup?.[key] ?? null;
}

function monthFromText(value) {
  const match = text(value).match(/(闰)?(正|元|十[一二]?|[一二三四五六七八九])月/);
  if (!match) return null;
  const values = { 正: 1, 元: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
  const month = values[match[2]];
  return month ? month + (match[1] ? 0.5 : 0) : null;
}

function reducedCareerLinks(tenure) {
  const result = { previous_roles: [], next_roles: [], predecessor_candidates: [], successor_candidates: [], unresolved_links: [] };
  for (const link of tenure.relation_links ?? []) {
    const related = link.related_node?.label ?? link.related_node?.id ?? '';
    const item = {
      edge_id: link.id,
      related,
      related_id: link.related_node?.id ?? null,
      order_status: link.order_status ?? null,
      order_basis: link.order_basis ?? null,
      quality: link.quality ?? null,
      review_state: link.review_state ?? null,
    };
    if (link.type === 'NEXT_RECORDED_LOCAL_TENURE') {
      (link.direction === 'incoming' ? result.previous_roles : result.next_roles).push(item);
    } else if (link.type === 'PREDECESSOR_CANDIDATE') {
      (link.direction === 'incoming' ? result.predecessor_candidates : result.successor_candidates).push(item);
    } else if (link.type === 'CAREER_ORDER_UNRESOLVED') {
      result.unresolved_links.push(item);
    }
  }
  return result;
}

function tenureTime(tenure) {
  const main = tenure.master_fields;
  const startText = text(originalBackup(tenure, '原始_起始时间'));
  const endText = text(originalBackup(tenure, '原始_结束时间'));
  const normalized = `起任 ${main['起任下界'] ?? '？'}—${main['起任上界'] ?? '？'}；卸任或后官 ${main['卸任或后官下界'] ?? '？'}—${main['卸任或后官上界'] ?? '？'}`;
  return {
    display: [startText && `起：${startText}`, endText && `止：${endText}`].filter(Boolean).join('；') || normalized,
    original_start: startText,
    original_end: endText,
    normalized,
    start_lower: number(main['起任下界']),
    start_upper: number(main['起任上界']),
    start_status: text(main['起任确定性']) || 'unknown',
    end_lower: number(main['卸任或后官下界']),
    end_upper: number(main['卸任或后官上界']),
    end_status: text(main['终止确定性']) || 'unknown',
  };
}

const tenureProjection = new Map();
const sourceDisposition = [];
for (const tenure of source.tenures) {
  const result = projectTenure(tenure);
  tenureProjection.set(tenure.official_id, result);
  sourceDisposition.push({
    official_id: tenure.official_id,
    source_timeline_id: tenure.source_timeline_id,
    state: result.state,
    projected_years: result.records.map((record) => record.year),
    reason: ({
      projected: '由主表现有年度锚点或任期边界机械投射',
      alias_not_displayed: '归并/发布别名仅保留追溯，不重复显示为独立任次',
      outside_chen_scope: `主表朝代范围为“${text(tenure.master_fields['朝代范围']) || '空'}”，未断言属于南陈`,
      excluded_not_served: `主表履任状态为“${text(tenure.master_fields['履任状态'])}”，明确排除实际履任`,
      unsupported_level: `层级“${text(tenure.master_fields['层级']) || '空'}”不属于郡县地方长官`,
      unprojectable_no_annual_evidence: '主表没有557—588年的在任锚点、人工逐年结论或可用任期边界',
    })[result.state],
  });
}

const projectedTenures = source.tenures.filter((tenure) => tenureProjection.get(tenure.official_id).records.length);
const tenureCatalog = {};
for (const tenure of projectedTenures) {
  const main = tenure.master_fields;
  const backup = tenure.original_backup ?? {};
  const anchorNodes = (tenure.relation_links ?? [])
    .filter((link) => link.type === 'ANCHORED_BY')
    .map((link) => link.related_node?.source_fields)
    .filter(Boolean);
  tenureCatalog[tenure.official_id] = {
    official_id: tenure.official_id,
    person_id: text(main.person_id),
    person: text(main['人名']),
    place: text(main['地点']),
    office: text(main['规范官职']),
    full_title: text(main['完整官衔']),
    level: text(main['层级']),
    tenure_nature: text(backup['原始_任职性质']) || text(main['履任状态']),
    tenure_status: text(main['履任状态']),
    tenure_conclusion_status: text(main['任次结论等级']),
    tenure_boundary_status: boundaryStatus(main),
    tenure_time: tenureTime(tenure),
    evidence_text: text(backup['原始_原文证据链']),
    time_anchors: [
      text(main['年内在任锚']) && { type: 'in_year_presence', label: '年内在任锚', value: text(main['年内在任锚']) },
      (number(main['起任下界']) !== null || number(main['起任上界']) !== null) && { type: 'start_boundary', label: '起任边界', value: `${main['起任下界'] ?? '？'}—${main['起任上界'] ?? '？'}（${text(main['起任确定性']) || '未标'}）` },
      (number(main['卸任或后官下界']) !== null || number(main['卸任或后官上界']) !== null) && { type: 'end_boundary', label: '卸任或后官边界', value: `${main['卸任或后官下界'] ?? '？'}—${main['卸任或后官上界'] ?? '？'}（${text(main['终止确定性']) || '未标'}）` },
      ...anchorNodes.map((node) => ({
        type: 'existing_career_anchor',
        label: text(node['纪年']) || text(node['锚点ID']) || '职业链锚点',
        value: [text(node['《陈书》复核']), text(node['对任期的夹逼作用'])].filter(Boolean).join('；'),
      })),
    ].filter(Boolean),
    comprehensive_analysis: text(backup['原始_综合考证']),
    research_notes: [
      text(backup['研究说明']),
      text(backup['人工原话']) && `人工原话：${text(backup['人工原话'])}`,
      text(backup['原始_反证审查']) && `反证审查：${text(backup['原始_反证审查'])}`,
    ].filter(Boolean),
    career_links: {
      career_chain_text: text(backup['原始_将相表职业链']),
      ...reducedCareerLinks(tenure),
    },
    technical_trace: {
      source_timeline_id: tenure.source_timeline_id,
      normalized_tenure_id: text(main['规范任次ID']),
      tenure_group_id: text(main['任次组ID']),
      original_person_id: text(main['原人物ID']),
      evidence_id: text(main['证据ID']),
      evidence_ids: splitIds(main['证据ID']),
      evidence_mapping_id: text(main['证据映射ID']),
      evidence_mapping_ids: splitIds(main['证据映射ID']),
      adjudication_id: text(main['裁决ID']),
      audit_issue_id: text(main['审计问题ID']),
      audit_issue_ids: splitIds(main['审计问题ID']),
      source_row_sha256: text(main['原始行SHA256']),
      master_source_row: tenure.source_row,
      original_backup_source_row: tenure.original_backup?.source_row ?? null,
      record_role: text(main['记录角色']),
      adjudication_source: text(main['裁决来源']),
      phase4_protection_status: text(main['第四阶段保护状态']),
      phase4_action: text(main['第四阶段处置']),
      phase5_status: text(main['第五阶段状态']),
      phase5_note: text(main['第五阶段说明']),
      phase6_revision_ids: tenure.phase6_revisions.map((row) => text(row['修订ID'])),
      change_log_ids: tenure.change_log.map((row) => text(row['修改ID'])),
      legacy_year_end_decision_ids: tenure.legacy_year_end_decisions.map((row) => text(row['年末决策ID'])),
      legacy_year_end_decisions: tenure.legacy_year_end_decisions,
    },
  };
}

const annualRecords = [];
for (const tenure of projectedTenures) {
  const details = tenureCatalog[tenure.official_id];
  for (const projection of tenureProjection.get(tenure.official_id).records) {
    const legacyDecisions = tenure.legacy_year_end_decisions.filter((row) => number(row['公元年']) === projection.year);
    annualRecords.push({
      schema_version: 'chen-local-official-annual-presence-v1',
      record_type: 'annual_local_officer_presence',
      annual_presence_id: `AP-${tenure.official_id}-${projection.year}`,
      official_id: tenure.official_id,
      person_id: details.person_id,
      person: details.person,
      place: details.place,
      office: details.office,
      full_title: details.full_title,
      level: details.level,
      year: projection.year,
      annual_presence_status: projection.annual_presence_status,
      confidence: projection.annual_presence_status,
      tenure_boundary_status: details.tenure_boundary_status,
      annual_presence_basis: projection.annual_presence_basis,
      reasoning_source: projection.annual_presence_basis,
      display_style: projection.annual_presence_status === 'probable' ? 'italic' : 'normal',
      display_italic: projection.annual_presence_status === 'probable',
      intra_year_order: null,
      intra_year_order_status: 'unknown',
      intra_year_order_note: '年内先后未详',
      display_order: null,
      administrative_link: administrativeLink(tenure, projection.year),
      technical_trace: {
        year_end_decision_id: legacyDecisions.map((row) => text(row['年末决策ID'])).filter(Boolean),
        evidence_id: details.technical_trace.evidence_id,
        evidence_mapping_id: details.technical_trace.evidence_mapping_id,
        source_timeline_id: details.technical_trace.source_timeline_id,
        normalized_tenure_id: details.technical_trace.normalized_tenure_id,
        tenure_group_id: details.technical_trace.tenure_group_id,
        adjudication_id: details.technical_trace.adjudication_id,
        audit_issue_id: details.technical_trace.audit_issue_id,
        phase6_revision_ids: details.technical_trace.phase6_revision_ids,
      },
    });
  }
}

function adminOrder(record) {
  const link = record.administrative_link;
  return [
    link.attach_to_snapshot ? 0 : 1,
    link.state_order ?? 999,
    link.prefecture_order ?? 999,
    link.target_level === 'prefecture' ? 0 : 1,
    link.county_order ?? 999,
  ];
}

function compareTuple(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) < (right[index] ?? 0)) return -1;
    if ((left[index] ?? 0) > (right[index] ?? 0)) return 1;
  }
  return 0;
}

function groupKey(record) {
  const link = record.administrative_link;
  return link.attach_to_snapshot
    ? `${link.target_level}|${link.prefecture_id ?? ''}|${link.county_id ?? ''}`
    : `${link.target_level}|detached|${normalizePlace(record.place, link.target_level)}`;
}

for (const year of targetYears) {
  const annual = annualRecords.filter((record) => record.year === year);
  const groups = new Map();
  for (const record of annual) {
    const key = groupKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  for (const records of groups.values()) {
    records.sort((left, right) => {
      const leftDetails = tenureCatalog[left.official_id];
      const rightDetails = tenureCatalog[right.official_id];
      const leftStartMonth = leftDetails.tenure_time.start_lower === year && leftDetails.tenure_time.start_upper === year
        ? monthFromText(leftDetails.tenure_time.original_start) : null;
      const rightStartMonth = rightDetails.tenure_time.start_lower === year && rightDetails.tenure_time.start_upper === year
        ? monthFromText(rightDetails.tenure_time.original_start) : null;
      if (leftStartMonth !== null && rightStartMonth !== null && leftStartMonth !== rightStartMonth) return leftStartMonth - rightStartMonth;
      const relation = projectedTenures.find((tenure) => tenure.official_id === left.official_id)?.relation_links?.find((edge) =>
        edge.type === 'PREDECESSOR_CANDIDATE'
        && edge.from === `tenure:${left.technical_trace.source_timeline_id}`
        && edge.to === `tenure:${right.technical_trace.source_timeline_id}`);
      if (relation) return -1;
      const reverse = projectedTenures.find((tenure) => tenure.official_id === right.official_id)?.relation_links?.find((edge) =>
        edge.type === 'PREDECESSOR_CANDIDATE'
        && edge.from === `tenure:${right.technical_trace.source_timeline_id}`
        && edge.to === `tenure:${left.technical_trace.source_timeline_id}`);
      if (reverse) return 1;
      return left.official_id.localeCompare(right.official_id, 'en', { numeric: true });
    });
    const allHaveDistinctMonths = records.length > 1 && records.every((record) => {
      const details = tenureCatalog[record.official_id];
      return details.tenure_time.start_lower === year && details.tenure_time.start_upper === year
        && monthFromText(details.tenure_time.original_start) !== null;
    }) && new Set(records.map((record) => monthFromText(tenureCatalog[record.official_id].tenure_time.original_start))).size === records.length;
    records.forEach((record, index) => {
      record.intra_year_order = index + 1;
      if (records.length === 1) {
        record.intra_year_order_status = 'single_record';
        record.intra_year_order_note = '';
      } else if (allHaveDistinctMonths) {
        record.intra_year_order_status = 'ordered_by_existing_date_anchor';
        record.intra_year_order_note = '按主表现有任命月份排列';
      }
    });
  }
  annual.sort((left, right) => compareTuple(adminOrder(left), adminOrder(right))
    || groupKey(left).localeCompare(groupKey(right), 'zh-CN')
    || left.intra_year_order - right.intra_year_order
    || left.official_id.localeCompare(right.official_id, 'en', { numeric: true }));
  annual.forEach((record, index) => { record.display_order = index + 1; });
}

const years = {};
for (const year of targetYears) {
  const records = annualRecords.filter((record) => record.year === year).sort((a, b) => a.display_order - b.display_order);
  years[String(year)] = {
    schema_version: 'chen-local-official-year-v1',
    year,
    list_semantics: 'all_existing_master_tenures_confirmed_or_probable_present_during_year',
    administrative_snapshot_semantics: 'year_end_only_for_geography_not_officers',
    intra_year_succession_inferred: false,
    record_count: records.length,
    prefecture_count: records.filter((record) => record.administrative_link.target_level === 'prefecture').length,
    county_count: records.filter((record) => record.administrative_link.target_level === 'county').length,
    confirmed_count: records.filter((record) => record.annual_presence_status === 'confirmed').length,
    probable_count: records.filter((record) => record.annual_presence_status === 'probable').length,
    attached_count: records.filter((record) => record.administrative_link.attach_to_snapshot).length,
    detached_count: records.filter((record) => !record.administrative_link.attach_to_snapshot).length,
    local_officers: records,
  };
}

const dispositionCounts = Object.fromEntries([...sourceDisposition.reduce((map, row) => {
  map.set(row.state, (map.get(row.state) ?? 0) + 1);
  return map;
}, new Map())]);
const runtimeData = {
  meta: {
    key: 'chen_local_officials',
    title: '南陈郡县地方长官年表',
    schema_version: 'chen-local-officials-v1',
    years: [557, 588],
    official_semantics: 'annual_presence_not_year_end_current',
    administrative_snapshot_semantics: 'year_end_geography_only',
    source_workbook: source.source.workbook,
    source_master_sha256: source.source.workbook_sha256,
    source_sheet: '任次主表',
    projection_rule: 'Project only existing structured annual anchors, adopted annual conclusions, and normalized tenure boundaries; never infer new tenure dates.',
    display_rule: { confirmed: 'normal', probable: 'italic' },
    preservation: source.preservation,
    disposition_counts: dispositionCounts,
    projectable_tenure_count: projectedTenures.length,
    annual_record_count: annualRecords.length,
  },
  tenures_by_id: tenureCatalog,
  source_disposition: sourceDisposition,
  years,
};

function oldCounts(year) {
  const records = oldData.years?.[String(year)]?.prefectural_officers ?? [];
  return {
    total: records.length,
    prefecture: records.length,
    county: 0,
    places: new Set(records.map((record) => record.place)).size,
    confirmed: records.filter((record) => record.year_end_status === 'confirmed').length,
    probable: records.filter((record) => record.year_end_status === 'probable').length,
  };
}

function newCounts(year) {
  const records = years[String(year)].local_officers;
  return {
    total: records.length,
    prefecture: records.filter((record) => record.administrative_link.target_level === 'prefecture').length,
    county: records.filter((record) => record.administrative_link.target_level === 'county').length,
    places: new Set(records.map((record) => `${record.administrative_link.target_level}|${record.place}`)).size,
    confirmed: records.filter((record) => record.annual_presence_status === 'confirmed').length,
    probable: records.filter((record) => record.annual_presence_status === 'probable').length,
  };
}

const anchorPairs = source.tenures.flatMap((tenure) => parseYears(tenure.master_fields['年内在任锚'])
  .map((year) => ({
    official_id: tenure.official_id,
    year,
    service: text(tenure.master_fields['履任状态']),
    role: text(tenure.master_fields['记录角色']),
    scope: text(tenure.master_fields['朝代范围']),
    level: text(tenure.master_fields['层级']),
  })))
  .filter((item) => !NOT_SERVED.has(item.service)
    && DISPLAY_ROLES.has(item.role)
    && CHEN_SCOPES.has(item.scope)
    && (COUNTY_LEVELS.has(item.level) || PREFECTURE_LEVELS.has(item.level)));
const missingAnchorPairs = anchorPairs.filter((anchor) => !annualRecords.some((record) => record.year === anchor.year && record.official_id === anchor.official_id));
const danyangByYear = targetYears.map((year) => ({
  year,
  records: years[String(year)].local_officers.filter((record) => record.place === '丹阳' && record.office.includes('丹阳尹'))
    .map((record) => ({ official_id: record.official_id, person: record.person, office: record.office, status: record.annual_presence_status })),
}));
const tests = [
  { id: 'A', label: '562年由全部有效任次重建', pass: newCounts(562).total > oldCounts(562).total && newCounts(562).prefecture >= 20, detail: { before: oldCounts(562), after: newCounts(562) } },
  { id: 'B', label: '563年由全部有效任次重建', pass: newCounts(563).total > oldCounts(563).total && newCounts(563).prefecture >= 15, detail: { before: oldCounts(563), after: newCounts(563) } },
  { id: 'C', label: '丹阳尹按主表结构化边界逐年投射', pass: danyangByYear.some((row) => row.records.length > 1) && danyangByYear.flatMap((row) => row.records).length >= 15, detail: { annual_rows: danyangByYear.flatMap((row) => row.records).length } },
  { id: 'D', label: '557—588明确在任锚点全部覆盖', pass: missingAnchorPairs.length === 0, detail: { anchor_pairs: anchorPairs.length, missing: missingAnchorPairs } },
  { id: 'E', label: '502条原始任次及全部追溯数据完整保留', pass: source.preservation.tenure_rows === 502 && source.preservation.distinct_official_ids === 502 && source.preservation.original_backup_rows === 501 && source.preservation.phase6_revision_rows === 11, detail: source.preservation },
  { id: 'F', label: '明确未履任任次无年度投射', pass: sourceDisposition.filter((row) => row.state === 'excluded_not_served').length === 21 && source.tenures.filter((tenure) => NOT_SERVED.has(text(tenure.master_fields['履任状态']))).every((tenure) => !annualRecords.some((record) => record.official_id === tenure.official_id)), detail: { excluded: sourceDisposition.filter((row) => row.state === 'excluded_not_served').length } },
  { id: 'G', label: '同地同年多任保留且不作唯一现任检查', pass: annualRecords.some((record, index) => annualRecords.some((other, otherIndex) => otherIndex > index && other.year === record.year && other.place === record.place && other.administrative_link.target_level === record.administrative_link.target_level)), detail: { multi_record_groups: new Set(annualRecords.map((record) => `${record.year}|${record.administrative_link.target_level}|${record.place}`).filter((key) => annualRecords.filter((record) => `${record.year}|${record.administrative_link.target_level}|${record.place}` === key).length > 1)).size } },
];
assert(tests.every((test) => test.pass), `Validation failed: ${tests.filter((test) => !test.pass).map((test) => test.id).join(', ')}`);

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(runtimeData, null, 2)}\n`, 'utf8');
fs.writeFileSync(scriptPath, `window.CHEN_LOCAL_OFFICIALS = ${JSON.stringify(runtimeData)};\n`, 'utf8');

const report = {
  generated_at: new Date().toISOString(),
  release_gate: tests.every((test) => test.pass) ? 'PASS' : 'FAIL',
  source: source.source,
  counts: {
    original_tenures: source.preservation.tenure_rows,
    effective_canonical_tenures: source.tenures.filter((tenure) => DISPLAY_ROLES.has(text(tenure.master_fields['记录角色']))).length,
    projectable_tenures: projectedTenures.length,
    unprojectable_tenures: dispositionCounts.unprojectable_no_annual_evidence ?? 0,
    excluded_not_served: dispositionCounts.excluded_not_served ?? 0,
    outside_chen_scope: dispositionCounts.outside_chen_scope ?? 0,
    aliases_preserved_not_displayed: dispositionCounts.alias_not_displayed ?? 0,
    annual_records: annualRecords.length,
    by_year: Object.fromEntries(targetYears.map((year) => [year, newCounts(year)])),
  },
  tests,
  test_a: { before: oldCounts(562), after: newCounts(562), records: years['562'].local_officers },
  test_b: { before: oldCounts(563), after: newCounts(563), records: years['563'].local_officers },
  test_c_danyang_yin: danyangByYear,
  test_d_anchor_coverage: { anchors: anchorPairs, missing: missingAnchorPairs },
  source_disposition: sourceDisposition,
};
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const tableRecord = (record) => `| ${record.display_order} | ${record.person} | ${record.office} | ${record.level} | ${record.annual_presence_status} | ${record.tenure_boundary_status} | ${record.administrative_link.attach_to_snapshot ? `${record.administrative_link.state_name}／${record.administrative_link.prefecture_name}${record.administrative_link.county_name ? `／${record.administrative_link.county_name}` : ''}` : `未连接：${record.administrative_link.link_status}`} | ${record.official_id} |`;
const countLine = (counts) => `总数 ${counts.total}；郡级 ${counts.prefecture}；县级 ${counts.county}；涉及郡县 ${counts.places}；confirmed ${counts.confirmed}；probable ${counts.probable}`;
const markdown = `# 南陈郡县地方长官年度投射验证报告

生成时间：${report.generated_at}

验证结果：**${report.release_gate}**

本次只按 \`master_officials_final.xlsx\` 已有结构化边界、在任锚点及人工逐年结论机械生成，不从史料正文新增任期判断。官员记录表示“本年曾任”，不表示该年最后时点仍在任。

## 数据保存与投射边界（测试E）

- 原始任次：${report.counts.original_tenures}
- 有效规范任次（别名除外）：${report.counts.effective_canonical_tenures}
- 可投射任次：${report.counts.projectable_tenures}
- 无法投射任次（缺少557—588年度信息）：${report.counts.unprojectable_tenures}
- 明确未履任排除：${report.counts.excluded_not_served}
- 非南陈或朝代未断言：${report.counts.outside_chen_scope}
- 仅作追溯、不重复显示的别名：${report.counts.aliases_preserved_not_displayed}
- 生成年度记录：${report.counts.annual_records}

全部502条任次、501条原始字段备份、232条变更日志、48条旧逐年选择记录和11条第六阶段定向修订均保留在源快照；旧选择记录不再控制网页发布。

## 562年（测试A）

- 修改前：${countLine(report.test_a.before)}
- 修改后：${countLine(report.test_a.after)}

| 顺序 | 人名 | 官职 | 层级 | 本年任职 | 任期边界 | 行政区划连接 | official_id |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${report.test_a.records.map(tableRecord).join('\n')}

## 563年（测试B）

- 修改前：${countLine(report.test_b.before)}
- 修改后：${countLine(report.test_b.after)}

| 顺序 | 人名 | 官职 | 层级 | 本年任职 | 任期边界 | 行政区划连接 | official_id |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${report.test_b.records.map(tableRecord).join('\n')}

## 丹阳尹557—588（测试C）

| 年 | 记录 |
| ---: | --- |
${danyangByYear.map((row) => `| ${row.year} | ${row.records.length ? row.records.map((record) => `${record.person}（${record.status}，${record.official_id}）`).join('；') : '—'} |`).join('\n')}

## 史料锚点（测试D）

- 557—588年有效明确在任锚：${anchorPairs.length}
- 漏投：${missingAnchorPairs.length}

## 各年记录数

| 年 | 总数 | 郡级 | 县级 | confirmed | probable |
| ---: | ---: | ---: | ---: | ---: | ---: |
${targetYears.map((year) => { const counts = report.counts.by_year[year]; return `| ${year} | ${counts.total} | ${counts.prefecture} | ${counts.county} | ${counts.confirmed} | ${counts.probable} |`; }).join('\n')}

## 机械测试

| ID | 检查 | 结果 |
| --- | --- | --- |
${tests.map((test) => `| ${test.id} | ${test.label} | ${test.pass ? 'PASS' : 'FAIL'} |`).join('\n')}
`;
fs.writeFileSync(reportMarkdownPath, markdown, 'utf8');

const files = [sourcePath, jsonPath, scriptPath, reportJsonPath, reportMarkdownPath].map((filePath) => ({
  path: path.relative(siteDir, filePath).replaceAll('\\', '/'),
  bytes: fs.statSync(filePath).size,
  sha256: sha256(fs.readFileSync(filePath)),
}));
const manifest = {
  schema_version: 'chen-local-officials-manifest-v1',
  generated_at: report.generated_at,
  source_master: { file: source.source.workbook, sha256: source.source.workbook_sha256 },
  files,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  status: 'PASS',
  counts: report.counts,
  test_a: report.test_a.after,
  test_b: report.test_b.after,
  anchors: { total: anchorPairs.length, missing: missingAnchorPairs.length },
  outputs: [...files.map((item) => item.path), path.relative(siteDir, manifestPath).replaceAll('\\', '/')],
}, null, 2));
