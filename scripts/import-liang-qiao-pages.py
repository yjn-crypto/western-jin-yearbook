#!/usr/bin/env python3
"""Resolve existing qiao OCR indexes to PDF and printed page locators.

This verifies page locators only, not every old homonym match. Full OCR files
remain outside the repository. Two independently checked homonym corrections
are recorded explicitly below.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ocr_json', type=Path)
    args = parser.parse_args()
    raw = args.ocr_json.read_bytes()
    pages = json.loads(raw)
    text = (ROOT / 'data/liang-data.js').read_text()
    indexes = sorted({int(x) for x in re.findall(r'"qiao_table_page_index"\s*:\s*(\d+)', text)})
    locators = {}
    for index in indexes:
        if not 0 <= index < len(pages):
            raise ValueError(f'Qiao page index out of range: {index}')
        numbers = set()
        for block in pages[index]['prunedResult']['parsing_res_list']:
            if block.get('block_label') in {'aside_text', 'number', 'footer'}:
                numbers.update(int(n) for n in re.findall(r'(?<!\d)1\d{3}(?!\d)', block.get('block_content', '')))
        locators[str(index)] = {'page_index': index, 'pdf_page': index + 1,
                                'book_page': next(iter(numbers)) if len(numbers) == 1 else None,
                                'source_title': '《中國行政區劃通史·三國兩晉南朝卷Ⅱ》第二版，第十編',
                                'verification': 'page_locator_only'}
    corrections = {}
    for county_id, name in [('lc_0727', '漢安'), ('lc_0728', '綿水')]:
        corrections[county_id] = {
            'qiao': False, 'name': name, 'prefecture': '東江陽郡',
            'source': {**locators['693'], 'excerpt': '江陽郡失土後寄治武陽；復舊土後所置東江陽郡，原書明言「非僑郡」。東江陽郡的漢安、綿水，不能因同名而套用武陽所寄江陽侨郡的縣表。',
                       'editorial_note': '本輪依第十編江陽郡考釋校正舊同名匹配；只撤去這兩條實縣的僑置標記，不改江陽僑郡本身。'}}
    result = {'meta': {'source_filename': args.ocr_json.name,
                        'source_sha256': hashlib.sha256(raw).hexdigest(),
                        'page_index_base': 0, 'pdf_page_rule': 'page_index + 1',
                        'marker_rule': '○：梁有陳無；△：梁無陳有；無標：梁陳共有。均不表示全朝每一年存續。',
                        'verification_note': '頁碼由OCR布局中的書頁號辨識；無原PDF圖像，尚未作版面目驗。除明列校正外，原有侨置匹配仍待逐條複核。'},
              'pages': locators, 'county_corrections': corrections}
    (ROOT / 'data/liang-qiao-sources.js').write_text('window.LIANG_QIAO_SOURCES = ' + json.dumps(result, ensure_ascii=False, indent=2) + ';\n')
    print(f'{len(locators)} page locators; {len(corrections)} explicit county corrections')


if __name__ == '__main__':
    main()
