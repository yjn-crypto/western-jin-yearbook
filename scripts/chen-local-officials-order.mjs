// Order existing annual presences without deriving dates from historical prose.
// A display position is not a historical rank: unresolved ranks remain null.
const text = (value) => value == null ? '' : String(value).trim();
const numeric = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const idOf = (value) => text(value).replace(/^tenure:/, '');
const PRIORITY = {
  exact_date: 1,
  human_adjudicated: 2,
  predecessor_successor: 3,
  previous_year_continuity: 4,
  next_year_continuity: 5,
  existing_career_chain: 6,
};
const UNKNOWN_DATE = /约|約|以前|以後|以后|之前|之后|之後|前后|前後|待考|待核|未详|未詳|不详|不詳|\d[—–～~]\d|[一二三四五六七八九十]、[一二三四五六七八九十]|月[^；;]*[前后後]/;

function chineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '正' || value === '元') return 1;
  if (value === '冬') return 11;
  if (value === '腊' || value === '臘') return 12;
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value.includes('十')) {
    const [tens, units] = value.split('十');
    return (digits[tens] ?? 1) * 10 + (digits[units] ?? 0);
  }
  return digits[value] ?? null;
}

function dateFromValue(value, fallbackYear, source, role) {
  if (value && typeof value === 'object') {
    if (value.confirmed === false || ['probable', 'unknown', 'unresolved'].includes(value.status ?? value.confidence)) return null;
    const year = numeric(value.year ?? value.gregorian_year ?? fallbackYear);
    const month = numeric(value.month);
    const day = numeric(value.day);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || (day !== null && (day < 1 || day > 31))) return null;
    return { year, month, day, leap: Boolean(value.leap_month), calendar: value.calendar ?? 'gregorian', role, label: value.label ?? `${year}/${month}${day ? `/${day}` : ''}`, source };
  }
  const label = text(value);
  if (!label || UNKNOWN_DATE.test(label)) return null;
  const iso = label.match(/(?<!\d)(\d{3,4})-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/);
  if (iso) return dateFromValue({ year: Number(iso[1]), month: Number(iso[2]), day: iso[3] ? Number(iso[3]) : null, label }, fallbackYear, source, role);
  const month = label.match(/(闰|閏)?([正冬腊臘一二三四五六七八九十\d]+)月/);
  if (!month) return null;
  const explicitYears = [...new Set((label.match(/(?<!\d)\d{3,4}(?!\d)/g) ?? []).map(Number))];
  if (explicitYears.length > 1) return null;
  const year = explicitYears[0] ?? fallbackYear;
  const monthNumber = chineseNumber(month[2]);
  if (!Number.isInteger(year) || !monthNumber || monthNumber > 12) return null;
  const suffix = label.slice(month.index + month[0].length);
  const day = suffix.match(/^(?:初)?([一二三四五六七八九十\d]+)日/);
  const cyclical = suffix.match(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/)?.[0] ?? null;
  return { year, month: monthNumber, day: day ? chineseNumber(day[1]) : null, sexagenary_day: cyclical, leap: Boolean(month[1]), calendar: 'historical_lunar', role, label, source };
}

