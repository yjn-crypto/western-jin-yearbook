/* Publish full-resolution viewing copies; retain lossless source frames locally. */
const fs=require('fs'),path=require('path');
const sharp=require(process.env.JIN_SHARP_MODULE||'/Users/yujiangnan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
  const manifest=JSON.parse(fs.readFileSync(process.argv[2]||path.join(root,'work/jin-video/manifest.json')));
  if(manifest.frames.length!==51||manifest.missing_years?.length)throw Error('Expected all 51 years, 266–316');
  const out=path.join(root,'assets/maps/jin-video/year-end');fs.mkdirSync(out,{recursive:true});
  for(const frame of manifest.frames){
    frame.web_path=`assets/maps/jin-video/year-end/${frame.year}.webp`;
    await sharp(path.resolve(root,frame.path)).webp({quality:88,effort:4}).toFile(path.join(root,frame.web_path));
  }
  const publicManifest={...manifest,viewing_copy:'1920×1080 WebP；无缩放；原始PNG及源帧校验值另保留在本机成果包。'};
  fs.writeFileSync(path.join(root,'data/jin-video-frames.json'),JSON.stringify(publicManifest));
  fs.writeFileSync(path.join(root,'data/jin-video-frames.js'),'window.JIN_VIDEO_FRAMES='+JSON.stringify(publicManifest)+';\n');
  console.log(JSON.stringify({years:manifest.frames.length,first:manifest.frames[0].year,last:manifest.frames.at(-1).year}));
})().catch(error=>{console.error(error);process.exitCode=1;});
