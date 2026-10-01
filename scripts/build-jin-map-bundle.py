#!/usr/bin/env python3
"""Build a local, browser-ready Jin map manifest from reviewed annual GeoJSON.

Example: python3 scripts/build-jin-map-bundle.py --map 289=../output/GeoJSON/289_map.geojson --map 308=../output/GeoJSON/308_map.geojson
This does not publish any files or change administrative facts in jin-data.js.
"""
import argparse,json,math
from pathlib import Path
from shapely.geometry import shape,mapping

def coords(geometry):
    if not geometry:return
    if geometry['type']=='GeometryCollection':
        for g in geometry['geometries']:yield from coords(g)
        return
    def walk(c):
        if len(c)>=2 and all(isinstance(v,(float,int)) for v in c[:2]):yield c[:2]
        else:
            for v in c:yield from walk(v)
    yield from walk(geometry['coordinates'])

def main():
    p=argparse.ArgumentParser();p.add_argument('--map',action='append',required=True,help='YEAR=/path/annual_map.geojson')
    p.add_argument('--width',type=int,default=2400)
    p.add_argument('--web-tolerance',type=float,default=.003,help='Display-only simplification in degrees; original delivery files are unchanged')
    a=p.parse_args();repo=Path(__file__).resolve().parents[1]
    dest=repo/'data/jin-maps';dest.mkdir(exist_ok=True);bundle={'version':1,'crs':'EPSG:4326','years':{}}
    for item in a.map:
        y,path=item.split('=',1);year=int(y);path=Path(path);fc=json.loads(path.read_text())
        if fc.get('type')!='FeatureCollection':raise ValueError('FeatureCollection required')
        points=[p for f in fc['features'] for p in coords(f.get('geometry'))]
        if not points:raise ValueError('Annual GeoJSON has no geometry')
        if any(not all(math.isfinite(v) for v in p) or not(-180<=p[0]<=180 and -90<=p[1]<=90) for p in points):raise ValueError('Expected longitude/latitude EPSG:4326, not pixel coordinates')
        def rounded(value):
            if isinstance(value,(tuple,list)):return [rounded(v) for v in value]
            if isinstance(value,dict):return {k:rounded(v) for k,v in value.items()}
            return round(value,6) if isinstance(value,float) else value
        for f in fc['features']:
            if f.get('geometry'):
                g=shape(f['geometry'])
                if g.geom_type not in ('Point','MultiPoint'):g=g.simplify(a.web_tolerance,preserve_topology=True)
                f['geometry']=rounded(mapping(g))
        fc['web_derivative']={'crs':'EPSG:4326','simplification_degrees':a.web_tolerance,'coordinate_decimal_places':6,
                              'purpose':'Web display only; original full-resolution GIS delivery unchanged'}
        west,east=min(p[0] for p in points),max(p[0] for p in points);south,north=min(p[1] for p in points),max(p[1] for p in points)
        dx=max(.1,(east-west)*.025);dy=max(.1,(north-south)*.025);extent=[west-dx,south-dy,east+dx,north+dy]
        width=a.width;height=round((width-160)*(extent[3]-extent[1])/(extent[2]-extent[0])+220)
        name=f'{year}_map.geojson';(dest/name).write_text(json.dumps(fc,ensure_ascii=False,separators=(',',':'))+'\n')
        bundle['years'][y]={'year':year,'width':width,'height':height,'plot':[80,140,width-80,height-80],'extent':extent,
                            'title':f'{year}年　西晉'+('名義建置與封國' if year==308 else '州郡與封國'),'feature_count':len(fc['features']),
                            'data_url':f'data/jin-maps/{name}',
                            'note':('308年為原圖工作斷年，名稱組合支持308—310年；本圖表達名義建置與封國關係，不代表實際控制疆域。' if year==308 else '289年末封國研究斷面。秦州等建置與正文年表存在來源分歧，兩者各自保留。')+fc.get('description','CHGIS優先的年度地理參考；尚未確定的封國或邊界保留原記錄，不由圖面推補。')}
    (repo/'data/jin-map-snapshots.js').write_text('/* Generated from locally reviewed annual GeoJSON. */\nwindow.JIN_SNAPSHOT_MAPS = '+json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+';\n')
    print(json.dumps({y:{'features':v['feature_count'],'size':[v['width'],v['height']],'bytes':(repo/v['data_url']).stat().st_size} for y,v in bundle['years'].items()},ensure_ascii=False))

if __name__=='__main__':main()
