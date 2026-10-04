/* Display relations are independent of the administrative entities and their counties. */
(() => {
  'use strict';

  function apply(states, year, data) {
    const entries = states.flatMap(state => state.rows.map(row => ({state, row})));
    const find = ids => entries.filter(entry => (ids || []).includes(entry.row.id));
    const used = new Set();
    const active = (data?.records || []).filter(record => record.begin <= year && year <= record.end)
      .sort((a, b) => b.begin - a.begin);
    for (const record of active) {
      const primaries = find(record.primary_ids);
      if (primaries.length !== 1 || used.has(primaries[0].row.id)) continue;
      const primary = primaries[0];
      const name = record.kingdom_name.replace(/國$/, '');
      primary.row.displayName = `${name}國`;
      primary.row.kingdom = true;
      primary.row.jinKingdom = {record, role: 'primary', name, primaryId: primary.row.id, crossState: false};
      used.add(primary.row.id);
      for (const member of record.members || []) {
        const matches = find(member.ids);
        if (matches.length !== 1 || used.has(matches[0].row.id)) continue;
        const {state, row} = matches[0];
        row.displayName = `${member.name.replace(/[郡國]$/, '')}支郡`;
        row.previousKingdomRuler = row.kingdom ? row.ruler : null;
        row.kingdom = false;
        row.ruler = null;
        row.jinKingdom = {record, member, role: 'member', name, primaryId: primary.row.id,
          crossState: state.id !== primary.state.id};
        used.add(row.id);
      }
    }
    for (const state of states) {
      const original = state.rows;
      state.rows = original.flatMap(row => {
        const relation = row.jinKingdom;
        if (relation?.role === 'member' && !relation.crossState) return [];
        if (relation?.role !== 'primary') return [row];
        return [row, ...original.filter(child => child.jinKingdom?.role === 'member'
          && !child.jinKingdom.crossState && child.jinKingdom.primaryId === row.id)];
      });
    }
    for(const group of data?.county_groups || []){
      if(year<group.begin||year>group.end)continue;
      const targets=find([group.primary_id]);
      if(targets.length===1)targets[0].row.countyDisplayGroups=[...(targets[0].row.countyDisplayGroups||[]),group];
    }
    return states;
  }

  function displayRows(state) {
    return state.rows.flatMap(row => {
      if(!row.countyDisplayGroups?.length)return [row];
      const assigned=new Set(), groups=[];
      for(const group of row.countyDisplayGroups){
        const counties=row.counties.filter(county=>group.county_ids.includes(county.id)&&!assigned.has(county.id));
        if(!counties.length)continue;
        counties.forEach(county=>assigned.add(county.id));
        groups.push({...row,id:`${row.id}:${group.id}`,displayName:group.label,counties,
          kingdom:false,ruler:null,fiveRankFiefs:[],jinKingdom:null,countyDisplayGroups:[],
          displayCountyGroup:group,countyGroupParent:row.id});
      }
      if(!groups.length)return [row];
      return [{...row,counties:row.counties.filter(county=>!assigned.has(county.id)),countyGroupParent:row.id,emptyCountyLabel:''},...groups];
    });
  }

  function joinsNext(row, next) {
    if(row?.countyGroupParent&&row.countyGroupParent===next?.countyGroupParent&&next.displayCountyGroup)return true;
    const left = row?.jinKingdom, right = next?.jinKingdom;
    return Boolean(left && right && !left.crossState && !right.crossState
      && left.primaryId === right.primaryId && right.role === 'member');
  }

  // An unknown accession year can only be selected using a separate dated attestation.
  // An undated entry in a succession list is not evidence of presence in every earlier year.
  function rulerAt(records, fief, year) {
    const all = records.filter(record => record.fief === fief);
    const active = all.filter(record => {
      const dated = record.start != null && Number.isFinite(Number(record.start));
      const attested = (record.attested_years || []).includes(year)
        || (record.attested_periods || []).some(period => period.start <= year && year <= period.end);
      return (dated ? Number(record.start) <= year : attested)
        && (record.end == null || year <= Number(record.end));
    }).sort((a, b) => Number(b.start ?? -Infinity) - Number(a.start ?? -Infinity)
      || Number(b.sequence || 0) - Number(a.sequence || 0));
    return {all, active, record: active[0] || null};
  }

  window.JIN_KINGDOM_TABLE = {apply, displayRows, joinsNext, rulerAt};
})();
