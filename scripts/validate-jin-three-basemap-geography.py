#!/usr/bin/env python3
"""Necessary interface, source-coordinate and coverage checks for the new maps."""
import collections, gzip, hashlib, json
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/jin-maps/three-basemap-annual'

def read(p):
    p=Path(p);raw=p.read_bytes()
    return json.loads(gzip.decompress(raw) if p.suffix=='.gz' else raw)
def verify_gzip(p):
    p=Path(p)
    if p.suffix=='.gz':
        raw=gzip.decompress(p.read_bytes())
        assert p.name=='geometry-'+hashlib.sha256(raw).hexdigest()[:16]+'.json.gz',f'Geometry content fingerprint mismatch: {p.name}'
        return
    assert gzip.decompress(p.with_suffix(p.suffix+'.gz').read_bytes())==p.read_bytes(),f'JSON/gzip mismatch: {p.name}'

def main():
    index=read(OUT/'graph.json');report=read(OUT/'build-report.json')
    verify_gzip(OUT/'graph.json')
    reviewed=read(ROOT/'data/jin-reviewed-annual-rows.json')
    assert sorted(map(int,index['years']))==list(range(266,317)),'All 51 years required'
    assert report['source_sha256']==hashlib.sha256((ROOT/'data/jin-reviewed-annual-rows.json').read_bytes()).hexdigest(),'Stale annual rows'
    colours=read(OUT/'fief-colors.json');geometry={}
    for shard in index['geometry_shards']:
        p=ROOT/shard['url'];assert p.exists();verify_gzip(p);geometry.update(read(p)['geometries'])
    errors=[];exceptions=[];coasts=set();point_count=0;summary={};control_summary={};focused={}
    source_units=read(ROOT/'data/jin-maps/three-basemap-sources/tan281-jun_guo_territories.geojson.gz')['features']
    source_policy=read(ROOT/'data/jin-maps/three-basemap-sources/manifest.json')
    assert source_policy['video_political_features_used']==0
    for year in range(266,317):
        path=ROOT/index['years'][str(year)]['data_url'];verify_gzip(path)
        bundle=read(path);geoms={**geometry,**bundle['geometries']}
        assert bundle['year']==year
        county_rows={c['entity_key']:c for p in reviewed['years'][str(year)] for c in p.get('counties',[])}
        pref_rows={p['id']:p for p in reviewed['years'][str(year)] if p.get('administrative_count',True)}
        active={};counts=collections.Counter();regimes=[];reference_interfaces=0;current_states=set();reference_states=set()
        for f in bundle['features']:
            p=f['properties'];g=geoms.get(f['geometry_id']);assert g,f'{year}: missing {f["geometry_id"]}'
            layer=p['layer'];counts[layer]+=1
            if layer in ('province_areas','reference_province_areas'):
                normalized=p['name'].translate(str.maketrans({'荆':'荊','并':'並','凉':'涼','扬':'揚','兖':'兗','宁':'寧','广':'廣'}))
                (current_states if layer=='province_areas' else reference_states).add(normalized)
            if layer=='regime_areas':
                name=p.get('regime') or p.get('name');regimes.append((p,g))
                assert name in ('西晉','孫吳'),f'{year}: non-atlas political feature: {name}'
                assert p['control_source'] in ('dated_atlas_partition','dated_atlas_partition_only'),f'{year}: video political geometry returned'
            assert layer not in ('county_areas','county_boundaries'),'County boundaries must not be published'
            if layer=='original_territory_boundary':coasts.add(f['geometry_id'])
            if layer=='prefecture_areas':
                assert p['entity_id'] in pref_rows,f'{year}: invalid prefecture {p["entity_id"]}'
                r=pref_rows[p['entity_id']];assert p['state_id']==r['state_id'],f'{year}: province mismatch'
                active[p['entity_id']]=p
            if g['type']=='Point' and p.get('point_coordinates_preserved') and p.get('source_coordinates'):
                assert g['coordinates']==p['source_coordinates'],f'{year}: moved CHGIS point {p.get("entity_id")}'
                point_count+=1
            if p.get('yearbook_entity_key'):
                assert p['yearbook_entity_key'] in county_rows,f'{year}: county identity mismatch'
            if p.get('includes_retained_reference'):
                assert p.get('is_reference') is True,f'{year}: reference boundary not styled as reference'
                state_sides=p.get('adjacent_state_ids',[])
                assert (p['layer']=='province_boundaries')==(state_sides[0]!=state_sides[1]),f'{year}: same-state reference interface promoted to province line'
                sides=p.get('adjacent_entity_ids',[])
                if any(x.startswith('tan281-') for x in sides) and any(x.startswith('p') for x in sides):reference_interfaces+=1
            if p.get('geometry_status')=='unmatched_atlas_compartment_retained_without_current_assignment':
                assert p.get('is_reference') and p.get('entity_id') is None and not p.get('fief_id'),f'{year}: an unsupported successor acquired current identity or kingdom colour'
                assert p.get('reference_year')==281 and p.get('current_entity_assigned') is False
            if p.get('fief_id'):
                assert p['color']==bundle['fief_colors'][p['fief_id']],f'{year}: fief colour inconsistency'
        for pair in colours['adjacency'][str(year)]:
            a,b=pair['fiefs'];assert colours['colors'][a]!=colours['colors'][b],f'{year}: touching same colour {a} {b}'
        assert not current_states.intersection(reference_states),f'{year}: duplicate current/reference province label'
        cov=bundle['coverage'];assert cov['nearest_successor_assignments']==0
        control=cov['political_control']
        used=[p.get('regime') or p.get('name') for p,g in regimes if p.get('control_source')=='allowlisted_internal_video_event']
        assert used==control['video_events_used']==[] and control['video_used'] is False,f'{year}: video boundary used'
        assert control['video_political_features_used']==control['video_boundaries_used']==0
        assert control['actual_control_claim'] is False
        assert control['video_outer_boundary_used'] is False
        assert (any(p.get('regime')=='孫吳' for p,g in regimes))==(year<280)
        control_summary[str(year)]={'video_used':bool(used),'events':used,'baseline':control['baseline']}
        if year==316:assert reference_interfaces>0,'Interfaces between current and reference prefectures are missing'
        if year in (266,281,304,316):
            jin=unary_union([shape(g) for p,g in regimes if p.get('is_jin')])
            territory=unary_union([shape(g) for p,g in regimes])
            focused[str(year)]={'jin_area':jin.area,'non_jin_area':territory.difference(jin).area,'regimes':[p.get('name') for p,g in regimes]}
            if year==266:
                south=unary_union([shape(f['geometry']) for f in source_units if f['properties']['state'] in ('交州','广州')])
                northern=unary_union([shape(f['geometry']) for f in source_units if f['properties']['state'] in ('凉州','幽州')]).intersection(territory)
                south_jin=south.intersection(jin).area;north_white=northern.difference(jin).area
                assert south_jin<1e-5,f'266: erroneous Jin colour in Jiao/Guang: {south_jin}'
                assert north_white<1e-5,f'266: external-video white holes in Liang/You: {north_white}'
                focused['266'].update(jiao_guang_erroneous_jin_area=south_jin,liang_you_external_white_area=north_white)
            if year==281:assert territory.difference(jin).area<1e-5 and not used,'281 must carry stable atlas political extent without video clipping'
            if year in (304,316):assert territory.difference(jin).area<1e-5 and not used,'Late atlas extent must not be cut by video'
            assert '完全不採用史圖館政權邊界' in bundle['presentation']['note']
            assert '不代表晉末全境均由西晉實控' in bundle['presentation']['note']
        assert cov['gap_area']<1e-5 and cov['overlap_area']<1e-5,f'{year}: topology coverage failure'
        documented=cov.get('documented_geometry_exceptions',[])
        for item in documented:
            assert item['entity_id'] in ('p033','p109','p166','p138','p186') and item.get('reason') and item.get('mother')
            exceptions.append(item)
        unexplained=set(cov['prefectures_without_geometry'])-{e['entity_id'] for e in documented}
        if unexplained:errors.append(dict(year=year,missing=sorted(unexplained)))
        summary[str(year)]=dict(layer_counts=dict(counts),active_drawn=len(active),unmapped=cov['prefectures_without_geometry'],retained_atlas_references=len(cov['unassigned_atlas_references']),current_reference_interfaces=reference_interfaces)
    assert len(coasts)==1,'Unrelated annual changes must not redraw the shoreline'
    keep={Path(s['url']).name for s in index['geometry_shards']}
    stale=[p.name for p in OUT.glob('geometry-*') if p.name not in keep]
    assert not stale,'Unreferenced generated shards remain'
    result=dict(years=51,preserved_source_point_observations=point_count,shared_coast_geometries=len(coasts),
        county_faces_or_boundaries=0,colour_conflicts=0,unexplained_missing_prefectures=errors,
        matching_json_gzip_pairs=52,verified_gzip_only_geometry_shards=len(index['geometry_shards']),
        documented_boundary_exceptions=exceptions,year_summary=summary,
        video_political_features_used=0,video_boundaries_used=0,nearest_successor_assignments=0,
        atlas_only_control_by_year=control_summary,focused_political_checks=focused)
    (OUT/'validation-report.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='year_summary'},ensure_ascii=False))
    if errors:raise SystemExit('Resolve active in-scope prefectures without geometry before publication')

if __name__=='__main__':main()