function datesFor(tenure, year, diagnostics) {
  const main = tenure.master_fields ?? {};
  const backup = tenure.original_backup ?? {};
  const dates = [];
  for (const [role, lowerKey, upperKey, rawKey, structuredKeys] of [
    ['appointment', '起任下界', '起任上界', '原始_起始时间', ['appointment_date', '起任日期', '任命日期']],
    ['departure', '卸任或后官下界', '卸任或后官上界', '原始_结束时间', ['departure_date', '卸任日期', '迁任日期']],
  ]) {
    const lower = numeric(main[lowerKey]);
    const upper = numeric(main[upperKey]);
    const fallback = lower !== null && lower === upper ? lower : null;
    for (const [field, value] of [[rawKey, backup[rawKey]], ...structuredKeys.map((key) => [key, main[key] ?? tenure[key]])]) {
      const date = dateFromValue(value, fallback, `${tenure.official_id}:${field}`, role);
      if (!date || date.year !== year) continue;
      if ((lower !== null && date.year < lower) || (upper !== null && date.year > upper)) {
        diagnostics.push({ official_id: tenure.official_id, source: date.source, reason: '原始日期与主表现有裁决边界不一致，未据此排序' });
        continue;
      }
      dates.push(date);
    }
  }
  for (const field of ['date_anchors', 'time_anchors', 'annual_anchors']) {
    for (const anchor of tenure[field] ?? []) {
      const role = /appointment|任命|起任/.test(anchor.type ?? '') ? 'appointment'
        : /departure|卸任|迁任/.test(anchor.type ?? '') ? 'departure' : 'sighting';
      const date = dateFromValue(anchor, null, `${tenure.official_id}:${field}:${anchor.id ?? ''}`, role);
      if (date?.year === year) dates.push(date);
    }
  }
  for (const edge of tenure.relation_links ?? []) {
    if (edge.type !== 'ANCHORED_BY') continue;
    const f = edge.related_node?.source_fields ?? {};
    const adoption = text(f['采用结论'] ?? edge.adoption_text);
    if (!adoption || /^(不采|保留.*未履)/.test(adoption)) continue;
    const functionText = text(f['对任期的夹逼作用']);
    const role = /(?:确定|确立).*(?:终点|任终点)/.test(functionText) ? 'departure'
      : /(?:确认|确立|确定).*(?:起点|起年)|^起点互证/.test(functionText) ? 'appointment'
        : /地方直载|地方兼领|中央兼地方/.test(text(f['类型'])) ? 'sighting' : null;
    if (!role) continue;
    const date = dateFromValue(f['纪年'], numeric(f['公元']), `${tenure.official_id}:职业链:${edge.id}`, role);
    if (!date || date.year !== year) continue;
    const lower = numeric(main[role === 'departure' ? '卸任或后官下界' : '起任下界']);
    const upper = numeric(main[role === 'appointment' ? '起任上界' : '卸任或后官上界']);
    if ((lower !== null && date.year < lower) || (upper !== null && date.year > upper)) {
      diagnostics.push({ official_id: tenure.official_id, source: date.source, reason: '旧职业链时间与最终主表边界不一致，保留追溯而不覆盖裁决' });
      continue;
    }
    dates.push(date);
  }
  return dates;
}

function compareDates(left, right) {
  if (left.calendar !== right.calendar || left.year !== right.year) return null;
  if (left.month !== right.month) return Math.sign(left.month - right.month);
  if (left.leap !== right.leap) return left.leap ? 1 : -1;
  if (left.day !== null && right.day !== null) return Math.sign(left.day - right.day);
  if (left.sexagenary_day && left.sexagenary_day === right.sexagenary_day) return 0;
  return null;
}

function hasPath(graph, from, to, visited = new Set()) {
  if (from === to) return true;
  if (visited.has(from)) return false;
  visited.add(from);
  return [...(graph.get(from) ?? [])].some((next) => hasPath(graph, next, to, visited));
}

function graphFor(ids, constraints) {
  const graph = new Map(ids.map((id) => [id, new Set()]));
  for (const edge of constraints) graph.get(edge.from)?.add(edge.to);
  return graph;
}

function pairKey(left, right) { return [left, right].sort().join('|'); }

function acceptedRelation(edge) {
  if (edge.historical_claim === false || /UNRESOLVED/.test(edge.type ?? '')) return false;
  return edge.historical_claim === true || edge.adjudicated === true || edge.confirmed === true
    || ['confirmed', 'human_adjudicated'].includes(edge.status ?? edge.quality);
}

