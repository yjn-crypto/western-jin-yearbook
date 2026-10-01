// Use literal roster matches and per-character XLSX run colours. A governor's
// cell colour must never be copied to every official mentioned in that cell.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {} });
for (const file of ['data/liang-person-colors.js', 'data/liang-person-evidence.js', 'data/liang-local-officials.js', 'data/liang-fiefs.js', 'liang-fief-rules.js', 'liang-person-formats.js', 'data/liang-yearbook-formats.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const w = context.window;
const categories = new Map(w.LIANG_PERSON_COLORS.categories.map(item => [item.color.toUpperCase(), item.label]));
for (const [color, label] of [['#00B0F0', '宗室鄉侯'], ['#7B4B23', '疏遠宗室'], ['#602826', '疏遠宗室'], ['#000000', '原表未標身份色']]) categories.set(color, label);
const people = new Map();
let occurrences = 0;
for (const row of w.LIANG_YEARBOOK_FORMATS.rows) {
  for (const cell of [...row.cells, row.auxiliary, row.appendix, ...(row.extra_cells || [])]) {
    for (const match of w.LIANG_PERSON_FORMATS.matches(cell.text, row.year)) {
      const name = match.person.name;
      const start = match.index, end = start + match.length;
      let offset = 0;
      const sourceColors = new Set();
      for (const run of cell.runs || []) {
        const next = offset + run.text.length;
        if (next > start && offset < end && run.text.slice(Math.max(0, start-offset), Math.min(run.text.length, end-offset)).trim()) {
          sourceColors.add((run.style.color || cell.style.color || '#000000').toUpperCase());
        }
        offset = next;
      }
      if (!people.has(name)) people.set(name, { name, aliases: [...match.person.aliases], years: {} });
      const person = people.get(name);
      if (!person.years[row.year]) person.years[row.year] = { evidence: [] };
      person.years[row.year].evidence.push({ address: cell.address, text: match.text, source_colors: [...sourceColors] });
      occurrences += 1;
    }
  }
}
const conflicts = [], corrections = [];
for (const person of people.values()) for (const [year, item] of Object.entries(person.years)) {
  const colors = [...new Set(item.evidence.flatMap(evidence => evidence.source_colors).filter(color => color !== '#000000'))];
  // The shared Chen/Liang display rule makes independently known, non-Xiao
  // people green; inherited red office text is not royal identity evidence.
  const nonRoyal = !person.name.startsWith('蕭');
  item.color = nonRoyal ? '#00B050' : colors.length === 1 ? colors[0] : '#000000';
  item.category = nonRoyal ? '庶姓' : colors.length > 1 ? '原表本年身份色有異，待核' : categories.get(item.color) || '原表人物色';
  item.pending = !nonRoyal && colors.length !== 1;
  item.conflict = !nonRoyal && colors.length > 1;
  item.source = `《${w.LIANG_YEARBOOK_FORMATS.meta.source_file}》Sheet1 ${item.evidence.map(evidence => evidence.address).join('、')}；${year}年逐段字色${nonRoyal ? '；異姓姓名綠色，官職及敘述黑色' : ''}`;
  item.basis = nonRoyal ? 'workbook_name_and_shared_person_rule' : 'workbook_rich_text';
  const old = w.LIANG_PERSON_COLORS.people.find(item => w.LIANG_PERSON_FORMATS.canonicalName(item.name) === person.name)?.years[year];
  if (old && old.color !== item.color) corrections.push({ name: person.name, year: Number(year), previous: old.color, current: item.color, evidence: item.evidence });
  if (!nonRoyal && colors.length > 1) conflicts.push({ name: person.name, year: Number(year), colors, evidence: item.evidence });
}
const output = { meta: { source_file: w.LIANG_YEARBOOK_FORMATS.meta.source_file, source_sheet: 'Sheet1', source_sha256: w.LIANG_YEARBOOK_FORMATS.meta.source_sha256,
  years: [502, 556], imported: '2026-10-01', policy: '只匹配有名錄依據的完整姓名與爵號；逐段取色，同年異色保留待核；不由蕭姓推宗室，不跨年補色。',
  people: people.size, annual_person_entries: [...people.values()].reduce((sum, person) => sum + Object.keys(person.years).length, 0), source_occurrences: occurrences },
  people: [...people.values()], conflicts };
fs.writeFileSync(path.join(root, 'data/liang-workbook-person-colors.js'), 'window.LIANG_WORKBOOK_PERSON_COLORS=' + JSON.stringify(output) + ';\n');
fs.writeFileSync(path.join(root, 'reports/liang-workbook-person-colors-2026-10-01.json'), JSON.stringify({ ...output.meta, changed_legacy_colors: corrections.length, corrections, conflicts }, null, 2) + '\n');
console.log(JSON.stringify({ ...output.meta, changed_legacy_colors: corrections.length, conflicts: conflicts.length }));
