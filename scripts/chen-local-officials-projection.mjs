// Publication windows only. Never write dates or interpretations back to the master.
export const PROJECTION_METHODS = [
  'exact_interval', 'appointment_three_year_cap', 'departure_three_year_cap',
  'sighting_plus_minus_three', 'multiple_sighting_union', 'no_time_information_fallback',
];
const str = (value) => value == null ? '' : String(value).trim();
const num = (value) => value == null || str(value) === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const yearsIn = (value) => [...new Set((str(value).match(/(?<!\d)[45]\d{2}(?!\d)/g) || []).map(Number))];
const range = (a, b) => a == null || b == null || a > b ? []
  : Array.from({ length: Math.max(0, Math.min(588, b) - Math.max(557, a) + 1) }, (_, i) => Math.max(557, a) + i);
const displayRoles = new Set(['canonical', 'canonical_merged', 'canonical_split_part_1', 'derived_split_part_2']);
const scopes = new Set(['陈表', '跨朝含陈', '跨朝待分', '梁至陈受禅', '陈，地点未明']);
const levels = new Set(['郡级正任', '郡级代理', '郡级正任（待核）', '封国相（郡级）', '县级', '县级正任']);
const notServed = new Set(['baseline_not_served', 'appointed_not_served']);
const uncertainService = new Set(['appointed_service_unknown', 'nominal_or_uncertain', 'text_uncertain']);

export function temporalEvidence(tenure) {
  const m = tenure.master_fields;
  const sl = num(m['起任下界']), su = num(m['起任上界']);
  const el = num(m['卸任或后官下界']), eu = num(m['卸任或后官上界']);
  // A lone lower/upper bound is a constraint, not an appointment/departure event.
  // A wide unresolved interval is likewise not a dated event: retain it only in
  // the explicitly labelled no-time fallback when no more specific time exists.
  const event = (lo, hi, certainty, field) => lo !== null && hi !== null && lo <= hi
    && (lo === hi || ['confirmed', 'probable'].includes(certainty))
    ? { lower: lo, upper: hi, certainty, source_field: field } : null;
  const result = {
    start: event(sl, su, str(m['起任确定性']), '起任下界/起任上界'),
    end: event(el, eu, str(m['终止确定性']), '卸任或后官下界/卸任或后官上界'),
    lower: sl, upper: eu,
    anchors: yearsIn(m['年内在任锚']).map((year) => ({ year, strength: 'confirmed', source_field: '年内在任锚', source_value: str(m['年内在任锚']) })),
    manual: yearsIn(m['已采用年末年份']).map((year) => ({ year, strength: m['年末采用等级'] === 'confirmed' ? 'confirmed' : 'probable', source_field: '已采用年末年份', source_value: str(m['已采用年末年份']) })),
    excluded: yearsIn(m['明确排除年份']), constraints: [], ignored_time_evidence: [],
  };
  for (const decision of tenure.annual_decisions || []) {
    const year = num(decision.year);
    if (decision.presence === false) result.excluded.push(year);
    else if (decision.presence === true) result.manual.push({ year, strength: decision.confidence === 'confirmed' ? 'confirmed' : 'probable', source_field: 'annual_decisions', source_value: str(decision.adjudication_id) });
  }
  // Old false year-end approvals are deliberately NOT annual non-service decisions.
  for (const link of tenure.relation_links || []) {
    if (link.type !== 'ANCHORED_BY') continue;
    const f = link.related_node?.source_fields || {};
    const year = num(f['公元']);
    const adoption = str(f['采用结论'] || link.adoption_text);
    const role = str(f['对任期的夹逼作用']);
    if (year === null || !adoption || /^(不采|保留.*未履)/.test(adoption)) continue;
    const side = /(?:确认|確定|确定|确立|起点互证|起年压到).*(?:起点|起年)|^起点互证/.test(role) ? 'start'
      : /(?:确定|确立).*(?:终点|任终点)/.test(role) ? 'end' : null;
    // The relation graph predates the final master. Do not resurrect a conflicting
    // earlier proposal (including an explicitly rejected year) over the final row.
    if ((sl !== null && year < sl) || (eu !== null && year > eu) || /^不采/.test(adoption)) {
      result.ignored_time_evidence.push({ edge_id: link.id, year, reason: '既有关系锚与最终主表边界不一致，保留追溯而不覆盖主表' });
      continue;
    }
    const strength = /中等|较可能|候选/.test(adoption + role) ? 'probable' : 'confirmed';
    if (side && !result[side]) result[side] = { lower: year, upper: year, certainty: strength, source_field: `职业链锚:${link.id}` };
    if (side === 'start' || /地方直载|地方兼领|中央兼地方/.test(str(f['类型']))) {
      result.anchors.push({ year, strength, source_field: `职业链锚:${link.id}`, source_value: str(f['纪年']) });
    }
    if (side === 'end') result.constraints.push({ upper: year, type: 'adopted_career_departure', source: link.id, label: '既有已采用职业链终点' });
  }
  // Explicit structured constraints can be consumed without reading historical prose.
  for (const constraint of tenure.temporal_constraints || []) {
    if (constraint.confirmed !== true) continue;
    result.constraints.push({ ...constraint, lower: num(constraint.lower), upper: num(constraint.upper) });
  }
  const endText = str(tenure.original_backup?.['原始_结束时间']);
  if (result.end && result.end.lower === result.end.upper && yearsIn(endText).includes(result.end.upper)
    && /(?:以前|之前|年前)$/.test(endText)) {
    result.constraints.push({ upper: result.end.upper - 1, type: 'explicit_before_year', label: '原时间字段明确为该年以前', source: endText });
  }
  return result;
}

