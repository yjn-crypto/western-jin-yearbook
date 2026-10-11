/* Only the common SVG renderer is reused; no other dynasty's map data. */
(function(root){
 'use strict';
 function draw(map,container,options){
  const rendered=root.JIN_MAP_VIEW.draw(map,container,{...options,labelAnchors:[]});
  const props=new Map(map.geojson.features.filter(f=>f.properties.entity_id).map(f=>[f.properties.entity_id,f.properties]));
  for(const label of rendered.labels){
   const p=props.get(label.entityId);label.qiao=p?.qiao===true;label.qiaoUnknown=p?.qiao===null;
   label.labelIdentity=label.entityId?`liu-song:${label.entityId}:${label.kind}`:label.labelIdentity;
   if(label.level==='state'&&label.kind==='state-area')label.allowAreaFontShrink=true;
  }
  for(const f of rendered.features){const p=props.get(f.entity_id);f.qiao=p?.qiao===true;f.parentage_unresolved=Boolean(p?.parentage_unresolved);}
  return rendered;
 }
 root.LIU_SONG_MAP_VIEW={draw};if(typeof module!=='undefined'&&module.exports)module.exports={draw};
})(typeof window!=='undefined'?window:globalThis);
