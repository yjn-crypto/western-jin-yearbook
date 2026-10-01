"""Recover unnumbered prefecture headings without inventing uncertain start dates.

The old import required an enumerator such as （一）.  A one-prefecture state
often has no enumerator in the printed book.  Keep unresolved headings in the
catalogue as well, but only create annual rows for the reviewed spans below.
"""
import json
import re
from pathlib import Path

REVIEW_DATE = '2026-10-01'
SOURCE_PDF = '中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf'

# Markdown line, stable state suffix, traditional name, explicitly reviewed spans.
# Empty spans mean that the source's unclear boundary still needs review.
HEADINGS = [
    (10832, '0004', '吳興郡', [(555, 555)]),
    (10842, '0005', '東陽郡', []),  # Existing 553/556 decisions take precedence.
    (10964, '0011', '豫章郡', []),
    (10976, '0013', '鄱陽郡', [(553, 557)]),
    (11820, '0025', '廬江郡', []),
    (11840, '0027', '安豐郡', [(535, 549)]),
    (11952, '0034', '定城郡', []),
    (12662, '0046', '汝南郡', [(547, 547)]),
    (12674, '0048', '汝南郡', [(527, 547)]),
    (12684, '0049', '淮川郡', [(527, 547)]),
    (12692, '0050', '陳郡', [(547, 547)]),
    (12814, '0056', '宜都郡', []),
    (12884, '0060', '上雋郡', [(554, 557)]),
    (12960, '0070', '巴陵郡', []),
    (12968, '0071', '武陵郡', []),
    (13018, '0074', '安陸郡', []),
    (13026, '0075', '平靖郡', []),
    (13034, '0076', '上明郡', []),
    (13044, '0077', '建寧郡', [(514, 549)]),
    (13078, '0080', '齊昌郡', []),
    (13772, '0088', '義安郡', []),
    (13780, '0089', '新寧郡', [(541, 557)]),
    (13848, '0092', '齊康郡', [(523, 557)]),
    (13856, '0093', '廣熙郡', []),
    (13880, '0095', '珠崖郡', []),
    (13932, '0098', '馬平郡', [(537, 557)]),
    (14066, '0104', '新昌郡', []),
    (14074, '0105', '九真郡', [(523, 557)]),
    (14082, '0106', '寧海郡', [(535, 557)]),
    (14098, '0109', '九德郡', [(543, 557)]),
    (15226, '0117', '永陽郡', []),
    (15603, '0123', '安康郡', []),
    (15611, '0124', '上津郡', []),
    (15619, '0125', '洵陽郡', []),
    (15645, '0128', '齊興郡', [(547, 550)]),
    (15749, '0133', '北宕渠郡', []),
    (16194, '0141', '巴郡', [(550, 551)]),
    (16202, '0142', '六同郡', [(544, 553)]),
    (16258, '0145', '齊通郡', [(548, 553)]),
    (16272, '0147', '東江陽郡', []),
    (16310, '0151', '越巂郡', []),
    (16402, '0153', '晉寧郡', []),
]


def augment(data, lines, sha, sources):
    ocr = json.loads((sources / (SOURCE_PDF + '_by_PaddleOCR-VL-1.6.json')).read_text())
    pages = ['\n'.join(b.get('block_content', '') for b in p['prunedResult']['parsing_res_list']) for p in ocr]
    visual_pages = {294, 365, 366}
    catalogue = []
    for line, state, name, spans in HEADINGS:
        heading = lines[line - 1].lstrip('# ').strip()
        date_raw = re.search(r'（([^）]+)）', heading).group(1)
        hits = [i + 1 for i, text in enumerate(pages) if heading in text]
        if len(hits) != 1:
            raise ValueError(f'Unresolved original page for line {line}: {hits}')
        page = hits[0]
        paragraph_start = line - 1
        for before in range(line - 2, max(0, line - 18), -1):
            if re.match(r'^[# ]*[一二三四五六七八九十]+、', lines[before]):
                paragraph_start = before
                break
        excerpt = '\n'.join(lines[paragraph_start:line + 2])
        note = ('無序號單郡標題在舊匯入中漏失；按原書明列年代補入。'
                if spans else '原書已有郡名，不能說此州無郡；起訖含問號、前或後，尚不擴成全梁時段。')
        if line in (13780, 14098):
            note = '設州確年仍不明；僅從正文已明見的541年／543年起，至原書所列557年附列，不把此起點說成設置年。'
        if line == 10842:
            note = '沿用既有553年婺州、556年縉州錨點裁決，不據此補滿554—555年。'
        source = {'source_label': '《中國行政區劃通史》下卷第八編 · ' + name,
                  'source_filename': SOURCE_PDF + '_by_PaddleOCR-VL-1.6.md',
                  'source_sha256': sha, 'source_pdf_filename': SOURCE_PDF,
                  'source_pdf_pages': [page], 'source_printed_pages': [page + 898],
                  'markdown_lines': [paragraph_start + 1, line + 2], 'excerpt': excerpt,
                  'editorial_note': note,
                  'verification': 'original_pdf_page_visually_verified' if page in visual_pages else 'ocr_text_and_original_page_locator_verified',
                  'reviewed_on': REVIEW_DATE}
        entity_id = f'liang_s{state}_p_singleton_20261001'
        catalogue.append({'id': entity_id, 'state_id': f'liang_s{state}', 'name': name,
                          'source_range': date_raw, 'display_spans': spans,
                          'status': 'annual_rows_restored' if spans else 'existing_anchor_decision' if line == 10842 else 'dating_pending',
                          'source': source})
        if not spans:
            continue
        uncertain = line in (13780, 14098)
        data['supplemental_prefectures'].append({
            'id': entity_id, 'state_id': f'liang_s{state}', 'n': name, 'o': 1,
            'q': False, 'qi': None, 'research_source': source,
            'ph': [{'start': start, 'end': end, 'name': name, 'uncertain': uncertain,
                    'raw': f'{start}—{end}（補回原書無序號郡條；原斷限{date_raw}）',
                    'source': source} for start, end in spans]})
    data['unnumbered_prefecture_audit'] = catalogue
    data['meta']['unnumbered_prefecture_review'] = {
        'reviewed_on': REVIEW_DATE, 'headings_recovered': len(catalogue),
        'annual_entities_added': sum(bool(x[3]) for x in HEADINGS),
        'date_policy': '完整確年區間直接補入；541/543以前始置者從已見年起附列並標※；其餘未知斷限保留待定，不以502填補。',
        'original_pdf_visual_pages': sorted(visual_pages)}
    data['state_research_notes'] = [
        {'state_id': 'liang_s0006', 'classification': 'source_says_unknown',
         'note': '東嘉州：原書明言「所領郡乏考」，不能補造郡；不是單郡標題漏提取。', 'markdown_lines': [10846, 10848]},
        {'state_id': 'liang_s0010', 'classification': 'source_says_unknown',
         'note': '南江州：原書明言「所領郡縣乏考」；新吳治所不是已考定的郡名。', 'markdown_lines': [10954, 10958]},
        {'state_id': 'liang_s0012', 'classification': 'source_says_unknown',
         'note': '江表寧州：原書明言「所領郡縣乏考」，臨川故郡的地理說明不等於已列本州郡表。', 'markdown_lines': [10968, 10970]},
        {'state_id': 'liang_s0148', 'classification': 'source_says_no_prefectures',
         'note': '邛州：原書明言梁末置州而「不領郡縣」；不能把西魏平蜀後新置四郡倒填至梁。', 'markdown_lines': [16276, 16278]},
    ]
    return data
