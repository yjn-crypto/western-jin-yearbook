#!/usr/bin/env python3
"""Package the Work Liu Song annual drafts without making historical decisions.

Source annual snapshots are authoritative for this build. A lossless row pool
removes duplication; browser loadYear restores the original hierarchy and all
its date/侨/territorial/control fields. The research directory is read-only.
"""
from __future__ import annotations
import collections
import copy
import gzip
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data/liu-song-research'
OUT = ROOT / 'data/liu-song-display'
REPORT_BASE = 'liu-song-data-integration-20261011'
LEVELS = ('state', 'prefecture', 'county')
CHILDREN = {'prefectures': 'p', 'direct_counties': 'd', 'counties': 'c'}
PRIVATE_KEYS = {'local_path', 'output_directory', 'local_file', 'local_file_path', 'image_path', 'screenshot_path', 'workspace_path', 'absolute_path'}
PRIVATE_PATH = re.compile(r'(?:file://)?/(?:Users|private|tmp|home)/[^\s\"\'<>，；。）、]*')
EXCERPT_LIMIT = 320


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def write_json(path, value, compressed=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = dump(value).encode('utf-8')
    path.write_bytes(gzip.compress(content, compresslevel=9, mtime=0) if compressed else content)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean(value, key=''):
    """Remove publication-inappropriate paths; leave research semantics intact."""
    if isinstance(value, dict):
        return {k: clean(v, k) for k, v in value.items() if k not in PRIVATE_KEYS}
    if isinstance(value, list):
        return [clean(v, key) for v in value]
    if isinstance(value, str):
        return PRIVATE_PATH.sub('[本地研究路径已省略]', value)
    return value


def excerpt(value, limit=EXCERPT_LIMIT):
    text = str(clean(value or '')).strip()
    return text if len(text) <= limit else text[:limit].rstrip() + '……〔节录止〕'


def walk(nodes):
    for node in nodes:
        yield node
        for key in CHILDREN:
            yield from walk(node.get(key, []))


def refs(value, key_match):
    result = set()
    def visit(obj):
        if isinstance(obj, dict):
            for key, child in obj.items():
                if key_match(key):
                    if isinstance(child, str): result.add(child)
                    elif isinstance(child, list): result.update(x for x in child if isinstance(x, str))
                visit(child)
        elif isinstance(obj, list):
            for child in obj: visit(child)
    visit(value)
    return result


def evidence_refs(value):
    return refs(value, lambda k: k == 'evidence_id' or k.endswith('evidence_ids'))


def year_ranges(years):
    runs = []
    for year in sorted(set(years)):
        if runs and runs[-1][-1] + 1 == year: runs[-1].append(year)
        else: runs.append([year])
    return '、'.join(str(r[0]) if len(r) == 1 else f'{r[0]}—{r[-1]}' for r in runs)


def enrich_node(node, phases, suspended=False, parent_id=None):
    result = {k: clean(v) for k, v in node.items() if k not in CHILDREN}
    result['id'] = node['entity_id']
    result['main_display'] = not suspended
    result['suspended'] = suspended
    result['parent_id'] = parent_id
    phase = phases.get(node.get('phase_id'), {})
    result['control'] = clean(phase.get('control', {
        'actor_or_polity': None, 'scope': None, 'evidence_ids': [],
        'note': '原年度记录未提供控制对象；行政归属不直接证明持续实控。'}))
    for key in CHILDREN:
        if key in node:
            result[key] = [enrich_node(child, phases, suspended, node['entity_id']) for child in node[key]]
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    research = read(SRC / 'research.json')
    source_index = read(SRC / 'annual-index.json')
    original_issues = read(SRC / 'issues.json')['rows']
    # Work retains one date-precision issue under "summary" instead of
    # "description"; publish a display alias without replacing either field.
    for issue in original_issues:
        issue.setdefault('description', issue.get('summary', '待核事项'))
    structural = read(SRC / 'annual-structural-issues.json')['rows']
    comparison = read(SRC / 'snapshot-464-comparison.json')
    phases = {x['id']: x for x in research['phases']}
    entities = {x['id']: x for x in research['entities']}
    bibliography = {x['id']: clean(x) for x in research['sources']}
    row_pool, row_lookup = [], {}
    annuals, packed_annuals, validations = {}, {}, []
    all_annual_evidence = set()
    row_fields = set()
    digests = {name: digest(SRC / name) for name in [
        'WORK-计划与任务书.txt', 'readable-summary.txt', 'coverage.json', 'data-contract.json',
        'research.json', 'annual-index.json', 'issues.json', 'annual-structural-issues.json',
        'snapshot-464-comparison.json']}

    def intern(value):
        token = dump(value)
        if token not in row_lookup:
            row_lookup[token] = len(row_pool)
            row_pool.append(value)
        return row_lookup[token]

    def pack_node(node):
        metadata = {key: value for key, value in node.items() if key not in CHILDREN}
        packed = {'r': intern(metadata)}
        for key, short in CHILDREN.items():
            if key in node: packed[short] = [pack_node(x) for x in node[key]]
        return packed

    def unpack_node(node):
        result = copy.deepcopy(row_pool[node['r']])
        for key, short in CHILDREN.items():
            if short in node: result[key] = [unpack_node(x) for x in node[short]]
        return result

    for year in range(420, 480):
        path = SRC / 'annual' / f'{year}.json'
        original = read(path)
        digests[f'annual/{year}.json'] = digest(path)
        annual = clean(original)
        annual['states'] = [enrich_node(x, phases) for x in original['states']]
        annual['unassigned'] = [enrich_node(x, phases, True) for x in original['unassigned']]
        annual['publication_note'] = '按Work原年度采用方案展示；未定归属独立待考，起讫未定引用不另计本年。'
        nodes = list(walk(annual['states'] + annual['unassigned']))
        main_nodes = list(walk(annual['states']))
        unassigned_nodes = list(walk(annual['unassigned']))
        for node in nodes: row_fields.update(node)
        all_annual_evidence.update(evidence_refs(annual))
        annual['display_counts'] = {level: len({n['entity_id'] for n in main_nodes if n['level'] == level}) for level in LEVELS}
        annual['unassigned_counts'] = {level: len({n['entity_id'] for n in unassigned_nodes if n['level'] == level}) for level in LEVELS}
        packed = {key: value for key, value in annual.items() if key not in ('states', 'unassigned', 'undated_refs')}
        packed.update({'format': 'liu-song-annual-row-pool-v1',
                       'states': [pack_node(x) for x in annual['states']],
                       'unassigned': [pack_node(x) for x in annual['unassigned']],
                       'undated_refs': [intern(x) for x in annual['undated_refs']]})
        decoded = {key: value for key, value in packed.items() if key not in ('format', 'states', 'unassigned', 'undated_refs')}
        decoded.update({'states': [unpack_node(x) for x in packed['states']],
                        'unassigned': [unpack_node(x) for x in packed['unassigned']],
                        'undated_refs': [copy.deepcopy(row_pool[x]) for x in packed['undated_refs']]})
        assert decoded == annual, f'{year}: row packing changed fields'
        errors = []
        for level in LEVELS:
            relevant = [n for n in nodes if n['level'] == level]
            unique = {n['entity_id']: n for n in relevant}
            actual = {'unique_total': len(unique),
                      'qiao': sum(n['qiao'] is True for n in unique.values()),
                      'non_qiao': sum(n['qiao'] is False for n in unique.values()),
                      'qiao_uncertain': sum(n['qiao'] is None for n in unique.values()),
                      'unassigned': annual['unassigned_counts'][level],
                      'date_or_identity_uncertain': sum(bool(n['uncertain']) for n in unique.values())}
            if len(unique) != len(relevant): errors.append(f'{level}: duplicate entity in hierarchy')
            if actual != original['counts'][level]: errors.append({'level': level, 'source': original['counts'][level], 'computed': actual})
        for node in nodes:
            for required in ('date_context', 'qiao', 'qiao_annotation', 'territorial_status', 'control_status', 'uncertain', 'evidence_ids'):
                if required not in node: errors.append(f"{node['entity_id']}: missing {required}")
        assert not errors, f'{year}: {errors}'
        if year in (420, 479):
            assert original.get('boundary_projection_source_year') == (421 if year == 420 else 478)
            assert any('边界年度投射' in x for x in original['notes'])
        validations.append({'year': year, 'status': 'passed', 'node_count': len(nodes),
                            'display_counts': annual['display_counts'], 'unassigned_counts': annual['unassigned_counts'],
                            'source_counts': original['counts'], 'undated_reference_count': len(annual['undated_refs']),
                            'qiao_unknown_count': sum(n['qiao'] is None for n in nodes),
                            'source_sha256': digests[f'annual/{year}.json']})
        annuals[year] = annual
        packed_annuals[year] = packed

    # The shared annotation layer carries the Work meanings, never new adoptions.
    shared = {'format': 'liu-song-shared-v1', 'bibliography': bibliography,
              'entities': {key: clean(value) for key, value in entities.items()},
              'phases': {key: clean(value) for key, value in phases.items()},
              'relations': {x['id']: clean(x) for x in research['relations']},
              'markers': {x['id']: clean(x) for x in research['markers']},
              'issues': {x['id']: clean(x) for x in original_issues},
              'territorialization': {x['id']: clean(x) for x in research.get('territorialization_ledger', [])},
              'source_layers': {x['id']: clean(x) for x in research.get('primary_citation_profiles', [])},
              'paragraph_citations': {x['evidence_id']: clean(x) for x in research.get('primary_paragraph_citations', [])},
              'territorial_observations': clean(research.get('territorial_observations', [])),
              'decisions': {}, 'annotation_by_entity': {}}
    for decision in research['decisions']:
        result = clean(decision)
        for key in ('before', 'after'):
            if not isinstance(result[key], (str, int, float, bool, type(None))):
                result[key] = excerpt(json.dumps(result[key], ensure_ascii=False), 700)
        shared['decisions'][decision['id']] = result
    for entity_id, entity in entities.items():
        shared['annotation_by_entity'][entity_id] = {
            'phase_ids': list(entity.get('phase_ids', [])), 'relation_ids': [], 'marker_ids': [],
            'issue_ids': list(entity.get('issue_ids', [])), 'decision_ids': [],
            'territorialization_ids': [], 'evidence_ids': list(entity.get('evidence_ids', []))}
    for field, target, subject_key in [('relations', 'relation_ids', 'subject_id'),
                                       ('markers', 'marker_ids', 'entity_ids'),
                                       ('issues', 'issue_ids', 'subject_ids'),
                                       ('decisions', 'decision_ids', 'subject_ids'),
                                       ('territorialization', 'territorialization_ids', 'entity_ids')]:
        for ident, value in shared[field].items():
            subjects = value.get(subject_key, [])
            if isinstance(subjects, str): subjects = [subjects]
            for subject in subjects:
                if subject in shared['annotation_by_entity']:
                    dest = shared['annotation_by_entity'][subject][target]
                    if ident not in dest: dest.append(ident)
    # Export only cited evidence, with short extracts rather than complete OCR pages.
    cited = all_annual_evidence | evidence_refs(shared) | evidence_refs(structural) | evidence_refs(comparison)
    evidence_lookup = {x['id']: x for x in research['evidence']}
    missing_evidence = sorted(cited - evidence_lookup.keys())
    assert not missing_evidence, f'unresolved evidence IDs: {missing_evidence[:20]}'
    shared['sources'] = {}
    for ident in sorted(cited):
        ev = evidence_lookup[ident]
        bib = bibliography.get(ev.get('source_id'), {})
        locator = clean(ev.get('locator', {}))
        raw = ev.get('raw_excerpt', '')
        normalized = ev.get('normalized_excerpt') or raw
        item = {key: clean(ev[key]) for key in (
            'id', 'source_id', 'source_layer', 'assertion_kind', 'verification', 'correction_note',
            'observation_date', 'event_date_raw', 'relevance', 'verification_scope',
            'transcription_source_id', 'quote_is_verbatim_original_pdf') if key in ev}
        item.update({'source': bib.get('title', ev.get('source_id')),
                     'title': bib.get('title', ev.get('source_id')),
                     'volume': bib.get('volume'), 'edition': bib.get('edition'),
                     'locator': locator, 'book_page': locator.get('book_page'),
                     'pdf_page': locator.get('pdf_page'), 'chapter': locator.get('chapter'),
                     'url': locator.get('url') or bib.get('url'),
                     'excerpt': excerpt(normalized), 'raw_excerpt': excerpt(raw),
                     'excerpt_truncated': len(str(normalized)) > EXCERPT_LIMIT or len(str(raw)) > EXCERPT_LIMIT,
                     'excerpt_note': '网页只发布本条短节录；校读性质、版本及观察时点另列，不表示整页逐字核对。'})
        citation = shared['paragraph_citations'].get(ident)
        if citation: item['citation_layers'] = citation.get('layers', [])
        shared['sources'][ident] = item

    # Human-readable integration ledger: preserve the 714/121/21 open items.
    names = {ident: x.get('base_name', ident) for ident, x in entities.items()}
    def label(ident): return f'{names.get(ident, ident)}（{ident}）'
    def short_source(ident):
        ev = shared['sources'].get(ident, {})
        return {'evidence_id': ident, 'source': ev.get('source'), 'volume': ev.get('volume'),
                'book_page': ev.get('book_page'), 'pdf_page': ev.get('pdf_page'),
                'chapter': ev.get('chapter'), 'excerpt': ev.get('excerpt'), 'verification': ev.get('verification')}
    issue_rows = []
    for issue in original_issues:
        row = clean(issue)
        row['subject_names'] = [label(x) for x in issue.get('subject_ids', [])]
        row['integration_action'] = '沿用Work采用阶段及原待考标记；不另定最早始年、不补造上级。'
        row['sources'] = [short_source(x) for x in issue.get('evidence_ids', [])]
        issue_rows.append(row)
    structural_rows = []
    for pos, issue in enumerate(structural, 1):
        row = clean(issue)
        row.update({'id': f'ls_structural_{pos:03d}', 'name': names.get(issue['entity_id'], issue['entity_id']),
                    'year_range': year_ranges(issue.get('years', [])),
                    'candidate_parent_names': [label(x) for x in issue.get('candidate_parent_ids', [])],
                    'integration_action': '保留unassigned及现有下属树，归属未定时独立折叠；不补父级。',
                    'sources': [short_source(x) for x in issue.get('evidence_ids', [])]})
        structural_rows.append(row)
    differences = [clean(x) for x in comparison['rows'] if x['status'] != 'matches']
    issue_kinds = dict(collections.Counter(x['kind'] for x in original_issues))
    meta = {'dynasty': 'liu-song', 'title': '刘宋州郡县首版', 'year_start': 420, 'year_end': 479,
            'years': list(range(420, 480)), 'status': 'first_round_with_open_issues', 'research_finalized': False,
            'source_status': source_index.get('status'), 'date_rule': research['meta']['date_rule'],
            'terminal_year_note': '420为晋宋交替、479为宋齐交替；部分条目分别参照421、478年作边界延续，不宣称本年整年实控。',
            'count_rule': 'counts.unique_total含unassigned；unassigned为交叉状态，不相加。正文计数使用display_counts；undated_refs不另计年。',
            'qiao_rule': 'qiao为true才下划线，null明确待核；州郡县独立取证，原页标记另见qiao_annotation和markers。',
            'historical_decisions_changed': False, 'new_parent_adoptions': 0, 'new_earliest_date_adoptions': 0,
            'open_issues': len(original_issues), 'structural_issues': len(structural), 'comparison_464_differences': len(differences),
            'links': {'review': f'reports/{REPORT_BASE}.html', 'review_json': f'reports/{REPORT_BASE}.json',
                      'index': 'data/liu-song-display/index.json'},
            'shared_url': 'data/liu-song-display/shared-data.json.gz', 'row_pool_url': 'data/liu-song-display/row-data.json.gz',
            'annual_url_template': 'data/liu-song-display/annual/{year}.json'}
    report = {'title': '刘宋首版文字数据接入与待考清单', 'generated_on': '2026-10-11',
              'status': 'necessary_data_integration_checks_passed', 'scope': '仅核字段保留、年度计数、引用与打包可逆性；未另作全面历史审核。',
              'policy': {'source_annual_unchanged': True, 'new_historical_decisions': 0,
                         'new_earliest_date_adoptions': 0, 'new_parent_adoptions': 0,
                         'unassigned': '保持Work未定归属，不加入正文已定层级；独立折叠。',
                         'undated_refs': '保留起讫未定引用，不另计入年度。',
                         'boundary_years': meta['terminal_year_note'],
                         'counts': meta['count_rule'], 'qiao': meta['qiao_rule'],
                         'separate_axes': '原属、寄治、行政父级、政治控制与实土状态独立保留；土断不自动等于撤废或划境。'},
              'summary': {'annual_count': 60, 'open_issues': len(original_issues), 'issue_kinds': issue_kinds,
                          'structural_issues': len(structural), 'comparison_464_rows': len(comparison['rows']),
                          'comparison_464_matches': len(comparison['rows']) - len(differences),
                          'comparison_464_differences': len(differences), 'unique_row_metadata': len(row_pool),
                          'published_evidence': len(shared['sources']), 'missing_evidence_references': missing_evidence},
              'blocking_integration_items': [],
              'preserved_fields': sorted(row_fields - set(CHILDREN)),
              'issues': issue_rows, 'structural_issues': structural_rows, 'comparison_464_differences': differences,
              'annual_checks': validations, 'source_digest': digests}
    index = {'meta': meta, 'format': 'liu-song-annual-row-pool-v1',
             'shared_url': meta['shared_url'], 'row_pool_url': meta['row_pool_url'],
             'annual_files': [{'year': year, 'path': f'annual/{year}.json',
                               'counts': annuals[year]['counts'], 'display_counts': annuals[year]['display_counts'],
                               'boundary_projection_source_year': annuals[year]['boundary_projection_source_year']}
                              for year in range(420, 480)],
             'source_digest': digests,
             'packing': {'row_reference': 'r', 'prefectures': 'p', 'direct_counties': 'd', 'counties': 'c',
                         'undated_refs': 'row-pool indexes; never counted as annual hierarchy',
                         'browser_entry': 'data/liu-song-data.js', 'browser_method': 'await LIU_SONG_DATA.loadYear(year)'}}
    write_json(OUT / 'row-data.json.gz', {'format': 'liu-song-row-pool-v1', 'rows': row_pool}, compressed=True)
    write_json(OUT / 'shared-data.json.gz', shared, compressed=True)
    for year, packed in packed_annuals.items(): write_json(OUT / 'annual' / f'{year}.json', packed)
    write_json(OUT / 'index.json', index)
    write_json(ROOT / 'reports' / f'{REPORT_BASE}.json', report)
    write_loader(meta)
    write_report(report, shared['sources'])
    # Necessary publication check, not a general audit.
    assert not PRIVATE_PATH.search(dump(shared))
    assert not PRIVATE_PATH.search(dump(row_pool))
    assert len(original_issues) == 714 and len(structural) == 121 and len(differences) == 21
    size = sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())
    print(json.dumps({'status': 'passed', **report['summary'], 'published_data_bytes': size,
                      'report': f'reports/{REPORT_BASE}.html'}, ensure_ascii=False, indent=2))


