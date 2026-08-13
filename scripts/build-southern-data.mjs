import fs from 'node:fs';
import path from 'node:path';
import OpenCC from 'opencc-js';

const root = path.resolve(import.meta.dirname, '..');
const adminSource = path.join(root, 'sources', '中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf_by_PaddleOCR-VL-1.6.md');
const governorSource = path.join(root, 'sources', '15366762.pdf_by_PaddleOCR-VL-1.6.md');
const adminLines = fs.readFileSync(adminSource, 'utf8').split(/\r?\n/);
const governorLines = fs.readFileSync(governorSource, 'utf8').split(/\r?\n/);
const toTraditional = OpenCC.Converter({ from: 'cn', to: 't' });

const dynastySpecs = {
  liu_song: {
    key: 'liu_song', label: '劉宋', prefix: 'ls', start: 420, dataStart: 421, end: 478,
    sectionStart: /^第一章 南朝宋實州郡縣沿革$/,
    sectionEnd: /^第二章 南朝宋大明八年/,
    governorStart: /^宋方鎮年表$/,
    governorEnd: /^齊方鎮年表$/,
    benchmarkYear: 464,
    benchmarkCounts: { states: 15, prefectures: 156, counties: 892 },
    note: '公元420年依使用者決定保留空白；421—478年按第六編年末口徑重建。'
  },
  southern_qi: {
    key: 'southern_qi', label: '蕭齊', prefix: 'sq', start: 479, dataStart: 479, end: 501,
    sectionStart: /^第一章 南朝齊實州郡縣沿革$/,
    sectionEnd: /^第二章 南朝齊建武四年/,
    governorStart: /^齊方鎮年表$/,
    governorEnd: /^梁方鎮年表$/,
    benchmarkYear: 497,
    benchmarkCounts: { states: 13, prefectures: 271, counties: 1024 },
    note: '479—501年按第七編年末口徑重建。'
  },
  southern_liang: {
    key: 'southern_liang', label: '蕭梁', prefix: 'sl', start: 502, dataStart: 502, end: 557,
    sectionStart: /^第一章 南朝梁實州郡縣沿革$/,
    sectionEnd: /^第二章 南朝梁中大同元年/,
    governorStart: /^梁方鎮年表$/,
    governorEnd: /^陳方鎮年表$/,
    benchmarkYear: 546,
    benchmarkCounts: { states: 89, prefectures: 340, counties: null },
    note: '梁代原書明言縣級隸屬難考；州郡逐年顯示，實縣另按九大區域列入「梁實縣存考」，不反推所屬郡。'
  }
};

function trad(value) {
  return toTraditional(String(value || ''))
    .replace(/裏/g, '里')
    .replace(/爲/g, '為')
    .replace(/硏/g, '研');
}

