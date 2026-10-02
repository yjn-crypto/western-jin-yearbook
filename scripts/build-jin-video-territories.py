#!/usr/bin/env python3
"""Register the user's 289/308 video frames and vectorise visible polity fills.

The inferred CRS is explicitly a fitted model, not an author-supplied CRS.
Political colour polygons and geographic land are separate products.
"""
from __future__ import annotations
import json
from pathlib import Path
import cv2
import numpy as np
from pyproj import Transformer, CRS
from scipy.ndimage import binary_fill_holes
from shapely.geometry import Polygon, MultiPolygon, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/jin-video/georeference'
DATA = ROOT / 'data/jin-maps'
SOURCE_WIDTH = 1920
SOURCE_HEIGHT = 1080
MAP_RIGHT = 1520
MANIFEST_FILE = ROOT / 'work/jin-video/manifest.json'
FRAME_ROWS = {r['year']:r for r in json.loads(MANIFEST_FILE.read_text()).get('frames',[])} if MANIFEST_FILE.exists() else {}

# Hand-read identifiable geographic objects. Coast tips are approximate at
# 1080p; historical seats use the project's CHGIS-linked point coordinates.
CONTROLS = [
    ('海南东北角',1041,862,110.68,20.15,'coast'),
    ('海南南端',1017,903,109.55,18.16,'coast'),
    ('海南西端',997,884,108.64,19.31,'coast'),
    ('台湾北端',1251,724,121.57,25.28,'coast'),
    ('台湾南端',1247,797,120.84,21.90,'coast'),
    ('辽东半岛南端',1191,424,121.13,38.72,'coast'),
    ('山东成山角',1227,452,122.70,37.397,'coast'),
    ('济州岛质心',1313,526,126.54,33.38,'island-centroid'),
    ('九州佐多岬',1397,554,130.67,30.99,'coast'),
    ('长安县治',990,547,108.90698,34.24642,'CHGIS-county'),
    ('洛阳都城点',1054,533,112.5963,34.73157,'CHGIS-county'),
    ('成都县治',908,629,104.075401,30.666059,'CHGIS-county'),
    ('建邺县治',1179,582,118.76899,32.052563,'CHGIS-county'),
    ('番禺县治',1089,785,113.256066,23.134624,'CHGIS-county'),
    ('高句丽集安都城点',1264,351,126.19,41.13,'geographic-city'),
]

MODELS = {
    'geographic-affine':'EPSG:4326',
    'mercator-affine':'EPSG:3857',
    'albers-105-25-47-affine':'+proj=aea +lat_1=25 +lat_2=47 +lon_0=105 +lat_0=0 +datum=WGS84 +units=m +no_defs',
}


def fit_registration():
    ll = np.asarray([[c[3],c[4]] for c in CONTROLS],float)
    pixels = np.asarray([[c[1],c[2]] for c in CONTROLS],float)
    results = []
    for name, crs in MODELS.items():
        forward = Transformer.from_crs('EPSG:4326',crs,always_xy=True)
        xy = np.column_stack(forward.transform(ll[:,0],ll[:,1]))
        design = np.column_stack([xy,np.ones(len(xy))])
        matrix = np.linalg.lstsq(design,pixels,rcond=None)[0]
        residuals = np.linalg.norm(design@matrix-pixels,axis=1)
        loo=[]
        for i in range(len(xy)):
            keep=np.arange(len(xy))!=i
            m=np.linalg.lstsq(design[keep],pixels[keep],rcond=None)[0]
            loo.append(float(np.linalg.norm(design[i]@m-pixels[i])))
        results.append(dict(name=name,crs=crs,matrix=matrix.tolist(),
            rmse_source_px=float(np.sqrt(np.mean(residuals**2))),
            max_residual_source_px=float(max(residuals)),
            leave_one_out_rmse_source_px=float(np.sqrt(np.mean(np.array(loo)**2))),
            residuals=[dict(name=c[0],source_xy=list(c[1:3]),lonlat=list(c[3:5]),
                provenance=c[5],residual_px=float(r),leave_one_out_px=l)
                for c,r,l in zip(CONTROLS,residuals,loo)]))
    selected=min(results,key=lambda d:d['leave_one_out_rmse_source_px'])
    m=np.asarray(selected['matrix'])
    inverse=np.linalg.inv(m[:2,:])
    backward=Transformer.from_crs(selected['crs'],'EPSG:4326',always_xy=True)
    def pixel_to_lonlat(points):
        p=np.asarray(points,float)
        xy=(p-m[2,:])@inverse
        lon,lat=backward.transform(xy[:,0],xy[:,1])
        return np.column_stack([lon,lat])
    return pixel_to_lonlat,dict(selected=selected,models=results,crs_author_confirmed=False,
        interpretation='基于15个手读地物及CHGIS治所点的投影候选比较；留一法为模型选择检查，非作者原始坐标系证明。',
        limits=['1080p手读控制点含数像素不确定性。','西北和最北方远离控制点，属于外推；全亚洲轮廓只能作为视频图数字化试验。',
                '古海岸与概括地形可能不同，不将控制点拟合误差等同历史边界精度。'])


