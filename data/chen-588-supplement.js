/* User's Zhenming 2 supplement. Original source files and all other years stay intact. */
(() => {
  'use strict';
  const year = 588;
  const source = '使用者祯明二年（588）专项补订';
  const junfanNote = '一說為永新侯陳君范。《隋書》卷61《宇文述傳》稱「陳永新侯陳君范自晉陵奔瓛，並軍合勢」。此處保留此前指定的鄱陽國世子稱號與紫色，並列異說供核對。';
  const renzhongNote = '《陳書》卷31《任忠傳》載「出為吳興內史，加秩中二千石」。卷6《後主紀》記禎明二年六月庚子廢皇太子胤為吳興王；據此次封國建置，按使用者補訂將任忠出任吳興內史的起點繫於588年。起年屬建置推定，任忠本傳未直接標明授任年。';
  const definitions = [
    {id:'USR588-01',person:'任忠',place:'吳興',office:'吳興內史（中二千石）',state:'吳州',sid:'ch_s0002',pid:'ch_p0015',stateOrder:2,prefectureOrder:3,
      analysis:renzhongNote,evidence:'《陳書》卷31《任忠傳》：「出為吳興內史，加秩中二千石。」\n《陳書》卷6《後主紀》：禎明二年六月庚子，廢皇太子胤為吳興王。',
      sourceUrls:['https://zh.wikisource.org/wiki/陳書/卷31','https://zh.wikisource.org/wiki/陳書/卷6']},
    {id:'USR588-02',person:'徐璒',place:'豫章',office:'豫章太守',state:'江州',sid:'ch_s0010',pid:'ch_p0044',stateOrder:10,prefectureOrder:4},
    {id:'USR588-03',person:'呂忠肅',place:'南康',office:'南康內史',state:'江州',sid:'ch_s0010',pid:'ch_p0046',stateOrder:10,prefectureOrder:6},
    {id:'USR588-04',person:'柳璿',place:'南康',office:'南康內史',state:'江州',sid:'ch_s0010',pid:'ch_p0046',stateOrder:10,prefectureOrder:6},
    {id:'USR588-05',person:'蕭廉',place:'廬陵',office:'廬陵太守',state:'江州',sid:'ch_s0010',pid:'ch_p0045',stateOrder:10,prefectureOrder:5},
    {id:'USR588-06',person:'陸仲容',place:'尋陽',office:'尋陽太守',state:'江州',sid:'ch_s0010',pid:'ch_p0041',stateOrder:10,prefectureOrder:1},
    {id:'USR588-07',person:'王誦',place:'巴山',office:'巴山太守',state:'江州',sid:'ch_s0010',pid:'ch_p0047',stateOrder:10,prefectureOrder:7},
    {id:'USR588-08',person:'馬頲',place:'太原',office:'太原太守',state:'江州',sid:'ch_s0010',pid:'ch_p0043',stateOrder:10,prefectureOrder:3},
    {id:'USR588-09',person:'黃正始',place:'齊昌',office:'齊昌太守',state:'江州',sid:'ch_s0010',pid:'ch_p0053',stateOrder:10,prefectureOrder:13,detached:true,
      analysis:'使用者指定補入588年齊昌太守黃正始。現行政底表的齊昌郡僅繫574—579年（《中國行政區劃通史》書內1391頁），故保留為未連接長官記錄，不據官銜改寫588年行政建置。'},
    {id:'USR588-10',person:'任瓘',place:'安成',office:'安成太守',state:'江州',sid:'ch_s0010',pid:'ch_p0050',stateOrder:10,prefectureOrder:10},
    {id:'USR588-11',person:'徐綜',place:'始安',office:'始安太守',state:'桂州',sid:'ch_s0054',pid:'ch_p0191',stateOrder:54,prefectureOrder:1},
    {id:'USR588-12',person:'曾孝廣',place:'清遠',office:'清遠太守',state:'廣州',sid:'ch_s0047',pid:'ch_p0161',stateOrder:47,prefectureOrder:7},
    {id:'USR588-13',person:'毛爽',place:'陽山',office:'陽山太守',state:'西衡州',sid:'ch_s0056',pid:'ch_p0200',stateOrder:56,prefectureOrder:1}
  ];
  const governorDefinitions = [
    {state:'南徐州',target_id:'ch_s0006',person:'黃恪',line:'黃恪 南徐州刺史（職銜存疑，或為監南徐州）。',
      note:'使用者補訂：北朝史料稱黃恪為南徐州刺史，或有夸大；黃恪可能是南徐州州府的高級僚佐，在陳彥、蕭摩訶還朝時擔任類似監南徐州的職位。此條保留史稱與疑問，不視為已確定的正式刺史任命。'},
    {state:'巴州',target_id:'ch_s0040',person:'畢寶',line:'畢寶 巴州刺史。'},
    {state:'武州',target_id:'ch_s0042',person:'鄔居業',line:'鄔居業 武州刺史。'},
    {state:'桂州',target_id:'ch_s0054',person:'錢季卿',line:'錢季卿 桂州刺史。'},
    {state:'信州',target_id:'ch_s0046',person:'顧覺',line:'顧覺 信州刺史。'},
    {state:'高州',target_id:'ch_s0049',person:'戴智烈',line:'戴智烈 高州刺史。'},
    {state:'成州',target_id:'ch_s0058',person:'熊門超',line:'熊門超 成州刺史。',
      note:'依使用者指定補為成州刺史；魯力方鎮年表在平陳條列成州，並指出史料「城州」疑為成州之訛。'},
    {state:'南定州',target_id:'ch_s0062',person:'呂子廓',line:'呂子廓 定州刺史。',
      note:'史稱定州刺史；魯力方鎮年表在平陳條繫於南定州，故附本年南定州，不附於579年已終止的北方定州。'}
  ];

  const original = window.CHEN_LOCAL_OFFICIALS;
  if (original?.years?.[year]) {
    const previous = original.years[year];
    const tenures = {...original.tenures_by_id};
    const records = previous.local_officers.filter(record => record.official_id !== 'CS-0162').map(record =>
      record.official_id === 'CS-0387' ? {...record,display_correction:[record.display_correction,junfanNote].filter(Boolean).join('\n')} : record);
    let order = Math.max(0,...records.map(record => Number(record.display_order)||0));
    for (const item of definitions) {
      const existing = Object.values(tenures).find(tenure => tenure.person === item.person);
      const personId = existing?.person_id || `PER-${item.id}`;
      const isRen = item.id === 'USR588-01';
      const note = item.analysis || `${source}：${item.office}${item.person}。僅補本年收錄，不反推完整起訖；年內先後未詳。`;
      const basis = {type:'user_year_specific_supplement',label:'使用者指定本年收錄',strength:'confirmed',source_field:source,source_value:`${year}年：${item.office}${item.person}`};
      tenures[item.id] = {
        official_id:item.id,person_id:personId,person:item.person,place:item.place,office:item.office,full_title:item.office,
        level:'郡级正任',tenure_nature:'正任（使用者補訂）',tenure_status:'本年收錄',tenure_conclusion_status:'user_supplement',tenure_boundary_status:'unknown',
        tenure_time:{display:isRen?'起：禎明二年（588，依吳興王建置推定）；止：未詳':'禎明二年（588）專項收錄；起任、卸任年份未詳',
          original_start:isRen?'588（使用者據建置推定）':'未詳',original_end:'未詳',normalized:isRen?'起任588；卸任未詳':'僅記588年',
          start_lower:isRen?588:null,start_upper:isRen?588:null,start_status:isRen?'probable':'unresolved',end_lower:null,end_upper:null,end_status:'unresolved'},
        evidence_text:item.evidence || `${source}：${item.office}${item.person}。`,
        time_anchors:[{type:'user_annual_inclusion',label:'使用者指定年度',value:'禎明二年（588）'}],
        comprehensive_analysis:note,research_notes:item.sourceUrls||[],career_links:{},
        technical_trace:{source_timeline_id:item.id,normalized_tenure_id:item.id,adjudication_id:'USER-588-SUPPLEMENT',evidence_id:item.id,source_label:source}
      };
      records.push({schema_version:'chen-local-official-annual-presence-v1',record_type:'annual_local_officer_presence',
        annual_presence_id:`AP-${item.id}-${year}`,official_id:item.id,person_id:personId,person:item.person,place:item.place,office:item.office,full_title:item.office,level:'郡级正任',year,
        annual_presence_status:'confirmed',confidence:'confirmed',tenure_boundary_status:'unknown',annual_presence_basis:[basis],reasoning_source:[basis],
        projection_method:'user_year_specific_supplement',projection_constraints:[{lower:year,upper:year,type:'user_selected_year',label:source}],
        display_style:'normal',display_italic:false,intra_year_order:null,intra_year_order_status:'unresolved',intra_year_order_basis:[],intra_year_order_note:'年內先後未詳',display_order:++order,
        administrative_link:{target_level:'prefecture',link_status:item.detached?'entity_known_not_active_in_snapshot':'user_linked_active_snapshot',link_method:'explicit_user_supplement',
          normalized_place_key:item.place,attach_to_snapshot:!item.detached,hierarchy_active_in_year:!item.detached,state_assignment_asserted:!item.detached,
          active_candidate_count:item.detached?0:1,global_candidate_count:1,state_id:item.sid,state_name:item.state,state_order:item.stateOrder,
          prefecture_id:item.pid,prefecture_name:`${item.place}郡`,prefecture_order:item.prefectureOrder,county_id:null,county_name:null,county_order:null,candidate_ids:[item.pid]},
        technical_trace:tenures[item.id].technical_trace
      });
    }
    const updated = {...previous,local_officers:records,record_count:records.length,
      prefecture_count:records.filter(record => record.administrative_link?.target_level === 'prefecture').length,
      county_count:records.filter(record => record.administrative_link?.target_level === 'county').length,
      confirmed_count:records.filter(record => record.annual_presence_status === 'confirmed').length,
      probable_count:records.filter(record => record.annual_presence_status === 'probable').length,
      attached_count:records.filter(record => record.administrative_link?.attach_to_snapshot).length,
      detached_count:records.filter(record => !record.administrative_link?.attach_to_snapshot).length,
      list_semantics:'original_annual_records_with_user_588_supplement'};
    window.CHEN_LOCAL_OFFICIALS = {...original,tenures_by_id:tenures,years:{...original.years,[year]:updated}};
  }

  const governors = window.CHEN_GOVERNORS;
  if (governors?.years?.[year]) {
    const records = governors.years[year].records.map(record => ({...record,
      summary_lines:record.state === '郢州' ? record.summary_lines.filter(line => !/^\s*[【\[]?郢州[】\]]\s*$/.test(line)) : [...record.summary_lines],
      evidence_lines:[...(record.evidence_lines||[])],editorial_notes:[...(record.editorial_notes||[])]}));
    for (const item of governorDefinitions) {
      let record = records.find(record => record.state === item.state);
      if (!record) { record={state:item.state,target_id:item.target_id,order:records.length+1,summary_lines:[],evidence_lines:[],editorial_notes:[]}; records.push(record); }
      if (!record.summary_lines.some(line => line.includes(item.person))) record.summary_lines.push(item.line);
      record.editorial_notes.push(item.note || `${source}：${item.line}`);
      record.supplement_source = source;
    }
    window.CHEN_GOVERNORS = {...governors,years:{...governors.years,[year]:{...governors.years[year],records}}};
  }
  if (window.CHEN_ROYAL_IDENTITIES) window.CHEN_ROYAL_IDENTITIES = {...window.CHEN_ROYAL_IDENTITIES,
    source_people:[...new Set([...window.CHEN_ROYAL_IDENTITIES.source_people,...governorDefinitions.map(item => item.person)])]};
  window.CHEN_588_SUPPLEMENT = {year,source,localOfficials:definitions,governors:governorDefinitions,junfanNote,removedAnnualOfficialIds:['CS-0162']};
})();
