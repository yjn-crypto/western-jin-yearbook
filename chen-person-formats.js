(() => {
  'use strict';
  const cache = new Map();
  let catalog;
  const text = value => value == null ? '' : String(value);
  const comparableState = value => text(value).replace(/[\s/／]/g, '').replace(/州$/, '');
  const stateMatches = (source, requested) => source === requested || source.split(/[\/／]/).some(value => comparableState(value) === comparableState(requested));
  const fontKeys = ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecorationLine', 'textDecorationStyle', 'verticalAlign', 'backgroundColor'];
  const fontOnly = style => Object.fromEntries(fontKeys.filter(key => style?.[key] !== undefined).map(key => [key, style[key]]));
  const signature = payload => JSON.stringify((payload.runs || []).flatMap(run => [...run.text].map(character => [character, fontOnly({ ...payload.style, ...run.style })])));
  const genealogy = () => window.CHEN_ROYAL_IDENTITIES || {};
  const canonical = name => genealogy().aliases?.[name] || name;
  const ink = '#000000';
  const isInk = color => !color || /^(?:#000(?:000)?|black|inherit|currentcolor|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(color);

  function personCatalog() {
    if (catalog) return catalog;
    const people = new Map();
    const add = (name, aliases = []) => {
      const original = name;
      name = canonical(name);
      if (!/^[\p{Script=Han}]{2,4}$/u.test(name || '') || /[郡州]|(?:王|侯|公|將軍|刺史|都督|內附|徵還)$/.test(name)) return;
      if (!people.has(name)) people.set(name, { name, aliases: new Set([name, original]), sources: [] });
      aliases.filter(Boolean).forEach(alias => people.get(name).aliases.add(alias));
      for (const [alias, target] of Object.entries(genealogy().aliases || {})) if (target === name) people.get(name).aliases.add(alias);
    };
    for (const name of genealogy().source_people || []) add(name);
    for (const family of genealogy().families || []) for (const child of family.children) add(`陳${child}`);
    for (const record of window.CHEN_FIEFS?.records || []) for (const holder of record.holders || []) {
      const aliases = [];
      for (const phase of record.phases || []) for (const rank of new Set([record.rank, '王', '嗣王', '郡王', '侯', '公'])) {
        aliases.push(`${phase.fief}${rank}${holder.person}`);
        if (/^[陳陈]/.test(holder.person || '')) aliases.push(`${phase.fief}${rank}${holder.person.slice(1)}`);
      }
      if (holder.title) { aliases.push(`${holder.title}${holder.person}`); if (/^[陳陈]/.test(holder.person)) aliases.push(`${holder.title}${holder.person.slice(1)}`); }
      add(holder.person, aliases);
    }
    // Correct-name aliases also receive the existing fief's titles, without
    // rewriting the fief source (e.g. source 淵 / historical 深).
    for (const person of people.values()) for (const alias of [...person.aliases]) for (const [variant, target] of Object.entries(genealogy().aliases || {})) {
      if (target === person.name && alias.includes(variant)) person.aliases.add(alias.replace(variant, target));
      if (target === person.name && alias.endsWith(variant.slice(1)) && /王|侯|公/.test(alias)) person.aliases.add(alias.slice(0, -variant.slice(1).length) + target.slice(1));
    }
    for (const tenure of Object.values(window.CHEN_LOCAL_OFFICIALS?.tenures_by_id || {})) add(tenure.person);
    // Never infer people from arbitrary clauses: “宣惠將軍”, “不行” and
    // “尋陽太守” are not names. The source roster is explicitly reviewed.
    // Discover an explicitly written title only at a clause start. A broad
    // Han-character regex would also colour dates and office prefixes.
    for (const row of window.CHEN_YEARBOOK_FORMATS?.rows || []) for (const cell of [...row.cells, row.auxiliary, row.appendix]) {
      for (const segment of text(cell?.text).split(/[\n\r；;，,。]| {2,}/)) {
        const start = segment.trim().replace(/^(?:閏?[一二三四五六七八九十正冬臘\d]+月[前後]?\s*)+/u, '');
        for (const person of people.values()) for (const name of [person.name, ...Object.keys(genealogy().aliases || {}).filter(alias => canonical(alias) === person.name)]) {
          const index = start.indexOf(name), prefix = index > 0 ? start.slice(0, index) : '';
          if (/^(?:梁)?[\p{Script=Han}]{1,7}(?:嗣王|蕃王|王|侯|公)$/u.test(prefix)) {
            person.aliases.add(prefix + name);
            if (/^[陳陈]/.test(name)) person.aliases.add(prefix + name.slice(1));
          }
        }
      }
    }
    catalog = people;
    return catalog;
  }

  function registry(year) {
    year = Number(year);
    if (cache.has(year)) return cache.get(year);
    const people = new Map([...personCatalog()].map(([name, person]) => [name, { ...person, sources: [] }]));
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
    const row = window.CHEN_YEARBOOK_FORMATS?.rows?.find(item => item.year === year);
    const cells = row ? [...row.cells.map((cell, index) => ({ cell, state: window.CHEN_GOVERNOR_YEARBOOK.states[index].name })), { cell: row.auxiliary, state: '州資' }, { cell: row.appendix, state: '附錄' }] : [];
    for (const { cell, state } of cells) for (const match of find(cell?.text || '')) {
      const payload = window.GOVERNOR_SOURCE_FORMAT.sliceRuns(cell, match.index, match.index + match.length);
      match.person.sources.push({ state, address: cell.address, matched: match.text, index: match.index, payload });
    }
    const result = { people, find };
    cache.set(year, result);
    return result;
  }

  function presentation(person, state, displayedText) {
    let candidates = person.sources;
    if (state) { const local = candidates.filter(item => stateMatches(item.state, state)); if (local.length) candidates = local; }
    const exact = candidates.filter(item => item.matched === displayedText);
    if (exact.length) candidates = exact;
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

  function identityStyle(name, year) {
    const data = genealogy();
    if ((data.deaths?.[name] ?? Infinity) < year || data.emperors?.some(person => person.name === name && year >= person.start && year <= person.end)) return null;
    const direct = data.individual?.[name]?.find(period => year >= period.start && year <= period.end);
    if (direct) return { ...direct, source: `《陳書》卷二十八：${year}年為${direct.category}` };
    const family = data.families?.find(item => item.children.some(child => `陳${child}` === name));
    const period = family?.periods.find(item => year >= item.start && year <= item.end);
    if (period) return { ...period, father: family.father, source: `《陳書》卷二十八父子名錄；${family.father}之子，${year}年${period.category}（同父兄弟年度校驗）` };
    if (data.successors?.includes(name)) {
      const succession = window.CHEN_FIEFS?.records?.some(record => record.display_periods?.some(period => year >= period.start && year <= period.end && new RegExp(`嗣王[·\\s]*${name}`).test(period.text)));
      if (succession) return { color: '#7030A0', category: '嗣王', source: '本項封國年度承襲紀錄（沿用已有服喪及嗣位考定）' };
    }
    return null;
  }

  function personStyle(person, year, source) {
    if (!/^[陳陈]/.test(person.name)) return { color: '#00B050', category: '異姓', source: '異姓人物綠色顯示規則' };
    const identity = identityStyle(person.name, Number(year));
    if (identity) return identity;
    const colors = new Set(source?.payload.runs.map(run => run.style?.color || source.payload.style?.color).filter(color => !isInk(color)) || []);
    if (colors.size === 1) return { color: [...colors][0], category: '原表姓名色', source: `原年表 ${source.addresses.join('、')}` };
    const stable = genealogy().stable_relatives?.[person.name];
    if (stable) {
      const sampleYears = (window.CHEN_YEARBOOK_FORMATS?.rows || []).map(row => row.year)
        .sort((a, b) => (a <= year ? 0 : 1) - (b <= year ? 0 : 1) || Math.abs(a - year) - Math.abs(b - year));
      for (const sampleYear of sampleYears) {
        const samples = registry(sampleYear).people.get(person.name)?.sources || [];
        const sampleColors = new Set(samples.flatMap(item => item.payload.runs.map(run => run.style?.color || item.payload.style?.color)).filter(color => !isInk(color)));
        if (sampleColors.size === 1) return { color: [...sampleColors][0], category: stable.category,
          source: `${stable.evidence}；本年缺色參照原年表${sampleYear}年 ${[...new Set(samples.map(item => item.address))].join('、')}姓名色`, sourceYear: sampleYear };
      }
    }
    return null;
  }

  function matches(value, year, state = null) {
    return registry(year).find(text(value)).map(match => {
      const source = presentation(match.person, state, match.text);
      return { ...match, source, colorStyle: personStyle(match.person, year, source) };
    });
  }

  function fiefStyle(name, year) {
    const person = registry(year).people.get(canonical(name));
    return person ? personStyle(person, year, presentation(person, null, person.name)) : null;
  }

  window.CHEN_PERSON_FORMATS = { matches, fiefStyle, identityStyle, ink };
})();
