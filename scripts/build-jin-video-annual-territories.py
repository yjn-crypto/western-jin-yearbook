#!/usr/bin/env python3
"""Vectorise the 51 final Western Jin video frames using the two-year model.

The old 289/308 political geometries are copied byte-for-byte as object values.
Province and prefecture boundaries are deliberately outside this script.
"""
from __future__ import annotations
import argparse
import copy
import importlib.util
import json
import re
from pathlib import Path
import cv2
import numpy as np
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
_spec=importlib.util.spec_from_file_location('trial',ROOT/'scripts/build-jin-video-territories.py')
trial=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(trial)
OUT=ROOT/'work/jin-video/annual-georeference'
TARGET=OUT/'annual-territories.geojson'
MANIFEST=json.loads((ROOT/'work/jin-video/manifest.json').read_text())
ROWS={int(r['year']):r for r in MANIFEST['frames']}


def specs(year):
    # A box is a search window for source colour, not a supplied border.
    # Later overlays are separate control/rebellion areas even where they
    # name a commander rather than an independent country.
    s=[
      ('坚昆',(560,20,890,205),[(98,111)],55,60,205),
      ('丁零' if year<=294 else '敕勒诸部',(800,35,1135,340),[(86,100)],45,105,250),
      ('匈奴余部',(520,80,880,275),[(18,39)],25,90,250),
      ('悦般',(380,190,615,292),[(147,175)],45,125,255),
      ('乌孙',(382,250,650,335),[(27,35)],150,135,255),
      ('焉耆',(522,293,620,337),[(66,91)],130,90,250),
      ('扶余',(1187,235,1300,349),[(2,22)],45,60,190),
      ('高句丽',(1217,290,1354,445),[(129,170)],55,70,230),
      ('马韩',(1265,432,1340,512),[(169,180),(0,5)],110,45,185),
      ('辰韩',(1310,424,1362,481),[(52,88)],90,50,210),
      ('弁韩',(1307,436,1356,489),[(7,23)],85,100,255),
      ('百济',(1264,426,1338,485),[(33,54)],90,60,250),
      ('新罗',(1322,445,1363,485),[(26,36)],130,110,255),
      ('珠崖部',(990,860,1055,910),[(20,41)],25,110,255),
      ('夷洲',(1225,718,1280,810),[(18,41)],25,110,255),
      ('古坟时代日本',(1350,0,1520,580),[(18,41)],25,110,255),
      ('林邑',(974,943,1026,985),[(28,54)],130,110,255),
    ]
    if year<=294:
        s.append(('鲜卑诸部',(540,245,1252,529),[(19,31)],110,150,255))
    else:
        s += [
          ('宇文鲜卑',(1082,291,1230,368),[(53,88)],95,55,210),
          ('拓跋鲜卑' if year<=309 else '代',(842,297,1169,484),[(97,116)],65,90,222),
          ('室韦、乌洛侯等部',(1080,72,1446,320),[(17,41)],25,110,255),
        ]
    if year<=279:
        s.append(('孙吴',(878,538,1255,977),[(85,101)],65,95,240))
    if 270<=year<=279:
        s.append(('秃发树机能起兵范围',(905,470,1017,558),[(24,39)],140,130,255))
    if 272<=year<=274:
        s.append(('河西起兵范围（视频标示）',(706,336,810,455),[(91,118)],90,130,255))
    if year==279:
        s.append(('郭马起兵范围',(1036,758,1138,834),[(112,145)],130,90,255))
    if 296<=year<=298:
        s.append(('齐万年起兵范围',(862,468,1015,559),[(90,116)],120,100,255))
    if year==300:
        s.append(('赵廞起兵范围',(862,565,963,708),[(24,43)],120,100,255))
    if year>=301:
        s.append(('龟兹',(426,325,675,380),[(129,155)],110,90,255))
    if year in (302,303):
        s.append(('李特、李雄起兵范围',(846,552,1010,704),[(0,8),(173,180)],80,70,245))
    if year>=304:
        s += [
          ('成',(837,551,1033,788),[(0,8),(173,180)],80,70,245),
          ('汉',(915,375,1246,695),[(54,89)],95,60,215),
        ]
    if year>=310:
        s.append(('吐谷浑',(799,488,932,569),[(20,38)],125,100,255))
    if year==303:
        s.append(('张昌起兵范围',(1100,519,1208,597),[(23,40)],130,100,255))
    if year>=303:
        s.append(('五苓夷起兵范围',(835,737,898,808),[(50,90)],70,130,255))
    if year in (305,306):
        s += [
          ('陈敏起兵范围',(1075,550,1260,802),[(145,173)],60,140,255),
          ('公师藩等起兵范围（视频标示）',(1053,472,1155,551),[(50,103)],100,130,255),
        ]
    if 311<=year<=314:
        s.append(('杜弢起兵范围',(969,609,1149,810),[(34,53)],115,135,255))
    if year>=312:
        s.append(('杜曾起兵范围',(1013,583,1132,683),[(87,106)],115,135,255))
    if year>=316:
        s.append(('汉（石勒控制范围）',(1019,418,1219,531),[(24,43)],125,140,255))
    return s