/** Returns per-year/place reports; mutates only annual ordering fields. */
export function orderAnnualRecords(annualRecords, sourceTenures, groupKey) {
  const tenures = new Map(sourceTenures.map((tenure) => [tenure.official_id, tenure]));
  const aliases = new Map();
  for (const tenure of sourceTenures) {
    for (const id of [tenure.official_id, tenure.source_timeline_id, tenure.master_fields?.['源年表ID']]) {
      if (!id) continue;
      if (!aliases.has(idOf(id))) aliases.set(idOf(id), new Set());
      aliases.get(idOf(id)).add(tenure.official_id);
    }
  }
  const byYearPlace = new Map();
  for (const record of annualRecords) {
    const key = `${record.year}|${groupKey(record)}`;
    if (!byYearPlace.has(key)) byYearPlace.set(key, []);
    byYearPlace.get(key).push(record);
  }
  const reports = [];
  for (const [key, records] of byYearPlace) {
    const year = records[0].year;
    const placeKey = groupKey(records[0]);
    const ids = records.map((record) => record.official_id);
    const idsSet = new Set(ids);
    const lookup = new Map(records.map((record) => [record.official_id, record]));
    const constraints = [];
    const ignored = [];
    const concurrent = new Set();
    const dates = new Map(ids.map((id) => [id, datesFor(tenures.get(id) ?? { official_id: id }, year, ignored)]));
    const add = (from, to, status, label, source) => {
      if (from === to || !idsSet.has(from) || !idsSet.has(to)) return;
      constraints.push({ from, to, status, priority: PRIORITY[status], label, source });
    };
    const resolve = (id) => [...(aliases.get(idOf(id)) ?? new Set([idOf(id)]))].filter((candidate) => idsSet.has(candidate));
    const seenRelations = new Set();
    for (const id of ids) {
      const tenure = tenures.get(id) ?? {};
      for (const edge of [...(tenure.relation_links ?? []), ...(tenure.succession_links ?? []), ...(tenure.career_links ?? [])]) {
        const edgeKey = edge.id ?? `${edge.type}|${edge.from}|${edge.to}`;
        if (seenRelations.has(edgeKey)) continue;
        seenRelations.add(edgeKey);
        const fromIds = resolve(edge.from);
        const toIds = resolve(edge.to);
        if (!fromIds.length || !toIds.length) continue;
        if (!acceptedRelation(edge)) {
          ignored.push({ relation_id: edge.id, reason: '既有候选关系未作历史断言，不用于确定年内先后' });
          continue;
        }
        if (/CONCURRENT|CO_SERVING|同时|同時|并任|並任/.test(edge.type ?? '')) {
          for (const from of fromIds) for (const to of toIds) concurrent.add(pairKey(from, to));
          continue;
        }
        if (!/PREDECESSOR|SUCCESSOR|NEXT_RECORDED|CAREER_ORDER|前任|继任/.test(edge.type ?? '')) continue;
        const human = edge.adjudicated === true || /human|manual|人工/.test(edge.provenance ?? '') || edge.status === 'human_adjudicated';
        const status = human ? 'human_adjudicated' : /PREDECESSOR|SUCCESSOR|前任|继任/.test(edge.type ?? '') ? 'predecessor_successor' : 'existing_career_chain';
        for (const from of fromIds) for (const to of toIds) add(from, to, status, edge.order_basis ?? edge.label ?? '据既有明确前后任或职业链关系排列。', edge.id ?? edgeKey);
      }
      const main = tenure.master_fields ?? {};
      for (const [field, direction, human] of [
        ['人工前任ID', 'before', true], ['人工继任ID', 'after', true],
        ['前任official_id', 'before', false], ['继任official_id', 'after', false],
      ]) {
        for (const reference of text(main[field]).split(/[；;,\s]+/).filter(Boolean)) {
          for (const other of resolve(reference)) add(direction === 'before' ? other : id, direction === 'before' ? id : other,
            human ? 'human_adjudicated' : 'predecessor_successor', '据主表已有明确前后任字段排列。', `${id}:${field}`);
        }
      }
      if (tenure.concurrent_with_confirmed === true || main['并任已确认'] === true) {
        for (const other of tenure.concurrent_with ?? text(main['并任official_id']).split(/[；;,\s]+/)) {
          for (const resolved of resolve(other)) concurrent.add(pairKey(id, resolved));
        }
      }
    }
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const left = ids[leftIndex]; const right = ids[rightIndex];
        for (const leftDate of dates.get(left)) for (const rightDate of dates.get(right)) {
          const comparison = compareDates(leftDate, rightDate);
          if (comparison === null) continue;
          let direction = null;
          if (leftDate.role === rightDate.role && comparison !== 0) direction = comparison;
          else if (leftDate.role === 'departure' && rightDate.role === 'appointment' && comparison <= 0) direction = -1;
          else if (leftDate.role === 'appointment' && rightDate.role === 'departure' && comparison >= 0) direction = 1;
          if (direction === null) continue;
          const from = direction < 0 ? left : right; const to = direction < 0 ? right : left;
          add(from, to, 'exact_date', `据已有时间“${leftDate.label}”与“${rightDate.label}”，${lookup.get(from).person ?? from}列于${lookup.get(to).person ?? to}之前。`, [leftDate.source, rightDate.source]);
        }
      }
    }
    const prior = new Set((byYearPlace.get(`${year - 1}|${placeKey}`) ?? []).map((record) => record.official_id));
    const next = new Set((byYearPlace.get(`${year + 1}|${placeKey}`) ?? []).map((record) => record.official_id));
    const fromPrior = ids.filter((id) => prior.has(id));
    const intoNext = ids.filter((id) => next.has(id));
    if (fromPrior.length === 1) for (const id of ids.filter((candidate) => !prior.has(candidate))) {
      add(fromPrior[0], id, 'previous_year_continuity', '据上年仍见任，列在本年新见任者之前。', `${year - 1}|${placeKey}|${fromPrior[0]}`);
    }
    if (intoNext.length === 1) for (const id of ids.filter((candidate) => !next.has(candidate))) {
      add(id, intoNext[0], 'next_year_continuity', '次年仍由此人任职，列在本年不再延续者之后。', `${year + 1}|${placeKey}|${intoNext[0]}`);
    }
    const accepted = [];
    // Resolve each evidence tier together; equal-tier contradictions must not be
    // decided by input order or IDs. Lower tiers cannot reverse higher tiers.
    for (const priority of Object.values(PRIORITY)) {
      const higherGraph = graphFor(ids, accepted);
      const tier = constraints.filter((edge) => edge.priority === priority).filter((edge) => {
        const reason = concurrent.has(pairKey(edge.from, edge.to)) ? '既有明确并任，未强制形成前后顺序'
          : hasPath(higherGraph, edge.to, edge.from) ? '低优先级约束与已采用的高优先级依据相反，未采用' : null;
        if (reason) ignored.push({ ...edge, reason });
        return !reason;
      });
      const tierGraph = graphFor(ids, [...accepted, ...tier]);
      for (const edge of tier) {
        if (hasPath(tierGraph, edge.to, edge.from)) ignored.push({ ...edge, reason: '同优先级依据形成循环，保留待判断而不按ID裁决' });
        else if ([...concurrent].some((pair) => {
          const [left, right] = pair.split('|');
          return (hasPath(tierGraph, left, edge.from) && hasPath(tierGraph, edge.to, right))
            || (hasPath(tierGraph, right, edge.from) && hasPath(tierGraph, edge.to, left));
        })) ignored.push({ ...edge, reason: '该约束间接强迫明确并任者分成先后，未采用' });
        else accepted.push(edge);
      }
    }
    const graph = graphFor(ids, accepted);
    const stableCompare = (left, right) => (numeric(tenures.get(left)?.source_row) ?? Number.MAX_SAFE_INTEGER)
      - (numeric(tenures.get(right)?.source_row) ?? Number.MAX_SAFE_INTEGER)
      || left.localeCompare(right, 'en', { numeric: true });
    const display = [];
    const remaining = new Set(ids);
    while (remaining.size) {
      const available = [...remaining].filter((id) => ![...remaining].some((other) => other !== id && graph.get(other)?.has(id))).sort(stableCompare);
      const chosen = available[0];
      if (!chosen) throw new Error(`Unexpected annual ordering cycle: ${key}`);
      display.push(chosen); remaining.delete(chosen);
    }
    for (const [index, id] of display.entries()) {
      const record = lookup.get(id);
      const before = ids.filter((other) => other !== id && hasPath(graph, other, id));
      const after = ids.filter((other) => other !== id && hasPath(graph, id, other));
      const concurrentWith = ids.filter((other) => other !== id && concurrent.has(pairKey(id, other)));
      const determined = concurrentWith.length === 0 && before.length + after.length === ids.length - 1;
      const contributing = accepted.filter((edge) => edge.from === id || edge.to === id || hasPath(graph, edge.to, id) || hasPath(graph, id, edge.from));
      const statuses = new Set(contributing.map((edge) => edge.status));
      const strongest = [...statuses].sort((left, right) => PRIORITY[left] - PRIORITY[right])[0];
      const status = records.length === 1 ? 'single_record' : concurrentWith.length ? 'concurrent' : !determined ? 'unresolved'
        : statuses.has('previous_year_continuity') && statuses.has('next_year_continuity') && PRIORITY[strongest] >= 4 ? 'combined_adjacent_years'
          : strongest ?? 'unresolved';
      const basis = contributing.map(({ status: basisStatus, label, source, from, to }) => ({ type: basisStatus, label, source, from_official_id: from, to_official_id: to }));
      const note = status === 'single_record' ? '' : status === 'concurrent' ? '现有记录明确并任，不强制区分前后。'
        : status === 'unresolved' ? `年内先后未详${contributing.length ? '；现有依据仅能确定部分先后关系。' : '；缺少可比较日期、明确前后任及唯一相邻年延续依据。'}`
          : status === 'combined_adjacent_years' ? '综合上年延续与次年延续记录，排列本年先后。'
            : status === 'previous_year_continuity' ? '据上年延续任职者在前，排列本年顺位。'
              : status === 'next_year_continuity' ? '据次年延续任职者在后，排列本年顺位。'
                : contributing.find((edge) => edge.status === strongest)?.label ?? '';
      Object.assign(record, {
        intra_year_order: determined ? before.length + 1 : null,
        intra_year_order_status: status,
        intra_year_order_basis: basis,
        intra_year_order_note: note,
        group_display_order: index + 1,
      });
    }
    const exactIds = ids.filter((id) => dates.get(id).length);
    const unresolvedIds = ids.filter((id) => lookup.get(id).intra_year_order_status === 'unresolved');
    const unresolvedReasons = unresolvedIds.length ? [...new Set([
      exactIds.length < records.length ? '并非所有任次均有同年可直接比较的明确月日' : null,
      fromPrior.length !== 1 ? '上年延续者非唯一' : null,
      intoNext.length !== 1 ? '次年延续者非唯一' : null,
      ignored.some((edge) => edge.reason.includes('未作历史断言')) ? '既有关系簇仅为机械候选，不是明确前后任裁决' : null,
      ignored.some((edge) => edge.reason.includes('循环')) ? '同优先级顺序依据冲突' : null,
    ].filter(Boolean))] : [];
    reports.push({
      year, key: placeKey, group_key: placeKey, place: records[0].place, record_count: records.length,
      resolved: unresolvedIds.length === 0 && !concurrent.size,
      partial: unresolvedIds.length > 0 && accepted.length > 0,
      unresolved_reason: unresolvedReasons.join('；'),
      exact_date_edges: accepted.filter((edge) => edge.status === 'exact_date'),
      fully_ordered: unresolvedIds.length === 0 && !concurrent.size,
      partially_ordered: unresolvedIds.length > 0 && accepted.length > 0,
      concurrent: concurrent.size > 0,
      exact_date_record_count: exactIds.length,
      exact_date_comparable: accepted.some((edge) => edge.status === 'exact_date'),
      accepted_constraints: accepted,
      ignored_constraints: ignored,
      unresolved_reasons: unresolvedReasons,
      records: display.map((id) => ({ official_id: id, person: lookup.get(id).person, intra_year_order: lookup.get(id).intra_year_order,
        intra_year_order_status: lookup.get(id).intra_year_order_status, group_display_order: lookup.get(id).group_display_order })),
    });
  }
  return reports;
}

