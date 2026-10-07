/* Export the already-published layers for the small detail overlay builder. */
const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
const ctx=vm.createContext({window:{}});
for(const f of ['data/princes.js','data/jin-ruler-constraints.js','data/five-rank-fiefs.js','data/jin-multi-kingdoms.js','jin-kingdom-table.js','data/jin-local-connectivity-20261007.js','data/jin-289-fief-map-review-20261007.js','data/jin-fief-abolitions-20261007.js','data/jin-map-reference-fiefs-20261007.js','jin-annual-map-model.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
fs.mkdirSync('/private/tmp/jin-detail-input',{recursive:true});
let cache={};for(let year=266;year<=316;year++){
 let b=JSON.parse(fs.readFileSync(`data/jin-maps/three-basemap-annual/${year}.json`));
 for(const url of b.geometry_urls){if(!cache[url])cache[url]=JSON.parse(zlib.gunzipSync(fs.readFileSync(url))).geometries;Object.assign(b.geometries,cache[url]);}
 const result=ctx.window.JIN_ANNUAL_MAP_MODEL.hydrateThreeBasemap(b,year,{detail:false});
 fs.writeFileSync(`/private/tmp/jin-detail-input/${year}.json`,JSON.stringify(result));
}