function definiteRelation(link) {
  return link.confirmed === true || link.historical_claim === true
    || ['human_adjudicated', 'confirmed', 'predecessor_successor'].includes(link.order_status);
}

export function projectTenure(tenure, sourceTenures = []) {
  const m = tenure.master_fields;
  const empty = (state) => ({ state, records: [], projection_method: null, constraints: [], ignored_time_evidence: [] });
  if (!displayRoles.has(str(m['记录角色']))) return empty('alias_not_displayed');
  if (notServed.has(str(m['履任状态']))) return empty('excluded_not_served');
  if (!scopes.has(str(m['朝代范围']))) return empty('outside_chen_scope');
  if (!levels.has(str(m['层级']))) return empty('unsupported_level');
  const e = temporalEvidence(tenure);
  const sourceById = new Map(sourceTenures.flatMap((t) => [[t.official_id, t], [t.source_timeline_id, t]]));
  for (const link of tenure.relation_links || []) {
    if (!definiteRelation(link)) continue;
    const target = sourceById.get(str(link.related_node?.id).replace(/^tenure:/, ''));
    if (!target) continue;
    const t = temporalEvidence(target);
    const incoming = link.direction === 'incoming';
    if (link.type === 'PREDECESSOR_CANDIDATE' || link.type === 'PREDECESSOR_SUCCESSOR') {
      if (!incoming && t.start?.certainty === 'confirmed') e.constraints.push({ upper: t.start.upper, type: 'confirmed_successor', source: link.id, label: '确定继任者已上任；交接年可并列' });
      if (incoming && t.end?.certainty === 'confirmed') e.constraints.push({ lower: t.end.lower, type: 'confirmed_predecessor', source: link.id, label: '确定前任的卸任边界' });
    } else if (link.type === 'NEXT_RECORDED_LOCAL_TENURE' && link.mutually_exclusive === true) {
      if (!incoming && t.start) e.constraints.push({ upper: t.start.upper, type: 'exclusive_next_role', source: link.id, label: '现有明确互斥职业起点' });
      if (incoming && t.end) e.constraints.push({ lower: t.end.lower, type: 'exclusive_previous_role', source: link.id, label: '现有明确互斥职业终点' });
    }
  }
  const presence = [...e.anchors, ...e.manual];
  const points = [...new Set(presence.map((p) => p.year))].sort((a, b) => a - b);
  let method, candidates;
  if (e.start && e.end) {
    method = 'exact_interval'; candidates = range(e.start.lower, e.end.upper);
  } else if (e.start) {
    method = 'appointment_three_year_cap'; candidates = range(e.start.lower, e.start.upper + 2);
  } else if (e.end) {
    method = 'departure_three_year_cap'; candidates = range(e.end.lower - 2, e.end.upper);
  } else if (points.length) {
    method = points.length > 1 ? 'multiple_sighting_union' : 'sighting_plus_minus_three';
    candidates = [...new Set(points.flatMap((year) => range(year - 3, year + 3)))];
  } else {
    method = 'no_time_information_fallback';
    // Retain only the existing normalized envelope; never recover superseded dates
    // from backup columns or invent a default reign-wide range.
    candidates = e.constraints.length ? [] : range(e.lower, e.upper);
  }
  if (str(m['朝代范围']) === '跨朝待分') candidates = [];
  const constraints = [
    ...(e.lower === null ? [] : [{ lower: e.lower, type: 'master_start_lower', label: '主表起任下限' }]),
    ...(e.upper === null ? [] : [{ upper: e.upper, type: 'master_end_upper', label: '主表终止上限' }]),
    ...e.constraints,
  ];
  const allowed = (year) => constraints.every((c) => (c.lower == null || year >= c.lower) && (c.upper == null || year <= c.upper));
  const basis = new Map();
  const add = (year, item) => {
    if (!Number.isInteger(year) || year < 557 || year > 588 || e.excluded.includes(year)) return;
    if (!basis.has(year)) basis.set(year, []);
    basis.get(year).push(item);
  };
  for (const year of candidates.filter(allowed)) {
    const inConfirmedInterval = method === 'exact_interval' && e.start.certainty === 'confirmed'
      && e.end.certainty === 'confirmed' && year >= e.start.upper && year <= e.end.lower
      && !uncertainService.has(m['履任状态']) && m['履任状态'] !== 'former';
    add(year, { type: method, label: method === 'exact_interval' ? '已有双边任期范围' : method === 'no_time_information_fallback'
      ? '无可用事件时间，沿用主表宽泛边界（待补时间信息）' : '在三年最大窗口内推定本年任职',
      strength: inConfirmedInterval ? 'confirmed' : 'probable', source_field: '现有时间证据与边界',
      source_value: JSON.stringify({ start: e.start, end: e.end, presence_years: points }), window_only: !inConfirmedInterval });
  }
  for (const [side, event] of [['start', e.start], ['end', e.end]]) {
    if (!event || event.lower !== event.upper || !allowed(event.lower)) continue;
    if (side === 'end' && m['履任状态'] === 'former') continue;
    add(event.lower, { type: side === 'start' ? 'explicit_appointment_year' : 'explicit_departure_year',
      label: side === 'start' ? '已有起任事件年份' : '已有卸任事件年份',
      strength: event.certainty === 'confirmed' && !uncertainService.has(m['履任状态']) ? 'confirmed' : 'probable',
      source_field: event.source_field, source_value: String(event.lower) });
  }
  // Rule 0 wins over inferred windows and constraints, but explicit exclusions win.
  for (const point of e.anchors) add(point.year, { type: 'explicit_in_year_anchor', label: '现有明确在任锚点', ...point });
  for (const point of e.manual) add(point.year, { type: 'existing_manual_annual_decision', label: '既有人工逐年结论', ...point });
  const records = [...basis].sort(([a], [b]) => a - b).map(([year, annual_presence_basis]) => ({
    year, projection_method: method, three_year_window_is_cap: true,
    annual_presence_status: annual_presence_basis.some((b) => b.strength === 'confirmed') ? 'confirmed' : 'probable',
    annual_presence_basis, projection_constraints: constraints,
  }));
  return { state: records.length ? 'projected' : 'unprojectable_no_annual_evidence', records,
    projection_method: method, constraints, ignored_time_evidence: e.ignored_time_evidence,
    excluded_years: e.excluded, rule0_outside_constraints: presence.filter((p) => !allowed(p.year)),
    possible_start_window_width: e.start ? e.start.upper - e.start.lower + 1 : null,
    possible_end_window_width: e.end ? e.end.upper - e.end.lower + 1 : null };
}

