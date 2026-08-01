(() => {
  'use strict';

  const DATA = window.JIN_DATA;
  if (!DATA) {
    document.body.innerHTML = '<p style="padding:2rem">数据文件未加载。</p>';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const yearSelect = $('yearSelect');
  const stateSelect = $('stateSelect');
  const searchInput = $('searchInput');
  const changedOnly = $('changedOnly');
  const results = $('results');

  const stateOrder = DATA.intervals.map(s => s.name);
  const intervalByState = new Map(DATA.intervals.map(s => [s.name, s]));

  function normalizeName(value) {
    return String(value || '')
      .replace(/^\d{3}/, '')
      .replace(/[\s·`?※]/g, '')
      .replace(/(王国|公国|侯国|国|郡|尹|属国都尉|典农校尉|县)$/g, '')
      .replace(/荣阳/g, '荥阳')
      .replace(/颖/g, '颍')
      .replace(/琅那|琅政/g, '琅邪')
      .replace(/玄苋|玄葛|立蓟/g, '玄菟')
      .replace(/穆章/g, '豫章')
      .replace(/邺阳|郡阳|好阳/g, '鄱阳')
      .replace(/衷阳|训阳/g, '襄阳')
      .replace(/梓关/g, '梓潼')
      .replace(/新郡/g, '新都')
      .replace(/姜为/g, '犍为')
      .replace(/^日$/, '蜀');
  }

  function isKingdom(name) {
    const n = String(name || '');
    if (n.includes('属国都尉')) return false;
    return /(王国|公国|侯国|国)$/.test(n);
  }

  function phaseAt(periods, year) {
    const active = (periods || [])
      .filter(p => Number(p.start) <= year && year <= Number(p.end))
      .sort((a, b) => Number(b.start) - Number(a.start));
    return active[0] || null;
  }

  function changeInfo(periods, year) {
    const starts = (periods || []).some(p => Number(p.start) === year);
    const ends = (periods || []).some(p => Number(p.end) === year);
    return {
      changed: starts || ends,
      starts,
      ends,
      label: starts && ends ? '本年变更' : starts ? '本年设立、改名或改属' : ends ? '本年废止、改名或移出' : ''
    };
  }

  function buildIntervalYear(year) {
    const states = [];
    for (const state of DATA.intervals) {
      const rows = [];
      for (const pref of state.prefectures) {
        const phase = phaseAt(pref.periods, year);
        if (!phase) continue;

        const countyRows = [];
        for (const county of pref.counties || []) {
          const cPhase = phaseAt(county.periods, year);
          if (!cPhase) continue;
          const ch = changeInfo(county.periods, year);
          countyRows.push({
            name: cPhase.name || county.base_name,
            changed: ch.changed,
            changeLabel: ch.label,
            uncertain: Boolean(cPhase.uncertain),
            kingdom: isKingdom(cPhase.name || county.base_name)
          });
        }

        const ch = changeInfo(pref.periods, year);
        rows.push({
          name: phase.name || pref.base_name,
          counties: dedupeCounties(countyRows),
          changed: ch.changed,
          changeLabel: ch.label,
          uncertain: Boolean(phase.uncertain),
          kingdom: isKingdom(phase.name || pref.base_name),
          sourcePage: pref.source_book_page || null,
          sourceKind: 'interval'
        });
      }
      if (rows.length) states.push({ name: state.name, rows: dedupeRows(rows) });
    }
    return states;
  }

  function dedupeCounties(items) {
    const map = new Map();
    for (const item of items) {
      const key = normalizeName(item.name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, item);
      else if (item.changed) map.set(key, { ...map.get(key), ...item, changed: true });
    }
    return [...map.values()];
  }

  function dedupeRows(rows) {
    const map = new Map();
    for (const row of rows) {
      const key = normalizeName(row.name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, row);
      else {
        const old = map.get(key);
        map.set(key, {
          ...old,
          changed: old.changed || row.changed,
          counties: dedupeCounties([...(old.counties || []), ...(row.counties || [])])
        });
      }
    }
    return [...map.values()];
  }

  function bestRowMatch(rows, name) {
    const target = normalizeName(name);
    if (!target) return null;
    let exact = rows.find(r => normalizeName(r.name) === target);
    if (exact) return exact;
    return rows.find(r => {
      const n = normalizeName(r.name);
      return n && target.length >= 2 && (n.includes(target) || target.includes(n));
    }) || null;
  }

  function bestCountyMatch(counties, name) {
    const target = normalizeName(name);
    return counties.find(c => normalizeName(c.name) === target) || null;
  }

  function build281() {
    const intervalStates = buildIntervalYear(281);
    const intervalMap = new Map(intervalStates.map(s => [s.name, s]));
    const output = [];

    for (const snapState of DATA.snapshot281) {
      const intervalState = intervalMap.get(snapState.name) || { rows: [] };
      const used = new Set();
      const rows = [];

      for (const snapPref of snapState.prefectures) {
        const matched = bestRowMatch(intervalState.rows, snapPref.name);
        if (matched) used.add(normalizeName(matched.name));

        const counties = [];
        for (const cName of snapPref.counties || []) {
          const match = matched ? bestCountyMatch(matched.counties || [], cName) : null;
          counties.push({
            name: cName,
            changed: Boolean(match && match.changed),
            changeLabel: match ? match.changeLabel : '',
            uncertain: Boolean(match && match.uncertain),
            kingdom: isKingdom(cName)
          });
        }
        if (matched) {
          for (const c of matched.counties || []) {
            if (!bestCountyMatch(counties, c.name)) counties.push(c);
          }
        }

        rows.push({
          name: snapPref.name,
          counties: dedupeCounties(counties),
          changed: Boolean(matched && matched.changed),
          changeLabel: matched ? matched.changeLabel : '',
          uncertain: Boolean(matched && matched.uncertain),
          kingdom: isKingdom(snapPref.name),
          sourcePage: '766-775',
          sourceKind: 'snapshot'
        });
      }

      for (const row of intervalState.rows || []) {
        if (!used.has(normalizeName(row.name)) && !bestRowMatch(rows, row.name)) rows.push(row);
      }
      output.push({ name: snapState.name, rows: dedupeRows(rows) });
    }

    for (const state of intervalStates) {
      if (!output.some(s => s.name === state.name)) output.push(state);
    }
    output.sort((a, b) => stateOrder.indexOf(a.name) - stateOrder.indexOf(b.name));
    return output;
  }

  function getYearData(year) {
    return year === 281 ? build281() : buildIntervalYear(year);
  }

  function applyFilters(states) {
    const selectedState = stateSelect.value;
    const query = normalizeName(searchInput.value.trim());
    const onlyChanged = changedOnly.checked;
    const filtered = [];

    for (const state of states) {
      if (selectedState && state.name !== selectedState) continue;
      const stateMatches = query && normalizeName(state.name).includes(query);
      const rows = [];
      for (const row of state.rows) {
        const rowMatches = !query || stateMatches || normalizeName(row.name).includes(query);
        const matchingCounties = !query || rowMatches
          ? row.counties
          : row.counties.filter(c => normalizeName(c.name).includes(query));
        const hasChangedCounty = matchingCounties.some(c => c.changed);
        if (query && !rowMatches && matchingCounties.length === 0) continue;
        if (onlyChanged && !row.changed && !hasChangedCounty) continue;
        rows.push({ ...row, counties: matchingCounties });
      }
      if (rows.length) filtered.push({ ...state, rows });
    }
    return filtered;
  }

  function makeNameSpan(item, className = '') {
    const span = document.createElement('span');
    span.className = [className, item.kingdom ? 'kingdom' : '', item.changed ? 'changed' : '', item.uncertain ? 'uncertain' : '']
      .filter(Boolean).join(' ');
    span.textContent = item.name;
    if (item.changeLabel) span.title = item.changeLabel;
    return span;
  }

  function renderState(state) {
    const article = document.createElement('article');
    article.className = 'state-card';

    const heading = document.createElement('div');
    heading.className = 'state-heading';
    const h2 = document.createElement('h2');
    h2.textContent = state.name;
    const meta = document.createElement('span');
    meta.className = 'state-meta';
    const countyTotal = state.rows.reduce((n, r) => n + r.counties.length, 0);
    meta.textContent = `${state.rows.length} 郡国 · ${countyTotal} 县级政区`;
    heading.append(h2, meta);
    article.appendChild(heading);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    for (const label of ['郡、国及郡级政区', '所属县级政区']) {
      const th = document.createElement('th');
      th.textContent = label;
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of state.rows) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.appendChild(makeNameSpan(row, 'pref-name'));
      if (row.kingdom) {
        const badge = document.createElement('span');
        badge.className = 'type-badge kingdom';
        badge.textContent = '封国';
        tdName.appendChild(badge);
      }
      const ref = document.createElement('span');
      ref.className = 'source-ref';
      ref.textContent = row.sourceKind === 'snapshot'
        ? '太康二年断面：书页 766-775'
        : row.sourcePage ? `沿革：书页 ${row.sourcePage}` : '沿革初录：页码待补';
      tdName.appendChild(ref);

      const tdCounties = document.createElement('td');
      if (!row.counties.length) {
        const empty = document.createElement('span');
        empty.className = 'empty';
        empty.textContent = '县级政区待校勘';
        tdCounties.appendChild(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'county-list';
        for (const county of row.counties) {
          const item = makeNameSpan(county, 'county-item');
          list.appendChild(item);
        }
        tdCounties.appendChild(list);
      }
      tr.append(tdName, tdCounties);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    article.appendChild(wrap);
    return article;
  }

  function renderSummary(states) {
    const prefCount = states.reduce((n, s) => n + s.rows.length, 0);
    const countyCount = states.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.counties.length, 0), 0);
    const changeCount = states.reduce((n, s) => n + s.rows.reduce((m, r) => m + (r.changed ? 1 : 0) + r.counties.filter(c => c.changed).length, 0), 0);
    $('stateCount').textContent = states.length;
    $('prefCount').textContent = prefCount;
    $('countyCount').textContent = countyCount;
    $('changeCount').textContent = changeCount;

    const changedNames = [];
    for (const state of states) {
      for (const row of state.rows) {
        if (row.changed) changedNames.push(`${state.name}：${row.name}`);
        for (const c of row.counties) if (c.changed) changedNames.push(`${state.name}·${row.name}：${c.name}`);
      }
    }
    const panel = $('changePanel');
    const list = $('changeList');
    list.replaceChildren();
    if (changedNames.length) {
      const group = document.createElement('div');
      group.className = 'change-groups';
      for (const name of changedNames.slice(0, 120)) {
        const span = document.createElement('span');
        span.textContent = name;
        group.appendChild(span);
      }
      if (changedNames.length > 120) {
        const more = document.createElement('span');
        more.textContent = `另有 ${changedNames.length - 120} 项`;
        group.appendChild(more);
      }
      list.appendChild(group);
      panel.hidden = false;
    } else {
      panel.hidden = true;
    }
  }

  function render() {
    const year = Number(yearSelect.value);
    const all = getYearData(year);
    const filtered = applyFilters(all);
    results.replaceChildren();
    if (!filtered.length) {
      const p = document.createElement('div');
      p.className = 'no-results';
      p.textContent = '没有符合当前条件的政区。';
      results.appendChild(p);
    } else {
      for (const state of filtered) results.appendChild(renderState(state));
    }
    renderSummary(filtered);
    $('statusText').textContent = year === 281
      ? '太康二年使用书中第766-775页断面优先显示，并以第592-765页沿革区间补足遗漏；当前仍是OCR初录校勘版。'
      : `公元${year}年由书中第592-765页沿革区间自动重建；红色为区间起止年，具体生效月日仍待校勘。`;
    document.title = `西晋${year}年末州郡县表`;
  }

  function init() {
    const [start, end] = DATA.meta.years;
    for (let y = start; y <= end; y++) {
      const option = document.createElement('option');
      option.value = String(y);
      option.textContent = `公元 ${y} 年`;
      if (y === 281) option.selected = true;
      yearSelect.appendChild(option);
    }

    const names = [...new Set([...stateOrder, ...DATA.snapshot281.map(s => s.name)])];
    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      stateSelect.appendChild(option);
    }

    yearSelect.addEventListener('change', render);
    stateSelect.addEventListener('change', render);
    searchInput.addEventListener('input', render);
    changedOnly.addEventListener('change', render);
    render();
  }

  init();
})();
