(() => {
  'use strict';

  // Missing bounds stay missing: Number(null) must never become a year.
  const knownYear = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const within = (item, year) => Number.isFinite(year)
    && (!knownYear(item.start) || Number(item.start) <= year)
    && (!knownYear(item.end) || year <= Number(item.end));
  const isPosthumous = holder => Boolean(holder.posthumous) || /追封|追贈|追赠/.test(holder.time_text || '');
  const evidenceText = value => typeof value === 'string' ? value : value?.source || value?.quote || value?.label || '';
  const sourceOf = (holder, record) => [holder?.source, holder?.evidence, record?.source_title, record?.source_url]
    .flat().map(evidenceText).filter(Boolean).join('；');

  function resolveHolder(record, requestedYear) {
    const year = Number(requestedYear);
    const holders = record?.holders || [];
    const living = holders.filter(holder => !isPosthumous(holder));
    const previous = living.filter(holder => knownYear(holder.end) && Number(holder.end) < year)
      .sort((a, b) => Number(b.end) - Number(a.end));
    const following = living.filter(holder => knownYear(holder.start) && Number(holder.start) > year)
      .sort((a, b) => Number(a.start) - Number(b.start));
    const base = { status: 'uncertain', holder: null, prev: previous[0] || null, next: following[0] || null,
      candidates: [], posthumous: holders.filter(holder => isPosthumous(holder) && within(holder, year)),
      source: record?.source_title || record?.source_url || '', reason: '' };
    if (!Number.isFinite(year)) return { ...base, reason: '所選年份無效' };
    if (record?.phases?.length && !record.phases.some(phase => within(phase, year))) {
      return { ...base, status: 'inactive', reason: '所選年份不在此封國已知存續範圍內' };
    }

    // Mourning needs an explicit dated statement and its evidence. A three-year
    // numerical gap alone establishes neither death, kinship nor observance.
    const mourning = (record?.display_periods || []).filter(period => period.mourning
      && knownYear(period.start) && knownYear(period.end) && within(period, year)
      && (period.evidence || period.source));
    if (mourning.length === 1) {
      const period = mourning[0];
      return { ...base, status: 'mourning', holder: { person: period.person || '世子服喪' }, display: period,
        source: [period.source, period.evidence].flat().map(evidenceText).filter(Boolean).join('；'),
        reason: '依具有年份和出處的服喪記載顯示' };
    }

    const eligible = living.filter(holder => within(holder, year));
    const bounded = eligible.filter(holder => knownYear(holder.start) && knownYear(holder.end));
    if (bounded.length) {
      // Preserve multiple people documented in a changeover year. The annual
      // view cannot establish that the latest start is also the sole holder.
      const names = new Set(bounded.map(holder => holder.person));
      if (names.size > 1) return { ...base, candidates: bounded, reason: '本年有多名有界封君，年內交接次序另待考證' };
      const holder = bounded.find(item => !item.uncertain) || bounded[0];
      return { ...base, status: holder.uncertain ? 'uncertain' : 'exact', holder, candidates: bounded,
        source: sourceOf(holder, record), reason: holder.uncertain ? '起訖有界但原資料仍標存疑' : '' };
    }
    if (eligible.length === 1) {
      const holder = eligible[0];
      return { ...base, holder, candidates: eligible, source: sourceOf(holder, record),
        reason: '未越過已知起止界；缺失的一側年代仍未考定，本年僅作候選' };
    }
    return { ...base, candidates: eligible,
      reason: eligible.length ? '多名封君缺起訖，不能依資料排列選定其中一人' : '沒有符合已知起止界的在任封君；追封及歷任資料另予保留' };
  }

  window.LIANG_FIEF_RULES = { resolveHolder, within, knownYear, isPosthumous };
})();
