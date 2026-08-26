#!/usr/bin/env python3
"""Refresh source annotations from the PaddleOCR-VL 1.6 transcriptions.

Only annotation text and OCR provenance are changed.  Administrative names,
periods and geometry are protected by a before/after signature check.
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import html
import json
import re
from pathlib import Path
from typing import Any, Iterable


LCMAP_SIMPLIFIED_CHINESE = 0x02000000
HAN_OR_ALNUM = re.compile(r"[\u3400-\u9fffA-Za-z0-9]")
HTML_TAG = re.compile(r"<[^>]+>")
TABLE_ROW = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.I | re.S)


def traditional_to_simplified(value: str) -> str:
    """Use Windows NLS so matching is not defeated by script differences."""
    if not value:
        return value
    mapper = ctypes.windll.kernel32.LCMapStringEx
    size = mapper(
        "zh-CN", LCMAP_SIMPLIFIED_CHINESE, value, len(value), None, 0, None, None, 0
    )
    if not size:
        return value
    buffer = ctypes.create_unicode_buffer(size)
    mapper(
        "zh-CN",
        LCMAP_SIMPLIFIED_CHINESE,
        value,
        len(value),
        buffer,
        size,
        None,
        None,
        0,
    )
    return buffer.value


def clean_ocr_markdown(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"\$\s*\\underline\{\\text\{([^{}]*)\}\}\s*\$", r"\1", value)
    value = re.sub(r"\$\s*([^$]+?)\s*\$", r"\1", value)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = HTML_TAG.sub(" ", value)
    value = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", value)
    value = value.replace("**", "").replace("__", "")
    value = re.sub(r"[ \t\u3000]+", " ", value)
    value = re.sub(r"\n\s*\n+", "\n\n", value)
    return value.strip()


def normalized_with_map(value: str) -> tuple[str, list[int]]:
    simplified = traditional_to_simplified(value)
    chars: list[str] = []
    positions: list[int] = []
    # NLS conversion used here is character-for-character for this corpus.
    for index, char in enumerate(simplified):
        if HAN_OR_ALNUM.fullmatch(char):
            chars.append(char.lower())
            positions.append(min(index, len(value) - 1))
    return "".join(chars), positions


def anchor_hits(needle: str, haystack: str, start: int, end: int) -> list[tuple[int, int, int]]:
    """Return (needle offset, page offset, anchor length) for unique anchors."""
    hits: list[tuple[int, int, int]] = []
    if len(needle) < 8:
        return hits
    for width in (24, 20, 16, 12, 10, 8):
        step = max(3, width // 3)
        for offset in range(start, max(start + 1, end - width + 1), step):
            token = needle[offset : offset + width]
            if len(token) < width:
                continue
            page_offset = haystack.find(token)
            if page_offset >= 0 and haystack.find(token, page_offset + 1) < 0:
                hits.append((offset, page_offset, width))
        if len(hits) >= 3:
            break
    return hits


def aligned_excerpt(old: str, page_markdown: str) -> tuple[str | None, float]:
    """Locate the old excerpt on its new OCR page with script-normalized anchors."""
    page = clean_ocr_markdown(page_markdown)
    old_norm, _ = normalized_with_map(old)
    page_norm, page_map = normalized_with_map(page)
    if len(old_norm) < 5 or not page_norm:
        return None, 0.0

    front_end = min(len(old_norm), max(90, len(old_norm) // 2))
    back_start = max(0, len(old_norm) - max(90, len(old_norm) // 2))
    hits = anchor_hits(old_norm, page_norm, 0, front_end)
    hits += anchor_hits(old_norm, page_norm, back_start, len(old_norm))
    if not hits:
        return None, 0.0

    # OCR corrections introduce only small drift.  Select anchors in the
    # dominant offset band and derive separate beginning/end estimates.
    deltas = sorted(page_offset - old_offset for old_offset, page_offset, _ in hits)
    median_delta = deltas[len(deltas) // 2]
    band = [h for h in hits if abs((h[1] - h[0]) - median_delta) <= max(80, len(old_norm) // 7)]
    if not band:
        return None, 0.0
    band.sort(key=lambda item: item[0])
    first = band[0]
    last = band[-1]
    norm_start = max(0, first[1] - first[0])
    norm_end = min(len(page_norm), last[1] + (len(old_norm) - last[0]))
    if norm_end <= norm_start:
        return None, 0.0

    raw_start = page_map[norm_start]
    raw_end = page_map[min(norm_end - 1, len(page_map) - 1)] + 1

    # Snap to nearby paragraph/line boundaries without swallowing a page.
    before = page[max(0, raw_start - 90) : raw_start]
    boundary = max(before.rfind("\n\n"), before.rfind("\n"))
    if boundary >= 0:
        raw_start = max(0, raw_start - len(before) + boundary + 1)
    after = page[raw_end : min(len(page), raw_end + 140)]
    boundaries = [p for p in (after.find("\n\n"), after.find("\n")) if p >= 0]
    if boundaries:
        raw_end += min(boundaries)

    candidate = page[raw_start:raw_end].strip(" \n;；")
    coverage = sum(width for _, _, width in band) / max(1, len(old_norm))
    spread = (last[0] - first[0] + last[2]) / max(1, len(old_norm))
    confidence = min(1.0, 0.55 * min(1.0, coverage) + 0.45 * min(1.0, spread))
    if len(candidate) < 2 or spread < 0.18:
        return None, confidence
    return candidate, confidence


def load_js(path: Path, variable: str) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    prefix = re.compile(rf"^\s*window\.{re.escape(variable)}\s*=\s*")
    body = prefix.sub("", text, count=1).strip()
    if body.endswith(";"):
        body = body[:-1]
    return json.loads(body)


def save_js(path: Path, variable: str, data: dict[str, Any]) -> None:
    rendered = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(f"window.{variable} = {rendered};\n", encoding="utf-8", newline="\n")


def walk(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def protected_signature(data: dict[str, Any]) -> str:
    protected: list[tuple[str, Any]] = []
    keys = {
        "id",
        "base_name",
        "name",
        "state_name",
        "start",
        "end",
        "period_text",
        "period_label",
        "geometry",
    }
    for node in walk(data):
        for key in keys:
            if key in node:
                protected.append((key, node[key]))
    payload = json.dumps(protected, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_page_text(pages: list[dict[str, Any]], pdf_page: Any) -> str | None:
    if not isinstance(pdf_page, int) or not (1 <= pdf_page <= len(pages)):
        return None
    return pages[pdf_page - 1].get("markdown", {}).get("text", "")


def refresh_regular_sources(data: dict[str, Any], pages: list[dict[str, Any]]) -> dict[str, int]:
    stats = {"seen": 0, "replaced": 0, "low_confidence": 0, "already_new": 0}
    cache: dict[tuple[int, str], tuple[str | None, float]] = {}
    for node in walk(data):
        source = node.get("source")
        if not isinstance(source, dict) or not isinstance(source.get("excerpt"), str):
            continue
        if node.get("qiao_annotation") is source:
            continue
        old = source["excerpt"].strip()
        page_number = source.get("pdf_page")
        page_text = get_page_text(pages, page_number)
        if not old or page_text is None:
            continue
        # Many original snippets cross a printed-page boundary.  The citation
        # remains the starting page, while matching may continue on the next.
        next_page = get_page_text(pages, page_number + 1) if isinstance(page_number, int) else None
        if next_page:
            left = page_text.rstrip()
            separator = "\n\n" if left.endswith(("。", "！", "？", "；", ":", "：")) else ""
            page_text = left + separator + next_page.lstrip()
        stats["seen"] += 1
        if traditional_to_simplified(old) in clean_ocr_markdown(page_text):
            stats["already_new"] += 1
            continue
        cache_key = (page_number, old)
        if cache_key not in cache:
            cache[cache_key] = aligned_excerpt(old, page_text)
        replacement, confidence = cache[cache_key]
        # Synthetic qiao notes are handled from table rows below.
        is_synthetic = any(token in old for token in ("僑置考表", "僑郡所領", "本頁作", "依陳代欄"))
        if replacement and confidence >= 0.30 and not is_synthetic:
            source["excerpt"] = replacement
            stats["replaced"] += 1
        else:
            stats["low_confidence"] += 1
    return stats


def table_rows(page_markdown: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for raw_row in TABLE_ROW.findall(page_markdown):
        cells = [
            re.sub(r"\s+", " ", clean_ocr_markdown(cell)).strip()
            for cell in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", raw_row, re.I | re.S)
        ]
        cells = [cell for cell in cells if cell]
        text = "；".join(cells)
        # A handful of table cells contain model repetition artifacts.  They
        # are worse than the older editorial summary and must not be exposed.
        if text and len(text) <= 1800:
            rows.append(cells)
    return rows


def entity_label(node: dict[str, Any]) -> str:
    return str(node.get("base_name") or node.get("name") or node.get("state_name") or "")


def label_probes(label: str) -> list[str]:
    simple = traditional_to_simplified(label)
    probes = [simple]
    probes.extend(re.split(r"[、，,；;/]", simple))
    probes.extend(re.findall(r"[\u3400-\u9fff]{2,}(?:州|郡|国|县)?", simple))
    cleaned: list[str] = []
    for probe in probes:
        probe = re.sub(r"[二两]郡$", "郡", probe.strip())
        if probe and probe not in cleaned:
            cleaned.append(probe)
    return cleaned


def best_qiao_row(label: str, origin: str, rows: list[list[str]]) -> str | None:
    probes = label_probes(label)
    origin_simple = traditional_to_simplified(origin)
    scored: list[tuple[int, int, str]] = []
    for cells in rows:
        simple_cells = [traditional_to_simplified(cell).strip() for cell in cells]
        exact = 0
        for probe in probes:
            for cell in simple_cells:
                bare = re.sub(r"[°※*\s]", "", cell)
                if bare == probe or bare.startswith(probe + "(") or bare.startswith(probe + "（"):
                    exact = max(exact, 30 + min(len(probe), 8))
        # A qiao row is accepted only on an exact entity-cell match.  Origin
        # text merely breaks ties; it may recur many times across a table.
        if not exact:
            continue
        row = "；".join(cells)
        score = exact + (3 if origin_simple and origin_simple in traditional_to_simplified(row) else 0)
        scored.append((score, -len(row), row))
    if not scored:
        return None
    scored.sort(reverse=True)
    return scored[0][2]


HUAINAN_EXPLANATION = (
    "又《晋志》上豫州：“元帝渡江，以春谷县侨立襄城郡及繁昌县。……时淮南入北，"
    "乃分丹杨侨立淮南郡，居于湖，又以旧当涂县流人渡江，侨立为县。”又《东晋志》"
    "卷4扬州淮南郡上党：“《图经》，故城在芜湖县西南”；定陵，“《图经》，故城在今"
    "青阳县东北”；逡逋，“《图经》，故城在今宣城县北六十里”。淮南侨郡六侨县，"
    "繁昌于宣城郡春谷县侨立，当涂分丹阳郡于湖侨立；襄垣、上党、逡逋、定陵侨于"
    "丹阳郡芜湖县境。"
)


def refresh_qiao_sources(data: dict[str, Any], lower_pages: list[dict[str, Any]]) -> dict[str, int]:
    stats = {"annotations": 0, "table_rows": 0, "huainan_explanations": 0}
    huainan_labels = {"淮南郡", "繁昌", "當塗", "襄垣", "上黨", "定陵", "逡遒", "逡逋", "遂道"}
    for node in walk(data):
        annotation = node.get("qiao_annotation")
        if not isinstance(annotation, dict):
            continue
        stats["annotations"] += 1
        label = entity_label(node)
        origin = str(annotation.get("origin") or "")
        sources = annotation.setdefault("sources", [])
        if not isinstance(sources, list):
            continue
        selected_excerpt: str | None = None
        selected_page: int | None = None
        selected_old_page: int | None = None
        for source in sources:
            if not isinstance(source, dict):
                continue
            cited_page = source.get("pdf_page")
            if not isinstance(cited_page, int):
                continue
            found: tuple[int, str] | None = None
            for distance in range(0, 7):
                candidates = [cited_page] if distance == 0 else [cited_page - distance, cited_page + distance]
                for candidate_page in candidates:
                    page_text = get_page_text(lower_pages, candidate_page)
                    if not page_text:
                        continue
                    row = best_qiao_row(
                        label,
                        str(source.get("origin") or origin),
                        table_rows(page_text),
                    )
                    if row:
                        found = (candidate_page, row)
                        break
                if found:
                    break
            if found:
                selected_old_page = cited_page
                selected_page, selected_excerpt = found
                source["pdf_page"] = selected_page
                source["book_page"] = selected_page + 898
                source["excerpt"] = selected_excerpt
                stats["table_rows"] += 1
        # The same source is stored on the entity and its phase for the normal
        # annotation panel.  Keep those copies in sync with the qiao panel.
        if selected_excerpt:
            for candidate in [node.get("source"), *[p.get("source") for p in node.get("phases", []) if isinstance(p, dict)]]:
                if (
                    isinstance(candidate, dict)
                    and candidate.get("pdf_page") == selected_old_page
                    and isinstance(candidate.get("excerpt"), str)
                    and any(token in candidate["excerpt"] for token in ("僑置考表", "僑郡所領", "本頁作", "依陳代欄"))
                ):
                    candidate["excerpt"] = selected_excerpt
                    candidate["pdf_page"] = selected_page
                    candidate["book_page"] = selected_page + 898 if selected_page else candidate.get("book_page")
        if label in huainan_labels or "淮南郡" in origin or "襄城郡" in origin:
            if not any(s.get("pdf_page") == 827 for s in sources if isinstance(s, dict)):
                sources.append(
                    {
                        "book_page": 800,
                        "pdf_page": 827,
                        "excerpt": HUAINAN_EXPLANATION,
                        "origin": origin,
                        "source_title": "《中国行政区划通史·三国两晋南朝卷（上）》",
                    }
                )
            stats["huainan_explanations"] += 1
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--upper", required=True, type=Path)
    parser.add_argument("--lower", required=True, type=Path)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    upper_pages = json.loads(args.upper.read_text(encoding="utf-8"))
    lower_pages = json.loads(args.lower.read_text(encoding="utf-8"))
    targets = [
        (args.repo / "data" / "jin-data.js", "JIN_DATA", upper_pages),
        (args.repo / "data" / "chen-data.js", "CHEN_DATA", lower_pages),
    ]
    report: dict[str, Any] = {}
    loaded: list[tuple[Path, str, dict[str, Any], str]] = []
    for path, variable, pages in targets:
        data = load_js(path, variable)
        signature = protected_signature(data)
        regular = refresh_regular_sources(data, pages)
        qiao = refresh_qiao_sources(data, lower_pages) if variable == "CHEN_DATA" else None
        data.setdefault("meta", {})["ocr_refresh"] = {
            "engine": "PaddleOCR-VL-1.6",
            "date": "2026-08-26",
            "scope": "仅刷新注释引文；人工校勘的政区名称、年代与空间数据保持不变",
            "source_file": args.upper.name if variable == "JIN_DATA" else args.lower.name,
        }
        if protected_signature(data) != signature:
            raise RuntimeError(f"Protected administrative data changed in {path}")
        report[variable] = {"regular": regular, "qiao": qiao}
        loaded.append((path, variable, data, signature))

    for path, variable, data, _ in loaded:
        save_js(path, variable, data)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
