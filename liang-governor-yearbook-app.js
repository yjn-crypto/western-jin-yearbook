(() => {
  'use strict';

  const DATA = window.LIANG_GOVERNOR_YEARBOOK || { meta: {}, states: [], rows: [] };
  const COLORS = window.LIANG_PERSON_COLORS || { categories: [], people: [] };
  const $ = (id) => document.getElementById(id);
  const yearSelect = $('governorYearSelect');
  const stateSelect = $('governorStateSelect');
  const searchInput = $('governorSearch');
  const matchOnly = $('matchOnly');
  const table = $('liangGovernorTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  const status = $('yearbookStatus');
  const tableShell = document.querySelector('.yearbook-table-shell');
  const params = new URLSearchParams(window.location.search);
  const requestedYear = Number(params.get('year')) || null;
  const requestedState = (params.get('state') || '').trim();
  const peopleByYear = new Map();

  for (const person of COLORS.people || []) {
    for (const [year, yearStyle] of Object.entries(person.years || {})) {
      if (!peopleByYear.has(year)) peopleByYear.set(year, []);
      peopleByYear.get(year).push({ person, yearStyle });
    }
  }

  const STATE_ALIASES = new Map([
    ['東揚州/會稽郡', ['東揚州', '會稽郡', '會稽']],
    ['青冀二州', ['青州', '冀州', '青冀州', '青冀二州']],
    ['梁秦二州', ['梁州', '秦州', '南秦州', '梁秦州', '梁秦二州']],
  ]);

  function normalize(value) {
    return String(value || '')
      .replace(/[\s·`?？※、，,。；;：:（）()【】\[\]\/／—－-]/g, '')
      .replace(/臺/g, '台')
      .replace(/[鍾鐘]/g, '鍾')
      .replace(/脩/g, '修');
  }

  function aliasesFor(stateName) {
    return [stateName, ...(STATE_ALIASES.get(stateName) || []), ...stateName.split(/[\/／]/)].filter(Boolean);
  }

  function fixedStateIndex(stateName) {
    const key = normalize(stateName);
    if (!key || key === normalize('附錄')) return -1;
    return DATA.states.findIndex((state) => aliasesFor(state.name).some((alias) => normalize(alias) === key));
  }

  function textContainsState(text, stateName) {
    const haystack = normalize(text);
    if (!haystack) return false;
    const aliases = [stateName, ...(STATE_ALIASES.get(stateName) || [])].map(normalize).filter(Boolean);
    return aliases.some((alias) => haystack.includes(alias));
  }

  function personColorMatches(text, year) {
    const value = String(text || '');
    const candidates = [];
    for (const { person, yearStyle } of peopleByYear.get(String(year)) || []) {
      for (const alias of [person.name, ...(person.aliases || [])]) {
        if (!alias) continue;
        let index = value.indexOf(alias);
        while (index >= 0) {
          candidates.push({ index, length: alias.length, text: alias, person, yearStyle });
          index = value.indexOf(alias, index + Math.max(1, alias.length));
        }
      }
    }
    candidates.sort((a, b) => a.index - b.index || b.length - a.length || a.person.name.localeCompare(b.person.name, 'zh-Hant'));
    const accepted = [];
    let end = -1;
    for (const match of candidates) {
      if (match.index < end) continue;
      accepted.push(match);
      end = match.index + match.length;
    }
    return accepted;
  }

  function appendColoredText(container, text, year) {
    const value = String(text || '');
    const matches = personColorMatches(value, year);
    if (!matches.length) {
      container.appendChild(document.createTextNode(value));
      return;
    }
    let cursor = 0;
    for (const match of matches) {
      if (match.index > cursor) container.appendChild(document.createTextNode(value.slice(cursor, match.index)));
      const span = document.createElement('span');
      span.className = 'liang-person-color';
      span.style.color = match.yearStyle.color;
      span.dataset.category = match.yearStyle.category;
      span.title = `${match.person.name}：${match.yearStyle.category}（據梁代刺史表，${year}年）`;
      span.textContent = match.text;
      container.appendChild(span);
      cursor = match.index + match.length;
    }
    if (cursor < value.length) container.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function renderCell(cell, value, year) {
    const text = String(value || '');
    cell.replaceChildren();
    if (!text) {
      cell.classList.add('empty-cell');
      cell.textContent = '—';
      return;
    }
    cell.classList.remove('empty-cell');
    for (const line of text.split(/\r?\n/)) {
      const div = document.createElement('div');
      div.className = 'cell-line';
      appendColoredText(div, line, year);
      cell.appendChild(div);
    }
  }

  function populateControls() {
    for (const row of DATA.rows) {
      const option = document.createElement('option');
      option.value = String(row.year);
      option.textContent = `${row.reign.replace(/\r?\n/g, '／')}（${row.year}）`;
      yearSelect.appendChild(option);
    }
    const missing557 = document.createElement('option');
    missing557.value = '557';
    missing557.textContent = '太平二年（557；原表梁段未收）';
    yearSelect.appendChild(missing557);

    for (const state of DATA.states) {
      const option = document.createElement('option');
      option.value = state.name;
      option.textContent = state.name;
      stateSelect.appendChild(option);
    }
    const appendix = document.createElement('option');
    appendix.value = '附錄';
    appendix.textContent = '附錄';
    stateSelect.appendChild(appendix);

    if (requestedState && fixedStateIndex(requestedState) < 0 && normalize(requestedState) !== normalize('附錄')) {
      const option = document.createElement('option');
      option.value = requestedState;
      option.textContent = `附錄定位：${requestedState}`;
      stateSelect.appendChild(option);
    }
    if (requestedYear && requestedYear >= 502 && requestedYear <= 557) yearSelect.value = String(requestedYear);
    if (requestedState) stateSelect.value = requestedState;
    searchInput.value = params.get('q') || '';
    matchOnly.checked = params.get('match') === '1';
  }

  function renderLegend() {
    const legend = $('personColorLegend');
    legend.replaceChildren();
    for (const category of COLORS.categories || []) {
      const span = document.createElement('span');
      span.className = 'yearbook-color-swatch';
      span.style.color = category.color;
      span.textContent = category.label;
      legend.appendChild(span);
    }
  }

  function selectedYear() {
    return Number(yearSelect.value) || null;
  }

  function selectedState() {
    return stateSelect.value.trim();
  }

  function updateUrls() {
    const url = new URL(window.location.href);
    const year = selectedYear();
    const state = selectedState();
    if (year) url.searchParams.set('year', String(year)); else url.searchParams.delete('year');
    if (state) url.searchParams.set('state', state); else url.searchParams.delete('state');
    if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim()); else url.searchParams.delete('q');
    if (matchOnly.checked) url.searchParams.set('match', '1'); else url.searchParams.delete('match');
    history.replaceState(null, '', url);

    const back = new URL('index.html', window.location.href);
    back.searchParams.set('dynasty', 'southern-liang');
    if (year) back.searchParams.set('year', String(year));
    if (state && state !== '附錄') back.searchParams.set('state', state);
    $('mainYearbookLink').href = back.href;
  }

  function buildHeader(targetStateIndex, focusAppendix) {
    thead.replaceChildren();
    const row = document.createElement('tr');
    const yearHead = document.createElement('th');
    yearHead.scope = 'col';
    yearHead.className = 'year-column';
    yearHead.textContent = '紀年（公元）';
    row.appendChild(yearHead);
    DATA.states.forEach((state, index) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = state.name;
      th.dataset.state = state.name;
      if (targetStateIndex === index) th.classList.add('is-target-column');
      else if (targetStateIndex >= 0 || focusAppendix) th.classList.add('is-muted-column');
      row.appendChild(th);
    });
    const count = document.createElement('th');
    count.scope = 'col';
    count.className = 'count-column';
    count.textContent = '出鎮皇弟皇子數';
    if (targetStateIndex >= 0 || focusAppendix) count.classList.add('is-muted-column');
    row.appendChild(count);
    const appendix = document.createElement('th');
    appendix.scope = 'col';
    appendix.className = 'appendix-column';
    appendix.textContent = '附錄';
    if (focusAppendix) appendix.classList.add('is-target-column');
    else if (targetStateIndex >= 0) appendix.classList.add('is-muted-column');
    row.appendChild(appendix);
    thead.appendChild(row);
  }

  function renderTable() {
    const year = selectedYear();
    const state = selectedState();
    const stateIndex = fixedStateIndex(state);
    const focusAppendix = Boolean(state) && stateIndex < 0;
    const query = normalize(searchInput.value);
    let targetCell = null;
    let targetRow = null;
    let visibleRows = 0;
    let matchedRows = 0;
    let targetAppendixContainsState = false;

    buildHeader(stateIndex, focusAppendix);
    tbody.replaceChildren();

    for (const record of DATA.rows) {
      const tr = document.createElement('tr');
      tr.dataset.year = String(record.year);
      const rowText = [record.reign, ...record.cells, record.royal_outpost_count, record.appendix].join('\n');
      const rowMatches = !query || normalize(rowText).includes(query);
      if (query && rowMatches) {
        tr.classList.add('is-search-match');
        matchedRows += 1;
      }
      const filteredByYear = year && year !== 557 && record.year !== year;
      const filteredBySearch = query && matchOnly.checked && !rowMatches;
      if (filteredByYear || filteredBySearch) tr.hidden = true;
      else visibleRows += 1;

      const yearCell = document.createElement('th');
      yearCell.scope = 'row';
      yearCell.className = 'year-column';
      yearCell.appendChild(document.createTextNode(`${record.reign.replace(/\r?\n/g, '／')}（${record.year}）`));
      const sourceRow = document.createElement('small');
      sourceRow.className = 'source-row';
      sourceRow.textContent = `原表第 ${record.source_row} 行`;
      yearCell.appendChild(sourceRow);
      tr.appendChild(yearCell);

      const isTargetYear = year === record.year;
      const appendixHasTarget = state && state !== '附錄' && textContainsState(record.appendix, state);
      if (isTargetYear) {
        tr.classList.add('is-target-row');
        targetRow = yearCell;
      }

      record.cells.forEach((value, index) => {
        const td = document.createElement('td');
        td.dataset.year = String(record.year);
        td.dataset.state = DATA.states[index].name;
        if (query && normalize(value).includes(query)) td.classList.add('is-search-match');
        if (stateIndex >= 0 && index !== stateIndex) td.classList.add('is-muted-column');
        if (focusAppendix) td.classList.add('is-muted-column');
        if (isTargetYear && stateIndex === index && !(!value && appendixHasTarget)) {
          td.classList.add('is-target-cell');
          targetCell = td;
        }
        renderCell(td, value, record.year);
        tr.appendChild(td);
      });

      const count = document.createElement('td');
      count.className = 'count-column';
      if (state) count.classList.add('is-muted-column');
      renderCell(count, record.royal_outpost_count, record.year);
      tr.appendChild(count);

      const appendix = document.createElement('td');
      appendix.className = 'appendix-column';
      appendix.dataset.year = String(record.year);
      appendix.dataset.state = '附錄';
      if (query && normalize(record.appendix).includes(query)) appendix.classList.add('is-search-match');
      if (stateIndex >= 0) appendix.classList.add('is-muted-column');
      if (isTargetYear && (focusAppendix || (stateIndex >= 0 && !record.cells[stateIndex] && appendixHasTarget))) {
        appendix.classList.remove('is-muted-column');
        appendix.classList.add('is-target-cell');
        targetCell = appendix;
        targetAppendixContainsState = appendixHasTarget || state === '附錄';
      }
      renderCell(appendix, record.appendix, record.year);
      tr.appendChild(appendix);
      tbody.appendChild(tr);
    }

    updateUrls();
    updateStatus({ year, state, stateIndex, query, visibleRows, matchedRows, targetCell, targetAppendixContainsState });

    requestAnimationFrame(() => {
      const focus = targetCell || targetRow || (stateIndex >= 0 ? thead.querySelector(`[data-state="${CSS.escape(DATA.states[stateIndex].name)}"]`) : focusAppendix ? thead.querySelector('.appendix-column') : null);
      if (focus) focus.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      else if (!year && !state) tableShell.scrollTo({ top: 0, left: 0 });
    });
  }

  function updateStatus({ year, state, stateIndex, query, visibleRows, matchedRows, targetCell, targetAppendixContainsState }) {
    if (year === 557) {
      status.innerHTML = '<strong>原表梁段未收557年：</strong> 工作簿將「太平二年／永定元年」置於後接南陳表段；本頁遵守只取蕭梁表段的範圍，不跨表抄入。下方仍顯示502—556年完整梁表。';
      return;
    }
    const pieces = [];
    let label = '';
    if (year) {
      const record = DATA.rows.find((item) => item.year === year);
      label = '已定位：';
      pieces.push(record ? `${record.reign.replace(/\r?\n/g, '／')}（${year}），原表第${record.source_row}行` : `公元${year}年`);
    } else {
      label = '資料範圍：';
      pieces.push(`${DATA.rows.length}個紀年行，${DATA.states.length}個固定州列`);
    }
    if (state) {
      if (stateIndex >= 0 && targetCell?.dataset.state === '附錄') pieces.push(`州列「${DATA.states[stateIndex].name}」原格為空；本年條目見附錄`);
      else if (stateIndex >= 0) pieces.push(`州列「${DATA.states[stateIndex].name}」${targetCell?.classList.contains('empty-cell') ? '；所定位原格為空' : ''}`);
      else if (state === '附錄') pieces.push('附錄列');
      else pieces.push(`附錄定位「${state}」${targetAppendixContainsState ? '' : '；本年附錄未見該州名'}`);
    }
    if (query) pieces.push(`檢索命中${matchedRows}個年份${matchOnly.checked ? `，目前顯示${visibleRows}行` : ''}`);
    const strong = document.createElement('strong');
    strong.textContent = label;
    status.replaceChildren(strong, document.createTextNode(pieces.join('；') + '。'));
  }

  function reset() {
    yearSelect.value = '';
    stateSelect.value = '';
    searchInput.value = '';
    matchOnly.checked = false;
    renderTable();
  }

  yearSelect.addEventListener('change', renderTable);
  stateSelect.addEventListener('change', renderTable);
  searchInput.addEventListener('input', renderTable);
  matchOnly.addEventListener('change', renderTable);
  $('resetYearbook').addEventListener('click', reset);
  $('historyBack').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else window.location.assign($('mainYearbookLink').href);
  });

  populateControls();
  renderLegend();
  renderTable();
})();
