/* Same viewport and production label layout for the requested map comparison. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),model=require('../jin-annual-map-model.js');
const sharp=require(process.env.JIN_SHARP_MODULE||'/Users/yujiangnan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const sameExtent=[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462];
(async()=>{
 const out=path.join(root,'work/jin-video/source-priority-comparison'),web=path.join(root,'assets/maps/jin-video/comparison');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(web,{recursive:true});
 global.JIN_VIDEO_FRAMES=read('data/jin-video-frames.json');global.JIN_FIEF_COLORS=read('data/jin-fief-colors.json');const land=read('data/jin-maps/jin-video-land.geojson');
 const comparison={baseline_commit:'e707671a624ddcbe281a28c6f6dd08b96a028f70',same_extent:sameExtent,annual_years:[266,316],source_policy:'CHGIS points > original administrative image areas > video control changes within original scope',years:{}};
 for(const year of [289,308]){
  const local=read(`work/jin-video/source-priority-final-gis/${year}.geojson`);
  const bundle={...local,year};
  const map=model.hydrateVideoTrial(bundle,year,land,{annualVideo:true});
  const report=read(`work/jin-video/source-priority-final-gis/${year}-completion-report.json`);
  const previous=read(`work/jin-video/stable-comparison/${year}-after.map.json`);
  const count=layer=>map.geojson.features.filter(f=>f.properties.layer===layer&&!f.properties.is_context).length;
  const colourCheck=global.JIN_FIEF_COLORS.validation.years.find(row=>row.year===year);
  comparison.years[year]={
   analysis:`恢復原圖的完整疆域、海岸線、展示空間與圖例樣式。CHGIS有效治所點優先，原圖州郡面按當年統属關係調整；史圖館只補充此範圍內的年度控制變化。${year===308?'漢、成與本年起兵範圍保留無色面及域內分界。':'本年以原圖完整疆域為準，不用視頻外緣覆蓋原圖海岸。'}郡級及以上封國繼續著色，接壤封國異色。`,
   metrics:[
    ['資料使用次序','CHGIS治所點優先；原圖州郡面與海岸優先；視頻僅補充域內明顯控制變化'],
    ['展示空間','採原圖漢晉天下範圍；不顯示域外西域、日本、朝鮮半島與西伯利亞諸政權'],
    ['州界繪法',`${report.province_shared_boundary_features}條州際共享線；年度變更沿完整郡界，補洞碎片不描成州界`],
    ['年度州属調整',`${(report.whole_prefecture_province_transfers||[]).length}項整郡改属，沿完整參照郡面處理；其餘州界保持原面`],
    ['接壤封國同色',`${colourCheck.edge_count}組鄰接關係，${colourCheck.conflict_count}組同色；包含角點接觸`],
    ['全期色板',`${global.JIN_FIEF_COLORS.meta.fief_count}個封國使用${global.JIN_FIEF_COLORS.meta.color_count}色，同一封國跨年固定`],
    ['本年行政圖面',`${count('province_areas')}州面、${count('prefecture_areas')}郡面、${count('county_seats')}縣治點；縣面與縣界不展示`],
    ['制度着色',`${count('kingdom_areas')}個郡級及以上封國面`],
    ['晉境內漏色',`未着色面積${report.unpainted_jin_area_degrees_squared}；${report.unfilled_jin_area_degrees_squared}平方度的幾何極細餘部由連續晉底色覆蓋`],
    ['依據與限制','未考定郡界仍標作擬合；視頻控制區的配准不確定性不向原海岸與州界傳遞']
   ]};
  for(const [mode,value]of [['before',previous],['after',map]]){
   const file=path.join(out,`${year}-${mode}`);fs.writeFileSync(file+'.map.json',JSON.stringify(value));
   execFileSync(process.execPath,[path.join(root,'scripts/render-jin-comparison-map.cjs'),file+'.map.json',file+'.svg',...sameExtent.map(String)]);
   await sharp(file+'.svg').resize(1600).png().toFile(file+'.png');
  }
  for(const mode of ['before','after'])await sharp(path.join(out,`${year}-${mode}.png`)).webp({quality:90,effort:4}).toFile(path.join(web,`${year}-${mode}.webp`));
 }
 fs.writeFileSync(path.join(root,'data/jin-video-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
 const W=2480,H=2240,layers=[];
 for(const[y,m,left,top]of [[289,'before',25,155],[289,'after',1255,155],[308,'before',25,1220],[308,'after',1255,1220]])layers.push({input:await sharp(path.join(out,`${y}-${m}.png`)).resize(1200,993).toBuffer(),left,top});
 layers.push({input:Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Songti SC',serif;fill:#333126}</style><text x="30" y="48" font-size="36">西晋289与308年 · 原图优先与展示范围对照</text><text x="30" y="87" font-size="22">右图优先采用CHGIS点与原图州郡面、疆域及海岸；视频只补充范围内的控制变化。</text><text x="40" y="137" font-size="27">289年 · 修改前</text><text x="1270" y="137" font-size="27">289年 · 原图范围与样式</text><text x="40" y="1200" font-size="27">308年 · 修改前</text><text x="1270" y="1200" font-size="27">308年 · 原图范围与样式</text></svg>`),left:0,top:0});
 await sharp({create:{width:W,height:H,channels:3,background:'#f6f3eb'}}).composite(layers).png().toFile(path.join(out,'西晋289与308年_新旧地图对照.png'));
 console.log('Two maps within original scope and comparison figure exported');
})().catch(e=>{console.error(e);process.exitCode=1;});
