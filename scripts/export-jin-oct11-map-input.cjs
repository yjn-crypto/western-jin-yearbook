/* October 11 changes start with the published map, including its local repairs. */
const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
const ctx=vm.createContext({window:{}});
for(const f of ['data/princes.js','data/jin-ruler-constraints.js','data/five-rank-fiefs.js','data/jin-multi-kingdoms.js','jin-kingdom-table.js','data/jin-local-connectivity-20261007.js','data/jin-289-fief-map-review-20261007.js','data/jin-fief-abolitions-20261007.js','data/jin-map-reference-fiefs-20261007.js','data/jin-detail-map-review-20261007.js','jin-annual-map-model.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const dir='/private/tmp/jin-oct11-input';fs.mkdirSync(dir,{recursive:true});
const cache={},countyKings={};
for(let year=266;year<=316;year++){
 const b=JSON.parse(fs.readFileSync(`data/jin-maps/three-basemap-annual/${year}.json`));
 for(const url of b.geometry_urls){if(!cache[url])cache[url]=JSON.parse(zlib.gunzipSync(fs.readFileSync(url))).geometries;Object.assign(b.geometries,cache[url]);}
 fs.writeFileSync(`${dir}/${year}.json`,JSON.stringify(ctx.window.JIN_ANNUAL_MAP_MODEL.hydrateThreeBasemap(b,year)));
 countyKings[year]=[...new Set(ctx.window.JIN_PRINCES.records.map(r=>r.fief))].flatMap(name=>{
  const r=ctx.window.JIN_KINGDOM_TABLE.rulerAt(ctx.window.JIN_PRINCES.records,name,year,'county');
  return r.all.length?[{name,holder:r.record?.person||null,inferred:!r.record||r.record.display_inferred,records:r.all.map(x=>x.id),note:r.constraints.map(c=>c.note).join('；')}]:[];
 });
}
fs.writeFileSync(`${dir}/county-kings.json`,JSON.stringify(countyKings));
console.log('Exported 51 published maps and constrained county titles.');
