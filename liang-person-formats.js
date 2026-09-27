(() => {
  'use strict';
  const ink = '#000000';
  const text = value => value == null ? '' : String(value);
  const nameOf = value => typeof value === 'string' ? value : value?.name || value?.person || '';
  // Explicit script variants; no phonetic, surname or similar-glyph guessing.
  const variants = Object.fromEntries([...('骞騫涡渦贲賁萧蕭陈陳张張冯馮孙孫刘劉谢謝袁袁吴吳齐齊陆陸韦韋裴裴严嚴贺賀赵趙邓鄧欧歐阳陽郑鄭马馬许許顾顧钟鍾苏蘇万萬龙龍贾賈乐樂兰蘭应應异異许許义義拟擬潜潛征徵显顯云雲恽惲灵靈宝寶庆慶昙曇泽澤宽寬顼頊礼禮谋謀坚堅献獻达達兴興纯純谟謨荣榮俭儉俨儼庄莊彦彥观觀纲綱统統绰綽辩辯华華宁寧鲁魯岚嵐渊淵阙闕纪紀纬緯谭譚诩詡诠詮伦倫纶綸续續绎繹绩績机機誉譽欢歡伟偉会會简簡谘諮咨諮骏駿丰豐县縣东東临臨当當寻尋长長嗣嗣国國罗羅丰豐丰豐')].reduce((pairs, character, index, chars) => {
    if (index % 2 === 0) pairs.push([character, chars[index + 1]]);
    return pairs;
  }, []));
  const traditional = value => [...text(value)].map(character => variants[character] || character).join('');
  const normalizeName = value => {
    const name = traditional(nameOf(value)).replace(/^蕭范$/, '蕭範');
    return window.LIANG_PERSON_EVIDENCE?.aliases?.[name] || name;
  };
  const named = value => /^[\p{Script=Han}]{2,4}$/u.test(value)
    && !/未[詳详知明]|不[詳详明]|封君|某|氏$|^(?:世子|服喪|後嗣)$/.test(value);
  const stripDate = value => text(value).replace(/^(?:閏?[一二三四五六七八九十正冬臘\d]+月[前後]?\s*)+/u, '');
  let cachedCatalog;
  let catalogSources;

  function catalog() {
    const sources = [window.LIANG_PERSON_COLORS, window.LIANG_LOCAL_OFFICIALS, window.LIANG_FIEFS, window.LIANG_PERSON_EVIDENCE];
    if (catalogSources?.every((source, index) => source === sources[index])) return cachedCatalog;
    const people = new Map();
    const add = (rawName, aliases = []) => {
      const name = normalizeName(rawName);
      if (!named(name)) return null;
      if (!people.has(name)) people.set(name, { name, aliases: new Set([name]), years: {}, evidence: [] });
      const person = people.get(name);
      for (const alias of [rawName, ...aliases]) {
        const value = traditional(stripDate(alias)).trim();
        // The roster contains literal names/titles, never arbitrary office clauses.
        if (value && !/將軍|刺史|太守|都督|長史|司馬|持節|內史/.test(value)) person.aliases.add(value);
      }
      return person;
    };
    for (const item of window.LIANG_PERSON_COLORS?.people || []) {
      const person = add(item.name, item.aliases || []);
      if (person) Object.assign(person.years, item.years || {});
    }
    for (const item of Object.values(window.LIANG_LOCAL_OFFICIALS?.tenures_by_id || {})) add(item.person, item.person_aliases || []);
    // Some live data updates provide only annual rows.
    for (const row of Object.values(window.LIANG_LOCAL_OFFICIALS?.years || {})) {
      for (const item of row.local_officers || []) add(item.person, item.person_aliases || []);
    }
    for (const item of window.LIANG_PERSON_EVIDENCE?.people || []) {
      const person = add(item.name, item.aliases || []);
      if (person) person.evidence.push(item);
    }
    for (const record of window.LIANG_FIEFS?.records || []) for (const holder of record.holders || []) {
      const person = add(holder.person);
      if (!person) continue;
      for (const phase of record.phases || []) for (const rank of record.rank === '王' ? ['王', '郡王', '嗣王', '蕃王', '國世子'] : [record.rank]) {
        const title = traditional(phase.fief + rank);
        person.aliases.add(title + person.name);
        if (person.name.startsWith('蕭')) person.aliases.add(title + person.name.slice(1));
      }
    }
    for (const item of window.LIANG_PERSON_EVIDENCE?.titles || []) {
      const person = add(item.name);
      if (person) person.aliases.add(traditional(item.title) + person.name);
    }
    for (const [alias, target] of Object.entries(window.LIANG_PERSON_EVIDENCE?.aliases || {})) {
      const person = people.get(normalizeName(target));
      if (person) person.aliases.add(traditional(alias));
    }
    // Literal source aliases with an omitted royal surname also match their
    // full-name version. We never match a one-character given name by itself.
    for (const person of people.values()) if (person.name.startsWith('蕭')) {
      const given = person.name.slice(1);
      for (const alias of [...person.aliases]) if (alias !== person.name && alias.endsWith(given) && !alias.endsWith(person.name)) {
        person.aliases.add(alias.slice(0, -given.length) + person.name);
      }
    }
    catalogSources = sources;
    cachedCatalog = people;
    return people;
  }

  function personStyle(value, requestedYear) {
    const name = normalizeName(value), year = Number(requestedYear), person = catalog().get(name);
    if (!person || !Number.isFinite(year)) return null;
    const annual = person.years[String(year)];
    if (annual) return { ...annual, source: `梁代刺史年表既有人物—年份色：${year}年 ${name}`, basis: 'annual_source', pending: false };
    for (const item of person.evidence) {
      const period = (item.periods || []).find(item => year >= item.start && year <= item.end);
      if (period) return { color: period.color || ink, category: period.category,
        source: period.source || item.source || '', evidence: period.evidence || item.evidence || [],
        pending: Boolean(period.pending), basis: 'liang_evidence' };
    }
    if (!name.startsWith('蕭')) return { color: '#00B050', category: '異姓', source: '梁代異姓人物綠色規則；姓名來自梁代人物名錄', basis: 'surname_display_rule', pending: false };
    return { color: ink, category: '同姓身份待核', pending: true, basis: 'unresolved',
      source: person.evidence.map(item => item.source).filter(Boolean).join('；') || '本年沒有已核梁代身份色；不能僅憑蕭姓推為宗室' };
  }

  function titleCandidates(name, year) {
    const titles = [];
    for (const entry of window.LIANG_PERSON_EVIDENCE?.titles || []) {
      if (normalizeName(entry.name) === name && year >= entry.start && year <= entry.end && !entry.posthumous) {
        titles.push({ title: entry.title, source: entry.source, evidence: entry.evidence || [], pending: Boolean(entry.pending), priority: 2 });
      }
    }
    for (const record of window.LIANG_FIEFS?.records || []) {
      const holders = (record.holders || []).filter(holder => normalizeName(holder.person) === name
        && !window.LIANG_FIEF_RULES?.isPosthumous(holder) && !holder.posthumous
        && holder.start != null && holder.end != null && year >= Number(holder.start) && year <= Number(holder.end));
      if (!holders.length) continue;
      for (const holder of holders) for (const phase of record.phases || []) {
        if (phase.start == null || phase.end == null || year < Number(phase.start) || year > Number(phase.end)) continue;
        // A tentative compiled interval remains available in the fief detail,
        // but is not a basis for silently inserting a title beside an officer.
        if (holder.uncertain) continue;
        const succession = record.rank === '王' && (holder.succession === true
          || /襲封|袭封/.test(holder.time_text || '')
          || catalog().get(name)?.years[String(year)]?.category === '嗣王');
        titles.push({ title: phase.fief + (succession ? '嗣王' : record.rank), source: `既有梁代封爵表：${holder.start}—${holder.end}，${record.source_url || ''}`,
          pending: false, priority: 1 });
      }
    }
    return titles;
  }

  function displayName(value, requestedYear) {
    const original = nameOf(value), name = normalizeName(value), year = Number(requestedYear);
    const base = { text: original, title: '', canonicalName: name, source: '', pending: false };
    if (!catalog().has(name) || !Number.isFinite(year)) return base;
    const candidates = titleCandidates(name, year);
    const best = candidates.filter(item => item.priority === Math.max(...candidates.map(item => item.priority)));
    const titles = [...new Set(best.map(item => traditional(item.title)))];
    if (titles.length === 1) return { ...base, title: titles[0], text: titles[0] + name,
      source: [...new Set(best.map(item => item.source))].join('；'), evidence: best.flatMap(item => item.evidence || []), pending: best.some(item => item.pending) };
    return { ...base, pending: true, source: titles.length ? '本年有多個有據爵號，未判定年內次序，保留原姓名' : '本年無有界的授封或承襲依據，保留原姓名' };
  }

  function matches(value, requestedYear) {
    const original = text(value), normalized = traditional(original).replace(/蕭范/g, '蕭範'), candidates = [];
    for (const person of catalog().values()) {
      const style = personStyle(person, requestedYear);
      for (const alias of person.aliases) {
        let from = 0, index;
        while ((index = normalized.indexOf(alias, from)) !== -1) {
          candidates.push({ index, length: alias.length, text: original.slice(index, index + alias.length), person,
            start: index, end: index + alias.length, style, yearStyle: style, colorStyle: style, color: style?.color,
            source: style?.source || '', displayName: displayName(person, requestedYear) });
          from = index + alias.length;
        }
      }
    }
    candidates.sort((a, b) => a.index - b.index || b.length - a.length);
    let end = -1;
    return candidates.filter(match => {
      if (match.index < end) return false;
      // A shared literal alias is ambiguous: keep the text uncoloured.
      if (candidates.some(other => other.index === match.index && other.length === match.length && other.person.name !== match.person.name)) return false;
      end = match.index + match.length;
      return true;
    });
  }

  function decorateText(value, year) {
    let result = text(value);
    for (const match of [...matches(result, year)].reverse()) {
      if (!match.displayName.title || normalizeName(match.text) !== match.person.name) continue;
      // Keep an explicit adjacent title, including one not in the roster.
      const prefix = result.slice(0, match.index);
      if (/[\p{Script=Han}]{1,7}(?:郡王|嗣王|王|侯|公|伯|子|男|世子)$/u.test(prefix)) continue;
      result = result.slice(0, match.index) + match.displayName.text + result.slice(match.index + match.length);
    }
    return result;
  }

  function fiefRecordStyle(value, year) {
    const record = value?.record || value;
    if (!record) return null;
    const resolution = window.LIANG_FIEF_RULES?.resolveHolder(record, Number(year));
    const holder = resolution?.holder || (!resolution ? value?.holder : null);
    if (!holder || resolution?.status === 'mourning') return null;
    const style = personStyle(holder.person, year);
    return style ? { ...style, source: [style.source, resolution?.reason].filter(Boolean).join('；') } : null;
  }
  function fiefStyle(value, year) {
    return value?.record || value?.holders ? fiefRecordStyle(value, year) : personStyle(value, year);
  }

  window.LIANG_PERSON_FORMATS = { matches, displayName, decorateText, personStyle, fiefStyle, fiefRecordStyle,
    canonicalName: normalizeName, ink };
})();