/** Small optional fixtures; importing this module does not run checks. */
export function runAnnualOrderFixtures() {
  const fixture = (name, presences, times, expected, expectation = {}) => {
    const ids = [...new Set(presences.flatMap(([, people]) => people))];
    const source = ids.map((id, index) => ({ official_id: id, source_row: index + 1,
      master_fields: times[id]?.master_fields ?? {}, original_backup: times[id]?.original_backup ?? {}, relation_links: times[id]?.relation_links ?? [] }));
    const rows = presences.flatMap(([year, people]) => people.map((id) => ({ year, official_id: id, person: id, place: '测试郡' })));
    const groups = orderAnnualRecords(rows, source, () => 'prefecture|fixture');
    const selected = rows.filter((row) => row.year === 562).sort((left, right) => left.group_display_order - right.group_display_order);
    const actual = selected.map((row) => row.official_id);
    const ranks = selected.map((row) => row.intra_year_order);
    return { name, pass: JSON.stringify(actual) === JSON.stringify(expected)
      && (expectation.unresolved ? selected.every((row) => row.intra_year_order === null) : ranks.every((rank, index) => rank === index + 1)), actual, ranks, groups };
  };
  const exact = (role, date) => ({ master_fields: { [role === 'departure' ? 'departure_date' : 'appointment_date']: { year: 562, month: date, calendar: 'gregorian' } } });
  return [
    fixture('previous_year_continuity', [[561, ['甲']], [562, ['乙', '甲']]], {}, ['甲', '乙']),
    fixture('next_year_continuity', [[562, ['乙', '甲']], [563, ['乙']]], {}, ['甲', '乙']),
    fixture('combined_adjacent_years', [[561, ['甲']], [562, ['丙', '乙', '甲']], [563, ['丙']]], {}, ['甲', '乙', '丙']),
    fixture('exact_date_overrides_adjacent_year', [[561, ['乙']], [562, ['乙', '甲', '丙']], [563, ['甲']]],
      { 甲: exact('departure', 1), 乙: exact('appointment', 2), 丙: exact('appointment', 10) }, ['甲', '乙', '丙']),
    fixture('mechanical_candidate_is_not_historical_order', [[562, ['乙', '甲']]], {
      甲: { relation_links: [{ id: 'mechanical', type: 'PREDECESSOR_CANDIDATE', from: 'tenure:甲', to: 'tenure:乙', historical_claim: false }] },
    }, ['乙', '甲'], { unresolved: true }),
  ];
}
