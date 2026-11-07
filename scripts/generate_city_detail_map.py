#!/usr/bin/env python3
"""Bundle fine-grain local OpenStreetMap roads for the offline Egypt map.

The map downloads this SVG only from the app's own public/maps directory. Nothing
in the browser calls a tile or map provider. The generated geometry is ODbL data.
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.parse
import urllib.request
import xml.sax.saxutils as xml
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/maps/egypt-city-roads.svg"
WIDTH, HEIGHT, PADDING = 598.0, 548.0, 8.0
# Local OSM road detail around Egypt's populated centers and coastal markets.
REGIONS = (
    (29.98, 31.22, 30.12, 31.42),  # Greater Cairo and New Cairo
    (31.15, 29.82, 31.30, 30.02),  # Alexandria
    (30.76, 28.85, 30.89, 29.02),  # Alamein coast
    (31.20, 32.25, 31.32, 32.40),  # Port Said
    (31.00, 31.32, 31.10, 31.44),  # Mansoura
    (29.90, 32.50, 30.00, 32.62),  # Suez
    (27.17, 33.78, 27.30, 33.90),  # Hurghada
    (25.65, 32.60, 25.74, 32.69),  # Luxor
    (24.04, 32.86, 24.15, 32.96),  # Aswan
)
ROAD_FILTER = "^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"


def positions(value: object):
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(v, (int, float)) for v in value[:2]):
        yield value
    elif isinstance(value, list):
        for child in value:
            yield from positions(child)


def map_projection():
    collection = json.loads((ROOT / "data/egypt.geo.json").read_text())
    coords = [point for feature in collection["features"] for point in positions(feature["geometry"]["coordinates"])]
    lons = [point[0] for point in coords]
    lats = [point[1] for point in coords]
    lon_scale = math.cos(math.radians((min(lats) + max(lats)) / 2))
    xs = [lon * lon_scale for lon in lons]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(lats), max(lats)
    scale = min((WIDTH - 2 * PADDING) / (max_x - min_x), (HEIGHT - 2 * PADDING) / (max_y - min_y))
    offset_x = (WIDTH - (max_x - min_x) * scale) / 2
    offset_y = (HEIGHT - (max_y - min_y) * scale) / 2

    def project(lat: float, lon: float):
        x = offset_x + (lon * lon_scale - min_x) * scale
        y = HEIGHT - offset_y - (lat - min_y) * scale
        return (round(x, 2), round(y, 2))

    return project


def simplify(points, tolerance=0.035):
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    tol2 = tolerance * tolerance
    while stack:
        first, last = stack.pop()
        ax, ay = points[first]
        bx, by = points[last]
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        best_i, best = None, tol2
        for index in range(first + 1, last):
            px, py = points[index]
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom)) if denom else 0.0
            dist2 = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2
            if dist2 > best:
                best_i, best = index, dist2
        if best_i is not None:
            keep[best_i] = True
            stack.extend(((first, best_i), (best_i, last)))
    return [point for point, retain in zip(points, keep) if retain]


def encode_path(points):
    # SVG relative commands use fewer bytes while preserving sub-pixel road bends.
    if not points:
        return ""
    x0, y0 = points[0]
    commands = [f"M{x0:g} {y0:g}"]
    previous_x, previous_y = x0, y0
    for x, y in points[1:]:
        dx, dy = round(x - previous_x, 2), round(y - previous_y, 2)
        if abs(dx) + abs(dy) > 0.035:
            commands.append(f"l{dx:g} {dy:g}")
            previous_x, previous_y = x, y
    return "".join(commands)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-json", type=Path, help="Reuse a downloaded Overpass JSON response instead of making a request")
    args = parser.parse_args()
    if args.input_json:
        elements = json.loads(args.input_json.read_text()).get("elements", [])
    else:
        boxes = ";".join(f'way["highway"~"{ROAD_FILTER}"]({south},{west},{north},{east})' for south, west, north, east in REGIONS)
        query = f"[out:json][timeout:90];({boxes};);out tags geom;"
        request = urllib.request.Request(
            "https://overpass-api.de/api/interpreter",
            data=urllib.parse.urlencode({"data": query}).encode(),
            headers={"User-Agent": "TheRealEstateAgent/1.0 (bundled offline OSM detail map)"},
        )
        with urllib.request.urlopen(request, timeout=150) as response:
            elements = json.load(response).get("elements", [])

    project = map_projection()
    groups = defaultdict(list)
    seen = set()
    for way in elements:
        way_id = way.get("id")
        if way_id in seen:
            continue
        seen.add(way_id)
        tags = way.get("tags", {})
        highway = tags.get("highway", "")
        points = [project(node["lat"], node["lon"]) for node in way.get("geometry", [])]
        points = simplify(points)
        path = encode_path(points)
        if not path:
            continue
        road_class = "arterial" if highway in {"motorway", "trunk", "primary"} else "collector" if highway in {"secondary", "tertiary"} else "local"
        name = xml.escape(tags.get("name", ""), {'"': "&quot;"})
        title = f'<title>{name}</title>' if name else ""
        groups[road_class].append(f'<path d="{path}">{title}</path>')

    styles = {
        "arterial": ('#a9daf3', ".88", ".22"),
        "collector": ('#76a8c7', ".72", ".15"),
        "local": ('#506b83', ".65", ".095"),
    }
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH:g} {HEIGHT:g}" width="{WIDTH:g}" height="{HEIGHT:g}">',
        '<metadata>High-detail local road geometry from OpenStreetMap contributors, ODbL 1.0. Bundled for offline use; coverage includes Greater Cairo/New Cairo, Alexandria, Alamein, the Nile Delta, Suez Canal, Red Sea, and Upper Egypt.</metadata>',
        '<defs><clipPath id="detail-clip"><rect x="0" y="0" width="598" height="548"/></clipPath></defs>',
        '<g clip-path="url(#detail-clip)" fill="none" stroke-linecap="round" stroke-linejoin="round">',
    ]
    for road_class in ("arterial", "collector", "local"):
        color, opacity, width = styles[road_class]
        lines.append(f'<g id="{road_class}" stroke="{color}" stroke-opacity="{opacity}" stroke-width="{width}">')
        lines.extend(groups[road_class])
        lines.append("</g>")
    lines.extend(("</g>", "</svg>"))
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(seen)} OSM ways, {OUT.stat().st_size:,} bytes ({date.today().isoformat()})")


if __name__ == "__main__":
    main()