BEIGE={'匈奴余部','珠崖部','夷洲','古坟时代日本','室韦、乌洛侯等部'}
MIN_AREAS={'林邑':40,'辰韩':40,'新罗':40,'郭马起兵范围':50}
X_RULE=np.array([(374,337),(422,333),(463,323),(538,316),(608,319),(656,324),(659,366),(704,371),(718,396),(749,400),(751,423),(714,434),(628,438),(582,451),(521,461),(458,458),(405,435),(397,410),(381,400),(375,376)])


def feature(year,regime,g,**extra):
    r=ROWS[year]
    p=dict(year=year,kind='rebellion' if '起兵' in regime or '侵入' in regime else 'regime',
      regime=regime,name=regime,is_jin=False,is_western_jin=False,is_jin_affiliate=False,
      source='史图馆《中国历代疆域变化第十五版》用户本机视频年末帧',
      source_frame=f'work/jin-video/frames/{year}.png',source_video_part=r['source_part'],
      source_video_filename=r['source_filename'],source_video_url='https://www.bilibili.com/video/'+re.search(r'BV[0-9A-Za-z]+',r['source_filename']).group()+'/',source_timestamp_seconds=r['timestamp_seconds'],
      source_frame_index=r['frame_index'],source_frame_sha256=r['frame_sha256'],
      source_video_sha256=r['source_sha256'],coordinate_system='WGS84 longitude / latitude',
      fidelity='source-colour-vectorized',
      boundary_evidence='按年度源帧具名色块提取；起兵/部将控制范围仅依视频划定，不据此断言独立国家或逐县归属。')
    p.update(extra)
    return dict(type='Feature',id=f'video-{year}-{regime}',properties=p,geometry=mapping(g))


