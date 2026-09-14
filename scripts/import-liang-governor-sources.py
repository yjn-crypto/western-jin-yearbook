#!/usr/bin/env python3
"""Attach source sections to existing Liang governor records, without inventing rows.

The positional page index is zero based; source PDF page is index + 1.
Only a unique year + state section that contains every existing summary line
is accepted. OCR omissions and ambiguous sections remain in the audit report.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EQUIVALENTS = dict(re.findall(r"([\u3400-\u9fff]):'([\u3400-\u9fff])'", (ROOT / 'source-annotations.js').read_text()))
EQUIVALENTS.update({'荆': '荊', '兖': '兗', '徵': '征', '醜': '丑'})


def read_js(path, name):
    return json.loads(re.sub(rf'^\s*window\.{name}\s*=\s*', '', path.read_text()).strip().removesuffix(';'))


def normalize(text):
    # Explicit character equivalents used by the existing source annotation UI.
    mapping = EQUIVALENTS
    text = text.replace('荊', '荆').replace('兗', '兖')
    return re.sub(r'[^\u3400-\u9fff0-9]', '', ''.join(mapping.get(c, c) for c in text))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ocr_json', type=Path)
    args = parser.parse_args()
    source_bytes = args.ocr_json.read_bytes()
    pages = json.loads(source_bytes)
    sections, current, year, in_liang = [], None, None, False
    # New paragraphs preserve source page boundaries; never derive a year from
    # dates inside an evidence quotation.
    for index, page in enumerate(pages):
        text = page.get('markdown', {}).get('text', '')
        for paragraph in re.split(r'\n\s*\n', text):
            plain = re.sub(r'^\s*#+\s*', '', paragraph).strip()
            if plain == '梁方鎮年表':
                in_liang = True
                continue
            if plain == '陳方鎮年表' and in_liang:
                in_liang = False
                current = None
            if not in_liang:
                continue
            date = re.match(r'^[^《\n：。]{0,32}年[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][（(](5\d\d)[）)]', plain)
            if date:
                year = int(date[1])
                current = None
                continue
            heading = re.match(r'^((?:[\[〔【][^\]〕】\n]{1,12}[\]〕】]\s*)+)', plain)
            if heading and year:
                states = re.findall(r'[\[〔【]([^\]〕】]+)[\]〕】]', heading[1])
                current = {'year': year, 'states': states, 'heading': plain,
                           'paragraphs': [], 'page_indexes': [index]}
                sections.append(current)
            elif current:
                current['paragraphs'].append(plain)
                if index not in current['page_indexes']:
                    current['page_indexes'].append(index)
    governors = read_js(ROOT / 'data/liang-governors.js', 'LIANG_GOVERNORS')
    result, unmatched = {}, []
    for year_key, annual in governors['years'].items():
        result[year_key] = []
        for record in annual['records']:
            summaries = [normalize(x) for x in record['summary_lines'] if normalize(x)]
            candidates = [s for s in sections if s['year'] == int(year_key)
                          and normalize(record['state']) in [normalize(n) for n in s['states']]]
            matches = [s for s in candidates if all(x in normalize(''.join(s['paragraphs'])) for x in summaries)
                       and record.get('source_page_index') in s['page_indexes']]
            if len(matches) != 1:
                unmatched.append({'year': int(year_key), 'state': record['state'],
                                  'source_page_index': record.get('source_page_index'),
                                  'candidate_count': len(candidates), 'matching_count': len(matches),
                                  'reason': '年、州及全部摘要未能唯一校合；保留舊記錄，不拼接鄰州史料。'})
                result[year_key].append(None)
                continue
            section = matches[0]
            evidence = [p for p in section['paragraphs'] if normalize(p) not in summaries]
            notes = [m[0] for p in evidence for m in re.finditer(r'按[：:].*', p, re.S)]
            uncertain = any(re.search(r'年不[詳详]|始任.*不[詳详]|[斷断]於此|列於此', n) for n in notes)
            result[year_key].append({
                'state': record['state'],
                'original_source_page_index': record.get('source_page_index'),
                'original_summary_lines': record['summary_lines'],
                'source_page_indexes': section['page_indexes'],
                'source_pdf_pages': [p + 1 for p in section['page_indexes']],
                'source_section': f'梁方鎮年表・{annual["label"]}・{record["state"]}',
                'evidence_lines': evidence,
                'dating_note': ('本州考證含年不詳或編者繫年；各人物的實際任職年限須分別核讀，所在年不是全部任期的確證。' if uncertain else ''),
                'source_verified': 'unique_year_state_and_summary_alignment',
            })
    data = {'meta': {'source': '魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》（2023）',
                     'source_filename': args.ocr_json.name,
                     'source_sha256': hashlib.sha256(source_bytes).hexdigest(),
                     'governors_sha256': hashlib.sha256((ROOT / 'data/liang-governors.js').read_bytes()).hexdigest(),
                     'page_index_base': 0, 'pdf_page_rule': 'page_index + 1',
                     'total_records': sum(len(x) for x in result.values()),
                     'matched_records': sum(sum(x is not None for x in rows) for rows in result.values()),
                     'unmatched_records': len(unmatched),
                     'rule': '僅補充已存在的逐年方鎮条目；第一年全部州名目錄不新增為本年政區，末年集中繫年不改為確任。'},
            'years': result, 'unmatched': unmatched}
    dest = ROOT / 'data/liang-governor-sources.js'
    dest.write_text('window.LIANG_GOVERNOR_SOURCES = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
    report = ROOT / 'reports/liang-governor-source-audit.json'
    report.write_text(json.dumps({'meta': data['meta'], 'unmatched': unmatched}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(data['meta'], ensure_ascii=False))


if __name__ == '__main__':
    main()
