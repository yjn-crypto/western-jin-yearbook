#!/usr/bin/env python3
"""Independently verify reviewed Liang citations against locally supplied EPUBs.

No network, no third-party packages, no source-corpus output. The verifier uses an
XML parser (the candidate extractor uses HTMLParser), checking both physical and
TOC-relative paragraph locators, normalized quote offsets, and original hashes.

Example:
  python3 scripts/verify-liang-epub-evidence.py --source-dir ~/Downloads
  python3 scripts/verify-liang-epub-evidence.py --officials data/liang-officials-reviewed.json
"""
import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET


REPO = Path(__file__).resolve().parents[1]
BOOK_LABELS = {'LS': '梁书', 'CS': '陈书'}


def first_existing(paths):
    return next((p for p in paths if p.exists()), paths[0])


def report_path(path):
    """Keep reports portable and avoid disclosing private absolute directories."""
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return path.name


def normalized(text):
    return re.sub(r'\s+', '', text.strip())


def read_epub(path, code):
    """Rebuild locators independently from XML document events and the NCX."""
    content = path.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    physical = {}
    ids = {}
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        container = ET.fromstring(archive.read('META-INF/container.xml'))
        opf_path = container.find('.//{*}rootfile').attrib['full-path']
        base = PurePosixPath(opf_path).parent
        opf = ET.fromstring(archive.read(opf_path))
        manifest = {n.attrib['id']: n.attrib for n in opf.findall('.//{*}manifest/{*}item')}
        spine = [manifest[n.attrib['idref']] for n in opf.findall('.//{*}spine/{*}itemref')]
        ncx_path = next(n['href'] for n in manifest.values() if n.get('media-type') == 'application/x-dtbncx+xml')
        ncx = ET.fromstring(archive.read(str(base / ncx_path)))
        toc = {n.find('{*}content').attrib['src']: n.find('{*}navLabel/{*}text').text
               for n in ncx.findall('.//{*}navPoint')}
        chapter = None
        chapter_index = 0
        chapter_paragraph = 0
        for item in spine:
            href = item['href']
            member = str(base / href)
            if not (item.get('media-type', '').endswith('xhtml+xml') or member.endswith(('.html', '.htm', '.xhtml'))):
                continue
            if href in toc:
                chapter = toc[href]
                chapter_index += 1
                chapter_paragraph = 0
            current_anchor = None
            pending_anchors = []
            file_paragraph = 0
            for event, node in ET.iterparse(io.BytesIO(archive.read(member)), events=('start', 'end')):
                tag = node.tag.split('}')[-1]
                if event == 'start':
                    if node.attrib.get('id'):
                        pending_anchors.append(node.attrib['id'])
                    if tag == 'p':
                        file_paragraph += 1
                    continue
                if tag != 'p':
                    continue
                text = normalized(''.join(node.itertext()))
                if not text:
                    continue
                for anchor in pending_anchors:
                    key = href + '#' + anchor
                    if key in toc:
                        chapter = toc[key]
                        chapter_index += 1
                        chapter_paragraph = 0
                        current_anchor = anchor
                pending_anchors = []
                chapter_paragraph += 1
                pid = f'{code}-C{chapter_index:02d}-P{chapter_paragraph:04d}'
                row = {'text': text, 'epub_member': member, 'file_paragraph': file_paragraph,
                       'chapter': chapter, 'chapter_paragraph': chapter_paragraph,
                       'chapter_anchor': current_anchor, 'paragraph_id': pid,
                       'volume': chapter_index-(2 if code == 'LS' else 1)}
                physical[(member, file_paragraph)] = row
                ids[pid] = row
    return {'path': path, 'sha256': digest, 'physical': physical, 'ids': ids}


