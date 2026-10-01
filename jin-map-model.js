/* Integration helpers for reviewed annual GIS slices.
 * It consumes reviewed annual GIS slices, never derives geography from title names.
 * Contract: {years:{'289':{layers:{...FeatureCollections},links:[],fiefs:[]}}}
 */
(function (root) {
  'use strict';
  const priority = {'CHGIS V6': 60, 'CHGIS V5': 50, 'CHGIS V4': 40, 'image-vector': 10};
  function slice(bundle, year) {
    const value = bundle?.years?.[String(year)];
    // Do not silently extrapolate two researched dates to every Jin year.
    return value ? {...value, year:Number(year), reference:false} : null;
  }
  function active(record, year) {
    return record.begin != null && record.end != null && record.begin <= year && year <= record.end;
  }
  function preferredGeometry(features) {
    const groups = new Map(), unresolved = [];
    for (const f of features) {
      const p=f.properties || {};
      // Source entity links must be reviewed upstream; a name is not an identity.
      if (!p.entity_id || !p.geometry_role) { unresolved.push(f); continue; }
      const key=`${p.entity_id}:${p.geometry_role}`;
      const rank=priority[p.source] ?? (p.source_version ? p.source_version*10 : 0);
      const previous=groups.get(key);
      if (!previous || rank>previous.rank) groups.set(key,{feature:f,rank});
    }
    return {features:[...groups.values()].map(x=>x.feature),unresolved};
  }
  function displayName(entity, fief) {
    if (!fief || fief.mapping_status!=='confirmed') return entity.name;
    const base=String(entity.name).replace(/(王國|公國|侯國|伯國|子國|男國|國|郡|縣)$/,'');
    if (fief.member_role==='branch') return `${base}支郡`;
    if (entity.level==='prefecture') return `${base}國`;
    if (entity.level==='county') return `${base}${fief.rank==='王'?'':fief.rank}國`;
    return entity.name;
  }
  function resolve(yearSlice, snapshot) {
    const entities=new Map();
    for (const s of snapshot.states || []) {
      entities.set(s.id,{...s,level:'state'});
      for (const p of s.rows || []) {
        entities.set(p.id,{...p,level:'prefecture',state_id:s.id});
        for (const c of p.counties || []) entities.set(c.id,{...c,level:'county',state_id:s.id,prefecture_id:p.id});
      }
    }
    const features=[],unlinked=[];
    for (const [layer, fc] of Object.entries(yearSlice.layers || {})) {
      for (const f of fc.features || []) {
        const p=f.properties || {}, entity=entities.get(p.entity_id);
        if (!entity) {unlinked.push({layer,feature:f,reason:'No explicit entity ID in this annual snapshot'});continue;}
        const matches=(yearSlice.fiefs || []).filter(x=>x.entity_id===entity.id && x.mapping_status==='confirmed');
        const fief=matches.length===1 ? matches[0] : null;
        features.push({...f,properties:{...p,layer,display_name:displayName(entity,fief),
          source_name:p.name,yearbook_name:entity.name,mapKey:`entity:${entity.id}`,
          fief_id:fief?.fief_id || null,mapping_conflict:matches.length>1}});
      }
    }
    return {features,unlinked,entities};
  }
  const style = {
    kingdom_areas:{fillOpacity:0.18,strokeWidth:2.2},
    member_boundaries:{strokeOpacity:0.22,strokeWidth:0.6},
    prefecture_boundaries:{strokeOpacity:0.75,strokeWidth:0.8},
    province_boundaries:{strokeOpacity:1,strokeWidth:3.2},
    uncertain_areas:{fillOpacity:0.08,strokeDasharray:'5 4'}
  };
  const api={slice,active,preferredGeometry,displayName,resolve,style};
  root.JIN_MAP_MODEL=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