def polygonal(g):
    if not g.is_valid:g=make_valid(g)
    if isinstance(g,Polygon):return g
    if isinstance(g,MultiPolygon):return g
    if hasattr(g,'geoms'):
        ps=[]
        for p in g.geoms:
            q=polygonal(p)
            if isinstance(q,Polygon):ps.append(q)
            elif isinstance(q,MultiPolygon):ps.extend(q.geoms)
        return unary_union(ps) if ps else Polygon()
    return Polygon()


def filled_components(mask,min_area=60,close=3):
    if close:
        mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_CLOSE,np.ones((close,close),np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype('uint8'))
    out=np.zeros_like(mask,dtype='uint8')
    for i in range(1,n):
        if stats[i,cv2.CC_STAT_AREA]<min_area:continue
        component=binary_fill_holes(labels==i)
        out[component]=1
    return out


def mask_geometry(mask,pixel_to_lonlat,min_area=30):
    contours,hierarchy=cv2.findContours(mask.astype('uint8'),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:return Polygon(),[]
    polygons=[];pixel_polygons=[]
    for i,contour in enumerate(contours):
        if hierarchy[0,i,3]!=-1 or cv2.contourArea(contour)<min_area:continue
        outer=cv2.approxPolyDP(contour,.55,True).reshape(-1,2)
        if len(outer)<3:continue
        holes=[];pixel_holes=[];child=hierarchy[0,i,2]
        while child!=-1:
            c=contours[child]
            if cv2.contourArea(c)>=min_area:
                pts=cv2.approxPolyDP(c,.55,True).reshape(-1,2)
                if len(pts)>=3:holes.append(pixel_to_lonlat(pts));pixel_holes.append(pts.tolist())
            child=hierarchy[0,child,0]
        g=polygonal(Polygon(pixel_to_lonlat(outer),holes))
        if not g.is_empty:polygons.append(g);pixel_polygons.append(dict(outer=outer.tolist(),holes=pixel_holes))
    return polygonal(unary_union(polygons)),pixel_polygons


def family_mask(hsv,box,hues,smin=45,vmin=70,vmax=255,smax=255):
    x0,y0,x1,y1=box;h,s,v=cv2.split(hsv)
    hue=np.zeros(h.shape,bool)
    for lo,hi in hues:hue|=(h>=lo)&(h<=hi)
    mask=hue&(s>=smin)&(s<=smax)&(v>=vmin)&(v<=vmax)
    region=np.zeros(h.shape,bool);region[y0:y1,x0:x1]=True
    return mask&region


def specifications(year):
    # Each box isolates one directly visible labelled colour region. Boxes
    # never supply the final border: only matching source colour does.
    specs=[
        ('坚昆',(560,20,890,205),[(98,111)],55,60,205),
        ('丁零' if year==289 else '敕勒诸部',(800,35,1135,340),[(86,100)],45,105,250),
        ('匈奴余部',(520,80,880,275),[(18,39)],25,90,250),
        ('悦般',(380,190,615,292),[(147,175)],45,125,255),
        ('乌孙',(382,250,650,335),[(27,35)],150,135,255),
        ('焉耆',(522,293,620,337),[(66,91)],130,90,250),
        ('扶余',(1187,235,1300,349),[(2,22)],45,60,190),
        ('高句丽',(1217,290,1354,392),[(129,170)],55,70,230),
        ('马韩',(1265,432,1340,512),[(169,180),(0,5)],110,45,185),
        ('辰韩',(1310,424,1362,481),[(52,88)],90,50,210),
        ('弁韩',(1307,436,1356,489),[(7,23)],85,100,255),
        ('珠崖部',(990,860,1055,910),[(20,41)],25,110,255),
        ('夷洲',(1225,718,1280,810),[(18,41)],25,110,255),
        ('古坟时代日本',(1350,0,1520,580),[(18,41)],25,110,255),
        ('林邑',(974,943,1026,985),[(28,54)],130,110,255),
    ]
    if year==289:
        specs += [('鲜卑诸部',(540,245,1252,529),[(19,31)],110,150,255)]
    else:
        specs += [
            ('宇文鲜卑',(1082,291,1230,368),[(53,88)],95,55,210),
            ('拓跋鲜卑',(842,297,1169,484),[(97,116)],65,90,222),
            ('室韦、乌洛侯等部',(1080,72,1446,320),[(17,41)],25,110,255),
            ('龟兹',(426,325,675,380),[(129,155)],110,90,255),
            ('百济',(1264,426,1338,485),[(33,54)],90,60,250),
            ('新罗',(1322,445,1363,485),[(26,36)],130,110,255),
            ('成',(872,573,998,691),[(0,8),(173,180)],80,70,245),
            ('汉',(972,457,1142,563),[(51,89)],95,60,215),
            ('五苓夷起兵范围',(837,741,894,798),[(50,90)],70,130,255),
        ]
    return specs


def add_feature(features,year,regime,g,source_pixels,**extra):
    if g.is_empty:return
    props=dict(year=year,kind='regime',regime=regime,name=regime,
        is_jin=False,is_western_jin=False,source='史图馆《中国历代疆域变化第十五版》用户本机视频年末帧',
        source_frame=f'work/jin-video/frames/{year}.png',source_video_url={289:'https://www.bilibili.com/video/BV1bc411D7WB/',308:'https://www.bilibili.com/video/BV1CA4m1L7WJ/'}[year],
        coordinate_system='WGS84 longitude / latitude',fidelity='source-colour-vectorized',
        boundary_evidence='按视频可见政治色块及外轮廓提取；文字、河流形成的小空隙闭合；不是逐县控制证据。')
    props.update(extra)
    frame=FRAME_ROWS.get(year,{})
    props.update(source_timestamp_seconds=frame.get('timestamp_seconds'),source_frame_index=frame.get('frame_index'),
                 source_frame_sha256=frame.get('frame_sha256'),source_video_sha256=frame.get('source_sha256'))
    features.append(dict(type='Feature',id=f'video-{year}-{len(features)}',properties=props,geometry=mapping(g)))
    return dict(regime=regime,source_pixel_polygons=source_pixels)


def source_land(hsv):
    h,s,v=cv2.split(hsv)
    sea=((h>=100)&(h<=119)&(s>=42)&(v>=217)).astype('uint8')
    sea=cv2.morphologyEx(sea,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    n, labels,stats,_=cv2.connectedComponentsWithStats(sea)
    ocean=np.zeros_like(sea)
    for i in range(1,n):
        if stats[i,cv2.CC_STAT_AREA]>100000:ocean[labels==i]=1
    land=1-ocean;land[:,MAP_RIGHT:]=0
    return filled_components(land,min_area=200,close=3)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    pixel_to_lonlat,registration=fit_registration()
    (OUT/'registration.json').write_text(json.dumps(registration,ensure_ascii=False,indent=2))
    features=[];source_records=[];mask_counts={}
    for year in (289,308):
        rgb=cv2.imread(str(ROOT/f'work/jin-video/frames/{year}.png'))
        if rgb is None:raise RuntimeError(f'Missing final year-end frame {year}')
        hsv=cv2.cvtColor(rgb,cv2.COLOR_BGR2HSV)
        others=[];other_masks=[];preview=rgb.copy()
        for regime,box,hues,smin,vmin,vmax in specifications(year):
            beige=regime in ('匈奴余部','珠崖部','夷洲','古坟时代日本','室韦、乌洛侯等部')
            mask=family_mask(hsv,box,hues,smin,vmin,vmax,smax=115 if beige else 255)
            mask=filled_components(mask,40 if regime in ('林邑','辰韩','新罗') else 90,close=3)
            g,pix=mask_geometry(mask,pixel_to_lonlat,25)
            if g.is_empty:continue
            others.append(g);other_masks.append(mask)
            record=add_feature(features,year,regime,g,pix,
                kind='rebellion' if regime=='五苓夷起兵范围' else 'regime',
                source_hsv_ranges=hues,source_colour_rgb=np.median(rgb[mask>0][:,::-1],axis=0).astype(int).tolist(),
                classification_note='源图标示五苓夷，不等于整个宁州已归成。' if regime=='五苓夷起兵范围' else
                '绿色区域内标（林邑），其下方白地另标西屠。' if regime=='林邑' else '')
            source_records.append(dict(year=year,**record))
            cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(preview,cs,-1,(30,30,30),1)
        # Jin orange encompasses the mainland, northern Hainan, and source
        # Chinese administrative coastal enclaves; closed enemy fills win.
        mask=family_mask(hsv,(620,295,1365,977),[(7,23)],85,100,255)
        # Remove the thin orange nominal-protectorate frame. Preserve only
        # substantial orange components, excluding tiny differently named
        # Tibetan polities which share Jin's hue.
        mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
        mask=filled_components(mask,45,close=3)
        n,labels,stats,centroids=cv2.connectedComponentsWithStats(mask)
        keep=[i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA]>=350 or
              (990<=centroids[i,0]<=1060 and 850<=centroids[i,1]<=910)]
        mask=np.isin(labels,keep).astype('uint8')
        enemy_pixels=np.zeros_like(mask)
        for m in other_masks:enemy_pixels|=m
        mask[enemy_pixels>0]=0
        g,pix=mask_geometry(mask,pixel_to_lonlat,20)
        g=polygonal(g.difference(unary_union(others)))
        record=add_feature(features,year,'西晋',g,pix,is_jin=True,is_western_jin=True,
                           source_hsv_ranges=[[7,23]],source_colour_rgb=[220,137,66],source_colour_semantics='晋橙色；排除同色弁韩和西藏小邦')
        source_records.append(dict(year=year,**record))
        cv2.imwrite(str(OUT/f'{year}-jin-mask.png'),mask*255)
        cs,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(preview,cs,-1,(255,255,255),1)
        cv2.imwrite(str(OUT/f'{year}-source-vector-outline.png'),preview)
        mask_counts[year]=int(mask.sum())
        # Beige western territory enclosed by Jin orange denotes the source's
        # protectorate relationship, kept separate from directly filled Jin.
        xiyu=np.array([(374,337),(422,333),(463,323),(538,316),(608,319),(656,324),
            (659,366),(704,371),(718,396),(749,400),(751,423),(714,434),(628,438),
            (582,451),(521,461),(458,458),(405,435),(397,410),(381,400),(375,376)])
        nominal=polygonal(Polygon(pixel_to_lonlat(xiyu)))
        if year==308:
            qs=[shape(f['geometry']) for f in features if f['properties']['year']==year and f['properties']['regime']=='龟兹']
            if qs:nominal=polygonal(nominal.difference(unary_union(qs)))
        add_feature(features,year,'西晋西域都护名义范围',nominal,[dict(outer=xiyu.tolist(),holes=[])],
            is_jin_affiliate=True,kind='nominal-affiliate',fidelity='source-outline-hand-traced',
            source_colour_semantics='米黄色填充及晋橙色外框',
            boundary_evidence='视频米黄色区域外有晋橙色外框；手描外框并单列名义范围，不并入中国州郡统计。')
        annotated=rgb.copy()
        for i,c in enumerate(CONTROLS,1):
            cv2.drawMarker(annotated,(c[1],c[2]),(0,0,255),cv2.MARKER_CROSS,12,1)
            cv2.putText(annotated,str(i),(c[1]+4,c[2]-5),cv2.FONT_HERSHEY_SIMPLEX,.4,(0,0,255),1,cv2.LINE_AA)
        cv2.imwrite(str(OUT/f'{year}-control-points.png'),annotated)
    collection=dict(type='FeatureCollection',name='西晋289和308年史图馆视频政权边界试验',
        metadata=dict(version='2026-10-02.1',registration=registration,source_crop_right=MAP_RIGHT,
            source_size=[SOURCE_WIDTH,SOURCE_HEIGHT],source_jin_mask_pixels=mask_counts,
            source_times={str(y):{k:FRAME_ROWS.get(y,{}).get(k) for k in ('timestamp_seconds','frame_index','frame_sha256','source_sha256','rule')} for y in (289,308)},
            caveat='源视频数字化试验；拟合投影未获作者确认；概括政权边界不提供可考证的县界。'),features=features)
    (DATA/'jin-video-territories.geojson').write_text(json.dumps(collection,ensure_ascii=False,separators=(',',':')))
    land,pix=mask_geometry(source_land(hsv),pixel_to_lonlat,50)
    (DATA/'jin-video-land.geojson').write_text(json.dumps(dict(type='FeatureCollection',
        name='史图馆视频地理陆地背景',metadata=dict(coordinate_system='WGS84',registration_model=registration['selected']['name'],
        political_evidence=False),features=[dict(type='Feature',properties=dict(kind='geographic-land',source_year=308),geometry=mapping(land))]),
        ensure_ascii=False,separators=(',',':')))
    (OUT/'source-pixel-polygons.json').write_text(json.dumps(source_records,ensure_ascii=False,separators=(',',':')))
    summary=dict(features=len(features),by_year={str(y):[f['properties']['regime'] for f in features if f['properties']['year']==y] for y in (289,308)},
                 registration=registration['selected'],mask_pixels=mask_counts)
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(dict(features=len(features),model=registration['selected']['name'],
        rmse_px=registration['selected']['rmse_source_px'],leave_one_out_px=registration['selected']['leave_one_out_rmse_source_px'],mask_pixels=mask_counts),ensure_ascii=False))


if __name__=='__main__':main()