def citations(value, path='$'):
    if isinstance(value, dict):
        if 'quote' in value and 'epub_member' in value:
            yield path, value
        for key, child in value.items():
            yield from citations(child, path+'.'+key)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            yield from citations(child, f'{path}[{i}]')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source-dir', type=Path, default=Path.home()/'Downloads')
    ap.add_argument('--officials', type=Path, default=first_existing([
        REPO/'data'/'liang-officials-reviewed.json', REPO/'work'/'epub'/'liang-officials-reviewed.json']))
    ap.add_argument('--geography', type=Path, default=first_existing([
        REPO/'data'/'liang-geography-reviewed.json', REPO/'work'/'epub'/'liang-geography-reviewed.json']))
    ap.add_argument('--skip-geography', action='store_true')
    ap.add_argument('--expected-tenures', type=int, default=29)
    ap.add_argument('--expected-annual', type=int, default=30)
    ap.add_argument('--report', type=Path, default=REPO/'work'/'epub'/'evidence-verification.json')
    args = ap.parse_args()
    failures = []
    checks = []
    books = {}
    for code, label in BOOK_LABELS.items():
        matches = list(args.source_dir.glob(f'*{label}*.epub'))
        if len(matches) != 1:
            failures.append(f'{label}: expected one EPUB in source directory, found {len(matches)}')
            continue
        try:
            books[label] = read_epub(matches[0], code)
        except (ET.ParseError, KeyError, OSError, zipfile.BadZipFile) as exc:
            failures.append(f'{label}: cannot read EPUB structure: {exc}')

    try:
        official_data = json.loads(args.officials.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f'Cannot read reviewed officials: {exc}', file=sys.stderr)
        return 2
    records = official_data.get('records', [])
    annual_count = sum(len(r.get('annual_presence_years', [])) for r in records)
    if len(records) != args.expected_tenures:
        failures.append(f'Expected {args.expected_tenures} tenures, found {len(records)}')
    if annual_count != args.expected_annual:
        failures.append(f'Expected {args.expected_annual} annual evidence rows, found {annual_count}')
    official_ids = [r.get('official_id') for r in records]
    if len(official_ids) != len(set(official_ids)) or None in official_ids:
        failures.append('Official IDs are missing or duplicated')
    for rec in records:
        years = rec.get('annual_presence_years', [])
        if years != sorted(set(years)) or not all(isinstance(y, int) and 502 <= y <= 557 for y in years):
            failures.append(f"{rec.get('official_id')}: malformed, repeated, unordered, or out-of-range annual anchors")
        if rec.get('can_infer_between_anchor_years') is not False:
            failures.append(f"{rec.get('official_id')}: no explicit prohibition on interpolation")
        if not rec.get('evidence') or not list(citations(rec['evidence'])):
            failures.append(f"{rec.get('official_id')}: no traceable EPUB citation")
    for excluded in official_data.get('excluded', []):
        if excluded.get('annual_presence_years'):
            failures.append(f"Excluded office wrongly has projected years: {excluded.get('person')} {excluded.get('office')}")

    metadata = official_data.get('meta', {})
    for key, actual in [('record_count', len(records)), ('annual_record_count', annual_count),
                        ('reviewed_exclusion_count', len(official_data.get('excluded', [])))]:
        if metadata.get(key) != actual:
            failures.append(f'Metadata {key}={metadata.get(key)!r} differs from actual {actual}')
    for source in metadata.get('source_books', []):
        label = BOOK_LABELS.get(source.get('book'), source.get('book'))
        if label not in books or source.get('sha256') != books[label]['sha256']:
            failures.append(f'Source metadata hash mismatch: {label}')
        elif source.get('paragraph_count') != len(books[label]['ids']):
            failures.append(f'Source paragraph count mismatch: {label}')

    documents = [(str(args.officials), official_data)]
    if not args.skip_geography:
        if args.geography.exists():
            geography_data = json.loads(args.geography.read_text())
            documents.append((str(args.geography), geography_data))
            expected = {'武原郡': (549, 6), '临江郡': (549, 11), '富春郡': (549, 11)}
            actual = {r['name']: (r.get('year'), r.get('month')) for r in geography_data.get('records', [])}
            if actual != expected:
                failures.append(f'Geography patch does not match the three reviewed 549 foundations: {actual}')
        else:
            failures.append(f'Geography evidence missing: {args.geography}; use --skip-geography for an officials-only verification')

    for document_name, data in documents:
        for path, cite in citations(data):
            where = f'{Path(document_name).name}:{path}'
            label = cite.get('book')
            book = books.get(label)
            if book is None:
                failures.append(f'{where}: book unavailable or unknown ({label!r})')
                continue
            if cite.get('epub_sha256') != book['sha256']:
                failures.append(f'{where}: source hash mismatch')
            physical_key = (cite.get('epub_member'), cite.get('file_paragraph'))
            row = book['physical'].get(physical_key)
            if row is None:
                failures.append(f'{where}: physical paragraph not found {physical_key}')
                continue
            for field in ['chapter', 'chapter_anchor', 'chapter_paragraph', 'paragraph_id', 'volume']:
                if cite.get(field) != row[field]:
                    failures.append(f'{where}: {field} mismatch: claimed {cite.get(field)!r}, source {row[field]!r}')
            quote = cite.get('quote', '')
            start, end = cite.get('quote_start'), cite.get('quote_end')
            if not quote or quote not in row['text']:
                failures.append(f'{where}: quotation is not an exact normalized substring')
            if (not isinstance(start, int) or not isinstance(end, int)
                    or not 0 <= start <= end <= len(row['text']) or row['text'][start:end] != quote):
                failures.append(f'{where}: quote offsets do not reproduce the quotation')
            if book['ids'].get(cite.get('paragraph_id')) is not row:
                failures.append(f'{where}: logical and physical paragraph locators disagree')
            checks.append({'document': Path(document_name).name, 'json_path': path,
                           'paragraph_id': cite.get('paragraph_id'), 'book': label})

    report = {'status': 'pass' if not failures else 'fail',
              'officials_file': report_path(args.officials), 'tenure_count': len(records),
              'annual_record_count': annual_count,
              'excluded_count': len(official_data.get('excluded', [])),
              'citation_count': len(checks),
              'sources': {label: {'filename': b['path'].name, 'sha256': b['sha256'],
                                   'paragraphs': len(b['ids'])} for label,b in books.items()},
              'limitations': ['Verifies transcription and evidence locators, not the historical interpretation of appointments, service, or calendar conversion.',
                             'Uses complete supplied EPUBs locally; does not export source paragraphs or upload them.'],
              'failures': failures, 'checks': checks}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['checks','sources']}, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == '__main__':
    raise SystemExit(main())
