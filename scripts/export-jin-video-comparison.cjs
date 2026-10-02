/* Same viewport and production label layout for the requested map comparison. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),model=require('../jin-annual-map-model.js');
const sharp=require(process.env.JIN_SHARP_MODULE||'/Users/yujiangnan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const sameExtent=[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462];
(async()=>{
 const out=path.join(root,'work/jin-video/stable-comparison'),web=path.join(root,'assets/maps/jin-video/comparison');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(web,{recursive:true});
 global.JIN_VIDEO_FRAMES=read('data/jin-video-frames.json');global.JIN_FIEF_COLORS=read('data/jin-fief-colors.json');const land=read('data/jin-maps/jin-video-land.geojson');
 const comparison={baseline_commit:'0fa9a5b17edba1ded1b749140de2ef64beab2719',same_extent:sameExtent,annual_years:[266,316],years:{}};
 for(const year of [289,308]){
  const local=read(`work/jin-video/annual-final-gis/${year}.geojson`);
  const bundle={year,features:local.features,coverage:local.coverage};
  const map=model.hydrateVideoTrial(bundle,year,land,{annualVideo:true});
  const report=read(`work/jin-video/annual-final-gis/${year}-completion-report.json`);
  const previous=JSON.parse(fs.readFileSync(path.join(out,`${year}-before.map.json`)));
  const count=layer=>map.geojson.features.filter(f=>f.properties.layer===layer&&!f.properties.is_context).length;
  const oldClosedStates=previous.geojson.features.filter(f=>f.properties.layer==='province_boundaries'&&/Polygon/.test(f.geometry.type)).length;
  const colourCheck=global.JIN_FIEF_COLORS.validation.years.find(row=>row.year===year);
  comparison.years[year]={
   analysis:`原圖州界重新作為州域基礎；本年沒有需要移動的完整郡改屬。上輪把政治裁切與補洞部件外圈畫成州界，這次改為州際共享線，政權外界及腹地他國邊界仍單列。${year===308?'漢、成與五苓夷起兵範圍仍按本年視頻表示。':''}封國保留郡級以上合併著色，並採266–316年全部鄰接關係的固定配色。`,
   metrics:[
    ['州界繪法',`${oldClosedStates}個閉合州界面 → ${report.province_shared_boundary_features}條州際共享線；補洞碎片不描成州界`],
    ['原州界內部差異',`${report.reviewed_province_interior_change_degrees_squared}平方度，僅為精度網格餘差；無完整郡改屬`],
    ['接壤封國同色',`${colourCheck.edge_count}組鄰接關係，${colourCheck.conflict_count}組同色；包含角點接觸`],
    ['全期色板',`${global.JIN_FIEF_COLORS.meta.fief_count}個封國使用${global.JIN_FIEF_COLORS.meta.color_count}色，同一封國跨年固定`],
    ['本年行政圖面',`${count('province_areas')}州面、${count('prefecture_areas')}郡面、${count('county_seats')}縣治點；縣面與縣界不展示`],
    ['制度着色',`${count('kingdom_areas')}個郡級及以上封國面`],
    ['晉境內漏色',`未着色面積${report.unpainted_jin_area_degrees_squared}；${report.unfilled_jin_area_degrees_squared}平方度的幾何極細餘部由連續晉底色覆蓋`],
    ['依據與限制','州界沿用原圖，新增州郡邊緣段及缺面歸屬仍含擬合；圖面連續不等同史料已考定']
   ]};
  const overview={...map,politicalOverview:true,width:2800,height:1900,plot:[65,140,2735,1820],extent:[60,8,146,63],title:`${year}年　政權範圍全覽`,subtitle:'白色為其它政權；晉西域都護名義範圍單列淡赭色。',geojson:{type:'FeatureCollection',features:map.geojson.features.filter(f=>['land_background','regime_areas','regime_boundaries'].includes(f.properties.layer))}};
  for(const [mode,value]of [['after',map],['overview',overview]]){
   const file=path.join(out,`${year}-${mode}`);fs.writeFileSync(file+'.map.json',JSON.stringify(value));
   execFileSync(process.execPath,[path.join(root,'scripts/render-jin-comparison-map.cjs'),file+'.map.json',file+'.svg',...(mode==='after'?sameExtent.map(String):[])]);
   await sharp(file+'.svg').resize(1600).png().toFile(file+'.png');
  }
  for(const mode of ['before','after','overview'])await sharp(path.join(out,`${year}-${mode}.png`)).webp({quality:90,effort:4}).toFile(path.join(web,`${year}-${mode}.webp`));
 }
 fs.writeFileSync(path.join(root,'data/jin-video-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
 const W=2480,H=2240,layers=[];
 for(const[y,m,left,top]of [[289,'before',25,155],[289,'after',1255,155],[308,'before',25,1220],[308,'after',1255,1220]])layers.push({input:await sharp(path.join(out,`${y}-${m}.png`)).resize(1200,993).toBuffer(),left,top});
 layers.push({input:Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Songti SC',serif;fill:#333126}</style><text x="30" y="48" font-size="36">西晋289与308年 · 州界与封国色彩对照</text><text x="30" y="87" font-size="22">右图沿用原图州界，改属沿整郡调整；州际共边单列，接壤封国使用不同色彩。</text><text x="40" y="137" font-size="27">289年 · 修改前</text><text x="1270" y="137" font-size="27">289年 · 稳定州界与新配色</text><text x="40" y="1200" font-size="27">308年 · 修改前</text><text x="1270" y="1200" font-size="27">308年 · 稳定州界与新配色</text></svg>`),left:0,top:0});
 await sharp({create:{width:W,height:H,channels:3,background:'#f6f3eb'}}).composite(layers).png().toFile(path.join(out,'西晋289与308年_新旧地图对照.png'));
 console.log('Two maps, two political overviews and comparison figure exported');
})().catch(e=>{console.error(e);process.exitCode=1;});