def round_coords(value):
    if isinstance(value,float):return round(value,6)
    if isinstance(value,list):return [round_coords(x) for x in value]
    if isinstance(value,tuple):return [round_coords(x) for x in value]
    if isinstance(value,dict):return {k:round_coords(v) for k,v in value.items()}
    return value


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--years',type=int,nargs='*',default=list(range(266,317)));parser.add_argument('--output',type=Path,default=TARGET)
    a=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True)
    transform,registration=trial.fit_registration()
    baseline=json.loads((ROOT/'data/jin-maps/jin-video-territories.geojson').read_text())
    features=[];records=[];summaries=[]
    for year in a.years:
        if year in (289,308):
            fs=copy.deepcopy([f for f in baseline['features'] if f['properties']['year']==year])
            features.extend(fs)
            old_pixels=json.loads((ROOT/'work/jin-video/georeference/source-pixel-polygons.json').read_text())
            records.extend(r for r in old_pixels if r['year']==year)
            summaries.append(dict(year=year,baseline_reused=True,regimes=[f['properties']['regime'] for f in fs]))
            print(f'{year}: reused accepted two-year masks',flush=True);continue
        rgb=cv2.imread(str(ROOT/f'work/jin-video/frames/{year}.png'))
        if rgb is None:raise RuntimeError(f'Missing frame {year}')
        hsv=cv2.cvtColor(rgb,cv2.COLOR_BGR2HSV);other_masks=[];others=[];fs=[];ysrc=[];preview=rgb.copy()
        for regime,box,hues,smin,vmin,vmax in specs(year):
            mask=trial.family_mask(hsv,box,hues,smin,vmin,vmax,smax=115 if regime in BEIGE else 255)
            mask=trial.filled_components(mask,MIN_AREAS.get(regime,90),close=3)
            g,pix=trial.mask_geometry(mask,transform,25)
            if g.is_empty:continue
            # Feature colours sometimes adjoin another same-family area. The
            # source windows separate named regions; they do not alter Jin's
            # outside border. A few text-sized components are discarded.
            others.append(g);other_masks.append(mask)
            c=np.median(rgb[mask>0][:,::-1],axis=0).astype(int).tolist()
            fs.append(feature(year,regime,g,source_hsv_ranges=hues,source_colour_rgb=c))
            ysrc.append(dict(year=year,regime=regime,source_pixel_polygons=pix))
            cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cv2.drawContours(preview,cs,-1,(30,30,30),1)
        # In 7-3 the administrative highlight lightens Jin orange to S≈40.
        # The hue and connected source colour still identify it as Jin.
        mask=trial.family_mask(hsv,(620,295,1365,977),[(7,23)],35 if year>=313 else 85,100,255)
        # The atlas also uses orange for small Tibetan chiefdoms; their
        # separate labelled cluster is outside the mainland Jin region.
        mask[500:690,:780]=0
        mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
        mask=trial.filled_components(mask,45,close=3)
        n,labels,stats,centroids=cv2.connectedComponentsWithStats(mask)
        keep=[i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA]>=350 or (990<=centroids[i,0]<=1060 and 850<=centroids[i,1]<=910)]
        mask=np.isin(labels,keep).astype('uint8');enemy=np.zeros_like(mask)
        for m in other_masks:enemy|=m
        mask[enemy>0]=0
        g,pix=trial.mask_geometry(mask,transform,20)
        g=trial.polygonal(g.difference(unary_union(others)))
        fs.append(feature(year,'西晋',g,is_jin=True,is_western_jin=True,
          source_hsv_ranges=[[7,23]],source_saturation_min=35 if year>=313 else 85,source_colour_rgb=[220,137,66],source_colour_semantics='晋橙色；具名他政权与起兵色块优先排除，弁韩等同色区亦先排出。'))
        ysrc.append(dict(year=year,regime='西晋',source_pixel_polygons=pix))
        cs,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);cv2.drawContours(preview,cs,-1,(255,255,255),1)
        cv2.imwrite(str(OUT/f'{year}-jin-mask.png'),mask*255);cv2.imwrite(str(OUT/f'{year}-source-vector-outline.png'),preview)
        nominal=trial.polygonal(Polygon(transform(X_RULE)))
        west=[shape(f['geometry']) for f in fs if f['properties']['regime']=='龟兹']
        if west:nominal=trial.polygonal(nominal.difference(unary_union(west)))
        fs.append(feature(year,'西晋西域都护名义范围',nominal,is_jin_affiliate=True,kind='nominal-affiliate',fidelity='source-outline-reused',
          boundary_evidence='沿同画布晋橙色外框手描；名义关系单列，不与中国州郡领土相加。跨年范围采用稳定框线，非重新考证的逐年西域控制。'))
        features.extend(fs);records.extend(ysrc)
        summaries.append(dict(year=year,baseline_reused=False,source_jin_mask_pixels=int(mask.sum()),regimes=[f['properties']['regime'] for f in fs],
          jin_geometry_valid=g.is_valid,polity_count=len(fs),geographic_area_degrees_squared=g.area))
        print(f'{year}: {len(fs)} regions, {mask.sum()} Jin source pixels',flush=True)
    c=dict(type='FeatureCollection',name='西晋266–316年史图馆视频年度政权范围',metadata=dict(version='2026-10-02.2',years=a.years,
      registration=registration,source_crop_right=1520,source_size=[1920,1080],retained_baseline_years=[289,308],
      caveat='投影为15点拟合候选而非作者确认。政权/起兵范围按每年视频最后清晰帧；不产生州界、郡界或县界。'),features=features)
    # Keep the two accepted geometries unrounded; reduce the new-year sizes.
    for f in c['features']:
        if f['properties']['year'] not in (289,308):
            f['geometry']=round_coords(f['geometry'])
            g=shape(f['geometry'])
            if not g.is_valid:f['geometry']=mapping(trial.polygonal(g))
    target=a.output;target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(c,ensure_ascii=False,separators=(',',':')));tmp.replace(target)
    evidence_dir=OUT if target.resolve()==TARGET.resolve() else target.parent/(target.stem+'-evidence')
    evidence_dir.mkdir(parents=True,exist_ok=True)
    (evidence_dir/'source-pixel-polygons.json').write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')))
    (evidence_dir/'summary.json').write_text(json.dumps(summaries,ensure_ascii=False,indent=2))
    print(json.dumps(dict(path=str(target),years=len(a.years),features=len(features),bytes=target.stat().st_size),ensure_ascii=False))

if __name__=='__main__':main()
