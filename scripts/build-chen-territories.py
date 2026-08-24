#!/usr/bin/env python3
"""Vectorise selected Shituguan Chen maps into WGS 84 GeoJSON.

The source screenshots use one fixed cartographic canvas.  The script extracts
the dark-blue Chen polity fill, registers the 569 outline to the existing
ChinaXMap 572 outline, converts map pixels through the web map's geographic
grid, and writes both GeoJSON and a browser-ready JavaScript copy.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
LOCAL_DEPS = WORKSPACE / ".gis-runtime"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

import cv2  # type: ignore  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape  # type: ignore  # noqa: E402
from shapely.ops import unary_union  # type: ignore  # noqa: E402
from shapely.validation import make_valid  # type: ignore  # noqa: E402


MAP_WIDTH = 4800
MAP_HEIGHT = 4128
PLOT = (650.0, 390.0, 4490.0, 3690.0)
GEO_EXTENT = (93.5, 18.0, 128.5, 44.0)  # west, south, east, north

YEAR_SOURCES = {
    557: "永定元年.jpg",
    558: "永定三年.jpg",  # no 558 sheet; nearest available sheet is 559
    559: "永定三年.jpg",
    560: "天嘉元年.jpg",
    561: "ZSXQ_20250416_222120404.jpg",
    562: "ZSXQ_20250416_222125143.jpg",
    569: "太建元年.jpg",  # used to retain the Guangzhou rebellion overlay
    573: "ZSXQ_20250416_222530051.jpg",  # no 573 sheet; nearest is 575
    574: "ZSXQ_20250416_222530051.jpg",  # no 574 sheet; nearest is 575
    575: "ZSXQ_20250416_222530051.jpg",
    576: "太建九年.jpg",  # no 576 sheet; nearest later sheet is 577
    577: "太建九年.jpg",
    578: "ZSXQ_20250416_222608261.jpg",
    579: "ZSXQ_20250416_222615571.jpg",
}

SOURCE_YEARS = {
    "永定元年.jpg": 557,
    "永定三年.jpg": 559,
    "天嘉元年.jpg": 560,
    "ZSXQ_20250416_222120404.jpg": 561,
    "ZSXQ_20250416_222125143.jpg": 562,
    "太建元年.jpg": 569,
    "ZSXQ_20250416_222530051.jpg": 575,
    "太建九年.jpg": 577,
    "ZSXQ_20250416_222608261.jpg": 578,
    "ZSXQ_20250416_222615571.jpg": 579,
}


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def load_dynamic_map() -> dict:
    text = (ROOT / "data" / "chen-map-dynamic.js").read_text(encoding="utf-8").strip()
    prefix = "window.CHEN_DYNAMIC_MAP="
    if not text.startswith(prefix):
        raise RuntimeError("Unexpected chen-map-dynamic.js wrapper")
    return json.loads(text[len(prefix) :].rstrip(";"))


def svg_rings(path_text: str) -> list[np.ndarray]:
    tokens = re.findall(r"[MLZ]|-?\d+(?:\.\d+)?", path_text)
    rings: list[np.ndarray] = []
    ring: list[tuple[float, float]] = []
    index = 0
    command = ""
    while index < len(tokens):
        token = tokens[index]
        if token in {"M", "L", "Z"}:
            command = token
            index += 1
            if command == "Z":
                if len(ring) >= 3:
                    rings.append(np.asarray(ring, dtype=np.float32))
                ring = []
            continue
        if command not in {"M", "L"} or index + 1 >= len(tokens):
            raise RuntimeError("Unsupported SVG path command")
        ring.append((float(tokens[index]), float(tokens[index + 1])))
        command = "L"
        index += 2
    if len(ring) >= 3:
        rings.append(np.asarray(ring, dtype=np.float32))
    return rings


def rasterise_svg(path_text: str) -> np.ndarray:
    mask = np.zeros((MAP_HEIGHT, MAP_WIDTH), dtype=np.uint8)
    for ring in svg_rings(path_text):
        cv2.fillPoly(mask, [np.rint(ring).astype(np.int32)], 255)
    return mask


def largest_component(mask: np.ndarray, close_size: int = 9) -> np.ndarray:
    kernel_close = np.ones((close_size, close_size), dtype=np.uint8)
    kernel_open = np.ones((5, 5), dtype=np.uint8)
    clean = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    clean = cv2.morphologyEx(clean, cv2.MORPH_OPEN, kernel_open)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(clean, 8)
    if count <= 1:
        raise RuntimeError("No political fill component was found")
    winner = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return np.where(labels == winner, 255, 0).astype(np.uint8)


def extract_chen_mask(rgb: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    # Shituguan's Chen fill is a saturated indigo-blue.  The value ceiling
    # excludes the pale ocean and the saturation floor excludes relief shading.
    mask = cv2.inRange(hsv, np.array([105, 78, 42]), np.array([148, 255, 224]))
    mask[:500, :] = 0
    mask[:, 3500:] = 0
    return largest_component(mask)


def extract_guangzhou_rebellion(rgb: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    green = cv2.inRange(hsv, np.array([36, 95, 35]), np.array([94, 255, 230]))
    crop = np.zeros_like(green)
    # Guangzhou / Lingnan area on the fixed Shituguan canvas.  The tight crop
    # prevents the green Linyi and relief tint farther south from being read as
    # part of Ouyang He's revolt.
    crop[1780:2050, 2500:2740] = green[1780:2050, 2500:2740]
    return largest_component(crop, close_size=11)


def component_bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask > 0)
    if not len(xs):
        raise RuntimeError("Cannot compute an empty mask's bounding box")
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def affine_from_bbox(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    sx0, sy0, sx1, sy1 = component_bbox(source)
    tx0, ty0, tx1, ty1 = component_bbox(target)
    scale_x = (tx1 - tx0) / (sx1 - sx0)
    scale_y = (ty1 - ty0) / (sy1 - sy0)
    return np.asarray(
        [[scale_x, 0.0, tx0 - scale_x * sx0], [0.0, scale_y, ty0 - scale_y * sy0]],
        dtype=np.float32,
    )


def iou(left: np.ndarray, right: np.ndarray) -> float:
    intersection = np.count_nonzero((left > 0) & (right > 0))
    union = np.count_nonzero((left > 0) | (right > 0))
    return intersection / union if union else 0.0


def register_to_web_map(source_mask: np.ndarray, target_mask: np.ndarray) -> tuple[np.ndarray, dict]:
    """Register the 569 fill to the 572 XMap outline.

    The first transform uses polity bounding boxes.  A conservative ECC pass
    then adjusts the already-warped masks at quarter resolution.  The better of
    the forward/inverse ECC interpretations is selected by actual mask IoU.
    """

    initial = affine_from_bbox(source_mask, target_mask)
    quarter = (MAP_WIDTH // 4, MAP_HEIGHT // 4)
    source_small = cv2.resize(source_mask, (source_mask.shape[1] // 4, source_mask.shape[0] // 4), interpolation=cv2.INTER_NEAREST)
    target_small = cv2.resize(target_mask, quarter, interpolation=cv2.INTER_NEAREST)
    initial_small = initial.copy()
    initial_small[:, 2] /= 4.0
    warped = cv2.warpAffine(source_small, initial_small, quarter, flags=cv2.INTER_NEAREST)

    template = cv2.GaussianBlur(target_small.astype(np.float32) / 255.0, (0, 0), 3.0)
    moving = cv2.GaussianBlur(warped.astype(np.float32) / 255.0, (0, 0), 3.0)
    delta = np.eye(2, 3, dtype=np.float32)
    try:
        score, delta = cv2.findTransformECC(
            template,
            moving,
            delta,
            cv2.MOTION_AFFINE,
            (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 160, 1e-6),
            None,
            5,
        )
    except cv2.error:
        score = 0.0
        delta = np.eye(2, 3, dtype=np.float32)

    candidates: list[tuple[float, np.ndarray, str]] = []
    initial_3 = np.vstack([initial, [0.0, 0.0, 1.0]])
    delta_3 = np.vstack([delta, [0.0, 0.0, 1.0]])
    for matrix_3, label in ((delta_3 @ initial_3, "ecc-forward"), (np.linalg.inv(delta_3) @ initial_3, "ecc-inverse"), (initial_3, "bbox")):
        matrix = matrix_3[:2].astype(np.float32)
        test = cv2.warpAffine(source_mask, matrix, (MAP_WIDTH, MAP_HEIGHT), flags=cv2.INTER_NEAREST)
        candidates.append((iou(test, target_mask), matrix, label))
    best_iou, best, label = max(candidates, key=lambda item: item[0])
    return best, {
        "method": label,
        "ecc_score": round(float(score), 6),
        "reference_iou": round(float(best_iou), 6),
        "matrix": [[round(float(v), 9) for v in row] for row in best],
    }


def map_xy_to_lonlat(x: float, y: float) -> tuple[float, float]:
    west, south, east, north = GEO_EXTENT
    left, top, right, bottom = PLOT
    lon = west + (x - left) / (right - left) * (east - west)
    lat = north - (y - top) / (bottom - top) * (north - south)
    return round(float(lon), 6), round(float(lat), 6)


def mask_to_geometry(mask: np.ndarray, min_area_px: float = 500.0):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hierarchy is None:
        raise RuntimeError("No contours found")
    hierarchy = hierarchy[0]
    polygons = []
    for index, contour in enumerate(contours):
        if hierarchy[index][3] != -1 or cv2.contourArea(contour) < min_area_px:
            continue
        outer_px = cv2.approxPolyDP(contour, 2.2, True).reshape(-1, 2)
        outer = [map_xy_to_lonlat(x, y) for x, y in outer_px]
        holes = []
        child = hierarchy[index][2]
        while child != -1:
            if cv2.contourArea(contours[child]) >= 180.0:
                hole_px = cv2.approxPolyDP(contours[child], 2.0, True).reshape(-1, 2)
                holes.append([map_xy_to_lonlat(x, y) for x, y in hole_px])
            child = hierarchy[child][0]
        if len(outer) >= 4:
            polygon = Polygon(outer, holes)
            if not polygon.is_valid:
                polygon = make_valid(polygon)
            polygons.append(polygon)
    geometry = unary_union(polygons)
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    geometry = geometry.simplify(0.012, preserve_topology=True)
    if isinstance(geometry, Polygon):
        geometry = MultiPolygon([geometry])
    return geometry


def geometry_to_svg_path(geometry) -> str:
    def ring_text(coords) -> str:
        points = []
        for lon, lat in coords:
            west, south, east, north = GEO_EXTENT
            left, top, right, bottom = PLOT
            x = left + (lon - west) / (east - west) * (right - left)
            y = top + (north - lat) / (north - south) * (bottom - top)
            points.append((x, y))
        return "M" + "L".join(f"{x:.3f},{y:.3f}" for x, y in points) + "Z"

    polygons = list(geometry.geoms) if hasattr(geometry, "geoms") else [geometry]
    chunks = []
    for polygon in polygons:
        chunks.append(ring_text(polygon.exterior.coords))
        chunks.extend(ring_text(interior.coords) for interior in polygon.interiors)
    return "".join(chunks)


def feature(year: int, source_name: str, kind: str, geometry, registration: dict, note: str = "") -> dict:
    source_year = SOURCE_YEARS[source_name]
    return {
        "type": "Feature",
        "properties": {
            "id": f"chen-{kind}-{year}",
            "year": year,
            "kind": kind,
            "regime": "南陳" if kind == "territory" else "廣州歐陽紇叛亂",
            "source": "史圖館中國歷代疆域變遷視頻截圖",
            "source_file": source_name,
            "source_year": source_year,
            "year_relation": "exact" if year == source_year else "nearest-available",
            "note": note,
            "fidelity": "image-vectorized",
            "svgPath": geometry_to_svg_path(geometry),
            "registration": registration,
        },
        "geometry": mapping(geometry),
    }


def write_preview(features: list[dict], dynamic: dict, destination: Path) -> None:
    base = np.asarray(Image.open(ROOT / dynamic["base"].split("?")[0]).convert("RGB")).copy()
    colors = {
        "territory": (196, 86, 76),
        "rebellion": (68, 151, 79),
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    panels = []
    for year in (557, 562, 569, 575, 579):
        canvas = base.copy()
        for item in features:
            if item["properties"]["year"] != year:
                continue
            overlay = rasterise_svg(item["properties"]["svgPath"])
            color = np.asarray(colors[item["properties"]["kind"]], dtype=np.uint8)
            alpha = 0.45 if item["properties"]["kind"] == "territory" else 0.78
            pixels = overlay > 0
            canvas[pixels] = np.rint(canvas[pixels] * (1 - alpha) + color * alpha).astype(np.uint8)
        panel = Image.fromarray(canvas).resize((600, 516), Image.Resampling.LANCZOS)
        panel.save(destination.with_name(f"{destination.stem}-{year}.png"))
        panels.append(panel)
    contact = Image.new("RGB", (1800, 1032), "white")
    for index, panel in enumerate(panels):
        x = (index % 3) * 600
        y = (index // 3) * 516
        contact.paste(panel, (x, y))
    contact.save(destination)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=Path(r"E:\BaiduNetdiskDownload\史图馆地图"))
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "chen-territories.geojson")
    parser.add_argument("--js-output", type=Path, default=ROOT / "data" / "chen-territories.js")
    parser.add_argument("--preview", type=Path, default=WORKSPACE / "research" / "chen-territories" / "vector-preview.png")
    args = parser.parse_args()

    dynamic = load_dynamic_map()
    target = largest_component(rasterise_svg(dynamic["regimes"]["chen"]), close_size=5)
    calibration_rgb = load_rgb(args.source_dir / "太建元年.jpg")
    calibration_mask = extract_chen_mask(calibration_rgb)
    transform, registration = register_to_web_map(calibration_mask, target)

    features: list[dict] = []
    cache: dict[str, tuple[object, np.ndarray]] = {}
    for year, source_name in YEAR_SOURCES.items():
        if source_name not in cache:
            rgb = load_rgb(args.source_dir / source_name)
            source_mask = extract_chen_mask(rgb)
            web_mask = cv2.warpAffine(source_mask, transform, (MAP_WIDTH, MAP_HEIGHT), flags=cv2.INTER_NEAREST)
            cache[source_name] = (mask_to_geometry(web_mask), rgb)
        blue_geometry, rgb = cache[source_name]
        territory = blue_geometry
        note = ""
        if year == 569:
            rebellion_source = extract_guangzhou_rebellion(rgb)
            rebellion_web = cv2.warpAffine(rebellion_source, transform, (MAP_WIDTH, MAP_HEIGHT), flags=cv2.INTER_NEAREST)
            rebellion = mask_to_geometry(rebellion_web, min_area_px=110.0)
            territory = make_valid(unary_union([territory, rebellion])).simplify(0.012, preserve_topology=True)
            note = "廣州叛亂區仍計入南陳政權疆域；另以 rebellion 圖層疊加表示。"
            features.append(feature(year, source_name, "rebellion", rebellion, registration, "歐陽紇於廣州舉兵；本層不從南陳主疆域扣除。"))
        features.append(feature(year, source_name, "territory", territory, registration, note))

    features.sort(key=lambda item: (item["properties"]["year"], item["properties"]["kind"] != "territory"))
    territory_features = [item for item in features if item["properties"]["kind"] == "territory"]
    rebellion_features = [item for item in features if item["properties"]["kind"] == "rebellion"]
    guangzhou = Point(113.2644, 23.1291)
    guangzhou_569_in_territory = next(
        bool(shape(item["geometry"]).covers(guangzhou))
        for item in territory_features
        if item["properties"]["year"] == 569
    )
    collection = {
        "type": "FeatureCollection",
        "name": "南陳史圖館分期疆域",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "metadata": {
            "version": "2026-08-24.1",
            "license_note": "疆界係依使用者本機保存的史圖館公開地圖截圖矢量化；請在再利用時保留史圖館來源說明。",
            "coordinate_system": "WGS 84 longitude/latitude (CRS84)",
            "web_map_extent": list(GEO_EXTENT),
            "web_map_plot": list(PLOT),
            "registration": registration,
            "guangzhou_569_in_territory": guangzhou_569_in_territory,
            "year_mapping": {str(year): {"source_file": name, "source_year": SOURCE_YEARS[name]} for year, name in YEAR_SOURCES.items()},
            "method": "HSV政權色分割；形態學清理；以569史圖館陳境對ChinaXMap 572陳境配準；轉入現有經緯網；輪廓拓撲修復與保形簡化。",
            "caveat": "這是史圖館概括性疆域圖的可重複矢量化，不等同逐縣邊界；缺年採最近可用年份並逐條標記。",
        },
        "features": features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    args.js_output.write_text(
        "window.CHEN_TERRITORIES=" + json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    write_preview(features, dynamic, args.preview)

    output = {
        "features": len(features),
        "territories": len(territory_features),
        "rebellions": len(rebellion_features),
        "years": [item["properties"]["year"] for item in territory_features],
        "registration": registration,
        "guangzhou_569_in_territory": guangzhou_569_in_territory,
        "geojson": str(args.output),
        "javascript": str(args.js_output),
        "preview": str(args.preview),
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
if __name__ == "__main__":
    main()
