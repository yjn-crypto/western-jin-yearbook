/* Integration helpers for reviewed annual GIS slices.
 * It consumes reviewed annual GIS slices, never derives geography from title names.
 * Contract: {years:{'289':{layers:{...FeatureCollections},links:[],fiefs:[]}}}
 */
(function (root) {
  'use strict';
  function sourceRank(properties, geometry, year) {
    const source=String(properties?.source || '');
    const role=String(properties?.geometry_role || properties?.coordinate_role || '');
    const point=/^(Point|MultiPoint)$/.test(geometry?.type || '') || /seat|point|治所/.test(role);
    const original=/image-vector|原图|原圖|原上传|原上傳|矢量化|vectorized/i.test(source);
    const begin=properties?.coordinate_source_begin ?? properties?.source_begin ?? properties?.begin;
    const end=properties?.coordinate_source_end ?? properties?.source_end ?? properties?.end;
    const atYear=year ?? properties?.year;
    const datedFallback=properties?.point_source_priority==='reviewed_original_fallback' ||
      properties?.geometry_source_priority==='reviewed_original_fallback' ||
      (!point && /^CHGIS_reference(?:_|$)/.test(properties?.geometry_status || '')) ||
      (atYear!=null && begin!=null && end!=null && !(Number(begin)<=Number(atYear) && Number(atYear)<=Number(end)));
    const version=source.match(/CHGIS[ _-]*V(?:ERSION[ _-]*)?(\d+)/i);
    if(/CHGIS/i.test(source))return datedFallback?50:120+Number(version?.[1] || properties?.source_version || 0);
    if(original)return point?50:100;
    if(/视频|視頻|video|史图馆|史圖館/i.test(source))return 10;
    return 0;
  }
  function slice(bundle, year) {
    const value = bundle?.years?.[String(year)];
    // Do not silently extrapolate two researched dates to every Jin year.
    return value ? {...value, year:Number(year), reference:false} : null;
  }
  function active(record, year) {
    return record.begin != null && record.end != null && record.begin <= year && year <= record.end;
  }
  function preferredGeometry(features, year) {
    const groups = new Map(), unresolved = [];
    for (const f of features) {
      const p=f.properties || {};
      // Source entity links must be reviewed upstream; a name is not an identity.
      const role=p.geometry_role || p.coordinate_role;
      if (!p.entity_id || !role) { unresolved.push(f); continue; }
      const key=`${p.entity_id}:${role}`;
      const rank=sourceRank(p,f.geometry,year);
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
  const api={slice,active,sourceRank,preferredGeometry,displayName,resolve,style};
  root.JIN_MAP_MODEL=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
