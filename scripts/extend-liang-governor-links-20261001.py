#!/usr/bin/env python3
"""Append reviewed state identities to existing annual entries, without new tenures."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path.home() / 'Downloads' / '年表资料'
DATE = '2026-10-01'


def load_js(name, global_name):
    return json.loads((ROOT / name).read_text().split(global_name + ' =', 1)[-1].split(global_name + '=', 1)[-1].strip().removesuffix(';'))


def main():
    data = load_js('data/liang-governor-links.js', 'window.LIANG_GOVERNOR_LINKS')
    governors = load_js('data/liang-governors.js', 'window.LIANG_GOVERNORS')
    sources = load_js('data/liang-governor-sources.js', 'window.LIANG_GOVERNOR_SOURCES')
    workbook = load_js('data/liang-yearbook-formats.js', 'window.LIANG_YEARBOOK_FORMATS')
    entities = load_js('data/liang-data.js', 'window.LIANG_DATA')['states']
    data['records'] = [r for r in data['records'] if r.get('review_batch') != DATE]
    existing = {(r['year'], r['state'], r['source_page_index'], tuple(r['summary_lines'])) for r in data['records']}
    book_name = '中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf'
    book_pages = json.loads((SOURCE_DIR / (book_name + '_by_PaddleOCR-VL-1.6.json')).read_text())
    page_texts = ['\n'.join(b.get('block_content', '') for b in p['prunedResult']['parsing_res_list']) for p in book_pages]
    book_facts = {}
    terms = {
        '江州': ('江州（502—557），治所屡变。齐末有江州，梁承之。', 268),
        '郢州': ('郢州（502—557）', 326),
        '湘州': ('湘州（502—557）', 394),
        '交州': ('交州（502—540，546—557）', 363),
        '譙州': ('南谯州，侨寄清流', 294),
        '北徐州': ('北徐州', 297),
        '豫州': ('豫州，治悬瓠城', 319),
    }
    for state, (term, preferred_page) in terms.items():
        hits = [i + 1 for i, text in enumerate(page_texts) if term in text and 260 <= i + 1 <= 435]
        if preferred_page in hits:
            page = preferred_page
        elif len(hits) == 1:
            page = hits[0]
        else:
            # The heading North Xu occurs in many places; use its explicit section.
            hits = [i + 1 for i, text in enumerate(page_texts) if '梁承之。天监三年得魏丰城' in text]
            if state != '北徐州' or len(hits) != 1:
                raise ValueError((state, hits))
            page = hits[0]
        text = page_texts[page - 1]
        if state == '北徐州':
            quote = '南齐有北徐州，镇钟离。梁承之。'
        elif state == '譙州':
            quote = '南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。'
        else:
            start = text.index(term)
            quote = text[start:text.find('\n', start) if '\n' in text[start:] else len(text)]
        book_facts[state] = {'source': '《中國行政區劃通史》下卷第八編',
            'source_pdf_filename': book_name, 'source_pdf_pages': [page],
            'source_printed_pages': [page + 898], 'quote': quote,
            'verification': 'original_pdf_page_visually_verified' if page == 294 else 'ocr_text_and_original_page_locator_verified'}

    def annual_source(year, state):
        return [s for s in sources['years'][str(year)] if s['state'] == state]

    def evidence(year, state, record):
        source = next(s for s in annual_source(year, state)
                      if s['original_source_page_index'] == record['source_page_index']
                      and s['original_summary_lines'] == record['summary_lines'])
        result = [{'source': '魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》',
                 'year': year, 'source_section': source['source_section'],
                 'source_page_indexes': source['source_page_indexes'], 'source_pdf_pages': source['source_pdf_pages'],
                 'quote': '\n'.join(record['summary_lines'] + source['evidence_lines'])}, book_facts[state]]
        column = {'江州': 'F', '郢州': 'H', '湘州': 'J', '交州': 'T', '譙州': 'Y'}.get(state)
        row = next((r for r in workbook['rows'] if r['year'] == year), None)
        cell = next((c for c in (row or {}).get('cells', []) if c['address'] == f'{column}{row["source_row"]}'), None) if row and column else None
        if cell and cell['text']:
            result.append({'source': '《南朝刺史、長史、司馬年表》原工作簿',
                'workbook': workbook['meta']['source_file'], 'sheet': workbook['meta']['source_sheet'],
                'source_sha256': workbook['meta']['source_sha256'], 'cell': cell['address'],
                'year': year, 'quote': cell['text'],
                'note': '用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。'})
        return result

    def append(year, state, target, reason, extra=None, decision='attach'):
        for record in governors['years'][str(year)]['records']:
            if record['state'] != state:
                continue
            key = (year, state, record['source_page_index'], tuple(record['summary_lines']))
            if key in existing:
                continue
            candidates = [s for s in entities if s['n'] == state]
            item = {'id': f'liang-governor-link-{year}-{record["source_page_index"]}-{state}',
                'year': year, 'state': state, 'source_page_index': record['source_page_index'],
                'summary_lines': record['summary_lines'], 'decision': decision, 'target_id': target,
                'candidate_target_ids': [], 'rejected_target_ids': [s['id'] for s in candidates if s['id'] != target],
                'reason': reason, 'evidence': evidence(year, state, record),
                'annual_semantics': '只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。',
                'review_status': 'source_region_and_annual_continuity_reviewed', 'review_batch': DATE}
            if target:
                entity = next(s for s in entities if s['id'] == target)
                item['entity_basis'] = [{'id': target, 'name': entity['n'], 'region': entity['r'],
                                        'phases': entity['ph'], 'prefecture_names': [p['n'] for p in entity['p']]}]
            if extra:
                item.update(extra)
            data['records'].append(item)

    for year in range(541, 549):
        append(year, '江州', 'liang_s0008',
               '原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。')
    for year in range(542, 549):
        append(year, '郢州', 'liang_s0058',
               '邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。')
    for year in range(543, 549):
        append(year, '湘州', 'liang_s0115',
               '543年張纘都督湘桂東寧三州，至548年河東王譽代任，原任段對應臨湘湘州。只附已有年度條，不補原表未列的544年；邵陵王綸未任等原注保留。')
    for year in range(537, 549):
        if year == 546:
            continue
        append(year, '譙州', 'liang_s0021',
               '537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。')
    for year in (544, 545):
        append(year, '交州', None,
               '楊暻與陳霸先南討的官銜指嶺南交州；本年底表交州仍在李賁之亂期間而未列為梁控制，不得回退到江漢唯一同名交州。保留本年任官及征討條目，不推年末行政歸屬。',
               {'candidate_target_ids': ['liang_s0103'], 'rejected_target_ids': ['liang_s0062']}, 'hold')
    append(546, '交州', 'liang_s0103',
           '本年明載楊暻克交趾嘉寧城、交州平，且《通史》嶺南交州546年復置；可明確接回龍編交州，排除江漢同名州。')
    for year in (547, 548):
        append(year, '豫州', 'liang_s0046',
               '547年詔以懸瓠為豫州，羊鴉仁鎮懸瓠；548年棄城走仍是此任官事件，對應河南豫州。不能延續為此前壽春豫州，亦不表示548年末梁仍控制懸瓠。')
    append(546, '豫州', None,
           '趙徵興墓誌任成、霍、豫州的年代原書明言皆不詳，546為編者暫繫年。其豫州可能涉及合肥/壽春改置前後，不能只按排在546年就裁成壽春；此條仍待考，並排除江表南昌及547年始置懸瓠。',
           {'candidate_target_ids': ['liang_s0019', 'liang_s0020'], 'rejected_target_ids': ['liang_s0011', 'liang_s0046']}, 'hold')
    split_evidence = [{'source': '《南朝刺史、長史、司馬年表》原工作簿',
                       'workbook': '南朝刺史、長史、司馬年表.xlsx', 'sheet': 'Sheet1', 'cell': 'Q302',
                       'source_sha256': workbook['meta']['source_sha256'],
                       'year': 546, 'quote': '北徐州：封山侯蕭正表'}]
    append(546, '譙州', None,
           '方鎮匯入把蕭泰與北徐州蕭正表合成一條；按原官銜及工作簿Q302分行附着，保留原分源摘要供追溯。',
           {'line_targets': [
               {'summary_line_indexes': [0], 'decision': 'attach', 'target_id': 'liang_s0021', 'display_state': '譙州',
                'reason': '蕭泰延續原譙州任段，對應新昌南譙州。', 'evidence': [book_facts['譙州']]},
               {'summary_line_indexes': [1], 'decision': 'attach', 'target_id': 'liang_s0029', 'display_state': '北徐州',
                'reason': '本行明言北徐州刺史、鎮鍾離，且原工作簿Q302同列北徐州；不可因匯入合段掛在譙州。',
                'evidence': split_evidence + [book_facts['北徐州']]},
           ]}, 'split')
    data['records'].sort(key=lambda x: (x['year'], x['source_page_index'], x['state']))
    meta = data['meta']
    meta['reviewed_on'] = DATE
    meta['record_count'] = len(data['records'])
    meta['attached_decisions'] = sum(r['decision'] == 'attach' for r in data['records'])
    meta['held_decisions'] = sum(r['decision'] == 'hold' for r in data['records'])
    meta['split_decisions'] = sum(r['decision'] == 'split' for r in data['records'])
    meta['scope'] += ' 2026-10-01補541—548名州任段、537—548蕭泰譙州任段及546跨州合段校正；仍不代表全部1049條考證完成。' if '2026-10-01補' not in meta['scope'] else ''
    meta['continuity_rule'] = '延續的是原表已有年度條目的行政實體身份，不由一個年份補出空白任期；州改名、遷治、失陷、人物轉任須分段。'
    meta['split_rule'] = 'split必須以summary_line_indexes完整且互斥地覆蓋原摘要，分行後仍保留原state、頁碼、摘要；任何失配轉待考。'
    (ROOT / 'data/liang-governor-links.js').write_text('/* Source-specific Liang governor entity decisions; keep held entries separate. */\nwindow.LIANG_GOVERNOR_LINKS = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
    print(json.dumps({k: meta[k] for k in ('record_count', 'attached_decisions', 'held_decisions', 'split_decisions')}))


if __name__ == '__main__':
    main()
