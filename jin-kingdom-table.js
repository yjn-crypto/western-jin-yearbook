/* Display relations are independent of the administrative entities and their counties. */
(() => {
  'use strict';

  function apply(states, year, data) {
    const entries = states.flatMap(state => state.rows.map(row => ({state, row})));
    const find = ids => entries.filter(entry => !entry.row.phase?.transfer_origin_grouping && (ids || []).includes(entry.row.id));
    const used = new Set();
    const active = (data?.records || []).filter(record => record.begin <= year && year <= record.end)
      .sort((a, b) => b.begin - a.begin);
    for (const record of active) {
      const primaries = find(record.primary_ids);
      if (primaries.length !== 1 || used.has(primaries[0].row.id)) continue;
      const primary = primaries[0];
      const name = record.kingdom_name.replace(/國$/, '');
      const proto = year < data.formal_multi_begin;
      primary.row.displayName = `${name}國`;
      primary.row.kingdom = true;
      primary.row.jinKingdom = {record, role: 'primary', name, primaryId: primary.row.id, crossState: false, proto};
      used.add(primary.row.id);
      for (const member of record.members || []) {
        const matches = find(member.ids);
        if (matches.length !== 1 || used.has(matches[0].row.id)) continue;
        const {state, row} = matches[0];
        const branchName = `${member.name.replace(/[郡國]$/, '')}支郡`;
        row.displayName = proto ? `（${branchName}）` : branchName;
        if (proto) row.phase = {...row.phase, administrative_count: false};
        row.previousKingdomRuler = row.kingdom ? row.ruler : null;
        row.kingdom = false;
        row.ruler = null;
        row.jinKingdom = {record, member, role: 'member', name, primaryId: primary.row.id,
          crossState: state.id !== primary.state.id, proto};
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

  const finite = value => value != null && Number.isFinite(Number(value));
  const samePerson = (a, b) => String(a || '').normalize('NFKC').replace(/⻢/g, '馬')
    === String(b || '').normalize('NFKC').replace(/⻢/g, '馬');

  // Missing constraints fail conservatively: a finite source interval can be
  // used, but one known endpoint never becomes an unbounded reign.
  function fallbackConstraint(record) {
    const start = finite(record.start) ? Number(record.start) : null;
    const end = finite(record.end) ? Number(record.end) : null;
    const periods = start != null && end != null ? [[start, end]]
      : start != null ? [[start, start]] : end != null ? [[end, end]] : [];
    return {start_min:start, start_max:start, end_min:end, end_max:end,
      accession_known:start != null, display_start:start, certain_periods:periods,
      note:'未见专门约束；单端日期只证明事件本年，不无限延续。'};
  }

  function constraintFor(record, supplied) {
    return supplied || window.JIN_RULER_CONSTRAINTS?.princes?.[record.id]
      || fallbackConstraint(record);
  }

  function isAttested(record, constraint, year) {
    if (constraint.identity_unknown || constraint.posthumous) return false;
    if (year <= 316 && ['eastern_jin','after_western_jin'].includes(constraint.dynasty)) return false;
    if (finite(constraint.start_min) && year < Number(constraint.start_min)) return false;
    if (finite(constraint.end_max) && year > Number(constraint.end_max)) return false;
    if (constraint.display_periods) return constraint.display_periods.some(([start,end]) => start <= year && year <= end);
    return (constraint.certain_periods || []).some(([start,end]) => start <= year && year <= end)
      || (record.attested_years || []).includes(year)
      || (record.attested_periods || []).some(period => period.start <= year && year <= period.end);
  }

  function displayRecord(record, constraint, year) {
    const reign = (constraint.display_reigns || []).find(p => p.begin <= year && year <= p.end);
    const start = reign ? reign.accession : constraint.display_start;
    const dated = (reign?.accession_known ?? constraint.accession_known) && finite(start);
    return {...record, source_start:record.start ?? null, source_end:record.end ?? null,
      start:dated ? Number(start) : null, end:reign?.end ?? record.end,
      display_start:dated ? Number(start) : null,
      accession_known:Boolean(dated), display_inferred:Boolean(constraint.display_inferred), constraint,
      constraint_note:constraint.note || ''};
  }

  function selectUnique(all, candidates, constraints, year) {
    const people = [];
    for (const item of candidates) if (!people.some(person => samePerson(person, item.person))) people.push(item.person);
    const record = people.length === 1 ? candidates[candidates.length - 1] : null;
    return {all, active:candidates, record, constraints,
      display_start:record?.display_start ?? null,
      accession_known:record?.accession_known || false,
      status:record ? 'matched' : all.length ? 'gap' : 'absent',
      reason:record ? (record.constraint_note || '') : people.length > 1
        ? '本年有不止一位有据国主，不能唯一确定正文姓名；完整世系留在展开资料。'
        : '现有材料不能确认本年的国主；可能起讫与表列次序不作为任年证明。'};
  }

  function rulerAt(records, fief, year, level='prefecture') {
    const all = records.filter(record => {
      if(record.fief !== fief)return false;
      const constraint=constraintFor(record);
      const period=constraint.level_periods?.find(period=>period.begin<=year&&year<=period.end);
      return (period?.level||constraint.level||'prefecture')===level
        && (level!=='county'||((constraint.start_min==null||constraint.start_min<=year)
          &&(constraint.end_max==null||year<=constraint.end_max)
          &&(!constraint.display_periods||constraint.display_periods.some(([start,end])=>start<=year&&year<=end))));
    });
    const constraints = all.map(record => ({id:record.id, ...constraintFor(record)}));
    const active = all.flatMap(record => {
      const constraint = constraintFor(record);
      return isAttested(record, constraint, year) ? [displayRecord(record, constraint, year)] : [];
    });
    return selectUnique(all, active, constraints, year);
  }

  function fiveRankAt(fief, year) {
    const all = fief.holders || [], active = [], constraints = [];
    all.forEach((holder, holderIndex) => {
      (holder.periods?.length ? holder.periods : [{}]).forEach((period, periodIndex) => {
        const key = `${fief.id}:${holderIndex}:${periodIndex}`;
        const constraint = window.JIN_RULER_CONSTRAINTS?.five_rank?.[key]
          || fallbackConstraint(period);
        constraints.push({id:key, ...constraint});
        const record = {...holder, ...period, id:key, holder_index:holderIndex, period_index:periodIndex};
        if (holder.person && !['?','？'].includes(holder.person) && isAttested(record, constraint, year)) {
          active.push(displayRecord(record, constraint, year));
        }
      });
    });
    const result = selectUnique(all, active, constraints, year);
    return {...result, holder_names:result.record ? [result.record.person] : [],
      holder_exact:Boolean(result.record)};
  }

  // A member-relation window is not a second, independent reign table. The
  // handwritten holder must pass the same selection as every other prince.
  function reviewedRulerAt(records, overlay, year) {
    const result = rulerAt(records, overlay.kingdom_name, year);
    if (year < overlay.begin || year > overlay.end || !overlay.holder) return result;
    if (!result.record || !samePerson(result.record.person, overlay.holder)) {
      return {...result, active:[], record:null, display_start:null, accession_known:false,
        status:result.all.length ? 'gap' : 'absent',
        reason:`多郡关系所记${overlay.holder}未通过本年国主约束，不能用关系期段覆盖世系筛选。${result.reason}`};
    }
    const declared = overlay.holder_accession_year;
    const dated = result.accession_known && finite(declared)
      && Number(declared) === result.display_start;
    const record = {...result.record, title:`${overlay.kingdom_name}王`,
      start:dated ? Number(declared) : null, display_start:dated ? Number(declared) : null,
      accession_known:Boolean(dated)};
    return {...result, record, display_start:record.display_start, accession_known:record.accession_known,
      researchNote:overlay.holder_note || overlay.note || ''};
  }

  window.JIN_KINGDOM_TABLE = {apply, displayRows, joinsNext, rulerAt, fiveRankAt, reviewedRulerAt};
})();