export function projectionExamples() {
  const fixture = (fields, extra = {}) => ({ official_id: 'fixture', master_fields: { '记录角色': 'canonical', '朝代范围': '陈表', '层级': '郡级正任', ...fields }, ...extra });
  const start = { '起任下界': 562, '起任上界': 562, '起任确定性': 'confirmed' };
  const end = { '卸任或后官下界': 562, '卸任或后官上界': 562, '终止确定性': 'confirmed' };
  return [
    ['A', fixture(start), [562, 563, 564]],
    ['B', fixture(end), [560, 561, 562]],
    ['C', fixture({ '年内在任锚': '562' }), [559, 560, 561, 562, 563, 564, 565]],
    ['D', fixture({ ...start, ...end, '卸任或后官下界': 563, '卸任或后官上界': 563 }), [562, 563]],
    ['E', fixture({ '年内在任锚': '562' }, { temporal_constraints: [{ confirmed: true, upper: 563, type: 'confirmed_successor' }] }), [559, 560, 561, 562, 563]],
    ['multiple', fixture({ '年内在任锚': '560；570' }), [557, 558, 559, 560, 561, 562, 563, 567, 568, 569, 570, 571, 572, 573]],
    ['exclusion', fixture({ ...start, '明确排除年份': '563' }), [562, 564]],
    ['cap_intersection', fixture({ ...start, '卸任或后官上界': 563 }), [562, 563]],
  ].map(([id, input, expected]) => ({ id, expected, actual: projectTenure(input).records.map((r) => r.year) }));
}
