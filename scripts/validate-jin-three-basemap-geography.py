#!/usr/bin/env python3
"""Necessary interface, source-coordinate and coverage checks for the new maps."""
import collections, gzip, hashlib, json
from pathlib import Path

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
    errors=[];exceptions=[];coasts=set();point_count=0;summary={}
    for year in range(266,317):
        path=ROOT/index['years'][str(year)]['data_url'];verify_gzip(path)
        bundle=read(path);geoms={**geometry,**bundle['geometries']}
        assert bundle['year']==year
        county_rows={c['entity_key']:c for p in reviewed['years'][str(year)] for c in p.get('counties',[])}
        pref_rows={p['id']:p for p in reviewed['years'][str(year)] if p.get('administrative_count',True)}
        active={};counts=collections.Counter()
        for f in bundle['features']:
            p=f['properties'];g=geoms.get(f['geometry_id']);assert g,f'{year}: missing {f["geometry_id"]}'
            layer=p['layer'];counts[layer]+=1
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
            if p.get('fief_id'):
                assert p['color']==bundle['fief_colors'][p['fief_id']],f'{year}: fief colour inconsistency'
        for pair in colours['adjacency'][str(year)]:
            a,b=pair['fiefs'];assert colours['colors'][a]!=colours['colors'][b],f'{year}: touching same colour {a} {b}'
        cov=bundle['coverage'];assert cov['gap_area']<1e-5 and cov['overlap_area']<1e-5,f'{year}: topology coverage failure'
        documented=cov.get('documented_geometry_exceptions',[])
        for item in documented:
            assert item['entity_id'] in ('p033','p109','p166','p138','p186') and item.get('reason') and item.get('mother')
            exceptions.append(item)
        unexplained=set(cov['prefectures_without_geometry'])-{e['entity_id'] for e in documented}
        if unexplained:errors.append(dict(year=year,missing=sorted(unexplained)))
        summary[str(year)]=dict(layer_counts=dict(counts),active_drawn=len(active),unmapped=cov['prefectures_without_geometry'])
    assert len(coasts)==1,'Unrelated annual changes must not redraw the shoreline'
    keep={Path(s['url']).name for s in index['geometry_shards']}
    stale=[p.name for p in OUT.glob('geometry-*') if p.name not in keep]
    assert not stale,'Unreferenced generated shards remain'
    result=dict(years=51,preserved_source_point_observations=point_count,shared_coast_geometries=len(coasts),
        county_faces_or_boundaries=0,colour_conflicts=0,unexplained_missing_prefectures=errors,
        matching_json_gzip_pairs=52,verified_gzip_only_geometry_shards=len(index['geometry_shards']),
        documented_boundary_exceptions=exceptions,year_summary=summary)
    (OUT/'validation-report.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='year_summary'},ensure_ascii=False))
    if errors:raise SystemExit('Resolve active in-scope prefectures without geometry before publication')

if __name__=='__main__':main()
