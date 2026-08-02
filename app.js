(() => {
  'use strict';

  const DATA = window.JIN_DATA;
  if (!DATA) {
    document.body.innerHTML = '<p style="padding:2rem">資料檔案未載入。</p>';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const yearSelect = $('yearSelect');
  const stateSelect = $('stateSelect');
  const searchInput = $('searchInput');
  const changedOnly = $('changedOnly');
  const results = $('results');
  const sourceModal = $('sourceModal');
  const sourceModalClose = $('sourceModalClose');
  const citationRegistry = new Map();

  function normalizeName(value) {
    return String(value || '')
      .replace(/[\s·`?？※]/g, '')
      .replace(/(王國|公國|侯國|國|郡|尹|屬國都尉|典農校尉|縣)$/g, '')
      .replace(/臺/g, '台');
  }

  function isKingdom(name, level, phase) {
    if (phase && typeof phase.is_fief === 'boolean') return phase.is_fief;
    if (level !== 'prefecture') return false;
    const n = String(name || '');
    if (n.includes('屬國都尉')) return false;
    return /(王國|公國|侯國|國)$/.test(n);
  }

  function activePhase(entity, year) {
    return (entity.phases || [])
      .filter((phase) => Number(phase.start) <= year && year <= Number(phase.end))
      .sort((a, b) => Number(b.start) - Number(a.start))[0] || null;
  }

  function sourceKey(source) {
    if (!source) return '';
    return `${source.book_page || ''}|${source.pdf_page || ''}|${source.excerpt || ''}`;
  }

  function dedupeSources(sources) {
    const seen = new Set();
    const output = [];
    for (const source of sources || []) {
      const key = sourceKey(source);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(source);
    }
    return output;
  }

  function buildSnapshot(year) {
    const states = [];
    for (const stateEntity of DATA.states) {
      const statePhase = activePhase(stateEntity, year);
      if (!statePhase) continue;
      const state = {
        id: stateEntity.id,
        name: statePhase.name || stateEntity.name,
        order: stateEntity.order,
        uncertain: Boolean(statePhase.uncertain),
        source: statePhase.source || stateEntity.source,
        entity: stateEntity,
        rows: []
      };

      for (const prefEntity of stateEntity.prefectures || []) {
        const prefPhase = activePhase(prefEntity, year);
        if (!prefPhase) continue;
        const row = {
          id: prefEntity.id,
          name: prefPhase.name || prefEntity.base_name,
          order: prefEntity.order,
          uncertain: Boolean(prefPhase.uncertain),
          source: prefPhase.source || prefEntity.source,
          entity: prefEntity,
          kingdom: isKingdom(prefPhase.name || prefEntity.base_name, 'prefecture', prefPhase),
          counties: []
        };
        for (const countyEntity of prefEntity.counties || []) {
          const countyPhase = activePhase(countyEntity, year);
          if (!countyPhase) continue;
          row.counties.push({
            id: countyEntity.id,
            name: countyPhase.name || countyEntity.base_name,
            order: countyEntity.order,
            uncertain: Boolean(countyPhase.uncertain),
            source: countyPhase.source || countyEntity.source,
            entity: countyEntity,
            kingdom: isKingdom(countyPhase.name || countyEntity.base_name, 'county', countyPhase)
          });
        }
        row.counties.sort((a, b) => a.order - b.order);
        state.rows.push(row);
      }
      state.rows.sort((a, b) => a.order - b.order);
      states.push(state);
    }
    states.sort((a, b) => a.order - b.order);
    return states;
  }

  function mapById(items) {
    return new Map((items || []).map((item) => [item.id, item]));
  }

  function makeChange(summary, sources, kind, label) {
    return {
      summary,
      sources: dedupeSources(sources),
      kind,
      label,
      number: null
    };
  }

  function compareSnapshots(current, previous, year) {
    const previousStateMap = mapById(previous);
    const removedChanges = [];

    for (const state of current) {
      const oldState = previousStateMap.get(state.id);
      const stateSources = [];
      const stateNotes = [];
      if (!oldState) {
        stateNotes.push(`${state.name}於本年年末見於表中`);
        stateSources.push(state.source);
      } else if (oldState.name !== state.name) {
        stateNotes.push(`${oldState.name}改稱${state.name}`);
        stateSources.push(state.source, oldState.source);
      }

      const oldPrefMap = mapById(oldState ? oldState.rows : []);
      for (const row of state.rows) {
        const oldRow = oldPrefMap.get(row.id);
        const rowSources = [];
        const rowNotes = [];
        if (!oldRow) {
          rowNotes.push(`${row.name}為本年新增、復置或改隸至本州`);
          rowSources.push(row.source);
        } else if (oldRow.name !== row.name) {
          rowNotes.push(`${oldRow.name}改稱${row.name}`);
          rowSources.push(row.source, oldRow.source);
        }

        const oldCountyMap = mapById(oldRow ? oldRow.counties : []);
        for (const county of row.counties) {
          const oldCounty = oldCountyMap.get(county.id);
          if (!oldCounty) {
            county.change = makeChange(
              `${county.name}為本年新增、復置、改名或改隸至${row.name}`,
              [county.source],
              'county',
              `${state.name}·${row.name}：${county.name}`
            );
          } else if (oldCounty.name !== county.name) {
            county.change = makeChange(
              `${oldCounty.name}改稱${county.name}`,
              [county.source, oldCounty.source],
              'county',
              `${state.name}·${row.name}：${oldCounty.name}→${county.name}`
            );
          }
        }

        if (oldRow) {
          const currentCountyMap = mapById(row.counties);
          const removedCounties = oldRow.counties.filter((county) => !currentCountyMap.has(county.id));
          if (removedCounties.length) {
            rowNotes.push(`${removedCounties.map((county) => county.name).join('、')}於本年不再隸屬${row.name}`);
            rowSources.push(...removedCounties.map((county) => county.source));
            for (const county of removedCounties) {
              removedChanges.push(makeChange(
                `${county.name}於${year}年末已不見於${row.name}所轄`,
                [county.source],
                'removed-county',
                `${state.name}·${row.name}：撤出／廢省 ${county.name}`
              ));
            }
          }
        }

        if (rowNotes.length) {
          row.change = makeChange(
            rowNotes.join('；'),
            rowSources,
            'prefecture',
            `${state.name}：${row.name}`
          );
        }
      }

      if (oldState) {
        const currentPrefMap = mapById(state.rows);
        const removedPrefs = oldState.rows.filter((row) => !currentPrefMap.has(row.id));
        if (removedPrefs.length) {
          stateNotes.push(`${removedPrefs.map((row) => row.name).join('、')}於本年不再隸屬${state.name}`);
          stateSources.push(...removedPrefs.map((row) => row.source));
          for (const row of removedPrefs) {
            removedChanges.push(makeChange(
              `${row.name}於${year}年末已不見於${state.name}所轄`,
              [row.source],
              'removed-prefecture',
              `${state.name}：撤出／廢省 ${row.name}`
            ));
          }
        }
      }

      if (stateNotes.length) {
        state.change = makeChange(
          stateNotes.join('；'),
          stateSources,
          'state',
          state.name
        );
      }
    }

    const currentStateMap = mapById(current);
    for (const oldState of previous) {
      if (currentStateMap.has(oldState.id)) continue;
      removedChanges.push(makeChange(
        `${oldState.name}於${year}年末已不見於州級政區表中`,
        [oldState.source],
        'removed-state',
        `撤出／廢省 ${oldState.name}`
      ));
    }

    citationRegistry.clear();
    let number = 0;
    const register = (change) => {
      if (!change || change.number) return;
      number += 1;
      change.number = number;
      citationRegistry.set(number, change);
    };

    for (const state of current) {
      register(state.change);
      for (const row of state.rows) {
        register(row.change);
        for (const county of row.counties) register(county.change);
      }
    }
    for (const change of removedChanges) register(change);

    return { states: current, removedChanges, citationCount: number };
  }

  function createCitationButton(change) {
    if (!change || !change.number) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'citation-link';
    button.textContent = `[${change.number}]`;
    button.title = '查看變動依據';
    button.setAttribute('aria-label', `查看註釋 ${change.number}`);
    button.dataset.citation = String(change.number);
    return button;
  }

  function makeNameSpan(item, className = '') {
    const span = document.createElement('span');
    span.className = [
      className,
      item.kingdom ? 'kingdom' : '',
      item.change ? 'changed' : '',
      item.uncertain ? 'uncertain' : ''
    ].filter(Boolean).join(' ');
    span.textContent = item.name;
    if (item.change) span.title = item.change.summary;
    const wrapper = document.createElement('span');
    wrapper.className = 'name-with-citation';
    wrapper.appendChild(span);
    const citation = createCitationButton(item.change);
    if (citation) wrapper.appendChild(citation);
    return wrapper;
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
          : row.counties.filter((county) => normalizeName(county.name).includes(query));
        const hasChangedCounty = matchingCounties.some((county) => county.change);
        if (query && !rowMatches && matchingCounties.length === 0) continue;
        if (onlyChanged && !row.change && !hasChangedCounty) continue;
        rows.push({ ...row, counties: matchingCounties });
      }
      if (rows.length || (onlyChanged && state.change)) filtered.push({ ...state, rows });
    }
    return filtered;
  }

  function renderState(state) {
    const article = document.createElement('article');
    article.className = 'state-card';

    const heading = document.createElement('div');
    heading.className = 'state-heading';
    const h2 = document.createElement('h2');
    const stateName = makeNameSpan({
      name: state.name,
      change: state.change,
      uncertain: state.uncertain,
      kingdom: false
    });
    h2.appendChild(stateName);
    const meta = document.createElement('span');
    meta.className = 'state-meta';
    const countyTotal = state.rows.reduce((sum, row) => sum + row.counties.length, 0);
    meta.textContent = `${state.rows.length} 郡國 · ${countyTotal} 縣級政區`;
    heading.append(h2, meta);
    article.appendChild(heading);

    if (!state.rows.length) return article;

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    for (const label of ['郡、國及郡級政區', '所屬縣級政區']) {
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
        badge.textContent = '封國';
        tdName.appendChild(badge);
      }
      const ref = document.createElement('span');
      ref.className = 'source-ref';
      ref.textContent = row.source && row.source.book_page
        ? `沿革：書內第 ${row.source.book_page} 頁`
        : '沿革：頁碼待校';
      tdName.appendChild(ref);

      const tdCounties = document.createElement('td');
      if (!row.counties.length) {
        const empty = document.createElement('span');
        empty.className = 'empty';
        empty.textContent = '本年無可顯示的縣級政區';
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

  function renderSummary(states, removedChanges) {
    const prefCount = states.reduce((sum, state) => sum + state.rows.length, 0);
    const countyCount = states.reduce(
      (sum, state) => sum + state.rows.reduce((inner, row) => inner + row.counties.length, 0),
      0
    );
    const visibleChanges = states.reduce(
      (sum, state) => sum + (state.change ? 1 : 0) + state.rows.reduce(
        (inner, row) => inner + (row.change ? 1 : 0) + row.counties.filter((county) => county.change).length,
        0
      ),
      0
    );
    $('stateCount').textContent = states.length;
    $('prefCount').textContent = prefCount;
    $('countyCount').textContent = countyCount;
    $('changeCount').textContent = visibleChanges + removedChanges.length;
  }

  function renderChangePanel(states, removedChanges) {
    const changes = [];
    for (const state of states) {
      if (state.change) changes.push(state.change);
      for (const row of state.rows) {
        if (row.change) changes.push(row.change);
        for (const county of row.counties) if (county.change) changes.push(county.change);
      }
    }
    changes.push(...removedChanges);

    const panel = $('changePanel');
    const list = $('changeList');
    list.replaceChildren();
    if (!changes.length) {
      panel.hidden = true;
      return;
    }

    const group = document.createElement('div');
    group.className = 'change-groups';
    for (const change of changes) {
      const item = document.createElement('span');
      item.className = 'change-index-item';
      item.textContent = change.label;
      const citation = createCitationButton(change);
      if (citation) item.appendChild(citation);
      group.appendChild(item);
    }
    list.appendChild(group);
    panel.hidden = false;
  }

  function openCitation(number) {
    const change = citationRegistry.get(Number(number));
    if (!change) return;
    $('sourceModalTitle').textContent = `註釋 [${change.number}]`;
    $('sourceModalSummary').textContent = change.summary;
    const body = $('sourceModalBody');
    body.replaceChildren();

    if (!change.sources.length) {
      const p = document.createElement('p');
      p.textContent = '此項頁碼仍待校勘。';
      body.appendChild(p);
    } else {
      for (const source of change.sources) {
        const article = document.createElement('article');
        article.className = 'source-entry';
        const heading = document.createElement('h3');
        const bookPage = source.book_page ? `書內第 ${source.book_page} 頁` : '書內頁碼待校';
        const pdfPage = source.pdf_page ? `PDF 第 ${source.pdf_page} 頁` : 'PDF頁碼待校';
        heading.textContent = `${bookPage}（${pdfPage}）`;
        const excerpt = document.createElement('p');
        excerpt.textContent = source.excerpt || '摘錄待補。';
        article.append(heading, excerpt);
        body.appendChild(article);
      }
    }

    sourceModal.hidden = false;
    document.body.classList.add('modal-open');
    sourceModalClose.focus();
  }

  function closeCitation() {
    sourceModal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function filterRemovedChanges(changes) {
    const selectedState = stateSelect.value;
    const query = normalizeName(searchInput.value.trim());
    return changes.filter((change) => {
      if (selectedState && !change.label.startsWith(selectedState)) return false;
      if (query && !normalizeName(change.label).includes(query)) return false;
      return true;
    });
  }

  function render() {
    const year = Number(yearSelect.value);
    const current = buildSnapshot(year);
    const isBaselineYear = year === DATA.meta.years[0];
    const previous = isBaselineYear ? current : buildSnapshot(year - 1);
    const comparison = compareSnapshots(current, previous, year);
    const filtered = applyFilters(comparison.states);
    const filteredRemoved = filterRemovedChanges(comparison.removedChanges);

    results.replaceChildren();
    if (!filtered.length) {
      const p = document.createElement('div');
      p.className = 'no-results';
      p.textContent = '沒有符合目前條件的政區。';
      results.appendChild(p);
    } else {
      for (const state of filtered) results.appendChild(renderState(state));
    }

    renderSummary(filtered, filteredRemoved);
    renderChangePanel(filtered, filteredRemoved);
    $('statusText').textContent = isBaselineYear
      ? `公元${year}年為本資料集的基準年，不以缺失的前一年資料判定變動；州、郡、縣均保留原書次序。`
      : `公元${year}年所示為年末狀態；與公元${year - 1}年年末相比的變動以紅色及註釋標示。資料已依新版OCR重新抽取，並保留原書州、郡、縣次序。`;
    document.title = `西晉${year}年末州郡縣表`;
  }

  function init() {
    const [start, end] = DATA.meta.years;
    for (let year = start; year <= end; year += 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = `公元 ${year} 年`;
      if (year === 281) option.selected = true;
      yearSelect.appendChild(option);
    }

    for (const state of DATA.states) {
      const option = document.createElement('option');
      option.value = state.name;
      option.textContent = state.name;
      stateSelect.appendChild(option);
    }

    yearSelect.addEventListener('change', render);
    stateSelect.addEventListener('change', render);
    searchInput.addEventListener('input', render);
    changedOnly.addEventListener('change', render);
    document.addEventListener('click', (event) => {
      const citation = event.target.closest('[data-citation]');
      if (citation) openCitation(citation.dataset.citation);
      if (event.target.matches('[data-close-modal]')) closeCitation();
    });
    sourceModalClose.addEventListener('click', closeCitation);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !sourceModal.hidden) closeCitation();
    });

    render();
  }

  init();
})();