def write_loader(meta):
    code = '''/* Liu Song Work annual drafts; generated by scripts/build-liu-song-display.py. */
(function (global) {
  "use strict";
  const script = document.currentScript;
  const siteRoot = script && script.src ? new URL("../", script.src) : new URL("./", document.baseURI);
  const api = {meta: META, annual: {}, sources: {}, entities: {}, phases: {}, relations: {}, markers: {}, decisions: {}, issues: {}, territorialization: {}, source_layers: {}, annotation_by_entity: {}};
  const pendingYears = new Map();
  let rows = null, sharedPending = null;
  async function readJson(path, gzip) {
    const response = await fetch(new URL(path, siteRoot));
    if (!response.ok) throw new Error("刘宋数据读取失败：" + response.status + " " + path);
    if (!gzip) return response.json();
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  }
  api.loadShared = function () {
    if (!sharedPending) sharedPending = Promise.all([
      readJson(api.meta.shared_url, true), readJson(api.meta.row_pool_url, true)
    ]).then(([shared, pool]) => {
      rows = pool.rows;
      Object.assign(api, shared);
      return api;
    }).catch(error => { sharedPending = null; throw error; });
    return sharedPending;
  };
  function decodeNode(node) {
    const value = Object.assign({}, rows[node.r]);
    for (const [short, name] of [["p", "prefectures"], ["d", "direct_counties"], ["c", "counties"]]) {
      if (Object.prototype.hasOwnProperty.call(node, short)) value[name] = node[short].map(decodeNode);
    }
    return value;
  }
  api.loadYear = function (year) {
    year = Number(year);
    if (!Number.isInteger(year) || year < api.meta.year_start || year > api.meta.year_end) return Promise.resolve(null);
    if (api.annual[year]) return Promise.resolve(api.annual[year]);
    if (!pendingYears.has(year)) pendingYears.set(year, Promise.all([
      api.loadShared(), readJson(api.meta.annual_url_template.replace("{year}", year), false)
    ]).then(([, packed]) => {
      const annual = Object.assign({}, packed, {
        states: packed.states.map(decodeNode), unassigned: packed.unassigned.map(decodeNode),
        undated_refs: packed.undated_refs.map(id => Object.assign({}, rows[id]))
      });
      delete annual.format;
      api.annual[year] = annual;
      pendingYears.delete(year);
      return annual;
    }).catch(error => { pendingYears.delete(year); throw error; }));
    return pendingYears.get(year);
  };
  api.getYear = function (year) { return api.annual[Number(year)] || null; };
  global.LIU_SONG_DATA = api;
})(window);
'''.replace('META', dump(meta))
    (ROOT / 'data/liu-song-data.js').write_text(code, encoding='utf-8')


