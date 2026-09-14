#!/usr/bin/env python3
"""Extract local-only, traceable official candidates from supplied history EPUBs.

Stdlib only. No network access. Candidates are recall-oriented, not assertions.
Run: python3 scripts/extract-liang-official-candidates.py --source-dir ~/Downloads
The source books and complete extracted paragraphs must not be committed/uploaded.
"""
import argparse
import hashlib
import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET


class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.anchors = []
        self.buf = None
        self.p_index = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.anchors.append(attrs['id'])
        if tag == 'p':
            self.p_index += 1
            self.buf = []

    def handle_data(self, data):
        if self.buf is not None:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if tag == 'p' and self.buf is not None:
            text = ''.join(self.buf).strip()
            text = re.sub(r'\s+', '', text)
            if text:
                self.rows.append({'file_paragraph': self.p_index, 'anchors': self.anchors, 'text': text})
                self.anchors = []
            self.buf = None


def extract(path, code, out):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as z:
        container = ET.fromstring(z.read('META-INF/container.xml'))
        rootfile = container.find('.//{*}rootfile').attrib['full-path']
        basedir = PurePosixPath(rootfile).parent
        opf = ET.fromstring(z.read(rootfile))
        manifest = {node.attrib['id']: node.attrib for node in opf.findall('.//{*}manifest/{*}item')}
        spine = [manifest[node.attrib['idref']] for node in opf.findall('.//{*}spine/{*}itemref')]
        ncx_item = next(v for v in manifest.values() if v.get('media-type') == 'application/x-dtbncx+xml')
        ncx = ET.fromstring(z.read(str(basedir / ncx_item['href'])))
        toc = {}
        for node in ncx.findall('.//{*}navPoint'):
            label = node.find('{*}navLabel/{*}text').text
            src = node.find('{*}content').attrib['src']
            toc[src] = label
        chapter = None
        chapter_idx = 0
        chapter_paragraph = 0
        paragraphs = []
        chapters = []
        for item in spine:
            member = str(basedir / item['href'])
            if not item.get('media-type', '').endswith('xhtml+xml') and not member.endswith(('.htm','.html','.xhtml')):
                continue
            parser = Paragraphs()
            parser.feed(z.read(member).decode('utf-8-sig'))
            if item['href'] in toc:
                chapter = toc[item['href']]
                chapter_idx += 1
                chapter_paragraph = 0
                chapters.append({'chapter': chapter, 'member': member, 'anchor': None})
            current_anchor = None
            for row in parser.rows:
                for anchor in row['anchors']:
                    if item['href'] + '#' + anchor in toc:
                        chapter = toc[item['href'] + '#' + anchor]
                        chapter_idx += 1
                        chapter_paragraph = 0
                        current_anchor = anchor
                        chapters.append({'chapter': chapter, 'member': member, 'anchor': anchor})
                chapter_paragraph += 1
                row.update(book=code, chapter=chapter, chapter_index=chapter_idx,
                           chapter_paragraph=chapter_paragraph, member=member,
                           chapter_anchor=current_anchor,
                           paragraph_id=f'{code}-C{chapter_idx:02d}-P{chapter_paragraph:04d}')
                paragraphs.append(row)
    # Include broad `令` candidates: named county offices often lack the word 县.
    # They require manual review; command verbs and central offices are false positives.
    office_re = re.compile(r'太守|内史|內史|郡丞|县丞|縣丞|县长|縣長|县令|縣令|[为爲除补補授拜迁遷领領兼任出作][^。；，！？]{0,12}令|[^。；，！？]{1,6}令[，。；、]')
    candidates = []
    for i, row in enumerate(paragraphs):
        hits = [m.group(0) for m in office_re.finditer(row['text'])]
        if hits:
            candidates.append({**row, 'matched_tokens': hits,
                'previous_paragraph_id': paragraphs[i-1]['paragraph_id'] if i else None,
                'next_paragraph_id': paragraphs[i+1]['paragraph_id'] if i+1 < len(paragraphs) else None,
                'review_status': 'unreviewed_candidate_not_a_historical_claim'})
    metadata = {'book': code, 'source_filename': path.name, 'sha256': digest,
        'paragraph_count': len(paragraphs), 'candidate_count': len(candidates),
        'locator_note': 'chapter_paragraph counts all nonempty HTML p blocks from TOC chapter start, including headings; file_paragraph counts every p in the member.',
        'chapters': chapters,
        'warning': 'LOCAL ONLY. Candidate text includes modern-edition punctuation. Do not commit source EPUB or extracted corpus. Regex does not establish person, office, dynasty or dates.'}
    (out / f'{code}-paragraphs.json').write_text(json.dumps({'metadata': metadata, 'paragraphs': paragraphs}, ensure_ascii=False, indent=2))
    (out / f'{code}-candidates.json').write_text(json.dumps({'metadata': metadata, 'candidates': candidates}, ensure_ascii=False, indent=2))
    (out / f'{code}-candidates.tsv').write_text('paragraph_id\tchapter\tmember\tfile_paragraph\ttext\n' + '\n'.join('\t'.join([r['paragraph_id'], str(r['chapter']),r['member'],str(r['file_paragraph']),r['text']]) for r in candidates))
    return {k:v for k,v in metadata.items() if k != 'chapters'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source-dir', type=Path, default=Path.home()/'Downloads')
    ap.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[1]/'work'/'epub')
    args = ap.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    result = []
    for title, code in [('梁书','LS'),('陈书','CS')]:
        matches = list(args.source_dir.glob(f'*{title}*.epub'))
        if len(matches) != 1:
            raise SystemExit(f'Expected exactly one {title} EPUB; found {len(matches)}')
        result.append(extract(matches[0], code, args.output_dir))
    (args.output_dir/'extraction-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
