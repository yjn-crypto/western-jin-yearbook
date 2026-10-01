"""Import Chen/Liang source cells, comments and layout without changing the XLSX.

The source header locates appendix columns. Every populated/annotated cell in
each dynasty block is retained, including right-hand columns and undated notes.
No merged cell or note is interpreted as an officer's continuous tenure.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("formats", ROOT / "scripts/import-chen-yearbook-formats.py")
formats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(formats)
NS = formats.NS


def load_js(path):
    return json.loads(path.read_text(encoding="utf-8-sig").split("=", 1)[1].strip().removesuffix(";"))


def write_js(path, variable, value):
    path.write_text(f"window.{variable}=" + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


def coords(address):
    letters, row = re.fullmatch(r"([A-Z]+)(\d+)", address).groups()
    col = 0
    for letter in letters:
        col = col * 26 + ord(letter) - 64
    return col, int(row)


def import_block(reader, key, header_row, first, last, block_end, source_meta):
    legacy_path = ROOT / f"data/{key}-governor-yearbook.js"
    legacy = load_js(legacy_path)
    previous = {row["year"]: row for row in legacy["rows"]}
    max_col = max(coords(address)[0] for address in reader.cells if header_row <= coords(address)[1] <= block_end)
    headers = [reader.cell(f"{formats.column(col)}{header_row}") for col in range(1, max_col + 1)]
    appendix_col = next(index + 1 for index, cell in enumerate(headers) if cell["text"].strip() == "附錄")
    state_count = legacy["meta"]["state_columns"]
    auxiliary_col = state_count + 2
    changes = []
    merges = []
    for item in reader.sheet.findall("s:mergeCells/s:mergeCell", NS):
        start, end = item.get("ref").split(":")
        left, top = coords(start)
        right, bottom = coords(end)
        if top <= block_end and bottom >= header_row:
            merges.append({"ref": item.get("ref"), "anchor": start, "left": left, "right": right, "top": top, "bottom": bottom})

    def cell_at(col, row):
        cell = reader.cell(f"{formats.column(col)}{row}")
        merge = next((item for item in merges if item["left"] <= col <= item["right"] and item["top"] <= row <= item["bottom"]), None)
        if merge:
            cell["merge"] = merge
        return cell

    def populated(cell):
        return bool(cell["text"] or cell.get("comments") or cell.get("formula"))

    rows, flat_rows, all_cells = [], [], []
    for old in legacy["rows"]:
        row = old["source_row"]
        cells = [cell_at(col, row) for col in range(1, max_col + 1)]
        all_cells.extend(cells)
        extra_columns = [col for col in range(1, max_col + 1) if col not in {*range(1, state_count + 2), auxiliary_col, appendix_col}]
        item = {"year": old["year"], "source_row": row, "reign": cells[0], "cells": cells[1:state_count + 1],
                "auxiliary": cells[auxiliary_col - 1], "appendix": cells[appendix_col - 1],
                "extra_cells": [cells[col - 1] for col in extra_columns if populated(cells[col - 1])],
                "source_row_format": dict(next(node for node in reader.sheet.find("s:sheetData", NS) if int(node.get("r")) == row).attrib)}
        for label, before, after in [("reign", old["reign"], item["reign"]), ("auxiliary", old["auxiliary"], item["auxiliary"]), ("appendix", old["appendix"], item["appendix"])]+[(f"state-{i+1}", value, item["cells"][i]) for i, value in enumerate(old["cells"])]:
            if before != after["text"]:
                changes.append({"year": old["year"], "field": label, "address": after["address"], "previous_text": before, "source_text": after["text"]})
        rows.append(item)
        flat_rows.append({**old, "reign": item["reign"]["text"], "cells": [cell["text"] for cell in item["cells"]],
                          "auxiliary": item["auxiliary"]["text"], "appendix": item["appendix"]["text"],
                          "colors": [cell["style"].get("color") for cell in item["cells"]],
                          "auxiliary_color": item["auxiliary"]["style"].get("color"), "appendix_color": item["appendix"]["style"].get("color"),
                          "extra_cells": [{"address": cell["address"], "text": cell["text"]} for cell in item["extra_cells"]]})
    supplements = []
    for row in range(header_row + 1, block_end + 1):
        if first <= row <= last:
            continue
        cells = [cell_at(col, row) for col in range(1, max_col + 1)]
        all_cells.extend(cells)
        visible = [cell for cell in cells if populated(cell)]
        if visible:
            supplements.append({"source_row": row, "kind": "transition" if row < first else "undated_note", "cells": visible})
    all_cells.extend(headers)
    source_addresses = {address for address in reader.cells if header_row <= coords(address)[1] <= block_end and populated(reader.cell(address))}
    source_addresses.update(address for address in reader.comments if header_row <= coords(address)[1] <= block_end)
    imported_addresses = {cell["address"] for cell in all_cells if populated(cell)}
    assert source_addresses == imported_addresses, sorted(source_addresses - imported_addresses)
    for cell in all_cells:
        assert "".join(run["text"] for run in cell["runs"]) == cell["text"], cell["address"]
        for comment in cell["comments"]:
            assert "".join(run["text"] for run in comment["runs"]) == comment["text"], cell["address"]
    counts = {"annual_rows": len(rows), "source_nonempty_or_annotated_cells": len(source_addresses),
              "imported_nonempty_or_annotated_cells": len(imported_addresses), "comments": sum(len(cell["comments"]) for cell in all_cells),
              "annual_comments": sum(len(cell["comments"]) for row in rows for cell in [row["reign"], *row["cells"], row["auxiliary"], row["appendix"], *row["extra_cells"]]),
              "extra_annual_cells": sum(len(row["extra_cells"]) for row in rows), "supplemental_rows": len(supplements),
              "merge_ranges": len(merges), "changed_legacy_text_cells": len(changes)}
    data = {"meta": {**source_meta, "source_header_row": header_row, "source_range": f"A{header_row}:{formats.column(max_col)}{block_end}",
                      "annual_range": f"A{first}:{formats.column(max_col)}{last}", "state_range": f"B:{formats.column(state_count+1)}",
                      "auxiliary_column": formats.column(auxiliary_col), "appendix_column": formats.column(appendix_col),
                      "counts": counts, "format_counts": {"nonempty_cells": sum(bool(cell["text"]) for cell in all_cells)},
                      "resolved_theme_colors": reader.theme,
                      "note": "逐格保存原文、批註、富文字與合併範圍；旁列及未繫年備註另列，未推定連續任期。"},
            "headers": headers, "rows": rows, "supplemental_rows": supplements, "merged_ranges": merges,
            "column_dimensions": [dict(item.attrib) for item in reader.column_styles]}
    write_js(ROOT / f"data/{key}-yearbook-formats.js", key.upper()+"_YEARBOOK_FORMATS", data)
    legacy["meta"].update({**source_meta, "source_data_range": data["meta"]["annual_range"], "source_appendix_column": formats.column(appendix_col)})
    legacy["rows"] = flat_rows
    write_js(legacy_path, key.upper()+"_GOVERNOR_YEARBOOK", legacy)
    return {**counts, "source_range": data["meta"]["source_range"], "appendix_column": formats.column(appendix_col), "text_changes": changes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", nargs="?", type=Path)
    args = parser.parse_args()
    candidates = [Path("/Volumes/KINGSTON/南朝刺史、長史、司馬年表.xlsx"), Path.home()/"Downloads/年表资料/南朝刺史、長史、司馬年表.xlsx"]
    workbook = args.workbook or next((path for path in candidates if path.is_file()), None)
    if not workbook or not workbook.is_file():
        parser.error("Provide the original 南朝刺史、長史、司馬年表.xlsx path")
    source_meta = {"source_file": workbook.name, "source_sheet": "Sheet1", "source_sha256": hashlib.sha256(workbook.read_bytes()).hexdigest(), "source_bytes": workbook.stat().st_size, "imported": "2026-10-01"}
    with zipfile.ZipFile(workbook) as archive:
        reader = formats.Reader(archive, "Sheet1")
        audit = {"source": source_meta, "source_workbook_comments": sum(len(items) for items in reader.comments.values()),
                 "liang": import_block(reader, "liang", 255, 258, 312, 315, source_meta),
                 "chen": import_block(reader, "chen", 320, 321, 352, 353, source_meta)}
    (ROOT/"reports/governor-workbook-preservation-2026-10-01.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({key: {k:v for k,v in item.items() if k != "text_changes"} if isinstance(item,dict) else item for key,item in audit.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
