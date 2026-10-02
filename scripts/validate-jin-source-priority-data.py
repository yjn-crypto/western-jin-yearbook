#!/usr/bin/env python3
"""Necessary source/geometry checks for the current 51-year publication."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from shapely import make_valid, set_precision
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def original_domain(year):
    doc = json.loads((ROOT/f'data/jin-maps/{year}_map.geojson').read_text())
    geoms = [set_precision(make_valid(shape(f['geometry'])),.000001)
             for f in doc['features'] if f['properties']['layer']=='province_areas']
    domain=unary_union(geoms)
    parts=[domain] if domain.geom_type=='Polygon' else list(domain.geoms)
    return set_precision(unary_union([Polygon(p.exterior,[r for r in p.interiors if Polygon(r).area>=.001])
                                      for p in parts]),.000001)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local',type=Path,default=ROOT/'work/jin-video/source-priority-final-gis')
    parser.add_argument('--public',type=Path,default=ROOT/'data/jin-maps/source-priority-annual')
    args=parser.parse_args()
    expected={year:original_domain(year) for year in (289,308)}
    near={year:g.buffer(.000003) for year,g in expected.items()}
    results=[]
    for year in range(266,317):
        source_year=289 if year<=290 else 308
        doc=json.loads((args.local/f'{year}.geojson').read_text())
        report=json.loads((args.local/f'{year}-completion-report.json').read_text())
        assert doc['source_policy']['video_outer_jin_boundary_used'] is False
        assert doc['presentation']['source_priority'] is True
        features=doc['features']
        outlines=[f for f in features if f['properties']['layer']=='original_territory_boundary']
        assert len(outlines)==1 and outlines[0]['geometry']['type'] in ('LineString','MultiLineString')
        assert not any(f['properties']['layer'] in ('county_areas','county_boundaries') for f in features)
        current_points=current_areas=0
        for feature in features:
            p,g=feature['properties'],shape(feature['geometry'])
            assert not g.is_empty and g.is_valid,(year,p.get('layer'),p.get('name'),'invalid geometry')
            if p['layer']=='regime_boundaries':
                assert g.geom_type in ('LineString','MultiLineString')
                assert not p.get('is_jin') and p.get('original_outer_boundary_excluded')
            if g.geom_type=='Point' and p.get('source_coordinates'):
                assert list(g.coords[0])==p['source_coordinates'],(year,p.get('name'),'moved source point')
                if p.get('point_source_priority')=='current_CHGIS':
                    assert p['coordinate_source_begin']<=year<=p['coordinate_source_end']
                    current_points+=1
            if p.get('area_source_priority')=='current_CHGIS_areas' and p['layer']=='prefecture_areas':
                assert p['geometry_source_begin']<=year<=p['geometry_source_end']
                assert 'CHGIS' in p['source'] and p.get('source_id')
                current_areas+=1
        regimes=[shape(f['geometry']) for f in features if f['properties']['layer']=='regime_areas']
        displayed=unary_union(regimes)
        difference=displayed.symmetric_difference(expected[source_year]).area
        outside=displayed.difference(near[source_year]).area
        assert difference<.00002 and outside<.000000001,(year,difference,outside,'original footprint changed')
        assert report['unpainted_jin_area_degrees_squared']==0
        assert report['unfilled_jin_area_degrees_squared']<.00002
        # Browser point packing must preserve source digits as well as local GIS.
        public=json.loads((args.public/f'{year}.json').read_text())
        for feature in public['features']:
            p=feature['properties']
            if p.get('source_coordinates'):
                g=public['geometries'].get(feature['geometry_id'])
                assert g and g['type']=='Point' and g['coordinates']==p['source_coordinates']
        results.append(dict(year=year,current_CHGIS_linked_points=current_points,current_CHGIS_areas=current_areas,
                            original_domain_difference_degrees_squared=difference,outside_original_domain=outside,
                            unpainted_Jin_area=0))
    output=ROOT/'work/jin-video/source-priority-data-checks.json'
    output.write_text(json.dumps(dict(passed=True,years=results,checks=['original_footprint','internal_control_lines',
        'valid_geometries','CHGIS_point_coordinates_and_intervals','CHGIS_area_intervals','no_county_polygons','no_Jin_white_gaps']),
        ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(passed=True,years=len(results),linked_CHGIS_points=sum(r['current_CHGIS_linked_points'] for r in results),
                         maximum_original_domain_difference=max(r['original_domain_difference_degrees_squared'] for r in results),
                         report=str(output)),ensure_ascii=False))


if __name__=='__main__':main()
