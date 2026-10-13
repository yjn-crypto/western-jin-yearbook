/* Only the common SVG renderer is reused; no other dynasty's map data. */
(function(root){
 'use strict';
 function draw(map,container,options){
  // Auxiliary offices retain their source level in GeoJSON and counts. The
  // common renderer uses prefecture-size symbols solely for their visible seat.
  const displayMap={...map,geojson:{...map.geojson,features:map.geojson.features.map(f=>f.properties.level==='administrative_office'?{...f,properties:{...f.properties,level:'prefecture',layer:'prefecture_seats',originalLevel:'administrative_office'}}:f)}};
  const rendered=root.JIN_MAP_VIEW.draw(displayMap,container,{...options,labelAnchors:[]});
  const props=new Map(map.geojson.features.filter(f=>f.properties.entity_id).map(f=>[f.properties.entity_id,f.properties]));
  for(const label of rendered.labels){
   const p=props.get(label.entityId);label.qiao=p?.qiao===true;label.qiaoUnknown=p?.qiao===null;
   if(p?.level==='administrative_office')label.originalLevel='administrative_office';
   label.labelIdentity=label.entityId?`southern-qi:${label.entityId}:${label.kind}`:label.labelIdentity;
   if(label.level==='state'&&label.kind==='state-area')label.allowAreaFontShrink=true;
  }
  for(const f of rendered.features){const p=props.get(f.entity_id);if(p?.level==='administrative_office')f.level='administrative_office';f.qiao=p?.qiao===true;f.parentage_unresolved=Boolean(p?.parentage_unresolved);}
  return rendered;
 }
 root.SOUTHERN_QI_MAP_VIEW={draw};if(typeof module!=='undefined'&&module.exports)module.exports={draw};
})(typeof window!=='undefined'?window:globalThis);
