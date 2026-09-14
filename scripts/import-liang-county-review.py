#!/usr/bin/env python3
"""Import the user's Liang county review without rewriting the source workbook.

Usage: python3 scripts/import-liang-county-review.py /path/to/review.xlsx
Requires openpyxl for read-only XLSX access; names are converted with OpenCC or
macOS CoreFoundation. Original human wording is always preserved verbatim.

The display intervals are inclusive annual-history intervals, not end-of-year
snapshots or asserted founding/abolition dates. Consumers must also intersect
the province/prefecture's jurisdiction and lifetime.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import ctypes
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import sys

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
YEARS = [502, 557]


def make_traditional_converter():
    try:
        from opencc import OpenCC
        return lru_cache(None)(OpenCC("s2t").convert)
    except ImportError:
        if sys.platform != "darwin":
            raise SystemExit("Install opencc-python-reimplemented for name conversion.")
    cf = ctypes.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
    ptr = ctypes.c_void_p
    cf.CFStringCreateWithCString.argtypes = [ptr, ctypes.c_char_p, ctypes.c_uint32]
    cf.CFStringCreateWithCString.restype = ptr
    cf.CFStringCreateMutableCopy.argtypes = [ptr, ctypes.c_long, ptr]
    cf.CFStringCreateMutableCopy.restype = ptr
    cf.CFStringTransform.argtypes = [ptr, ptr, ptr, ctypes.c_bool]
    cf.CFStringTransform.restype = ctypes.c_bool
    cf.CFStringGetCString.argtypes = [ptr, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]
    cf.CFStringGetCString.restype = ctypes.c_bool
    cf.CFRelease.argtypes = [ptr]
    encoding = 0x08000100

    @lru_cache(None)
    def convert(value):
        if not value:
            return value
        original = cf.CFStringCreateWithCString(None, value.encode(), encoding)
        mutable = cf.CFStringCreateMutableCopy(None, 0, original)
        transform = cf.CFStringCreateWithCString(None, b"Simplified-Traditional", encoding)
        try:
            if not cf.CFStringTransform(mutable, None, transform, False):
                raise ValueError("Chinese name conversion failed")
            buffer = ctypes.create_string_buffer(len(value.encode()) * 8 + 32)
            if not cf.CFStringGetCString(mutable, buffer, len(buffer), encoding):
                raise ValueError("Chinese name conversion overflow")
            return buffer.value.decode()
        finally:
            for ref in (original, mutable, transform):
                cf.CFRelease(ref)
    return convert


traditional = make_traditional_converter()

# These are spelling aliases only. They never identify different places or
# replace a missing historical assignment. The original spelling stays below.
NAME_ALIASES = {"宿豫郡": "宿預郡", "宿豫": "宿預"}


def name(value):
    text = traditional(value) if value else None
    return NAME_ALIASES.get(text, text)


def county_id(value):
    match = re.fullmatch(r"L[CR]-(\d{4})", value or "")
    if not match:
        raise ValueError(f"Invalid county record ID: {value!r}")
    return f"lc_{match[1]}"


def rows(workbook, sheet):
    iterator = workbook[sheet].iter_rows(values_only=True)
    headers = next(iterator)
    return [dict(zip(headers, values), _row=index) for index, values in enumerate(iterator, 2)]


def read_js_data(path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("=") + 1:].strip().rstrip(";"))


def manual_target(record_id, confirmation):
    """Only parse unambiguous labels; free-text decisions have explicit patches."""
    explicit = {
        "LR-0268": ("无考，放在殷州下即可", (None, "殷州", "state_only")),
        "LR-0337": ("北郢州，郡无考", (None, "北郢州", "state_only")),
        "LR-0678": ("邻州，郡无考", (None, "鄰州", "state_only")),
        "LR-0679": ("邻州，郡无考", (None, "鄰州", "state_only")),
        "LR-0686": ("南梁州", (None, "南梁州", "state_only")),
        "LR-0239": ("睢州南济阴郡", ("南濟陰郡", "睢州", "prefecture")),
        "LR-0336": ("暂系北义阳郡", ("北義陽郡", None, "prefecture")),
        "LR-0341": ("定州建宁左郡", ("建寧左郡", "定州", "prefecture")),
        "LR-0342": ("定州建宁左郡", ("建寧左郡", "定州", "prefecture")),
        "LR-0214": ("东莞琅琊二郡", ("東莞、琅琊二郡", None, "joint_prefecture")),
        "LR-0215": ("东莞琅琊二郡", ("東莞、琅琊二郡", None, "joint_prefecture")),
    }
    if record_id in explicit:
        expected, target = explicit[record_id]
        if confirmation != expected:
            raise ValueError(f"Human wording changed for {record_id}; review its explicit parsing patch before importing.")
        return target
    text = name(confirmation)
    if text and re.fullmatch(r"[\u3400-\u9fff、]+二郡", text):
        return text, None, "joint_prefecture"
    if text and re.fullmatch(r"[\u3400-\u9fff]+郡", text) and not any(x in text for x in ["無考", "暫", "不明", "待定"]):
        return text, None, "prefecture"
    return None, None, "unresolved"


def source_location(filename, sheet, row, **kwargs):
    return {"workbook": filename, "sheet": sheet, "row": row, **kwargs}


def build(input_path):
    digest = hashlib.sha256(input_path.read_bytes()).hexdigest()
    workbook = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    filename = input_path.name
    summaries = rows(workbook, "复核总表")
    phase_rows = rows(workbook, "显示时段")
    by_record = {r["编号"]: r for r in summaries}
    assert len(by_record) == len(summaries) == 744
    assert len(phase_rows) == 753
    assert len({county_id(r) for r in by_record}) == len(by_record)
    originals = {r["id"]: r for r in read_js_data(ROOT / "data/liang-data.js")["counties"]}

    human = defaultdict(list)
    # Later sheet entries supersede earlier copied machine conclusions. A blank
    # confirmation is preserved as a blank; a note alone never invents a target.
    for sheet, confirmation_key, notes_key in [
        ("待人工判断", "人工确认郡", "人工备注"),
        ("剩余人工判断", "人工确认郡", "人工备注"),
        ("时间及数据疑点", "人工处理结论", "人工备注"),
    ]:
        previous = None
        for row in rows(workbook, sheet):
            confirmation, notes = row[confirmation_key], row[notes_key]
            if confirmation is None and notes is None:
                continue
            entry = source_location(filename, sheet, row["_row"], confirmation=confirmation, notes=notes)
            if notes == "同上":
                if previous is None:
                    raise ValueError(f"Unresolved 同上 in {sheet} row {row['_row']}")
                entry["resolved_notes"] = previous.get("resolved_notes", previous["notes"])
                entry["notes_reference"] = {"sheet": sheet, "row": previous["row"]}
            else:
                entry["resolved_notes"] = notes
            human[row["编号"]].append(entry)
            previous = entry

    counties, assignments, patches = [], [], []
    for row in summaries:
        record_id = row["编号"]
        identity = county_id(record_id)
        original = originals.get(identity, {})
        reviews = human.get(record_id, [])
        qiao = bool(original.get("q", False))
        qiao_info = original.get("qi")
        if identity in {"lc_0727", "lc_0728"}:
            qiao, qiao_info = False, None
            patches.append({"county_id": identity, "kind": "qiao_identity_correction", "before": original.get("qi"),
                "after": {"q": False, "qi": None}, "source": "《中國行政區劃通史》下卷書內1592頁／電子索引693；本輪制度考察",
                "reason": "東江陽郡復舊土；不可與治武陽的江陽僑郡同名匹配，也不能據此將漢安、綿水標成僑縣。"})
        evidence = source_location(filename, "复核总表", row["_row"], page_index=row["存考页索引"],
            evidence_record_ids=row["依据记录ID"],
            excerpt="；".join(str(x) for x in [row["本轮归属结论"], row["归属判断理由"], row["时间核查处理"]] if x))
        counties.append({"id": identity, "record_id": record_id, "name": name(row["显示县名"]),
            "original_name": row["县名（原表）"], "region": name(row["地域"]), "q": qiao, "qi": qiao_info,
            "manual_reviews": reviews, "source": evidence,
            "machine_review": {"conclusion": row["本轮归属结论"], "prefecture": row["规范郡／阶段郡"],
                "candidates": row["剩余候选郡"], "display_status": row["显示准备状态"], "issues": row["时间及数据疑点"]},
            "date_evidence": {"founded": row["建县年（明确）"], "abolished": row["省废年（明确）"],
                "founding_earliest": row["建县最早界"], "founding_latest": row["建县最晚界"],
                "liang_rule_start": row["梁辖起年"], "liang_rule_end": row["梁辖止年"],
                "name_start": row["新县名启用年"], "name_end": row["县名终止年"]}})
        if row["县名（原表）"] != row["显示县名"]:
            patches.append({"county_id": identity, "kind": "workbook_name_correction", "before": row["县名（原表）"],
                "after": name(row["显示县名"]), "source": source_location(filename, "复核总表", row["_row"]),
                "reason": "採用工作簿顯示縣名；更名記錄另按顯示時段，原OCR縣名仍保留。"})

    for row in phase_rows:
        record_id = row["县记录ID"]
        summary = by_record[record_id]
        reviews = human.get(record_id, [])
        review = reviews[-1] if reviews else None
        prefecture = name(row["规范所属郡"])
        state = None
        kind = "prefecture" if prefecture else "unresolved"
        start_bound, end_bound = row["限制起年（含）"], row["限制止年（含）"]
        start, end = row["表内最早显示年"], row["表内最晚显示年"]
        start_kind, end_kind = row["起年性质"], row["止年性质"]
        machine_allowed = row["允许按规则投射"] == "是"
        allowed = machine_allowed
        issues = [summary["时间及数据疑点"]] if summary["时间及数据疑点"] else []
        assignment_uncertain = False
        time_uncertain = bool(issues)
        review_status = "machine"
        if review:
            review_status = "manual"
            note = " ".join(str(x or "") for x in [review["confirmation"], review["resolved_notes"]])
            assignment_uncertain = any(x in note for x in ["暂系", "暂取", "暫系", "暫取", "暂属", "暫屬"])
            if review["sheet"] == "剩余人工判断":
                prefecture, state, kind = manual_target(record_id, review["confirmation"])
                allowed = kind in {"prefecture", "joint_prefecture"} and not issues
                if kind == "state_only":
                    review_status = "manual_state_only"
                    issues.append("人工只確定所屬州，郡無考；保留州層線索，不虛造郡名。")
                elif kind == "unresolved":
                    issues.append("人工欄未提供可直接識別的郡名；原文保留，待具體判讀。")
                if record_id == "LR-0045":
                    # The user's chosen presentation date takes priority over
                    # the old machine rejection. Do not call 527 a founding date.
                    if review["confirmation"] != "新安郡" or review["notes"] != "歙州绩溪县的位置，地望当属新安郡。时间未知，表格则选择从大通元年开始展示。":
                        raise ValueError("Human wording changed for LR-0045; recheck the selected display start.")
                    start = start_bound = 527
                    start_kind = "人工選定展示起年；建縣確年仍未定"
                    allowed = True
                    issues = []
                    time_uncertain = True
                    patches.append({"county_id": county_id(record_id), "kind": "manual_display_start", "after": 527,
                        "source": review, "reason": "人工明確選擇自大通元年展示；保留建縣年527／535異文，不寫為確定建縣年。"})
        assignments.append({"id": row["时段ID"], "county_id": county_id(record_id), "name": name(row["显示县名"]),
            "region": name(row["地域"]), "prefecture_name": prefecture, "state_name": state, "assignment_kind": kind,
            "start": start, "end": end, "start_bound": start_bound, "end_bound": end_bound,
            "start_kind": start_kind, "end_kind": end_kind,
            "uncertain": assignment_uncertain or time_uncertain, "assignment_uncertain": assignment_uncertain,
            "time_uncertain": time_uncertain, "display_allowed": allowed, "machine_display_allowed": machine_allowed,
            "review_status": review_status, "transition_double": row["过渡年双见"] == "是", "issues": issues,
            "source": source_location(filename, "显示时段", row["_row"], evidence_record_ids=row["依据记录ID"],
                excerpt=row["处理说明"], manual_reviews=reviews)})

    # No source record is silently dropped or duplicated by its LC/LR prefix.
    assert len(assignments) == len(phase_rows)
    assert {a["county_id"] for a in assignments} == {c["id"] for c in counties}
    assert len({a["id"] for a in assignments}) == len(assignments)
    assert all(isinstance(a["start"], int) and isinstance(a["end"], int) and 502 <= a["start"] <= a["end"] <= 557 for a in assignments)
    assert all(a["prefecture_name"] is None or not any(x in a["prefecture_name"] for x in ["無考", "无考", "暫系", "暂系", "天監元年"]) for a in assignments)
    assert len(human) == 87, "Recheck expected manual coverage when the workbook changes."
    assert len([a for a in assignments if a["assignment_kind"] == "state_only"]) == 5
    by_phase = {a["id"]: a for a in assignments}
    for test in rows(workbook, "边界验证"):
        phase = by_phase[test["时段ID"]]
        year = test["测试年份"]
        actual = phase["start"] <= year <= phase["end"]
        assert actual == (test["预期时间条件"] == "是"), f"Workbook boundary test failed: {test}"
    for year, expected in [(534, False), (535, True)]:
        assert (by_phase["LR-0011-S01"]["start"] <= year) == expected
    salt = [a for a in assignments if a["county_id"] == "lc_0014" and a["start"] <= 549 <= a["end"]]
    assert {a["prefecture_name"] for a in salt} == {"吳郡", "武原郡"}
    assert all(a["display_allowed"] for a in salt)
    assert by_phase["LR-0175-S01"]["end"] == by_phase["LR-0175-S02"]["start"] == 529
    assert by_phase["LC-0007-S01"]["end"] == 535
    assert by_phase["LR-0045-S01"]["display_allowed"] and by_phase["LR-0045-S01"]["start"] == 527
    for identity in ["lc_0227", "lc_0230", "lc_0231", "lc_0233", "lc_0234", "lc_0311", "lc_0312"]:
        assert all(a["assignment_uncertain"] for a in assignments if a["county_id"] == identity)

    review_items = [{"county_id": c["id"], "record_id": c["record_id"], "name": c["name"], "region": c["region"],
        "issues": list(dict.fromkeys(issue for a in assignments if a["county_id"] == c["id"] for issue in a["issues"])),
        "assignment_ids": [a["id"] for a in assignments if a["county_id"] == c["id"] and not a["display_allowed"]]}
        for c in counties if any(a["county_id"] == c["id"] and not a["display_allowed"] for a in assignments)]
    for item in review_items:
        if not item["issues"]:
            item["issues"] = ["工作簿仍未確定唯一郡；不可沿用原靜態候選值。"]
    counts = Counter(a["review_status"] for a in assignments)
    meta = {"workbook": filename, "sha256": digest, "schema_version": 1, "years": YEARS,
        "county_records": len(counties), "assignment_records": len(assignments), "manual_records": len(human),
        "manual_new_records": sum(any(r["sheet"] == "剩余人工判断" for r in v) for v in human.values()),
        "machine_allowed_assignments": sum(a["machine_display_allowed"] for a in assignments),
        "display_allowed_assignments": sum(a["display_allowed"] for a in assignments),
        "display_allowed_counties": len({a["county_id"] for a in assignments if a["display_allowed"]}),
        "manual_uncertain_counties": len({a["county_id"] for a in assignments if a["assignment_uncertain"]}),
        "state_only_counties": sum(a["assignment_kind"] == "state_only" for a in assignments),
        "held_assignments": sum(not a["display_allowed"] for a in assignments), "held_counties": len(review_items),
        "review_status_counts": dict(counts), "source_boundary_tests": 33,
        "county_policy": "縣隨郡列出，縣時段與同地域州郡存續、管辖逐年相交。年度沿革允許改屬、更名當年新舊雙見，省廢當年保留。",
        "date_policy": "start/end是502—557頁面投射界；start_bound/end_bound記縣層限制，均非自動斷言建縣、廢縣年。",
        "manual_policy": "人工結論優先；暫系及同上承接的暫系標不確定；郡無考留州線索；雙頭郡不拆猜。",
        "qiao_policy": "僑郡標注不等於僑縣；保留既有可用縣標注及本輪更正，不由郡標注自動派生。",
        "count_policy": "744是來源記錄數，不是已去重的歷史縣總數；梁泰兩條等疑似重複保留待核。"}
    workbook.close()
    return {"meta": meta, "normalization": {"name_aliases": NAME_ALIASES}, "counties": counties,
        "assignments": assignments, "review_items": review_items, "patches": patches}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "data/liang-county-reviewed.json")
    parser.add_argument("--report", type=Path, default=ROOT / "docs/liang-county-import-report.md")
    args = parser.parse_args()
    data = build(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.output.with_suffix(".js").write_text("window.LIANG_COUNTY_REVIEWED=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    meta = data["meta"]
    lines = ["# 萧梁县郡人工复核导入", "", f"来源：{meta['workbook']}。", "", f"SHA-256：`{meta['sha256']}`。", "",
        f"完整保留 {meta['county_records']} 条县记录、{meta['assignment_records']} 条时段。原先四条与后补83条共 {meta['manual_records']} 条人工意见均已读取；“同上”保留原文并记录承接行。", "",
        f"县层可投射 {meta['display_allowed_assignments']} 条时段、涉及 {meta['display_allowed_counties']} 条县记录；另有 {meta['held_assignments']} 条时段、涉及 {meta['held_counties']} 条县记录仍须复核。这不是本年实际展示量，还须与州郡存续和管辖相交。", "",
        f"人工暂系 {meta['manual_uncertain_counties']} 条县记录标不确定。五条只知州，不制造郡。人工双头郡保留合题，不自动拆成两个郡。", "",
        "采用工作簿的年度沿革口径：海盐549年吴郡、武原郡两见；决口／临水529年两见；湖熟535年保留、536年起停止。梁安依人工527年起展示，同时保留建县确年未定。", "",
        "已验证工作簿33条时界检查、全部人工字段保留、稳定LC/LR编号、暂系承接、过渡年及废县年。显示县名依复核表修正，原OCR不删除；汉安、绵水不再误标为江阳侨郡下的侨县。", "",
        "## 尚需补足的证据", "", "此清单保留现有不确定性，不要求一次补齐。附书可继续考证的条目应先由程序研究；需要人工取舍时按记录ID询问。", "",
        "| 记录 | 县名 | 地域 | 问题 |", "| --- | --- | --- | --- |"]
    for item in data["review_items"]:
        issues = "；".join(item["issues"]).replace("|", "／").replace("\n", " ")
        lines.append(f"| {item['record_id']} | {item['name']} | {item['region']} | {issues} |")
    lines.extend(["", "## 重建", "", "运行 `python3 scripts/import-liang-county-review.py /path/to/review.xlsx`。只读工作簿，生成独立数据层，未覆盖原州郡数据。非macOS环境需opencc-python-reimplemented；原始文件不纳入仓库。", ""])
    args.report.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
