#!/usr/bin/env python3
"""Necessary registration and extraction checks for this annual build only."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/jin-video/annual-georeference'
DATA=OUT/'annual-territories.geojson'


def coast_mask(hsv):
    return (((hsv[:,:,0]>=100)&(hsv[:,:,0]<=119)&(hsv[:,:,1]>=42)&(hsv[:,:,2]>=217)).astype('uint8'))


def main():
    data=json.loads(DATA.read_text());base=json.loads((ROOT/'data/jin-maps/jin-video-territories.geojson').read_text())
    roi=[(978,835,1070,925),(1214,705,1285,823),(1360,506,1514,575)]
    names=['海南','台湾','九州']
    reference=coast_mask(cv2.cvtColor(cv2.imread(str(ROOT/'work/jin-video/frames/289.png')),cv2.COLOR_BGR2HSV))
    coast=[];checks=[]
    for y in range(266,317):
        im=cv2.imread(str(ROOT/f'work/jin-video/frames/{y}.png'));m=coast_mask(cv2.cvtColor(im,cv2.COLOR_BGR2HSV));rs=[]
        for name,(x0,y0,x1,y1) in zip(names,roi):
            t=reference[y0:y1,x0:x1];s=m[y0-5:y1+5,x0-5:x1+5];p=cv2.matchTemplate(s,t,cv2.TM_SQDIFF)
            _,_,loc,_=cv2.minMaxLoc(p)
            rs.append(dict(name=name,offset_px=[loc[0]-5,loc[1]-5],coast_mask_difference_pixels=int(np.count_nonzero(s[loc[1]:loc[1]+t.shape[0],loc[0]:loc[0]+t.shape[1]]!=t))))
        coast.append(dict(year=y,coast_checks=rs))
        fs=[f for f in data['features'] if f['properties']['year']==y]
        assert all(shape(f['geometry']).is_valid for f in fs),y
        j=unary_union([shape(f['geometry']) for f in fs if f['properties'].get('is_jin')]);o=unary_union([shape(f['geometry']) for f in fs if not f['properties'].get('is_jin') and not f['properties'].get('is_jin_affiliate')])
        checks.append(dict(year=y,political_features=len(fs),jin_valid=j.is_valid,foreign_valid=o.is_valid,jin_foreign_overlap_degrees_squared=j.intersection(o).area,jin_empty=j.is_empty,wu_features=sum(f['properties']['regime']=='孙吴' for f in fs)))
    assert all(c['jin_foreign_overlap_degrees_squared']<1e-7 and not c['jin_empty'] for c in checks)
    assert all(c['wu_features']==(1 if c['year']<280 else 0) for c in checks)
    assert all([f for f in data['features'] if f['properties']['year']==y]==[f for f in base['features'] if f['properties']['year']==y] for y in [289,308])
    assert all(r['offset_px']==[0,0] for c in coast for r in c['coast_checks'])
    (OUT/'coast-consistency.json').write_text(json.dumps(coast,ensure_ascii=False,indent=2))
    (OUT/'geometric-generation-checks.json').write_text(json.dumps(dict(checks=checks,coordinate_rounding_degrees=1e-6,intersection_tolerance_degrees_squared=1e-7,note='少于阈值的接触误差是六位小数坐标量化；最终政区仍对其他政权作精确差分。'),ensure_ascii=False,indent=2))
    r=json.loads((OUT/'source-pixel-polygons.json').read_text());font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',26)
    canvas=Image.new('RGB',(1600,1800),'white');draw=ImageDraw.Draw(canvas)
    for n,y in enumerate([279,280,312,316]):
        im=cv2.imread(str(ROOT/f'work/jin-video/frames/{y}.png'));ms=cv2.imread(str(OUT/f'{y}-jin-mask.png'),0)>0
        im[ms]=(.48*im[ms]+.52*np.array([200,35,220])).astype('uint8')
        for row in r:
            if row['year']!=y or row['regime']=='西晋':continue
            m=np.zeros(ms.shape,'uint8')
            for p in row['source_pixel_polygons']:
                cv2.fillPoly(m,[np.array(p['outer'],np.int32)],255)
                for h in p['holes']:cv2.fillPoly(m,[np.array(h,np.int32)],0)
            im[m>0]=(.66*im[m>0]+.34*np.array([255,255,255])).astype('uint8')
            cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cv2.drawContours(im,cs,-1,(20,20,20),1)
        cs,_=cv2.findContours((ms*255).astype('uint8'),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);cv2.drawContours(im,cs,-1,(255,255,255),1)
        cv2.imwrite(str(OUT/f'{y}-polity-outline-check.png'),im)
        v=Image.fromarray(im[:,:,::-1]).crop((760,360,1370,1000)).resize((800,838));x=(n%2)*800;z=(n//2)*900;canvas.paste(v,(x,z+62));draw.text((x+10,z+10),f'{y}年：粉色覆层为提取的晋境，黑线为其它范围',font=font,fill='black')
    canvas.save(OUT/'279-280-312-316-source-check.png')
    result=dict(years=51,features=len(data['features']),valid_geometries=True,max_jin_foreign_overlap_degrees_squared=max(c['jin_foreign_overlap_degrees_squared'] for c in checks),retained_baseline_years=[289,308],coast_windows=3,coast_best_offsets_all_zero=True,source_review_years=[279,280,312,316],scope='本次新生成的源图配准、几何可用性及四张转折帧必要检查；不是全朝代历史或网页审核。')
    (OUT/'generation-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
