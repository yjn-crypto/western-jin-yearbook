// Execute the application's actual geography path for data builds and validation.
// Non-geographic annotations are disabled; they cannot influence entity matching.
import fs from 'node:fs';
import vm from 'node:vm';
export const root = new URL('../', import.meta.url);
export function extractFunction(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  if (start < 0) throw new Error(`Missing application function: ${name}`);
  const rest = source.slice(start + 3);
  const end = rest.search(/\n  (?:(?:async )?function |(?:const|let) )/);
  return source.slice(start, end < 0 ? undefined : start + 3 + end);
}
export function createLiangContext() {
  const context = vm.createContext({window: {}});
  for (const file of ['data/liang-data.js', 'data/liang-county-overlay.js',
    'data/liang-county-reviewed.js', 'data/liang-administrative-corrections.js',
    'data/liang-qiao-sources.js', 'liang-county-model.js']) {
    vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
  }
  vm.runInContext(`let liangCountyIndex=null,liangCountyMethodIndex=null;
    const attachLiangFiefs=()=>[],applySouthernPrefectureDisplayNames=()=>{},
      attachGovernors=()=>[],attachLocalOfficers=()=>[];`,context);
  const app=fs.readFileSync(new URL('app.js',root),'utf8');
  for(const name of ['normalizeName','activePhase','effectiveOrder','liangSource',
    'buildLiangCountyIndexes','buildLiangSnapshot'])vm.runInContext(extractFunction(app,name),context);
  return context;
}
