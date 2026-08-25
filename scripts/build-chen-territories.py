#!/usr/bin/env python3
"""Vectorise selected Shituguan Chen maps into WGS 84 GeoJSON.

The source screenshots use one fixed cartographic canvas.  The script extracts
the dark-blue Chen polity fill, separately recognises the mainland and Hainan,
registers the fixed source canvas through Jiankang, Jiangling, Wuling,
Guangzhou, Jiaozhi, and Hainan controls, and then constrains maritime edges to
the coastline in the web terrain base.  The result is converted through the
web map's geographic grid and written as both
GeoJSON and a browser-ready JavaScript copy.
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
from PIL import Image, ImageDraw  # noqa: E402
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape  # type: ignore  # noqa: E402
from shapely.ops import unary_union  # type: ignore  # noqa: E402
from shapely.validation import make_valid  # type: ignore  # noqa: E402


MAP_WIDTH = 4800
MAP_HEIGHT = 4128
PLOT = (650.0, 390.0, 4490.0, 3690.0)
GEO_EXTENT = (93.5, 18.0, 128.5, 44.0)  # west, south, east, north
COAST_SNAP_RADIUS_PX = 84.0
COASTAL_LAND_BAND_PX = 112.0
ADMINISTRATIVE_CONTROL_POINTS = {
    # source_xy was read from the fixed 4661×2622 Shituguan canvas; target_xy
    # uses the corresponding CHGIS/web-map seat or, for Hainan, the terrain
    # island centroid.  Jiangling is a Later Liang seat in these years: it is a
    # geodetic control only and must not be forced into Chen territory.
    "建康（南陳都城）": {"source_xy": (2858.0, 1411.0), "target_xy": (3426.7, 1915.7)},
    "江陵（後梁都城、荊州地理錨點）": {"source_xy": (2562.0, 1532.0), "target_xy": (2701.3, 2135.2)},
    "武陵（武陵郡治臨沅）": {"source_xy": (2547.0, 1609.0), "target_xy": (2646.2, 2302.2)},
    "廣州（南海郡治番禺）": {"source_xy": (2647.0, 1920.0), "target_xy": (2818.8, 3027.1)},
    "交趾（交州核心）": {"source_xy": (2273.0, 2052.0), "target_xy": (2005.0, 3305.0)},
    "海南（史圖館島形質心）": {"source_xy": (2482.0, 2141.0), "target_xy": (2431.4, 3491.5)},
}

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


def clean_selected_component(labels: np.ndarray, label_id: int, close_size: int = 9) -> np.ndarray:
    component = np.where(labels == label_id, 255, 0).astype(np.uint8)
    component = cv2.morphologyEx(
        component,
        cv2.MORPH_CLOSE,
        np.ones((close_size, close_size), dtype=np.uint8),
        iterations=2,
    )
    return cv2.morphologyEx(component, cv2.MORPH_OPEN, np.ones((3, 3), dtype=np.uint8))


def extract_chen_components(rgb: np.ndarray) -> tuple[np.ndarray, bool]:
    """Return the mainland Chen mask and whether the source colours Hainan as Chen.

    Hainan is deliberately detected before morphological closing.  In the
    source JPEG it is a separate blue component; closing the whole mask first
    can bridge the narrow Qiongzhou Strait and silently merge island and
    mainland.  The final island outline comes from the georeferenced terrain
    coastline, while this source component supplies the historical inclusion.
    """

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    # Shituguan's Chen fill is a saturated indigo-blue.  The value ceiling
    # excludes the pale ocean and the saturation floor excludes relief shading.
    mask = cv2.inRange(hsv, np.array([105, 78, 42]), np.array([148, 255, 224]))
    mask[:500, :] = 0
    mask[:, 3500:] = 0
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
    if count <= 1:
        raise RuntimeError("No Chen political fill component was found")
    mainland_id = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mainland = clean_selected_component(labels, mainland_id)

    hainan_candidates = []
    for label_id in range(1, count):
        if label_id == mainland_id or stats[label_id, cv2.CC_STAT_AREA] < 1200:
            continue
        x, y = centroids[label_id]
        if 2350 <= x <= 2600 and 2020 <= y <= 2250:
            hainan_candidates.append(label_id)
    hainan_present = bool(hainan_candidates)
    return mainland, hainan_present


def extract_chen_mask(rgb: np.ndarray) -> np.ndarray:
    mainland, _ = extract_chen_components(rgb)
    return mainland


def map_lonlat_to_xy(lon: float, lat: float) -> tuple[int, int]:
    west, south, east, north = GEO_EXTENT
    left, top, right, bottom = PLOT
    x = left + (lon - west) / (east - west) * (right - left)
    y = top + (north - lat) / (north - south) * (bottom - top)
    return int(round(x)), int(round(y))


def terrain_land_masks(dynamic: dict) -> tuple[np.ndarray, np.ndarray, dict]:
    """Extract target land and a detached Hainan mask from the web terrain base."""

    base = np.asarray(Image.open(ROOT / dynamic["base"].split("?")[0]).convert("RGB"))
    hsv = cv2.cvtColor(base, cv2.COLOR_RGB2HSV)
    water = cv2.inRange(hsv, np.array([88, 15, 140]), np.array([115, 120, 255]))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(water, 8)
    ocean_id = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    ocean = np.where(labels == ocean_id, 255, 0).astype(np.uint8)

    plot = np.zeros_like(ocean)
    left, top, right, bottom = (int(round(value)) for value in PLOT)
    plot[top : bottom + 1, left : right + 1] = 255
    land = np.where((plot > 0) & (ocean == 0), 255, 0).astype(np.uint8)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(land, 8)
    hainan_x, hainan_y = map_lonlat_to_xy(109.8, 19.25)
    hainan_id = int(labels[hainan_y, hainan_x])
    if hainan_id == 0 or stats[hainan_id, cv2.CC_STAT_AREA] < 10000:
        raise RuntimeError("The terrain coastline did not yield a detached Hainan component")
    hainan = np.where(labels == hainan_id, 255, 0).astype(np.uint8)
    mainland_x, mainland_y = map_lonlat_to_xy(110.1, 20.5)
    mainland_id = int(labels[mainland_y, mainland_x])
    if mainland_id == 0 or mainland_id == hainan_id:
        raise RuntimeError("Qiongzhou Strait is not detached in the terrain coastline mask")
    return land, hainan, {
        "source": dynamic["base"].split("?")[0],
        "coast_snap_radius_px": COAST_SNAP_RADIUS_PX,
        "coastal_land_band_px": COASTAL_LAND_BAND_PX,
        "hainan_component_area_px": int(stats[hainan_id, cv2.CC_STAT_AREA]),
        "hainan_detached_from_mainland": True,
    }


def constrain_mainland_to_coast(mainland: np.ndarray, land: np.ndarray) -> np.ndarray:
    """Snap only the maritime fringe to land while preserving inland borders."""

    land_distance = cv2.distanceTransform(land, cv2.DIST_L2, 5)
    outside_territory = np.where(mainland > 0, 0, 255).astype(np.uint8)
    territory_distance = cv2.distanceTransform(outside_territory, cv2.DIST_L2, 5)
    kept = (mainland > 0) & (land > 0)
    coastal_fill = (
        (land > 0)
        & (land_distance <= COASTAL_LAND_BAND_PX)
        & (territory_distance <= COAST_SNAP_RADIUS_PX)
    )
    return np.where(kept | coastal_fill, 255, 0).astype(np.uint8)


def extract_guangzhou_rebellion(rgb: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    green = cv2.inRange(hsv, np.array([36, 95, 35]), np.array([94, 255, 230]))
    crop = np.zeros_like(green)
    # Guangzhou / Lingnan area on the fixed Shituguan canvas.  The tight crop
    # prevents the green Linyi and relief tint farther south from being read as
    # part of Ouyang He's revolt.
    crop[1780:2050, 2500:2740] = green[1780:2050, 2500:2740]
    return largest_component(crop, close_size=11)


def iou(left: np.ndarray, right: np.ndarray) -> float:
    intersection = np.count_nonzero((left > 0) & (right > 0))
    union = np.count_nonzero((left > 0) | (right > 0))
    return intersection / union if union else 0.0


def map_xy_to_lonlat(x: float, y: float) -> tuple[float, float]:
    west, south, east, north = GEO_EXTENT
    left, top, right, bottom = PLOT
    lon = west + (x - left) / (right - left) * (east - west)
    lat = north - (y - top) / (bottom - top) * (north - south)
    return round(float(lon), 6), round(float(lat), 6)


def polygon_parts(geometry) -> list[Polygon]:
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    if hasattr(geometry, "geoms"):
        return [polygon for child in geometry.geoms for polygon in polygon_parts(child)]
    return []


def mask_to_geometry(
    mask: np.ndarray,
    min_area_px: float = 500.0,
    approx_epsilon_px: float = 1.0,
    simplify_degrees: float = 0.004,
):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hierarchy is None:
        raise RuntimeError("No contours found")
    hierarchy = hierarchy[0]
    polygons = []
    for index, contour in enumerate(contours):
        if hierarchy[index][3] != -1 or cv2.contourArea(contour) < min_area_px:
            continue
        outer_px = cv2.approxPolyDP(contour, approx_epsilon_px, True).reshape(-1, 2)
        outer = [map_xy_to_lonlat(x, y) for x, y in outer_px]
        holes = []
        child = hierarchy[index][2]
        while child != -1:
            if cv2.contourArea(contours[child]) >= 180.0:
                hole_px = cv2.approxPolyDP(contours[child], approx_epsilon_px, True).reshape(-1, 2)
                holes.append([map_xy_to_lonlat(x, y) for x, y in hole_px])
            child = hierarchy[child][0]
        if len(outer) >= 4:
            polygon = Polygon(outer, holes)
            if not polygon.is_valid:
                polygon = make_valid(polygon)
            polygons.extend(polygon_parts(polygon))
    if not polygons:
        raise RuntimeError("No polygonal contours found")
    geometry = unary_union(polygons)
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    geometry = geometry.simplify(simplify_degrees, preserve_topology=True)
    parts = polygon_parts(geometry)
    if not parts:
        raise RuntimeError("Topology repair removed every polygon")
    return MultiPolygon(parts)


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
            "fidelity": "image-vectorized-coastline-constrained",
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


def write_control_previews(rgb: np.ndarray, transform: np.ndarray, destination: Path) -> None:
    """Write source-map crops around inverse-projected administrative controls."""

    destination.mkdir(parents=True, exist_ok=True)
    inverse = cv2.invertAffineTransform(transform)
    source = Image.fromarray(rgb)
    for name, item in ADMINISTRATIVE_CONTROL_POINTS.items():
        target_x, target_y = item["target_xy"]
        source_x, source_y = inverse @ np.asarray([target_x, target_y, 1.0])
        half = 180
        left = max(0, int(round(source_x)) - half)
        top = max(0, int(round(source_y)) - half)
        right = min(source.width, int(round(source_x)) + half)
        bottom = min(source.height, int(round(source_y)) + half)
        crop = source.crop((left, top, right, bottom)).resize(((right - left) * 2, (bottom - top) * 2), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(crop)
        cx = (source_x - left) * 2
        cy = (source_y - top) * 2
        draw.line((cx - 26, cy, cx + 26, cy), fill=(255, 30, 30), width=3)
        draw.line((cx, cy - 26, cx, cy + 26), fill=(255, 30, 30), width=3)
        safe_name = name.split("（", 1)[0]
        crop.save(destination / f"{safe_name}.png")


def register_from_administrative_controls(source_mask: np.ndarray, target_mask: np.ndarray) -> tuple[np.ndarray, dict]:
    """Fit the fixed Shituguan canvas to CHGIS with distributed historical seats."""

    source = np.asarray([item["source_xy"] for item in ADMINISTRATIVE_CONTROL_POINTS.values()], dtype=np.float64)
    target = np.asarray([item["target_xy"] for item in ADMINISTRATIVE_CONTROL_POINTS.values()], dtype=np.float64)
    design = np.column_stack([source, np.ones(len(source), dtype=np.float64)])
    transform = np.linalg.lstsq(design, target, rcond=None)[0].T.astype(np.float32)
    predicted = design @ transform.T
    residuals = np.linalg.norm(predicted - target, axis=1)
    warped = cv2.warpAffine(source_mask, transform, (MAP_WIDTH, MAP_HEIGHT), flags=cv2.INTER_NEAREST)
    controls = []
    for (name, item), predicted_xy, residual in zip(ADMINISTRATIVE_CONTROL_POINTS.items(), predicted, residuals):
        target_x, target_y = item["target_xy"]
        controls.append(
            {
                "name": name,
                "source_xy": list(item["source_xy"]),
                "target_xy": list(item["target_xy"]),
                "target_lonlat": list(map_xy_to_lonlat(target_x, target_y)),
                "fitted_xy": [round(float(predicted_xy[0]), 3), round(float(predicted_xy[1]), 3)],
                "residual_px": round(float(residual), 3),
            }
        )
    return transform, {
        "method": "administrative-control-affine-lstsq",
        "control_rmse_px": round(float(np.sqrt(np.mean(residuals**2))), 6),
        "control_max_residual_px": round(float(np.max(residuals)), 6),
        "reference_iou": round(float(iou(warped, target_mask)), 6),
        "matrix": [[round(float(value), 9) for value in row] for row in transform],
        "controls": controls,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=Path(r"E:\BaiduNetdiskDownload\史图馆地图"))
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "chen-territories.geojson")
    parser.add_argument("--js-output", type=Path, default=ROOT / "data" / "chen-territories.js")
    parser.add_argument("--preview", type=Path, default=WORKSPACE / "research" / "chen-territories" / "vector-preview.png")
    parser.add_argument("--control-preview", type=Path, default=WORKSPACE / "research" / "chen-territories" / "control-points")
    args = parser.parse_args()

    dynamic = load_dynamic_map()
    target = largest_component(rasterise_svg(dynamic["regimes"]["chen"]), close_size=5)
    terrain_land, terrain_hainan, coastline = terrain_land_masks(dynamic)
    terrain_mainland_land = cv2.bitwise_and(terrain_land, cv2.bitwise_not(terrain_hainan))
    coastline["mainland_excludes_hainan_before_snap"] = True
    calibration_rgb = load_rgb(args.source_dir / "太建元年.jpg")
    calibration_mask = extract_chen_mask(calibration_rgb)
    transform, registration = register_from_administrative_controls(calibration_mask, target)
    write_control_previews(calibration_rgb, transform, args.control_preview)
    registration["coastline_constraint"] = coastline

    features: list[dict] = []
    cache: dict[str, tuple[object, np.ndarray, bool, np.ndarray]] = {}
    for year, source_name in YEAR_SOURCES.items():
        if source_name not in cache:
            rgb = load_rgb(args.source_dir / source_name)
            source_mainland, hainan_present = extract_chen_components(rgb)
            web_mainland = cv2.warpAffine(source_mainland, transform, (MAP_WIDTH, MAP_HEIGHT), flags=cv2.INTER_NEAREST)
            web_mask = constrain_mainland_to_coast(web_mainland, terrain_mainland_land)
            if hainan_present:
                web_mask = cv2.bitwise_or(web_mask, terrain_hainan)
            cache[source_name] = (mask_to_geometry(web_mask), rgb, hainan_present, web_mask)
        blue_geometry, rgb, hainan_present, territory_mask = cache[source_name]
        territory = blue_geometry
        note = "史圖館內陸疆界保留；海岸依網頁地形底圖校準，海南按原圖歸屬以獨立島形重建。" if hainan_present else "史圖館內陸疆界保留；海岸依網頁地形底圖校準。"
        if year == 569:
            rebellion_source = extract_guangzhou_rebellion(rgb)
            rebellion_raw = cv2.warpAffine(rebellion_source, transform, (MAP_WIDTH, MAP_HEIGHT), flags=cv2.INTER_NEAREST)
            ocean_pixels_removed = int(np.count_nonzero((rebellion_raw > 0) & (terrain_land == 0)))
            rebellion_web = cv2.bitwise_and(rebellion_raw, terrain_mainland_land)
            coastline["rebellion_ocean_pixels_removed"] = ocean_pixels_removed
            coastline["rebellion_ocean_overlap_px"] = int(np.count_nonzero((rebellion_web > 0) & (terrain_land == 0)))
            rebellion = mask_to_geometry(rebellion_web, min_area_px=110.0)
            territory = mask_to_geometry(cv2.bitwise_or(territory_mask, rebellion_web))
            note += "廣州叛亂區仍計入南陳政權疆域；另以 rebellion 圖層疊加表示。"
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
            "version": "2026-08-24.4",
            "license_note": "疆界係依使用者本機保存的史圖館公開地圖截圖矢量化；請在再利用時保留史圖館來源說明。",
            "coordinate_system": "WGS 84 longitude/latitude (CRS84)",
            "web_map_extent": list(GEO_EXTENT),
            "web_map_plot": list(PLOT),
            "registration": registration,
            "guangzhou_569_in_territory": guangzhou_569_in_territory,
            "year_mapping": {str(year): {"source_file": name, "source_year": SOURCE_YEARS[name]} for year, name in YEAR_SOURCES.items()},
            "method": "HSV政權色分割；大陸與海南分量獨立辨識；以建康、江陵、武陵、廣州、交趾、海南六個分布式人文地理控制點對CHGIS／網頁經緯網作最小二乘仿射配準；海岸線以網頁地形底圖海陸掩膜約束；海南採底圖獨立島形；輪廓拓撲修復與保形簡化。",
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
