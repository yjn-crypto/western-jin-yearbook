(() => {
  'use strict';
  const text = value => String(value || '').replace(/^#+\s*/, '').trim();
  const normalize = value => text(value).replace(/[\s·]/g, '').replace(/陈/g, '陳').replace(/萧/g, '蕭');
  const endOfTenure = /(?:遷|迁|徵|征還|征还|入朝|入為|入爲|入为|免|罷|罢|解職|解职|去職|去职|卒|薨|被殺|被杀|賜死|赐死|未拜|未任|未就|未行|未之任|奔|叛|反)/;
  const hasOffice = /都督|(?:^|[、，,\s])督|刺史|太守|內史|内史|尹|監|监/;
  const hasTitle = /將軍|将军|刺史|都督|太守|內史|内史|侍中|司空|司徒|大夫|開府|开府|持節|持节|監|监|中郎將|中郎将/;
  let liangRoyalLabels;

  function personAtStart(line, year, dynasty) {
    const value = text(line);
    if (dynasty === 'chen') {
      const match = window.CHEN_PERSON_FORMATS?.matches(value, year).find(item => item.index === 0);
      if (match) return { key: normalize(match.person.name), label: match.text, rest: value.slice(match.length).trim() };
    } else {
      const candidates = [];
      for (const person of window.LIANG_PERSON_COLORS?.people || []) {
        for (const alias of [person.name, ...(person.aliases || [])]) {
          if (alias && value.startsWith(alias)) candidates.push({ key: normalize(person.name), label: alias, rest: value.slice(alias.length).trim() });
        }
      }
      if (candidates.length) return candidates.sort((a, b) => b.label.length - a.label.length)[0];
      // Some Liang princes are absent from the colour table. Learn only their
      // explicitly separated royal labels from the governor source itself, so
      // a later OCR line without a space can still retain the same identity.
      if (!liangRoyalLabels) {
        const labels = new Set();
        for (const row of Object.values(window.LIANG_GOVERNORS?.years || {})) for (const record of row.records || []) {
          for (const entry of record.summary_lines || []) {
            const label = text(entry).match(/^([\p{Script=Han}]{1,5}王[\p{Script=Han}]{1,3})(?=\s|$)/u)?.[1];
            if (label) labels.add(label);
          }
        }
        liangRoyalLabels = [...labels].sort((a, b) => b.length - a.length);
      }
      const royal = liangRoyalLabels.find(label => value.startsWith(label));
      if (royal) return { key: normalize(royal), label: royal, rest: value.slice(royal.length).trim() };
    }
    // Without a known identity, only accept an explicitly separated name.
    // Never guess where a continuous OCR string's name ends.
    const separated = value.match(/^([\p{Script=Han}]{2,8})(?:\s+|$)/u);
    if (!separated || /將軍|将军|都督|刺史|太守|按|遷|迁|未|卒|薨/.test(separated[1])) return null;
    return { key: normalize(separated[1]), label: separated[1], rest: value.slice(separated[1].length).trim() };
  }

  function yearLabel(data, year) {
    const raw = data?.year_labels?.[year] || data?.years?.[year]?.label || data?.years?.[year]?.raw_heading;
    return raw?.match(/^.*?[（(]\d{3}[）)]/)?.[0] || `公元 ${year} 年`;
  }

  function references(record, line, year, data, dynasty) {
    const person = personAtStart(line, year, dynasty);
    if (!person || hasOffice.test(person.rest)) return [];
    const found = [];
    const years = Object.keys(data?.years || {}).map(Number).filter(value => value < year).sort((a, b) => b - a);
    let nextYear = year;
    for (const previousYear of years) {
      // A missing year or missing person interrupts the same-office chain.
      if (previousYear !== nextYear - 1) break;
      nextYear = previousYear;
      const sameState = (data.years[previousYear].records || []).filter(item => normalize(item.state) === normalize(record.state)
        && (!record.target_id || !item.target_id || record.target_id === item.target_id));
      const candidates = [];
      for (const previous of sameState) for (const previousLine of previous.summary_lines || []) {
        const identity = personAtStart(previousLine, previousYear, dynasty);
        if (identity?.key === person.key) candidates.push({ previous, line: text(previousLine), identity });
      }
      const unique = [...new Map(candidates.map(item => [item.line, item])).values()];
      // The book also leaves an explicitly present state row wholly blank.
      // Traverse that omission only while a current named officer anchors the
      // lookup; this never creates a new present-year officer from old data.
      if (!unique.length && sameState.length && sameState.every(item => !(item.summary_lines || []).some(text))) continue;
      if (unique.length !== 1) break;
      const candidate = unique[0];
      if (endOfTenure.test(candidate.identity.rest)) break;
      if (!hasTitle.test(candidate.identity.rest)) continue;
      found.push({
        year: previousYear, yearLabel: yearLabel(data, previousYear), state: candidate.previous.state,
        line: candidate.line, person: person.label,
        evidence: [...(candidate.previous.evidence_lines || [])],
        pages: [...new Set([...(candidate.previous.source_page_indexes || []), candidate.previous.source_page_index].filter(Boolean))],
        kind: hasOffice.test(candidate.identity.rest) ? 'office' : 'amendment',
      });
      if (hasOffice.test(candidate.identity.rest)) break;
    }
    return found;
  }

  window.GOVERNOR_HISTORY = { references, personAtStart, yearLabel };
})();