function stripLatex(value) {
  return String(value || '')
    .replace(/\$\s*\\underline\{\\text\{([^}]*)\}\}\s*\$/g, '$1')
    .replace(/\$\s*\\underline\{([^}]*)\}\s*\$/g, '$1')
    .replace(/\$\s*\^\{[^}]*\}\s*\$/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s*/, '')
    .replace(/[＊*]{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(value) {
  return trad(stripLatex(value))
    .replace(/(?<=\d)[一–－-](?=\d)/g, '—')
    .replace(/\((?=\d{3,4})/g, '（')
    .replace(/(?<=\d{3,4})\)/g, '）')
    .trim();
}

function isQiao(value) {
  return /\\underline\{/.test(String(value || ''));
}

function findBoundary(lines, matcher, from = 0) {
  for (let index = from; index < lines.length; index += 1) {
    if (matcher.test(cleanLine(lines[index]))) return index;
  }
  return -1;
}

function parsePeriodText(raw, spec, baseName) {
  const text = cleanLine(raw);
  const groups = [...text.matchAll(/[（(]([^（）()]*(?:\d{3,4}|[？?])[^（）()]*)[）)]/g)];
  const period = groups.map((match) => match[1]).find((value) => {
    const years = [...value.matchAll(/\d{3,4}/g)].map((m) => Number(m[0]));
    return years.some((year) => spec.start - 5 <= year && year <= spec.end + 5);
  });
  if (!period) {
    return [{ start: spec.dataStart, end: spec.end, name: baseName, raw: '年代未詳', uncertain: true, timeless: true }];
  }

  const phases = [];
  for (const rawPart of period.split(/[，,；;]/)) {
    const part = rawPart.trim();
    const match = part.match(/^(\d{3,4}|[？?])\s*(前|後)?\s*(?:—\s*(\d{3,4}|[？?])\s*(前|後)?)?\s*(.*)$/);
    if (!match) continue;
    const [, startRaw, startQualifier, endRaw, endQualifier, trailingRaw] = match;
    let start = /[？?]/.test(startRaw) ? spec.dataStart : Number(startRaw);
    let end = endRaw ? (/[？?]/.test(endRaw) ? spec.end : Number(endRaw)) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    start = Math.max(spec.dataStart, Math.min(spec.end, start));
    end = Math.max(spec.dataStart, Math.min(spec.end, end));
    if (start > end) [start, end] = [end, start];
    const trailing = trailingRaw.replace(/^[：:、，,\s]+/, '').trim();
    const phaseName = /^[\u3400-\u9fff、·（）()]+(?:州|郡|國|王畿|都尉)$/.test(trailing) ? trailing : baseName;
    phases.push({
      start, end, name: phaseName, raw: part,
      uncertain: /[？?]|前|後/.test(part) || Boolean(startQualifier || endQualifier),
      period_label: part
    });
  }
  return phases.length ? phases : [{ start: spec.dataStart, end: spec.end, name: baseName, raw: period, uncertain: true }];
}

function entityName(raw, kind) {
  let text = cleanLine(raw)
    .replace(/^[（(][一二三四五六七八九十百〇零—－-]+[）)]\s*/, '')
    .replace(/^\d+[.．、]\s*/, '')
    .replace(/\$.*$/, '')
    .trim();
  text = text.split(/[（(]/)[0].split(/——|—治|--治|，治|,治|，侨|，僑|,僑|，寄治|,寄治/)[0].trim();
  text = text.replace(/\s*\^\{.*$/, '').replace(/[，,。；;：:]$/, '').trim();
  if (kind === 'state') text = text.replace(/所轄實(?:郡|縣)+沿革$|沿革$/g, '').trim();
  return text;
}

function plausibleCountyName(name) {
  return Boolean(name)
    && name.length <= 18
    && /^[\u3400-\u9fff〇、·（）()]+$/.test(name)
    && !/^(按|注|又|據|卷|同|此|其|第|梁縣|實縣)/.test(name);
}

function sourceExcerpt(lines, index, stopIndex, maxLength = 900) {
  const chunks = [];
  for (let cursor = index; cursor < Math.min(stopIndex, index + 18); cursor += 1) {
    const text = cleanLine(lines[cursor]);
    if (!text || /^<|^#{1,6}\s/.test(lines[cursor])) continue;
    chunks.push(text);
    if (chunks.join(' ').length >= maxLength) break;
  }
  return chunks.join(' ').slice(0, maxLength);
}

function makeSource(lines, index, stopIndex) {
  return {
    book_page: null,
    pdf_page: null,
    ocr_line: index + 1,
    excerpt: sourceExcerpt(lines, index, stopIndex),
    editorial_note: '本條由第二OCR自動結構化；書內頁碼仍待逐頁覆核。'
  };
}

function stateHeading(raw, spec) {
  const value = cleanLine(raw);
  if (spec.key === 'southern_liang') {
    const match = value.match(/^[（(]?[一二三四五六七八九十百〇零]+[）)]?、?\s*(.+?沿革)$/);
    if (!match) return null;
    return entityName(match[1], 'state');
  }
  const match = value.match(/^第[一二三四五六七八九十百〇零]+節\s+(.+?沿革)$/);
  return match ? entityName(match[1], 'state') : null;
}

function prefectureHeading(raw) {
  const value = cleanLine(raw);
  const match = value.match(/^[（(][一二三四五六七八九十百〇零—－-]+[）)]\s*(.+)$/);
  if (!match) return null;
  const name = entityName(match[1], 'prefecture');
  return /(?:郡|國|尹|都尉|軍|二郡)$/.test(name) ? name : null;
}

function countyHeading(raw) {
  const value = cleanLine(raw);
  const match = value.match(/^\d+[.．、]\s*(.+)$/);
  if (!match) return null;
  const name = entityName(match[1], 'county');
  if (!plausibleCountyName(name)) return null;
  const hasPeriod = /[（(][^（）()]*(?:\d{3,4}|[？?])/.test(value);
  const explicitHeading = /^#{3,6}\s*/.test(raw);
  const underlined = isQiao(raw);
  if (!hasPeriod && !explicitHeading && !underlined) return null;
  return name;
}

function findStateHeader(lines, start, end, stateName) {
  const normalized = stateName.replace(/[、（）()]/g, '');
  let firstProse = -1;
  for (let index = start + 1; index < Math.min(end, start + 24); index += 1) {
    const value = cleanLine(lines[index]);
    if (!value || value.startsWith('按：')) continue;
    if (firstProse < 0 && !/^#{1,6}\s/.test(lines[index])) firstProse = index;
    if (value.replace(/[、（）()]/g, '').startsWith(normalized) && (/[（(]/.test(value) || /治/.test(value))) return index;
  }
  return firstProse >= 0 ? firstProse : start;
}

function buildAdministrativeDynasty(spec) {
  const start = findBoundary(adminLines, spec.sectionStart);
  const end = findBoundary(adminLines, spec.sectionEnd, start + 1);
  if (start < 0 || end < 0) throw new Error(`Unable to locate administrative section: ${spec.key}`);
  const headings = [];
  for (let index = start + 1; index < end; index += 1) {
    const name = stateHeading(adminLines[index], spec);
    if (name) headings.push({ index, name, qiao: isQiao(adminLines[index]) });
  }

  const states = [];
  for (let stateOrder = 0; stateOrder < headings.length; stateOrder += 1) {
    const heading = headings[stateOrder];
    let stateEnd = headings[stateOrder + 1]?.index ?? end;
    if (spec.key === 'southern_liang') {
      for (let index = heading.index + 1; index < stateEnd; index += 1) {
        if (/^附\s*.+?諸實縣存考$/.test(cleanLine(adminLines[index]))) {
          stateEnd = index;
          break;
        }
      }
    }
    const headerIndex = findStateHeader(adminLines, heading.index, stateEnd, heading.name);
    const state = {
      id: `${spec.prefix}_s${String(stateOrder + 1).padStart(4, '0')}`,
      name: heading.name,
      order: stateOrder + 1,
      qiao: heading.qiao || isQiao(adminLines[headerIndex]),
      phases: parsePeriodText(adminLines[headerIndex], spec, heading.name),
      source: makeSource(adminLines, headerIndex, stateEnd),
      prefectures: []
    };

    const prefHeadings = [];
    for (let index = heading.index + 1; index < stateEnd; index += 1) {
      const name = prefectureHeading(adminLines[index]);
      if (name) prefHeadings.push({ index, name, qiao: isQiao(adminLines[index]) });
    }

    if (!prefHeadings.length) {
      const counties = [];
      for (let index = heading.index + 1; index < stateEnd; index += 1) {
        const name = countyHeading(adminLines[index]);
        if (!name) continue;
        counties.push({ index, name, qiao: isQiao(adminLines[index]) });
      }
      if (counties.length) prefHeadings.push({ index: heading.index, name: '', qiao: false, directCounties: true, countyCandidates: counties });
    }

    for (let prefOrder = 0; prefOrder < prefHeadings.length; prefOrder += 1) {
      const prefHeading = prefHeadings[prefOrder];
      const prefEnd = prefHeadings[prefOrder + 1]?.index ?? stateEnd;
      const pref = {
        id: `${spec.prefix}_p${String(states.reduce((sum, item) => sum + item.prefectures.length, 0) + state.prefectures.length + 1).padStart(5, '0')}`,
        base_name: prefHeading.name,
        order: prefOrder + 1,
        qiao: prefHeading.qiao,
        direct_counties: Boolean(prefHeading.directCounties),
        display_label: prefHeading.directCounties ? '州所轄實縣' : '',
        phases: prefHeading.directCounties
          ? [{ start: spec.dataStart, end: spec.end, name: '', raw: '州所轄實縣', uncertain: false }]
          : parsePeriodText(adminLines[prefHeading.index], spec, prefHeading.name),
        source: makeSource(adminLines, prefHeading.index, prefEnd),
        counties: []
      };
      const countyCandidates = prefHeading.countyCandidates || [];
      if (!prefHeading.countyCandidates) {
        for (let index = prefHeading.index + 1; index < prefEnd; index += 1) {
          const name = countyHeading(adminLines[index]);
          if (name) countyCandidates.push({ index, name, qiao: isQiao(adminLines[index]) });
        }
      }
      for (let countyOrder = 0; countyOrder < countyCandidates.length; countyOrder += 1) {
        const candidate = countyCandidates[countyOrder];
        const countyEnd = countyCandidates[countyOrder + 1]?.index ?? prefEnd;
        const phases = parsePeriodText(adminLines[candidate.index], spec, candidate.name);
        pref.counties.push({
          id: `${spec.prefix}_c${String(states.reduce((sum, item) => sum + item.prefectures.reduce((n, p) => n + p.counties.length, 0), 0) + state.prefectures.reduce((n, p) => n + p.counties.length, 0) + countyOrder + 1).padStart(5, '0')}`,
          base_name: candidate.name,
          order: countyOrder + 1,
          qiao: candidate.qiao,
          timeless: phases.some((phase) => phase.timeless),
          phases,
          source: makeSource(adminLines, candidate.index, countyEnd)
        });
      }
      state.prefectures.push(pref);
    }
    states.push(state);
  }

  return {
    meta: {
      title: `${spec.label}年末州郡縣表`, years: [spec.start, spec.end], data_years: [spec.dataStart, spec.end],
      benchmark_year: spec.benchmarkYear,
      benchmark_counts: spec.benchmarkCounts,
      source: '《中國行政區劃通史·三國兩晉南朝卷（下）》',
      date_rule: '依各編凡例所定年末口徑，直接採用作者折算後的存續年段。',
      caveat: spec.note,
      generated: new Date().toISOString().slice(0, 10),
      version: '2026-08-13.1-ocr-structured'
    },
    states,
    county_appendices: spec.key === 'southern_liang' ? buildLiangCountyAppendices(start, end, spec) : []
  };
}

function buildLiangCountyAppendices(start, end, spec) {
  const appendices = [];
  const headings = [];
  for (let index = start; index < end; index += 1) {
    const value = cleanLine(adminLines[index]);
    const match = value.match(/^附\s*(.+?)諸實縣存考$/);
    if (match) headings.push({ index, region: match[1].trim() });
  }
  for (let appendixOrder = 0; appendixOrder < headings.length; appendixOrder += 1) {
    const heading = headings[appendixOrder];
    const appendixEnd = headings[appendixOrder + 1]?.index ?? end;
    const counties = [];
    for (let index = heading.index + 1; index < appendixEnd; index += 1) {
      const name = countyHeading(adminLines[index]);
      if (!name) continue;
      counties.push({
        id: `${spec.prefix}_a${String(appendixOrder + 1).padStart(2, '0')}_c${String(counties.length + 1).padStart(4, '0')}`,
        name,
        base_name: name,
        order: counties.length + 1,
        qiao: isQiao(adminLines[index]),
        timeless: parsePeriodText(adminLines[index], spec, name).some((phase) => phase.timeless),
        phases: parsePeriodText(adminLines[index], spec, name),
        source: makeSource(adminLines, index, appendixEnd)
      });
    }
    appendices.push({
      id: `${spec.prefix}_appendix_${String(appendixOrder + 1).padStart(2, '0')}`,
      region: heading.region,
      order: appendixOrder + 1,
      counties,
      source: makeSource(adminLines, heading.index, appendixEnd)
    });
  }
  return appendices;
}

function isYearHeading(raw, spec) {
  const value = cleanLine(raw);
  const match = value.match(/^(.+?)[（(](\d{3,4})[）)]/);
  if (!match) return null;
  const year = Number(match[2]);
  if (year < spec.start || year > spec.end) return null;
  return { year, raw: value, label: `${match[1].trim()}（${year}）` };
}

function buildGovernorDynasty(spec) {
  const start = findBoundary(governorLines, spec.governorStart);
  const end = findBoundary(governorLines, spec.governorEnd, start + 1);
  if (start < 0 || end < 0) throw new Error(`Unable to locate governor section: ${spec.key}`);
  const yearHeadings = [];
  const seenYears = new Set();
  for (let index = start + 1; index < end; index += 1) {
    const raw = governorLines[index].trim();
    let continuation = '';
    if (/^#{3,4}\s+/.test(raw)) {
      for (let cursor = index + 1; cursor < Math.min(end, index + 5); cursor += 1) {
        if (cleanLine(governorLines[cursor])) { continuation = governorLines[cursor]; break; }
      }
    }
    const heading = isYearHeading(governorLines[index], spec)
      || (/^#{3,4}\s+/.test(raw) ? isYearHeading(`${governorLines[index]} ${continuation}`, spec) : null);
    if (!heading || seenYears.has(heading.year)) continue;
    const headingLike = /^#{3,4}\s+/.test(raw) || (!raw.startsWith('[') && cleanLine(raw).length <= 84);
    if (!headingLike) continue;
    seenYears.add(heading.year);
    yearHeadings.push({ index, ...heading });
  }
  const output = { meta: { title: `${spec.label}方鎮長官資料`, source: '魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》', years: [spec.start, spec.end], note: '按年表逐年州條抽取；方鎮表無本年條目不等於該州沒有刺史。' }, year_labels: {}, years: {} };
  for (let yearOrder = 0; yearOrder < yearHeadings.length; yearOrder += 1) {
    const heading = yearHeadings[yearOrder];
    const yearEnd = yearHeadings[yearOrder + 1]?.index ?? end;
    output.year_labels[String(heading.year)] = heading.label;
    const records = [];
    const stateHeadings = [];
    for (let index = heading.index + 1; index < yearEnd; index += 1) {
      const value = cleanLine(governorLines[index]);
      const match = value.match(/^\[([^\]]+)\](.*)$/);
      if (match) stateHeadings.push({ index, state: match[1].trim(), tail: match[2].trim() });
    }
    for (let stateOrder = 0; stateOrder < stateHeadings.length; stateOrder += 1) {
      const stateHeading = stateHeadings[stateOrder];
      const stateEnd = stateHeadings[stateOrder + 1]?.index ?? yearEnd;
      const lines = [];
      if (stateHeading.tail) lines.push(stateHeading.tail);
      for (let index = stateHeading.index + 1; index < stateEnd; index += 1) {
        const value = cleanLine(governorLines[index]);
        if (value && !/^<|^#{1,6}\s/.test(governorLines[index])) lines.push(value);
      }
      let evidenceStart = lines.findIndex((line) => /^(《|按：|校勘記|注：|又按：)/.test(line));
      if (evidenceStart < 0) evidenceStart = lines.length;
      records.push({
        state: stateHeading.state,
        order: stateOrder + 1,
        summary_lines: lines.slice(0, evidenceStart),
        evidence_lines: lines.slice(evidenceStart),
        source_line: stateHeading.index + 1
      });
    }
    output.years[String(heading.year)] = { raw_heading: heading.raw, records };
  }
  return output;
}

const administrative = { meta: { title: '宋齊梁年末州郡縣資料', generated: new Date().toISOString().slice(0, 10) }, dynasties: {} };
const governors = { meta: { title: '宋齊梁方鎮長官資料', generated: new Date().toISOString().slice(0, 10) }, dynasties: {} };
for (const spec of Object.values(dynastySpecs)) {
  administrative.dynasties[spec.key] = buildAdministrativeDynasty(spec);
  governors.dynasties[spec.key] = buildGovernorDynasty(spec);
}

fs.writeFileSync(path.join(root, 'data', 'southern-data.js'), `window.SOUTHERN_DATA = ${JSON.stringify(administrative, null, 2)};\n`);
fs.writeFileSync(path.join(root, 'data', 'southern-governors.js'), `window.SOUTHERN_GOVERNORS = ${JSON.stringify(governors, null, 2)};\n`);

for (const spec of Object.values(dynastySpecs)) {
  const data = administrative.dynasties[spec.key];
  const governorData = governors.dynasties[spec.key];
  const prefectures = data.states.reduce((sum, state) => sum + state.prefectures.length, 0);
  const counties = data.states.reduce((sum, state) => sum + state.prefectures.reduce((n, pref) => n + pref.counties.length, 0), 0);
  const appendixCounties = data.county_appendices.reduce((sum, appendix) => sum + appendix.counties.length, 0);
  console.log(`${spec.label}: ${data.states.length}州段、${prefectures}郡段、${counties}隸屬縣、${appendixCounties}存考縣、${Object.keys(governorData.years).length}方鎮年份`);
}
