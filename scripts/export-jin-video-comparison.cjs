/* Same viewport and production label layout for the requested map comparison. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),model=require('../jin-annual-map-model.js');
const sharp=require(process.env.JIN_SHARP_MODULE||'/Users/yujiangnan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const sameExtent=[92.76949194836817,15.25765489858437,128.42883145915184,43.37633897890462];
(async()=>{
 const out=path.join(root,'work/jin-video/comparison'),web=path.join(root,'assets/maps/jin-video/comparison');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(web,{recursive:true});
 global.JIN_VIDEO_FRAMES=read('data/jin-video-frames.json');const land=read('data/jin-maps/jin-video-land.geojson');
 for(const year of [289,308]){
  const bundle=read(`data/jin-maps/video-trial-289-308/${year}.json`);
  for(const url of bundle.geometry_urls)Object.assign(bundle.geometries,read(url).geometries);
  const map=model.hydrateVideoTrial(bundle,year,land);
  const overview={...map,politicalOverview:true,width:2800,height:1900,plot:[65,140,2735,1820],extent:[60,8,146,63],title:`${year}年　政權範圍全覽`,subtitle:'白色為其它政權；晉西域都護名義範圍單列淡赭色。',geojson:{type:'FeatureCollection',features:map.geojson.features.filter(f=>['land_background','regime_areas','regime_boundaries'].includes(f.properties.layer))}};
  for(const [mode,value]of [['after',map],['overview',overview]]){
   const file=path.join(out,`${year}-${mode}`);fs.writeFileSync(file+'.map.json',JSON.stringify(value));
   execFileSync(process.execPath,[path.join(root,'scripts/render-jin-comparison-map.cjs'),file+'.map.json',file+'.svg',...(mode==='after'?sameExtent.map(String):[])]);
   await sharp(file+'.svg').resize(1600).png().toFile(file+'.png');
  }
  for(const mode of ['before','after','overview'])await sharp(path.join(out,`${year}-${mode}.png`)).webp({quality:90,effort:4}).toFile(path.join(web,`${year}-${mode}.webp`));
 }
 const W=2480,H=2240,layers=[];
 for(const[y,m,left,top]of [[289,'before',25,155],[289,'after',1255,155],[308,'before',25,1220],[308,'after',1255,1220]])layers.push({input:await sharp(path.join(out,`${y}-${m}.png`)).resize(1200,993).toBuffer(),left,top});
 layers.push({input:Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:'Songti SC',serif;fill:#333126}</style><text x="30" y="48" font-size="36">西晋289与308年 · 同范围新旧对照</text><text x="30" y="87" font-size="22">右图按年末视频重绘政权界；晋境漏色附入当年有效郡，推定分界保留说明。</text><text x="40" y="137" font-size="27">289年 · 修改前</text><text x="1270" y="137" font-size="27">289年 · 视频GIS测验</text><text x="40" y="1200" font-size="27">308年 · 修改前</text><text x="1270" y="1200" font-size="27">308年 · 视频GIS测验</text></svg>`),left:0,top:0});
 await sharp({create:{width:W,height:H,channels:3,background:'#f6f3eb'}}).composite(layers).png().toFile(path.join(out,'西晋289与308年_新旧地图对照.png'));
 console.log('Two maps, two political overviews and comparison figure exported');
})().catch(e=>{console.error(e);process.exitCode=1;});
