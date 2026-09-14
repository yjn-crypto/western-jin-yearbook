// node scripts/build-liang-local-officials.mjs
// Only reviewed annual anchors are projected; missing intervals remain missing.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {root,createLiangContext} from './liang-snapshot-context.mjs';
const input=fs.readFileSync(new URL('data/liang-officials-reviewed.json',root));
const source=JSON.parse(input),context=createLiangContext();
const annotation=fs.readFileSync(new URL('source-annotations.js',root),'utf8');
const equivalents=vm.runInNewContext(`(${annotation.match(/const equivalents = (\{[\s\S]*?\n  \});/)[1]})`);
Object.assign(equivalents,{尋:'寻',羨:'羡',恆:'恒'});
const key=value=>String(value||'').replace(/[\u3400-\u9fff]/g,c=>equivalents[c]||c)
  .replace(/[\s、，,（）()]/g,'').replace(/(郡|國|国|縣|县)$/,'');
const meta={...source.meta,source_master_sha256:crypto.createHash('sha256').update(input).digest('hex'),
  build_method:'reviewed_annual_anchors_and_unique_active_entity',
  link_note:'同名而多候選或不存在者保留獨立任次。唯一連接只表示對應目前政區底表，底表的年代不確仍保留。'};
const output={meta,tenures_by_id:{},years:{}};
const audit=[];
for(const record of source.records){
  assert(!output.tenures_by_id[record.official_id],`Duplicate tenure ${record.official_id}`);
  const citations=record.evidence.map(e=>`《${e.book}》卷${e.volume}·${e.chapter}；${e.paragraph_id}；${e.epub_member} 第${e.file_paragraph}段`);
  output.tenures_by_id[record.official_id]={...record,
    tenure_time:{...record.tenure_time,display:`${record.original_time}；可證年度：${record.annual_presence_years.join('、')}。起訖未完整確定，不補中間年。`},
    tenure_status:record.tenure_status==='served'?'有本年在任記載':record.tenure_status==='appointment_only'
      ?'僅能確認本年授官；尚無實際履任證據':'本年授官並有在任事迹；到郡日期未詳',
    source_citation:[...new Set(citations)].join('\n'),
    evidence_text:record.evidence.map(e=>`《${e.book}》卷${e.volume}（${e.paragraph_id}）：${e.quote}`).join('\n\n'),
    time_anchors:[{label:'原紀年',value:record.original_time},{label:'換算及斷限',value:record.time_explanation}],
    comprehensive_analysis:record.annual_semantics,
    technical_trace:{epub_evidence:record.evidence,review_status:record.review_status}
  };
  for(const year of record.annual_presence_years){
    assert(Number.isInteger(year)&&year>=502&&year<=557);
    const snap=context.buildLiangSnapshot(year),targetLevel=record.level.startsWith('县')?'county':'prefecture';
    const candidates=[];
    for(const state of snap.states)for(const row of state.rows){
      const targets=targetLevel==='county'?row.counties:[row];
      for(const target of targets)if(key(target.name)===key(record.place))candidates.push({state,row,target});
    }
    const match=candidates.length===1?candidates[0]:null;
    const link={target_level:targetLevel,link_status:match?'unique_active_entity':candidates.length?'ambiguous_active_entities':'no_active_entity',
      link_method:'exact_normalized_name_unique_in_year',attach_to_snapshot:!!match,
      hierarchy_active_in_year:!!match,state_assignment_asserted:!!match,
      active_candidate_count:candidates.length,candidate_ids:candidates.map(c=>c.target.id),
      ...(match?{state_id:match.state.id,state_name:match.state.name,prefecture_id:match.row.id,prefecture_name:match.row.name,
        ...(targetLevel==='county'?{county_id:match.target.id,county_name:match.target.name}:{}),
        geography_uncertain:!!(match.state.uncertain||match.row.uncertain||match.target.uncertain)}:{})};
    const annual={annual_presence_id:`${record.official_id}-${year}`,official_id:record.official_id,
      person_id:record.person_id,person:record.person,place:record.place,office:record.office,
      full_title:record.full_title,level:record.level,year,annual_presence_status:'confirmed',
      tenure_status:record.tenure_status,annual_semantics:'本年有授官或在任證據，履任狀態另列',
      tenure_boundary_status:'unknown',annual_presence_basis:[{label:'原典年度證據',source_value:record.time_explanation}],
      projection_method:'reviewed_annual_anchor',display_order:Number(record.official_id.split('-').at(-1)),
      intra_year_order:null,intra_year_order_status:'unknown',
      intra_year_order_note:'排列僅供閱讀，不據資料次序斷定同年先後任。',
      administrative_link:link};
    (output.years[year]??={local_officers:[]}).local_officers.push(annual);
    audit.push({annual_presence_id:annual.annual_presence_id,person:record.person,place:record.place,year,...link});
  }
}
meta.attached_annual_records=audit.filter(r=>r.attach_to_snapshot).length;
meta.detached_annual_records=audit.length-meta.attached_annual_records;
assert.equal(audit.length,source.meta.annual_record_count);
fs.writeFileSync(new URL('data/liang-local-officials.js',root),'/* Generated from reviewed EPUB evidence; do not infer missing years. */\nwindow.LIANG_LOCAL_OFFICIALS = '+JSON.stringify(output)+';\n');
fs.writeFileSync(new URL('reports/liang-official-geography-audit.json',root),JSON.stringify({meta,records:audit},null,2)+'\n');
console.log(JSON.stringify({tenures:source.records.length,annual:audit.length,attached:meta.attached_annual_records,detached:meta.detached_annual_records}));
