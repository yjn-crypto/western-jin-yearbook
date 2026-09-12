(() => {
  'use strict';

  // Keep workbook text and non-colour formatting verbatim. When semantic name
  // ranges are supplied, only names (including their titles) may retain colour.
  const CSS_KEYS = new Set([
    'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight',
    'fontStyle', 'textDecoration', 'textDecorationLine', 'textDecorationStyle',
    'textDecorationColor', 'verticalAlign', 'textAlign', 'whiteSpace',
    'textIndent', 'letterSpacing', 'lineHeight',
  ]);

  function applyStyle(element, style = {}) {
    for (const [key, value] of Object.entries(style || {})) {
      if (CSS_KEYS.has(key) && value !== null && value !== undefined) {
        element.style[key] = String(value);
      }
    }
    return element;
  }

  function cellRuns(cell = {}) {
    const text = String(cell.text ?? '');
    const runs = Array.isArray(cell.runs) ? cell.runs : [];
    // A malformed payload must not alter the visible source text.
    return runs.length && runs.map((run) => String(run.text ?? '')).join('') === text
      ? runs
      : [{ text, style: {} }];
  }

  function appendCell(element, cell = {}, options = {}) {
    if (options.replace !== false) element.replaceChildren();
    element.classList.add('governor-source-format');
    // HTML decorations on a parent cannot be cancelled by a child run. Put
    // their effective value on each run so Excel's explicit “no underline”
    // remains meaningful inside an otherwise underlined cell.
    const baseStyle = { ...(cell.style || {}) };
    delete baseStyle.textDecoration;
    delete baseStyle.textDecorationLine;
    if (options.personMatches) baseStyle.color = '#000000';
    applyStyle(element, baseStyle);
    element.style.textDecoration = 'none';
    element.style.whiteSpace = 'pre-wrap';
    if (cell.address) element.dataset.sourceCell = cell.address;
    let offset = 0;
    const segments = [];
    for (const run of cellRuns(cell)) {
      const value = String(run.text ?? '');
      const start = offset, end = start + value.length;
      const points = new Set([start, end]);
      for (const match of options.personMatches || []) {
        if (match.index > start && match.index < end) points.add(match.index);
        if (match.index + match.length > start && match.index + match.length < end) points.add(match.index + match.length);
      }
      const boundaries = [...points].sort((a, b) => a - b);
      for (let index = 0; index < boundaries.length - 1; index++) {
        const from = boundaries[index], to = boundaries[index + 1];
        const person = options.personMatches?.find(match => match.index <= from && match.index + match.length >= to);
        segments.push({ ...run, text: value.slice(from - start, to - start), person });
      }
      offset = end;
    }
    for (const run of segments) {
      const span = document.createElement('span');
      span.className = 'governor-source-run';
      span.textContent = String(run.text ?? '');
      const runStyle = { ...(cell.style || {}), ...(run.style || {}) };
      if (options.personMatches) {
        runStyle.color = run.person ? (run.person.colorStyle?.color || runStyle.color || '#000000') : '#000000';
        if (run.person) {
          span.dataset.person = run.person.person.name;
          if (run.person.colorStyle) span.title = `${run.person.person.name}：${run.person.colorStyle.source}`;
        }
      }
      // A cell's top/middle/bottom alignment is not an inline font baseline.
      // Only the font's actual superscript/subscript setting belongs here.
      if (!['baseline', 'super', 'sub'].includes(runStyle.verticalAlign)) {
        runStyle.verticalAlign = 'baseline';
      }
      applyStyle(span, runStyle);
      element.appendChild(span);
    }
    return element;
  }

  function sliceRuns(cell = {}, start = 0, end = String(cell.text ?? '').length) {
    const text = String(cell.text ?? '');
    const from = Math.max(0, Math.min(text.length, start));
    const to = Math.max(from, Math.min(text.length, end));
    let offset = 0;
    const runs = [];
    for (const run of cellRuns(cell)) {
      const runText = String(run.text ?? '');
      const left = Math.max(0, from - offset);
      const right = Math.min(runText.length, to - offset);
      if (right > left) runs.push({ text: runText.slice(left, right), style: { ...(run.style || {}) } });
      offset += runText.length;
    }
    return { address: cell.address, text: text.slice(from, to), style: { ...(cell.style || {}) }, runs };
  }

  function findTextRuns(cell, text, occurrence = 0) {
    if (!cell || !text || occurrence < 0) return null;
    const source = String(cell.text ?? '');
    const needle = String(text);
    let start = -needle.length;
    for (let index = 0; index <= occurrence; index += 1) {
      start = source.indexOf(needle, start + needle.length);
      if (start < 0) return null;
    }
    return sliceRuns(cell, start, start + needle.length);
  }

  window.GOVERNOR_SOURCE_FORMAT = { applyStyle, appendCell, sliceRuns, findTextRuns };
})();
