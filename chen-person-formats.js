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
  // Explicit character variants only; never collapse similar names such as
  // 陳番 (伯仁之子) and 陳蕃 (後主之子), or infer a clan from a surname.
  const traditionalChars = { 陈:'陳',拟:'擬',详:'詳',党:'黨',庆:'慶',昙:'曇',泽:'澤',宽:'寬',顼:'頊',义:'義',礼:'禮',谋:'謀',坚:'堅',献:'獻',齐:'齊',达:'達',兴:'興',纯:'純',谟:'謨',显:'顯',荣:'榮',俭:'儉',俨:'儼',忠:'忠',庄:'莊',彦:'彥',观:'觀',纲:'綱',统:'統',绰:'綽',辩:'辯',华:'華',宁:'寧',鲁:'魯',岚:'嵐',萧:'蕭',淵:'淵',渊:'淵',酆:'酆',阙:'闕',宝:'寶',纪:'紀',纬:'緯',文:'文',礼:'禮',谭:'譚',诩:'詡',诠:'詮' };
  const traditional = value => [...text(value)].map(character => traditionalChars[character] || character).join('');
  const canonical = name => { const value = traditional(name); return genealogy().aliases?.[value] || value; };
  const simplified = value => {
    const inverse = Object.fromEntries(Object.entries(traditionalChars).filter(([a,b]) => a !== b).map(([a,b]) => [b,a]));
    return [...text(value)].map(character => inverse[character] || character).join('');
  };
  const ink = '#000000';
  const isInk = color => !color || /^(?:#000(?:000)?|black|inherit|currentcolor|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(color);

  function personCatalog() {
    if (catalog) return catalog;
    const people = new Map();
    const add = (name, aliases = []) => {
      const original = name;
      name = canonical(name);
      if (!/^[\p{Script=Han}]{2,4}$/u.test(name || '') || /[郡州]|(?:王|侯|公|將軍|刺史|都督|內附|徵還)$/.test(name)) return;
      if (!people.has(name)) people.set(name, { name, aliases: new Set([name, original, simplified(name)]), sources: [] });
      aliases.filter(Boolean).forEach(alias => people.get(name).aliases.add(alias));
      for (const [alias, target] of Object.entries(genealogy().aliases || {})) if (target === name) people.get(name).aliases.add(alias);
    };
    for (const name of genealogy().source_people || []) add(name);
    for (const key of ['remote_relatives', 'blue_relatives', 'individual']) for (const name of Object.keys(genealogy()[key] || {})) add(name);
    for (const [name, override] of Object.entries(genealogy().title_overrides || {})) add(name, [override.title + name]);
    for (const family of genealogy().families || []) for (const child of family.children) add(`陳${child}`);
    for (const record of window.CHEN_FIEFS?.records || []) for (const holder of record.holders || []) {
      const aliases = [];
      for (const phase of record.phases || []) for (const rank of new Set(record.rank === '王' ? ['王', '嗣王', '郡王'] : [record.rank])) {
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
    for (const person of people.values()) for (const alias of [...person.aliases]) person.aliases.add(simplified(alias));
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
    name = canonical(name); year = Number(year);
    const data = genealogy();
    if ((data.deaths?.[name] ?? Infinity) < year || data.emperors?.some(person => person.name === name && year >= person.start && year <= person.end)) return null;
    const direct = data.individual?.[name]?.find(period => year >= period.start && year <= period.end);
    if (direct) return { ...direct, source: direct.evidence || `《陳書》卷二十八：${year}年為${direct.category}` };
    const remote = data.remote_relatives?.[name];
    if (remote) return { ...remote, source: remote.evidence };
    const family = data.families?.find(item => item.children.some(child => `陳${child}` === name));
    const period = family?.periods.find(item => year >= item.start && year <= item.end);
    if (period) return { ...period, father: family.father, source: `《陳書》卷二十八父子名錄；${family.father}之子，${year}年${period.category}（同父兄弟年度校驗）` };
    if (data.successors?.includes(name)) {
      const succession = window.CHEN_FIEFS?.records?.filter(record => record.rank === '王').flatMap(record => record.display_periods || []).find(period => year >= period.start && year <= period.end && !period.mourning && new RegExp(`嗣王[·\\s]*${name}`).test(period.text));
      if (succession) return { color: '#7030A0', category: '嗣王', pending: Boolean(succession.inferred || succession.uncertain), source: '本項封國年度承襲紀錄（沿用已有服喪及嗣位考定；僅實際襲王階段用紫色）' };
    }
    const blue = data.blue_relatives?.[name];
    if (blue) return { ...blue, color: '#0070C0', source: blue.evidence };
    return null;
  }

  function personStyle(person, year, source) {
    if (!/^[陳陈]/.test(person.name)) return { color: '#00B050', category: '異姓', source: '異姓人物綠色顯示規則' };
    const identity = identityStyle(person.name, Number(year));
    if (identity) return identity;
    const colors = new Set(source?.payload.runs.map(run => run.style?.color || source.payload.style?.color).filter(color => !isInk(color)) || []);
    // Purple is a claim of royal succession. A workbook colour by itself is
    // not evidence that a prince, county marquis, or mourning heir acceded.
    if (colors.has('#7030A0') || colors.has('#800080')) return { color: ink, category: '親屬／承襲待核', pending: true, source: `原年表 ${source.addresses.join('、')}紫色未有本年襲王證據，暫以黑色待核` };
    if (colors.size === 1) return { color: [...colors][0], category: '原表姓名色（身份待核）', pending: true, source: `原年表 ${source.addresses.join('、')}` };
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
    const normalized = canonical(name);
    if (!isNamedHolder(normalized)) return null;
    if (/^[\p{Script=Han}]{2,4}$/u.test(normalized) && !normalized.startsWith('陳')) return { color: '#00B050', category: '異姓', source: '使用者規則：所有非陳姓人物均為綠色' };
    const person = registry(year).people.get(normalized);
    return person ? personStyle(person, year, presentation(person, null, person.name)) : null;
  }

  const holderName = person => canonical(text(typeof person === 'string' ? person : person?.person).trim().split(/\s+/).at(-1));
  const isNamedHolder = name => /^[\p{Script=Han}]{2,4}$/u.test(name) && !/未[詳详知明]|不[詳详明]|[無无]名|封君|[繼继]承|某|氏$|^(?:世子|服[喪丧]|[後后]嗣)$/.test(name);

  function fiefRecordStyle(match, year) {
    const record = match?.record || match;
    if (!record) return null;
    year = Number(year);
    const display = match.display || record.display_periods?.find(period => year >= period.start && year <= period.end);
    const current = display ? display.people || [] : match.holders || (record.holders || []).filter(holder => year >= holder.start && year <= holder.end);
    const names = current.map(holderName).filter(isNamedHolder);
    if (names.length) {
      const styles = names.map(name => fiefStyle(name, year));
      const colors = new Set(styles.map(style => style?.color));
      return colors.size === 1 && !colors.has(undefined) ? { ...styles[0], source: [...new Set(styles.map(style => style.source))].join('；') } : null;
    }
    // Unnamed successors inherit only the previous holder's surname category.
    // Keep their names, dates, and uncertainty unchanged; a later named grant
    // takes priority, including a change from a non-Chen holder to a Chen holder.
    const history = [];
    (record.holders || []).forEach((holder, index) => {
      const name = holderName(holder);
      if (isNamedHolder(name) && Number(holder.start) <= year) history.push({ names: [name], start: Number(holder.start), index, kind: 0 });
    });
    (record.display_periods || []).forEach((period, index) => {
      const names = (period.people || []).map(holderName).filter(isNamedHolder);
      if (names.length && Number(period.start) <= year) history.push({ names, start: Number(period.start), index, kind: 1 });
    });
    history.sort((a, b) => b.start - a.start || b.kind - a.kind || b.index - a.index);
    const previous = history[0];
    if (!previous || !previous.names.every(name => fiefStyle(name, year)?.color === '#00B050')) return null;
    const predecessor = previous.names.join('、');
    return { color: '#00B050', category: '異姓（未詳繼承者）', predecessor,
      source: `同一封國此前具名封君為${predecessor}；依使用者規則，未詳繼承者沿用異姓綠色，姓名與任期仍保留未詳` };
  }

  function displayName(personName, year) {
    const name = canonical(personName), person = registry(year).people.get(name);
    const base = { text: text(personName), title: '', canonicalName: name, source: '', pending: false };
    if (!name.startsWith('陳')) return base;
    const override = genealogy().title_overrides?.[name];
    if (override && year >= override.start && year <= override.end) return { ...base, title: override.title, text: override.title + name, source: override.evidence };
    if (!person) return { ...base, pending: true };
    if (genealogy().title_blocks?.[name]) return { ...base, source: genealogy().title_blocks[name], pending: true };
    if ((genealogy().deaths?.[name] ?? Infinity) < Number(year)) return { ...base, source: '本年已卒，不補在任爵號', pending: true };
    const titledSource = person.sources.map(item => {
      const names = [...person.aliases].filter(alias => /^[\p{Script=Han}]{2,4}$/u.test(alias) && canonical(alias) === name);
      const written = names.find(alias => item.matched.endsWith(alias));
      const title = written ? item.matched.slice(0, -written.length) : '';
      return /(?:王|侯|公|伯|子|男)$/.test(title) ? { title, source: `原年表${year}年 ${item.address}` } : null;
    }).filter(Boolean);
    const sourceTitles = [...new Set(titledSource.map(item => item.title))];
    if (sourceTitles.length === 1) return { ...base, text: sourceTitles[0] + name, ...titledSource[0] };
    if (sourceTitles.length > 1) return { ...base, pending: true, source: '本年原表見多個爵號，保留原姓名；不推定年內晉封先後' };
    const candidates = [];
    for (const record of window.CHEN_FIEFS?.records || []) {
      const phase = record.phases?.find(item => year >= item.start && year <= item.end);
      if (!phase) continue;
      const period = record.display_periods?.find(item => year >= item.start && year <= item.end);
      const periodNamesPerson = (period?.people || []).some(item => canonical(typeof item === 'string' ? item : item.person) === name);
      const holder = record.holders?.find(item => canonical(item.person) === name && (periodNamesPerson || year >= item.start && year <= item.end));
      if (!holder || period && !periodNamesPerson) continue;
      const mourning = period?.mourning || (period?.text?.includes('世子') && !new RegExp(`(?:嗣王|侯國)[·\\s]*${name}`).test(period.text));
      const succession = !mourning && record.rank === '王' && period?.text?.includes('嗣王');
      const title = phase.fief + (mourning ? '國世子' : succession ? '嗣王' : record.rank === '王' && phase.fief === '吳' ? '郡王' : record.rank);
      candidates.push({ title, text: title + name, canonicalName: name,
        source: `既有封國紀年 ${record.id}：${holder.time_text || '年份見封國表'}`,
        pending: Boolean(holder.uncertain || phase.uncertain || period?.inferred || period?.uncertain), start: holder.start });
    }
    candidates.sort((a,b) => b.start - a.start);
    if (candidates.length && (!candidates[1] || candidates[0].start > candidates[1].start || candidates[0].title === candidates[1].title)) return candidates[0];
    return { ...base, pending: true, source: sourceTitles.length > 1 || candidates.length ? '本年爵號有多個候選，保留姓名待核' : '本年未見確定爵號' };
  }

  function decorateText(value, year, state = null) {
    value = text(value);
    for (const match of [...matches(value, year, state)].reverse()) {
      if (!match.person.name.startsWith('陳')) continue;
      const label = displayName(match.person.name, year);
      // An explicit title in the annual sentence is more precise than an
      // annual aggregate (which can contain a promotion within that year).
      const names = [...match.person.aliases].filter(alias => canonical(alias) === match.person.name);
      if (match.person.name.startsWith('陳')) names.push(match.person.name.slice(1), simplified(match.person.name.slice(1)));
      names.sort((a,b) => b.length - a.length);
      const written = names.find(name => match.text.endsWith(name));
      const prefix = written ? match.text.slice(0, -written.length) : '';
      const replacement = /(?:王|侯|公|伯|子|男)$/.test(prefix) ? prefix + match.person.name : label.title ? label.text : match.text;
      value = value.slice(0, match.index) + replacement + value.slice(match.index + match.length);
    }
    return value;
  }

  window.CHEN_PERSON_FORMATS = { matches, fiefStyle, fiefRecordStyle, identityStyle, displayName, decorateText, canonicalName: canonical, ink };
})();