def write_report(report, sources):
    esc = lambda value: html.escape(str(value if value is not None else '未详'))
    kind_names = {'date': '年代', 'text': '文字', 'parentage': '归属', 'control': '控制', 'identity': '实体身份'}
    def source_text(item):
        bits = [item.get('source') or '', item.get('volume') or '', item.get('chapter') or '']
        if item.get('book_page') is not None: bits.append(f"书页{item['book_page']}")
        if item.get('pdf_page') is not None: bits.append(f"PDF页{item['pdf_page']}")
        return ' · '.join(str(x) for x in bits if x)
    def source_html(items):
        return ''.join(f'<p class="source">{esc(source_text(item))} <code>{esc(item["evidence_id"])}</code><br>{esc(item.get("excerpt"))}</p>' for item in items)
    def arr(value): return '、'.join(map(str, value or [])) or '无'
    intro = '<p>按 Work 的 420—479 年原年度草案接入。未新增最早年裁定或父级关系；保留来源范围、采用边界与待考性质。只做打包、字段、计数及引用的必要检查。</p>'
    intro += '<p>420 为晋宋交替，479 为宋齐交替：部分条目分别参照 421、478 年作边界延续；这些记录不是整年实控快照。正文已定层级与归属未定区分列。unassigned 是总数的交叉状态，不额外相加；起讫未定引用不另计本年。</p>'
    intro += '<p>侨置为 true 才下划线，null 保留待核；原页下划线、侨置性质、实土状态、政治控制分别展示。原属和寄治不自动成为行政上级。土断不自动等于撤废或划境。本文节录有限，完整研究记录留在本地。</p>'
    s = report['summary']
    intro += f'<p><strong>60 个年度；{s["open_issues"]} 项开放待考；{s["structural_issues"]} 组结构缺口；464 年横表 {s["comparison_464_rows"]} 行中 {s["comparison_464_matches"]} 行相符、{s["comparison_464_differences"]} 行仍有差异。</strong>上述三组不可直接相加为历史问题总数，可能涉及同一实体。</p>'
    issue_html = []
    for num, row in enumerate(report['issues'], 1):
        issue_html.append(f'<details id="{esc(row["id"])}"><summary>{num}. {esc(kind_names.get(row["kind"], row["kind"]))}｜{esc(arr(row["subject_names"]))}｜{esc(row["description"])}</summary><p>{esc(row.get("display_treatment"))}</p><p>{esc(row["integration_action"])} 状态：{esc(row["status"])}。</p>{source_html(row["sources"])}</details>')
    structural_html = []
    for num, row in enumerate(report['structural_issues'], 1):
        structural_html.append(f'<details id="{esc(row["id"])}"><summary>{num}. {esc(row["name"])}｜{esc(row["year_range"])}｜上级归属未定</summary><p>实体：<code>{esc(row["entity_id"])}</code>；候选上级：{esc(arr(row["candidate_parent_names"]))}。</p><p>{esc(row["integration_action"])}</p>{source_html(row["sources"])}</details>')
    diff_html = []
    for num, row in enumerate(report['comparison_464_differences'], 1):
        source_items = [dict(sources.get(eid, {}), evidence_id=eid) for eid in row.get('evidence_ids', [])]
        diff_html.append(f'<details><summary>{num}. {esc(row.get("state"))} · {esc(row.get("prefecture"))}</summary><p>原表标实县数：{esc(row.get("declared_real_count"))}；原表县名：{esc(arr(row.get("source_names")))}。</p><p>年度实县或侨性待核县：{esc(arr(row.get("annual_real_or_uncertain_names")))}。</p><p>仅见原表：{esc(arr(row.get("source_only_names")))}；仅见年度：{esc(arr(row.get("annual_only_names")))}。</p><p>保留差异，不因横表未列删侨县；县名相同而原表数量不同者仍待人工核对。</p>{source_html(source_items)}</details>')
    annual_rows = ''.join(f'<tr><td>{r["year"]}</td><td>{r["display_counts"]["state"]}/{r["display_counts"]["prefecture"]}/{r["display_counts"]["county"]}</td><td>{r["unassigned_counts"]["state"]}/{r["unassigned_counts"]["prefecture"]}/{r["unassigned_counts"]["county"]}</td><td>{r["undated_reference_count"]}</td><td>{r["qiao_unknown_count"]}</td></tr>' for r in report['annual_checks'])
    document = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>刘宋首版文字数据接入与待考清单</title><style>body{{font-family:system-ui,"Songti SC",serif;max-width:1100px;margin:32px auto;padding:0 22px;color:#29261f;line-height:1.75;background:#faf8f2}}h1{{font-size:26px}}h2{{margin-top:36px}}a{{color:#6a4523}}nav{{display:flex;gap:20px;flex-wrap:wrap}}details{{background:white;border:1px solid #ded8ca;border-radius:6px;margin:10px 0;padding:10px 14px}}summary{{cursor:pointer}}code{{font-size:12px;overflow-wrap:anywhere}}.source{{font-size:14px;color:#625d51;border-left:3px solid #ddd3bd;padding-left:12px}}table{{border-collapse:collapse;width:100%;background:white}}th,td{{border:1px solid #ded8ca;padding:7px;text-align:left}}@media print{{body{{max-width:none;background:white;font-size:10pt}}details{{break-inside:avoid}}summary{{list-style:none}}nav{{display:none}}}}</style><h1>刘宋首版文字数据接入与待考清单</h1>{intro}<nav><a href="#issues">714 项待考</a><a href="#structural">121 组结构缺口</a><a href="#comparison-464">464 年差异</a><a href="#annual">年度接入计数</a><a href="{REPORT_BASE}.json">JSON 明细</a></nav><h2 id="issues">开放待考（714 项，沿用 Work）</h2>{''.join(issue_html)}<h2 id="structural">年度结构缺口（121 组）</h2><p>未定郡的下属县仍可保留在其待考树内，但不据此认定该郡属于某州。年度列表保留 Work 已采用关系，不用来源观察点填补连续阶段。</p>{''.join(structural_html)}<h2 id="comparison-464">464 年横表差异（21 项）</h2>{''.join(diff_html)}<h2 id="annual">年度接入计数</h2><p>“州/郡/县”为唯一实体数；待考归属列单列，起讫未定引用不得与它们相加。</p><table><thead><tr><th>年</th><th>正文州/郡/县</th><th>归属未定州/郡/县</th><th>起讫未定引用</th><th>侨性待核</th></tr></thead><tbody>{annual_rows}</tbody></table><p>必要检查：60 年打包解码与来源字段一致；唯一实体计数及侨性分类与原年度一致；引用可解析；420、479 交替说明保留。未新增历史判断。</p></html>'''
    (ROOT / 'reports' / f'{REPORT_BASE}.html').write_text('\n'.join(line.rstrip() for line in document.splitlines()) + '\n', encoding='utf-8')
    (ROOT / 'reports' / f'{REPORT_BASE}.txt').write_text(
        '刘宋首版文字数据接入说明\n\n'
        '来源：Work 原 annual/420—479.json，未修改研究目录、日期或归属裁定。\n'
        '发布：data/liu-song-data.js；调用 await LIU_SONG_DATA.loadYear(year) 后读取 annual[year]。\n'
        'loadShared() 返回 evidence/phase/relation/marker/decision/issue 与实土、引书层注释。\n'
        '年度磁盘文件使用共享行元数据池；需经浏览器 loadYear 解码，不直接当展开树读取。\n'
        'date_context 全量保留；source_bound、constrained_bound、display_year 与事件确年分开。\n'
        'qiao=null 保留待核；下划线原页标记见 qiao_annotation 和 markers，不能由父级继承。\n'
        '原属、寄治、行政父级、控制与实土状态互不替代。\n'
        '420/479 是交替年；421/478 边界投射原注逐条保留。\n'
        'counts.unassigned 为交叉状态，不加计；undated_refs 不另计年。\n'
        '714 项待考、121 组结构缺口、464 横表21项差异均保留，未套东晋最早年选择。\n'
        '全部60年字段、计数、侨标及引用必要检查通过；未另作全面历史审核。\n'
        f'可读完整清单：reports/{REPORT_BASE}.html\n', encoding='utf-8')


if __name__ == '__main__':
    main()
