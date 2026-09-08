"""Read the existing Chen yearbook's OOXML formatting without editing its workbook.

No historical parsing is performed. Rich-text runs, spaces and newlines remain
verbatim; the older flat-text export is compared before writing the sidecar.
"""

import argparse
import colorsys
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
INDEXED = ("000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF "
           "000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF "
           "800000 008000 000080 808000 800080 008080 C0C0C0 808080 "
           "9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCCC "
           "000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF "
           "00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 "
           "3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 "
           "003366 339966 003300 333300 993300 993366 333399 333333").split()


def raw(element):
    if element is None:
        return None
    return {"tag": element.tag.rsplit("}", 1)[-1], "attributes": dict(element.attrib),
            "children": [raw(child) for child in element]}


def boolean(element):
    return element is not None and element.get("val", "1") not in ("0", "false")


def column(number):
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


class Reader:
    def __init__(self, archive, sheet_name):
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = next(s for s in workbook.find("s:sheets", NS) if s.get("name") == sheet_name)
        rel_id = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in relationships if r.get("Id") == rel_id)
        self.sheet = ET.fromstring(archive.read(posixpath.normpath(posixpath.join("xl", target)) if not target.startswith("/") else target.lstrip("/")))
        self.styles = ET.fromstring(archive.read("xl/styles.xml"))
        self.fonts = list(self.styles.find("s:fonts", NS))
        self.fills = list(self.styles.find("s:fills", NS))
        self.borders = list(self.styles.find("s:borders", NS))
        self.xfs = list(self.styles.find("s:cellXfs", NS))
        self.base_xfs = list(self.styles.find("s:cellStyleXfs", NS))
        self.strings = list(ET.fromstring(archive.read("xl/sharedStrings.xml")))
        theme = ET.fromstring(archive.read("xl/theme/theme1.xml"))
        scheme = theme.find("a:themeElements/a:clrScheme", NS)
        by_name = {item.tag.rsplit("}", 1)[-1]: item[0].get("val") if item[0].tag.endswith("srgbClr") else item[0].get("lastClr") for item in scheme}
        self.theme = [by_name[key] for key in ("lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink")]
        indexed = self.styles.find("s:colors/s:indexedColors", NS)
        self.indexed = [c.get("rgb")[-6:] for c in indexed] if indexed is not None else INDEXED
        self.cells = {cell.get("r"): cell for row in self.sheet.find("s:sheetData", NS) for cell in row}
        self.row_styles = {row.get("r"): row.get("s") for row in self.sheet.find("s:sheetData", NS) if row.get("s") is not None}
        columns = self.sheet.find("s:cols", NS)
        self.column_styles = list(columns) if columns is not None else []

    def color(self, element, fallback="#000000"):
        if element is None:
            return None
        if element.get("rgb"):
            value = element.get("rgb")[-6:]
        elif element.get("theme") is not None:
            value = self.theme[int(element.get("theme"))]
        elif element.get("indexed") is not None:
            index = int(element.get("indexed"))
            value = self.indexed[index] if index < len(self.indexed) else ("FFFFFF" if index == 65 else "000000")
        else:
            return fallback
        tint = float(element.get("tint", "0"))
        if tint:
            channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
            hue, light, saturation = colorsys.rgb_to_hls(*channels)
            light = light * (1 + tint) if tint < 0 else light * (1 - tint) + tint
            value = "".join(f"{int(channel * 255 + .5):02X}" for channel in colorsys.hls_to_rgb(hue, light, saturation))
        return "#" + value.upper()

    def font(self, element, inherited=None):
        result = dict(inherited or {"color": "#000000", "fontWeight": "normal", "fontStyle": "normal", "textDecorationLine": "none", "verticalAlign": "baseline"})
        for child in element:
            key = child.tag.rsplit("}", 1)[-1]
            value = child.get("val")
            if key == "color":
                result["color"] = self.color(child)
            elif key in ("name", "rFont"):
                result["fontFamily"] = value
            elif key == "sz":
                result["fontSize"] = f"{value}pt"
            elif key == "b":
                result["fontWeight"] = "bold" if boolean(child) else "normal"
            elif key == "i":
                result["fontStyle"] = "italic" if boolean(child) else "normal"
            elif key == "vertAlign":
                result["verticalAlign"] = {"superscript": "super", "subscript": "sub", "baseline": "baseline"}.get(value, value)
        lines = set(result.get("textDecorationLine", "none").split()) - {"none"}
        underline = element.find("s:u", NS)
        strike = element.find("s:strike", NS)
        if underline is not None:
            lines.discard("underline")
            if underline.get("val", "single") != "none":
                lines.add("underline")
                result["textDecorationStyle"] = "double" if "double" in underline.get("val", "single").lower() else "solid"
        if strike is not None:
            lines.discard("line-through")
            if boolean(strike):
                lines.add("line-through")
        result["textDecorationLine"] = " ".join(sorted(lines)) or "none"
        return result

    def cell(self, address):
        element = self.cells.get(address)
        col_name, row_number = re.fullmatch(r"([A-Z]+)([0-9]+)", address).groups()
        col_number = 0
        for letter in col_name:
            col_number = col_number * 26 + ord(letter) - 64
        column_style = next((item.get("style", "0") for item in self.column_styles if int(item.get("min")) <= col_number <= int(item.get("max"))), "0")
        style_id = int(element.get("s", self.row_styles.get(row_number, column_style)) if element is not None else self.row_styles.get(row_number, column_style))
        xf = self.xfs[style_id]
        base = self.base_xfs[int(xf.get("xfId", "0"))]
        attributes = dict(base.attrib)
        attributes.update(xf.attrib)
        font = self.fonts[int(attributes.get("fontId", "0"))]
        style = self.font(font)
        fill = self.fills[int(attributes.get("fillId", "0"))]
        pattern = fill.find("s:patternFill", NS)
        style["backgroundColor"] = self.color(pattern.find("s:fgColor", NS), "#FFFFFF") if pattern is not None and pattern.get("patternType") == "solid" else "transparent"
        alignment = xf.find("s:alignment", NS)
        if alignment is None:
            alignment = base.find("s:alignment", NS)
        if alignment is not None:
            horizontal = alignment.get("horizontal")
            vertical = alignment.get("vertical")
            if horizontal:
                style["textAlign"] = {"general": "start", "centerContinuous": "center", "distributed": "justify", "fill": "start"}.get(horizontal, horizontal)
            if vertical:
                style["verticalAlign"] = {"center": "middle", "distributed": "middle", "justify": "middle"}.get(vertical, vertical)
        style["whiteSpace"] = "pre-wrap"
        text = ""
        runs = []
        shared = None
        if element is not None:
            value = element.find("s:v", NS)
            if element.get("t") == "s" and value is not None:
                shared = self.strings[int(value.text)]
            elif element.get("t") == "inlineStr":
                shared = element.find("s:is", NS)
            elif value is not None:
                text = value.text or ""
        if shared is not None:
            for child in shared:
                kind = child.tag.rsplit("}", 1)[-1]
                if kind == "t":
                    chunk = child.text or ""
                    runs.append({"text": chunk, "style": dict(style)})
                elif kind == "r":
                    chunk = "".join(t.text or "" for t in child.findall("s:t", NS))
                    properties = child.find("s:rPr", NS)
                    run_style = self.font(properties, style) if properties is not None else dict(style)
                    runs.append({"text": chunk, "style": run_style, "source_font": raw(properties)})
            text = "".join(run["text"] for run in runs)
        elif text:
            runs = [{"text": text, "style": dict(style)}]
        return {"address": address, "text": text, "style": style, "runs": runs,
                "source_format": {"style_id": style_id, "font": raw(font), "fill": raw(fill),
                                  "alignment": raw(alignment), "xf": raw(xf), "base_xf": raw(base),
                                  "border": raw(self.borders[int(attributes.get("borderId", "0"))])}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output or root / "data/chen-yearbook-formats.js"
    legacy_text = (root / "data/chen-governor-yearbook.js").read_text(encoding="utf-8-sig")
    legacy = json.loads(legacy_text.split("=", 1)[1].strip().removesuffix(";"))
    differences = []
    counts = {"compared_cells": 0, "identical_cells": 0, "whitespace_only_differences": 0, "text_differences": 0}
    with zipfile.ZipFile(args.workbook, "r") as archive:
        reader = Reader(archive, "Sheet1")
        rows = []
        for old in legacy["rows"]:
            number = old["source_row"]
            item = {"year": old["year"], "source_row": number,
                    "cells": [reader.cell(f"{column(col)}{number}") for col in range(2, 26)],
                    "reign": reader.cell(f"A{number}"), "auxiliary": reader.cell(f"Z{number}"),
                    "spacer": reader.cell(f"AA{number}"), "appendix": reader.cell(f"AB{number}")}
            pairs = list(zip(item["cells"], old["cells"])) + [(item[key], old.get(key, "")) for key in ("reign", "auxiliary", "appendix")]
            for cell, previous in pairs:
                counts["compared_cells"] += 1
                if cell["text"] == previous:
                    counts["identical_cells"] += 1
                    continue
                kind = "whitespace_only" if re.sub(r"\s+", "", cell["text"]) == re.sub(r"\s+", "", previous) else "text"
                counts[f"{kind}_differences"] += 1
                differences.append({"year": old["year"], "address": cell["address"], "kind": kind,
                                    "previous_text": previous, "source_text": cell["text"]})
            rows.append(item)
        cells = [cell for row in rows for cell in [*row["cells"], row["reign"], row["auxiliary"], row["appendix"]]]
        nonempty = [cell for cell in cells if cell["text"]]
        multicolor = [cell for cell in nonempty if len({run["style"].get("color") for run in cell["runs"] if run["text"].strip()}) > 1]
        italic = [cell for cell in nonempty if any(run["style"].get("fontStyle") == "italic" for run in cell["runs"])]
        underline = [cell for cell in nonempty if any("underline" in run["style"].get("textDecorationLine", "") for run in cell["runs"])]
        data = {"meta": {"source_file": args.workbook.name, "source_sheet": "Sheet1", "source_range": "A320:AB352",
                         "state_range": "B:Y", "auxiliary_column": "Z", "appendix_column": "AB",
                         "range_note": "舊匯出標注終列 AA；原工作簿附欄實際位於 AB，AA 留空並保留。",
                         "text_comparison": {**counts, "differences": differences},
                         "format_counts": {"nonempty_cells": len(nonempty), "multicolor_cells": len(multicolor), "italic_cells": len(italic), "underlined_cells": len(underline)},
                         "resolved_theme_colors": reader.theme,
                         "note": "只讀匯入原工作簿字元格式。逐段字色、字体、大小、粗斜體、刪除線、下劃線、上下標及原儲存樣式皆保留；不改寫任期或史料。"},
                "headers": [reader.cell(f"{column(col)}320") for col in range(1, 29)], "rows": rows}
        for cell in cells:
            if "".join(run["text"] for run in cell["runs"]) != cell["text"]:
                raise ValueError(f"Run text differs at {cell['address']}")
        output.write_text("window.CHEN_YEARBOOK_FORMATS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(json.dumps({"output": output.name, **counts, **data["meta"]["format_counts"],
                      "examples": {key: [{"address": c["address"], "runs": [{"text": r["text"], "color": r["style"].get("color"), "fontStyle": r["style"].get("fontStyle"), "textDecorationLine": r["style"].get("textDecorationLine")} for r in c["runs"]]} for c in collection[:1]] for key, collection in (("multicolor", multicolor), ("italic", italic), ("underline", underline))}}, ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
