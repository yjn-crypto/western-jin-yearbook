(() => {
  'use strict';
  const cache = new Map();
  const text = value => value == null ? '' : String(value);
  const comparableState = value => text(value).replace(/[\s/／]/g, '').replace(/州$/, '');
  const stateMatches = (source, requested) => source === requested || source.split(/[\/／]/).some(value => comparableState(value) === comparableState(requested));
  const fontKeys = ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecorationLine', 'textDecorationStyle', 'verticalAlign', 'backgroundColor'];
  const fontOnly = style => Object.fromEntries(fontKeys.filter(key => style?.[key] !== undefined).map(key => [key, style[key]]));
  // Excel may split identically styled text into different runs in two cells.
  // Compare character styles, not that incidental run segmentation.
  const signature = payload => JSON.stringify((payload.runs || []).flatMap(run => {
    const style = fontOnly({ ...payload.style, ...run.style });
    return [...run.text].map(character => [character, style]);
  }));

  function registry(year) {
    if (cache.has(year)) return cache.get(year);
    const people = new Map();
    const add = (name, aliases = []) => {
      if (!/^[\p{Script=Han}]{2,4}$/u.test(name || '') || /[郡州國]|[王侯公]$/.test(name)) return;
      if (!people.has(name)) people.set(name, { name, aliases: new Set([name]), sources: [] });
      aliases.filter(Boolean).forEach(alias => people.get(name).aliases.add(alias));
    };
    for (const record of window.CHEN_FIEFS?.records || []) for (const holder of record.holders || []) {
      const aliases = [];
      if (/^[陳陈]/.test(holder.person || '')) for (const phase of record.phases || []) {
        for (const rank of new Set([record.rank, '王', '嗣王', '郡王', '侯', '公'])) {
          aliases.push(`${phase.fief}${rank}${holder.person.slice(1)}`);
          aliases.push(`${phase.fief}${rank}${holder.person}`);
        }
      }
      add(holder.person, aliases);
    }
    for (const tenure of Object.values(window.CHEN_LOCAL_OFFICIALS?.tenures_by_id || {})) add(tenure.person);
    const addLineNames = line => {
      for (const segment of text(line).split(/[\n\r；;]| {2,}/)) {
        const name = segment.trim()
          .replace(/^(?:閏?[一二三四五六七八九十正冬臘\d]+月[，,\s]*)+/u, '')
          .replace(/^(?:梁)?[\p{Script=Han}]{1,8}(?:王|侯|公)(?=[陳陈蕭萧])/u, '')
          .replace(/^[\p{Script=Han}]{1,5}州刺史/u, '')
          .split(/[\s，,。；;：:（）()\[\]、]|閏?[一二三四五六七八九十正冬臘\d]+月|都督|刺史|將軍|長史|司馬|司空|帥軍|進號|徵還|遷|轉|卸|未|為|爲|監|攝|督|鎮|卒|薨|入|反|奔|降|被殺|次年/u)[0];
        add(name);
      }
    };
    for (const row of window.CHEN_YEARBOOK_FORMATS?.rows || []) for (const cell of [...row.cells, row.auxiliary, row.appendix]) addLineNames(cell?.text);
    for (const row of Object.values(window.CHEN_GOVERNORS?.years || {})) for (const record of row.records || []) for (const line of record.summary_lines || []) addLineNames(line);

    const find = value => {
      const found = [];
      for (const person of people.values()) for (const alias of person.aliases) {
        let offset = 0, index;
        while ((index = value.indexOf(alias, offset)) !== -1) {
          found.push({ person, index, length: alias.length, text: alias });
          offset = index + alias.length;
        }
      }
      found.sort((a, b) => a.index - b.index || b.length - a.length);
      let end = -1;
      return found.filter(match => { if (match.index < end) return false; end = match.index + match.length; return true; });
    };
    const row = window.CHEN_YEARBOOK_FORMATS?.rows?.find(item => item.year === Number(year));
    const cells = row ? [...row.cells.map((cell, index) => ({ cell, state: window.CHEN_GOVERNOR_YEARBOOK.states[index].name })),
      { cell: row.auxiliary, state: '州資' }, { cell: row.appendix, state: '附錄' }] : [];
    for (const { cell, state } of cells) for (const match of find(cell?.text || '')) {
      // Store the actual matched character runs, never the cell's first person's colour.
      const payload = window.GOVERNOR_SOURCE_FORMAT.sliceRuns(cell, match.index, match.index + match.length);
      match.person.sources.push({ state, address: cell.address, matched: match.text, index: match.index, payload });
    }
    const result = { people, find };
    cache.set(year, result);
    return result;
  }

  function presentation(person, state, displayedText) {
    let candidates = person.sources;
    if (state) {
      const local = candidates.filter(item => stateMatches(item.state, state));
      if (local.length) candidates = local;
    }
    const exact = candidates.filter(item => item.matched === displayedText);
    if (exact.length) candidates = exact;
    // Compare formats independent of title aliases; a conflicting occurrence is
    // deliberately left unmapped rather than choosing a colour by precedence.
    const adapted = candidates.map(item => {
      let payload = item.payload;
      if (item.matched !== displayedText) {
        const nameIndex = item.matched.indexOf(person.name);
        if (nameIndex >= 0) payload = window.GOVERNOR_SOURCE_FORMAT.sliceRuns(payload, nameIndex, nameIndex + person.name.length);
        const styles = (payload.runs || []).map(run => fontOnly({ ...payload.style, ...run.style }));
        if (new Set(styles.map(style => JSON.stringify(style))).size !== 1) return null;
        payload = { text: displayedText, style: {}, runs: [{ text: displayedText, style: styles[0] }] };
      }
      return { ...item, payload };
    }).filter(Boolean);
    if (!adapted.length || new Set(adapted.map(item => signature(item.payload))).size !== 1) return null;
    return { ...adapted[0], addresses: [...new Set(adapted.map(item => item.address))] };
  }

  function matches(value, year, state = null) {
    return registry(year).find(text(value)).map(match => ({ ...match, source: presentation(match.person, state, match.text) }));
  }

  function fiefStyle(name, year) {
    // The source yearbook and governor names always keep their actual Excel
    // formatting. The separate fief badge follows the requested non-Chen rule.
    if (!/^[陳陈]/.test(name || '')) return { color: '#00B050', source: '異姓封君顯示規則' };
    const person = registry(year).people.get(name);
    if (!person) return null;
    const chosen = presentation(person, null, name);
    if (!chosen) return null;
    const colors = new Set(chosen.payload.runs.map(run => run.style?.color || chosen.payload.style?.color).filter(Boolean));
    return colors.size === 1 ? { color: [...colors][0], source: chosen.addresses.join('、') } : null;
  }

  window.CHEN_PERSON_FORMATS = { matches, fiefStyle };
})();
