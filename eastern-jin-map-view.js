/* Reuse the established map interaction contract without Western Jin fief
 * inference or the original map's label anchors. Qiao is an independent flag. */
(function(root){
  'use strict';
  function draw(map,container,options){
    const result=root.JIN_MAP_VIEW.draw(map,container,{...options,labelAnchors:[]});
    const props=new Map(map.geojson.features.filter(f=>f.properties.entity_id).map(f=>[f.properties.entity_id,f.properties]));
    for(const label of result.labels){
      const p=props.get(label.entityId);label.qiao=Boolean(p?.qiao);
      label.labelIdentity=label.entityId?`eastern-jin:${label.entityId}:${label.kind}`:label.labelIdentity;
      // Shared-boundary topology now remains intact. Overview labels once
      // again stay within the current province, with smaller type when needed.
      if(label.level==='state'&&label.kind==='state-area'){
        label.allowAreaFontShrink=true;
      }
    }
    for(const point of result.features)point.qiao=Boolean(props.get(point.entity_id)?.qiao);
    return result;
  }
  root.EASTERN_JIN_MAP_VIEW={draw};
  if(typeof module!=='undefined'&&module.exports)module.exports={draw};
})(typeof window!=='undefined'?window:globalThis);
