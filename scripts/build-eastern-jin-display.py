#!/usr/bin/env python3
"""Build a separately reviewable Eastern Jin presentation from the immutable Work handoff.

This is a presentation adjudication, not an overwrite or historical certification.
Run from any directory: python3 scripts/build-eastern-jin-display.py
"""
from pathlib import Path
from collections import defaultdict, Counter
import json, copy, hashlib, csv, re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data/eastern-jin-research'
OUT = ROOT / 'data/eastern-jin-display'
OUT.mkdir(exist_ok=True)
(OUT / 'annual').mkdir(exist_ok=True)
raw = (SRC / 'research.json').read_bytes()
r = json.loads(raw)
es = {e['id']: e for e in r['entities']}
evs = {e['id']: e for e in r['evidence']}
sources = {s['id']: s for s in r['sources']}
original_phases = {p['id']: p for p in r['phases']}
phases = copy.deepcopy(r['phases'])
ps = {p['id']: p for p in phases}
rels = copy.deepcopy(r['relations'])
issues = [i for i in r['issues'] if i.get('status') == 'open']
issue_lookup = {i['id']: i for i in issues}
levels = {'state': '州', 'prefecture': '郡', 'county': '县'}
kind_labels = {'date':'年代','parentage':'归属','identity':'身份','text':'文本','other':'其他','source_access':'版本来源'}
page_by_ocr = {}
for ev in r['evidence']:
    loc = ev.get('locator') or {}
    if ev['id'].startswith('eja_evmark_') and loc.get('book_page') and loc.get('pdf_page'):
        page_by_ocr[loc.get('ocr_page_index')] = (loc['book_page'], loc['pdf_page'])
issue_entities = defaultdict(list)
entity_issues = defaultdict(list)
for i in issues:
    for x in i.get('subject_ids', []):
        eid = x if x in es else original_phases.get(x, {}).get('entity_id')
        if eid and eid not in issue_entities[i['id']]:
            issue_entities[i['id']].append(eid)
            entity_issues[eid].append(i['id'])


def uniq(seq):
    return list(dict.fromkeys(x for x in seq if x is not None))


def clean(s):
    s = str(s or '')
    return re.sub(r'/Users/[^\s，。；\]）]+', '[本地研究资料]', s)


def evidence(vid, limit=900):
    e = evs.get(vid, {})
    source = sources.get(e.get('source_id'), {})
    loc = e.get('locator') or {}
    raw_excerpt = clean(e.get('raw_excerpt') or e.get('normalized_excerpt') or '')
    linked_page = page_by_ocr.get(loc.get('ocr_page_index')) if e.get('source_layer') == 'tongshi_body' and (not loc.get('book_page') or not loc.get('pdf_page')) else None
    book_page = loc.get('book_page') or (linked_page[0] if linked_page else None)
    pdf_page = loc.get('pdf_page') or (linked_page[1] if linked_page else None)
    page_note = '；书页及PDF页取同条已核原图的定位对应，OCR与扫描版本异文仍保留。' if linked_page else ''
    excerpt = raw_excerpt if len(raw_excerpt) <= limit else raw_excerpt[:limit] + '……（节录）'
    title = source.get('title') or e.get('source_id') or '研究证据'
    chapter = loc.get('chapter') or loc.get('volume') or source.get('volume') or ''
    return dict(id=vid, source=title, title=title, book_page=book_page,
                pdf_page=pdf_page, chapter=chapter, excerpt=excerpt,
                editorial_note=clean(e.get('correction_note') or e.get('relevance')) + page_note,
                assertion_kind=e.get('assertion_kind'),
                url=loc.get('url') or source.get('url'))


# Only specific dated candidates are brought forward. A generic 317--420 search
# envelope is not evidence for establishment in 317, and late catalogues remain late.
DATE_CHOICES = {
    'ej5_c19471_ph3': (355, 358, '许昌355年五月陷后又复、359再陷，Work列复取候选355—358；本轮取最早355展示至358。355仅为“再陷以后复取”的展示投射，不称复取确年。', '低'),
    'ej10_c1562_1_1_ph1': (397, 419, '襄垣“晋末立”已约束为397—419，取候选最早397；原属上党、420转淮南的展示衔接保留。397及420均不是原典确切置县、改属年。', '低'),
    'ej10_p1577_2_ph1': (397, 402, '横江武都既有候选397—402，本轮取397作为展示起界；402任官战事为观察锚，只有太守及驻屯证据，不能因此确定郡治或行政州属。', '低'),
    'ej10_c1611_1_1_ph1': (405, 413, '堂邑郡405已有太守并领同名一县；既列候选405—413，按同一郡县组取最早405展示，413保留既有省并前上限。县与郡同起为本轮推定。', '中'),
}
phase_changes = []
for pid, (start, end, reason, confidence) in DATE_CHOICES.items():
    p = ps[pid]
    old = (p['display_start'], p['display_end'])
    p['display_start'], p['display_end'] = start, end
    p['display_note'] = reason
    p['machine_date_choice'] = reason
    p['machine_date_confidence'] = confidence
    # Only align the original relation of this exact phase, never all relations of a namesake.
    for z in rels:
        if z['kind'] == 'administrative_parent' and z['subject_id'] == p['entity_id'] and (
            (z.get('display_start'), z.get('display_end')) == old or z['id'].startswith(pid + '_')
        ):
            z['display_start'], z['display_end'] = start, end
            z['boundary_notes'] += '；' + reason
    phase_changes.append(dict(phase_id=pid, entity_id=p['entity_id'], name=p['name'],
                              before=list(old), after=[start,end], reason=reason))

# Discrete, source-backed administrative candidates. Hosted-at/origin labels never
# become parents automatically.  Existing institution IDs are mandatory.
parent_choices = []
def parent_choice(eid, parent, start, end, basis, evidence_ids, confidence='中'):
    assert eid in es and parent in es
    row = dict(id=f'ejmp_{len(parent_choices)+1:03d}', subject_id=eid, kind='administrative_parent',
               object_id=parent, object_label=es[parent]['base_name'], display_start=start,
               display_end=end, status='adopted', alternative_group_id=None,
               boundary_notes=basis, evidence_ids=evidence_ids, decision_ids=[],
               machine_choice=True, confidence=confidence)
    parent_choices.append(row)
    rels.append(row)

# Direct retrospective affiliation, with the unresolved transfer kept outside its boundary.
parent_choice('ej10_p1509_1','ej5_s19743',317,396,
              '《晋书》明称“司州之弘农”，安帝应何无忌请后才改江州；本轮只把安帝以前的317—396归司州，安帝期间改属年未定暂搁置。父州本年缺期者仍入待考。', ['ejp_jin015_p0126','ej10_chrono_154'])
parent_choice('ej10_p1543_1','ej5_s18431',329,396,
              '《晋书》明载松滋遥隶扬州，安帝时改江州但确年未定；329—396采用扬州，397后保留两属及转换待考。', ['ejp_jin015_p0126','ejp_song036_p0163','ej10_chrono_155'])
# Jin geographical narrative explicitly situates the Chenliu institution in the qiao Yanzhou account.
parent_choice('ej10_p1520_1','ej10_s1519_1',338,420,
              '《晋书》侨兖州沿革直接接记咸康四年于北谯界立陈留，《通史》同一实体且永初仍属兖州；采用此行政上下文连续关系，非从原籍或寄地推州。', ['ejp_jin014_p0056','ej10_chrono_020'])
# A prefecture created by division retains the supported administrative context;
# no invented territorial affiliation is derived from a host county.
parent_choice('ej10_p1611_1','ej5_s18431',405,413,
              '《晋书》扬州篇明确把侨京邑堂邑与魏、广川等同列；结合本实体405—413阶段采用扬州，京邑寄治只是身份限定，不是单独州属依据。', ['ejp_jin015_p0126','ej10_chrono_164'])
parent_choice('ej10_p1573_2','ej10_s1574_1',373,420,
              '原文明“本属南秦”，Work已经留下秦州关系但未定时段；按现有秦州最早373年阶段相交采用，362—372父州缺期仍搁置，不造秦州早期。', ['ej10_prose_b_1572','ej10_chrono_084','ejp_song037_p0393'])
parent_choice('ej10_p1579_3','ej10_s1574_1',397,420,
              '《宋书》怀宁专条追叙晋安帝立并明“本属南秦”，439才度益州；本轮采用已存在侨秦州，成都寄治不当作益州归属。', ['ejp_song038_p0045','ej10_chrono_093'], '较高')
# Mapping for the newly widened county is direct and explicit in its phase.
changed_xiangyuan = ps['ej10_c1562_1_1_ph1']['entity_id']
parent_choice(changed_xiangyuan,'ej10_p1562_1',397,419,
              '《通史》原属上党、后省郡县属淮南；只给本轮扩大至397—419的上党阶段补同一实体的行政父级，420关系不改。', ['ej10_chrono_160','ej10_c1562_1_1_origin_ev'] if 'ej10_c1562_1_1_origin_ev' in evs else ['ej10_chrono_160'])

phases_by_entity = defaultdict(list)
rels_by_entity = defaultdict(list)
for p in phases:
    phases_by_entity[p['entity_id']].append(p)
for z in rels:
    rels_by_entity[z['subject_id']].append(z)
limits_by_entity = defaultdict(list)
for x in r.get('qiao_parentage_limits', []):
    for eid in x['entity_ids']:
        limits_by_entity[eid].append(x)


def active(x, year, phase=False):
    return ((x.get('adoption_status','adopted') == 'adopted') if phase else x.get('status') == 'adopted') and \
           x.get('display_start') is not None and x.get('display_end') is not None and \
           x['display_start'] <= year <= x['display_end']


def picked_phases(eid):
    return [p for p in phases_by_entity[eid] if p.get('adoption_status','adopted') == 'adopted']


def supported_years(eid):
    return sorted({y for p in picked_phases(eid) for y in range(317,421) if active(p,y,True)})


def ranges(years):
    years = sorted(set(years))
    out=[]
    for y in years:
        if out and out[-1][1]+1 == y: out[-1][1]=y
        else: out.append([y,y])
    return out


def period_words(periods):
    return '、'.join(str(a) if a==b else f'{a}—{b}' for a,b in periods) or '未定年'


def phase_view(p):
    def candidates(boundary):
        b=p.get(boundary,{})
        return sorted({n for key in ['source_bound','constrained_bound'] for n in (b.get(key,{}).get('lower_year'), b.get(key,{}).get('upper_year')) if n is not None})
    return dict(id=p['id'], name=p['name'], raw=p['period_raw'], start=p['display_start'],end=p['display_end'],
                start_candidates=candidates('start_boundary'),end_candidates=candidates('end_boundary'),
                start_note=clean(p['start_boundary']['reason']),end_note=clean(p['end_boundary']['reason']),
                qiao={'qiao':True,'non_qiao':False,'uncertain':None}[p['qiao_status']],
                adoption_status=p.get('adoption_status','adopted'))


# First build a decision for every open Work issue, including issues whose subject is
# a whole page or a version limitation. Original issue state remains untouched.
decisions=[]
for no,i in enumerate(issues,1):
    ids=issue_entities[i['id']]
    candidates=[];adopted=[];vids=list(i.get('evidence_ids',[]))
    for eid in ids:
        opp=[p for p in r['phases'] if p['entity_id']==eid]
        pr=[z for z in r['relations'] if z['subject_id']==eid and z['kind']=='administrative_parent']
        candidates.append(dict(entity_id=eid,name=es[eid]['base_name'],phases=[phase_view(p) for p in opp],
             parents=[dict(id=z['object_id'],name=z.get('object_label'),start=z.get('display_start'),end=z.get('display_end'),status=z['status'],basis=clean(z['boundary_notes']),evidence_ids=z['evidence_ids']) for z in pr]))
        for p in picked_phases(eid):
            vids += p['evidence_ids']
            if p['display_start'] is not None and p['display_end'] is not None:
                adopted.append(dict(entity_id=eid,name=p['name'],start=p['display_start'],end=p['display_end'],phase_id=p['id'],qiao={'qiao':True,'non_qiao':False,'uncertain':None}[p['qiao_status']]))
    changed=[c for c in phase_changes if c['entity_id'] in ids]
    pts=[x for x in parent_choices if x['subject_id'] in ids]
    for x in pts:vids += x['evidence_ids']
    label='、'.join(es[e]['base_name']+'（'+levels[es[e]['level']]+'）' for e in ids) or i['description'].split('；')[0][:65]
    any_undated=any(p['display_start'] is None or p['display_end'] is None for eid in ids for p in picked_phases(eid))
    decision='';reason='';status='retained_with_note';confidence='中'
    if i['kind']=='date':
        if changed:
            status='partial' if any_undated else 'adopted';confidence='低'
            decision='采用候选最早展示年。'+' '.join(c['reason'] for c in changed)
        elif adopted:
            status='partial' if any_undated else 'adopted'
            decision='采用已有约束后的最早可支持展示阶段；各实体及分段见采用时段。'
        else:
            status='suspended';confidence='低';decision='暂搁置本问题的未定年阶段，不加入逐年主表。'
        notes=uniq(p.get('machine_date_choice') or p['start_boundary']['reason'] for eid in ids for p in picked_phases(eid))
        reason='；'.join(clean(n) for n in notes) or i['display_treatment']
        if adopted and any(a['start'] >= 418 for a in adopted):
            reason+='；仅有418或420观察的阶段，早年无独立候选，故保留最早有据观察年；它不是始置下限。'
        manual='核对候选是否有更早同一机构记录，尤其置年、观察年、迁治年和侨化年是否被混用；有排斥性材料时缩窄展示段。'
    elif i['kind']=='parentage':
        status='partial';decision='逐年采用有直接属隶证据且本年存在的唯一父级；其余保留归属待考。'
        reason='已有明定行政关系优先；本轮新增候选只据具名原文或同一机构阶段衔接，原籍、寄治及兼督不单独生成州属。'
        if pts:reason+='；'+'；'.join(x['boundary_notes'] for x in pts)
        for eid in ids:
            for z in limits_by_entity[eid]:reason+='；'+z['raw_quote']+'：'+z['reason'];vids+=z['evidence_ids']
        manual='核查所采用州属是否确为东晋行政属隶，是否仅府属、兼督、寄治或宋代州属；未定转换年请补证。'
    elif i['kind']=='identity':
        status='retained_with_note' if adopted else 'suspended';confidence='低'
        decision='沿用已辨认且采用的实体与名称，保留竞争身份；不能唯一连接者不增加第二套年度实体。'
        reason=i['display_treatment'];manual='核对同名异地、侨实异体、复建与迁移是否同一机构；请勿只凭同名合并。'
    elif i['kind']=='text':
        status='retained_with_note';decision='正文采用现有标题及已核校读；把错配按语、版本异文留在展开，不以异文自动改实体。'
        reason=i['display_treatment'];manual='对照所列版本原页，确认标题、按语、表格栏位与异体字的正确对应。'
    elif i['kind']=='source_access':
        status='suspended';confidence='低';decision='保留版本限制，不以机器判断宣称完成纸本校勘。'
        reason=i['display_treatment'];manual='人工核对《晋书》电子文本疑误及《宋书》所用版本；不影响已有可定位原文的暂用。'
    else:
        status='retained_with_note' if adopted else 'suspended';confidence='低'
        decision='保留已有有据阶段及侨置标记，未可确定的原属、侨化或推补性质只作注释。'
        reason=i['display_treatment'];manual='核对本条学术推论与原文明载的界限；必要时更改侨性或补充原属，不联动同名异地条。'
    short_evidence=[evidence(v) for v in uniq(vids) if v in evs]
    decisions.append(dict(id=f'ejmd_{no:04d}',issue_id=i['id'],kind=i['kind'],kind_label=kind_labels[i['kind']],
        subject_ids=ids,entities=[dict(id=e,name=es[e]['base_name'],level=es[e]['level'],level_label=levels[es[e]['level']]) for e in ids],
        label=label,original_question=i['description'],original_treatment=i['display_treatment'],candidates=candidates,
        status=status,decision=decision,reason=clean(reason),adopted_periods=adopted,adopted_parentages=[],confidence=confidence,
        evidence=short_evidence,manual_review=manual,historical_final=False))

by_issue={d['issue_id']:d for d in decisions}
decision_ids_by_entity=defaultdict(list)
for d in decisions:
    for eid in d['subject_ids']:decision_ids_by_entity[eid].append(d['id'])


def choose_parent(eid, year, current):
    rr=[z for z in rels_by_entity[eid] if z['kind']=='administrative_parent' and active(z,year)]
    valid=[z for z in rr if z.get('object_id') in current]
    obj=uniq(z['object_id'] for z in valid)
    if len(obj)==1:
        return obj[0],valid,None
    if len(obj)>1:
        # Explicit machine adjudication is a reviewed candidate, otherwise a source
        # conflict remains exposed. It is never settled by list order.
        chosen=uniq(z['object_id'] for z in valid if z.get('machine_choice'))
        if len(chosen)==1:return chosen[0],[z for z in valid if z['object_id']==chosen[0]],None
        return None,rr,'multiple_parents'
    return None,rr,'parent_not_present' if any(z.get('object_id') for z in rr) else 'parent_unresolved'


annual={}; index=[]; parent_observations=defaultdict(lambda:defaultdict(list)); source_ids=set(); all_rows={}
undatedrefs=[]
for eid in es:
    pp=[p for p in picked_phases(eid) if p.get('display_start') is None or p.get('display_end') is None]
    if pp:
        undatedrefs.append(dict(entity_id=eid,id=eid,name=es[eid]['base_name'],level=es[eid]['level'],phase_ids=[p['id'] for p in pp],
          qiao=True if all(p['qiao_status']=='qiao' for p in pp) else False if all(p['qiao_status']=='non_qiao' for p in pp) else None,
          reason='；'.join(uniq(clean(p['display_note']) for p in pp)),evidence_ids=uniq(v for p in pp for v in p['evidence_ids']),
          machine_decision_ids=decision_ids_by_entity[eid],suspended=True,main_display=False))

for year in range(317,421):
    current={eid:[p for p in pp if active(p,year,True)] for eid,pp in phases_by_entity.items()}
    current={eid:pp for eid,pp in current.items() if pp}
    rows={}; parents={}; problems={}
    for eid,pp in current.items():
        pp.sort(key=lambda p:(p['display_start'],p['id']), reverse=True)
        p=pp[0]; entity=es[eid]
        parent, parent_rels, problem=choose_parent(eid,year,current) if entity['level']!='state' else (None,[],None)
        parents[eid]=parent
        if problem:problems[eid]=problem
        names=uniq(x['name'] for x in pp)
        qvals=set(x['qiao_status'] for x in pp)
        qstatus=next(iter(qvals)) if len(qvals)==1 else 'uncertain'
        qiao={'qiao':True,'non_qiao':False,'uncertain':None}[qstatus]
        context=[dict(kind=z['kind'],label=z.get('object_label'),entity_id=z.get('object_id'),status=z['status'],notes=clean(z['boundary_notes']),evidence_ids=z['evidence_ids']) for z in rels_by_entity[eid]
                 if z['kind'] in ('origin','hosted_at') and (active(z,year) or z.get('display_start') is None)]
        vids=uniq([v for x in pp for v in x['evidence_ids']]+[v for z in parent_rels for v in z['evidence_ids']])
        notes=uniq(clean(x.get('machine_date_choice') or x['display_note']) for x in pp)
        if parent_rels and any(z.get('machine_choice') for z in parent_rels):notes.extend(uniq(z['boundary_notes'] for z in parent_rels if z.get('machine_choice')))
        open_ids=uniq(entity_issues[eid]+[i for x in pp for i in x.get('issue_ids',[]) if i in issue_lookup])
        uncertain=bool(open_ids or problem or len(names)>1 or qiao is None or any(x['start_boundary']['qualifier']!='exact' or x['end_boundary']['qualifier']!='exact' or x.get('machine_date_choice') for x in pp))
        row=dict(id=eid,entity_id=eid,name=p['name'] if len(names)==1 else entity['base_name'],level=entity['level'],
            phase_id=p['id'],phase_ids=[x['id'] for x in pp],qiao=qiao,qiao_status=qstatus,uncertain=uncertain,
            display_start_is_inferred=not p['start_boundary']['is_exact_event_year'],
            notes=notes,evidence_ids=vids,issue_ids=open_ids,machine_decision_ids=uniq(by_issue[i]['id'] for i in open_ids if i in by_issue),
            parent_id=parent,candidate_parent_ids=uniq(z.get('object_id') for z in parent_rels),
            selected_parent_basis='；'.join(uniq(clean(z['boundary_notes']) for z in parent_rels)),
            periods=[dict(start=x['display_start'],end=x['display_end'],raw=x['period_raw'],start_note=clean(x.get('machine_date_choice') or x['start_boundary']['reason']),end_note=clean(x['end_boundary']['reason'])) for x in pp],
            context=context,seat=p.get('seat'),control_status=p.get('control_status','unknown'),territorial_status=p.get('territorial_status','uncertain'),
            qiao_annotation=dict(evidence_ids=uniq(v for x in pp for v in x.get('qiao_evidence_ids',[])),marker_ids=uniq(v for x in pp for v in x.get('marker_ids',[])),rule='侨州、侨郡、侨县各按本级证据标记，不向上下级继承。'),
            suspended=False,main_display=True,map_eligible=qiao is False)
        if len(names)>1:row['name_alternatives']=names
        if entity['level']=='state':row.update(prefectures=[],direct_counties=[])
        elif entity['level']=='prefecture':row['counties']=[]
        if problem:row['unassigned_reason']=problem
        rows[eid]=row
        source_ids.update(vids)
        source_ids.update(v for c in context for v in c['evidence_ids'])
        source_ids.update(row['qiao_annotation']['evidence_ids'])
        if parent:
            parent_observations[eid][(parent,row['selected_parent_basis'])].append(year)
    def main(eid, seen=None):
        seen=set() if seen is None else seen
        if eid in seen or eid in problems:return False
        seen.add(eid)
        par=parents[eid]
        return main(par,seen) if par in rows else rows[eid]['level']=='state'
    for eid,row in rows.items():
        row['main_display']=main(eid)
        row['suspended']=not row['main_display']
        row['map_eligible']=row['main_display'] and row['qiao'] is False
        if not row['main_display'] and eid not in problems:row['unassigned_reason']='ancestor_parent_unresolved'
    states=[];unassigned=[]
    for eid,row in sorted(rows.items(),key=lambda x:es[x[0]].get('order',10**9)):
        par=rows.get(parents[eid]);lev=row['level']
        if lev=='state':states.append(row)
        elif par and eid not in problems:
            if lev=='prefecture' and par['level']=='state':par['prefectures'].append(row)
            elif lev=='county' and par['level']=='prefecture':par['counties'].append(row)
            elif lev=='county' and par['level']=='state':par['direct_counties'].append(row)
            else:row['main_display']=False;row['suspended']=True;row['map_eligible']=False;row['unassigned_reason']='wrong_parent_level';unassigned.append(row)
        else:unassigned.append(row)
    counts={}
    for lev in levels:
        rr=[x for x in rows.values() if x['level']==lev];shown=[x for x in rr if x['main_display']]
        counts[lev]=dict(unique_total=len(rr),displayed_total=len(shown),qiao=sum(x['qiao'] is True for x in shown),non_qiao=sum(x['qiao'] is False for x in shown),
                        qiao_uncertain=sum(x['qiao'] is None for x in shown),unassigned=len(rr)-len(shown),date_or_identity_uncertain=sum(x['uncertain'] for x in shown))
    short=copy.deepcopy([x for x in r.get('intra_year_records',[]) if x['year']==year])
    events=[{k:x[k] for k in ['id','entity_ids','kind','display_label','date','evidence_ids']} for x in r['events'] if x['display_year']==year and x['kind']!='display_boundary_only']
    for x in short+events:source_ids.update(x.get('evidence_ids',[]))
    notes=['本轮采用最早有据候选与最可能行政归属；带“推定”者为网页展示判断，未经人工定稿。',
           '侨州、侨郡、侨县分别以本级下划线标示；原属、寄治与行政隶属分列。',
           '归属不明及未定年项目收在待考区，不计正文数量；原始Work问题保留，不因暂用而标成历史定论。']
    if year==420:notes.append('420为晋宋交替边界，宋初名录仅作本轮晚期观察依据；宋代新建及明确改属不倒填东晋全年。')
    out=dict(year=year,status='first_construction_machine_adopted',date_rule='括号纪年为基础，候选取最早有据且无排斥者；明确变更取当年变更后结果。',
             states=states,unassigned=unassigned,undated_refs=undatedrefs,counts=counts,notes=notes,intra_year_records=short,events=events)
    annual[str(year)]=out
    index.append(dict(year=year,path=f'annual/{year}.json',counts=counts))
    all_rows[year]=rows

# Fill actual annual parent choices, not merely proposed relations.
for d in decisions:
    placements=[]
    for eid in d['subject_ids']:
        for (par,basis),years in parent_observations[eid].items():
            for start,end in ranges(years):placements.append(dict(entity_id=eid,name=es[eid]['base_name'],parent_id=par,parent_name=es[par]['base_name'],start=start,end=end,basis=basis))
    d['adopted_parentages']=placements
    d['displayed_years']= {eid:ranges(y for y,rows in all_rows.items() if eid in rows and rows[eid]['main_display']) for eid in d['subject_ids']}
    d['suspended_years']= {eid:ranges(y for y,rows in all_rows.items() if eid in rows and not rows[eid]['main_display']) for eid in d['subject_ids']}
    if d['kind']=='parentage':
        susp=any(d['suspended_years'].values())
        if not placements:d.update(status='suspended',confidence='低',decision='暂无足够依据选唯一行政父级；暂收待考区，不入正文州郡关系及地图。')
        elif susp:d['status']='partial'
        else:d['status']='adopted'
    # Make the result plain in the printed entry, even for group questions.
    details=[]
    for eid in d['subject_ids']:
        present=d['displayed_years'][eid];suspended=d['suspended_years'][eid]
        text=es[eid]['base_name']+'：正文 '+period_words(present)
        if suspended:text+='；归属待考 '+period_words(suspended)
        details.append(text)
    d['display_summary']='。'.join(details) or '全局来源或文本限制，不直接新增年度行。'

# Keep all 102 original structural groups, including unchanged/deferred ones.
structural=[]
original_structural=json.loads((SRC/'annual-structural-issues.json').read_text())['rows']
reason_labels={'parent_not_present':'候选父级本年未出现','parent_unresolved':'未有行政父级候选','multiple_parents':'本年存在多个行政父级候选','name_conflict':'名称有竞争解释'}
for n,x in enumerate(original_structural,1):
    eid=x['entity_id'];shown=[];left=[];placements=[]
    for y in x['years']:
        row=all_rows[y].get(eid)
        if row and row['main_display']:shown.append(y)
        else:left.append(y)
    for (par,basis),years in parent_observations[eid].items():
        relevant=set(years)&set(x['years'])
        for start,end in ranges(relevant):placements.append(dict(entity_id=eid,parent_id=par,parent_name=es[par]['base_name'],start=start,end=end,basis=basis))
    vids=uniq(x['evidence_ids']+[v for z in parent_choices if z['subject_id']==eid for v in z['evidence_ids']])
    why='；'.join(uniq(z['basis'] for z in placements)) or '未发现足够明确的同年行政父级；不把寄治地、原籍或宋后州属提升为东晋行政关系。'
    for lim in limits_by_entity[eid]:why+='；'+lim['raw_quote']+'：'+lim['reason'];vids+=lim['evidence_ids']
    structural.append(dict(id=f'ejms_{n:03d}',entity_id=eid,name=es[eid]['base_name'],level=es[eid]['level'],level_label=levels[es[eid]['level']],
        kind=x['kind'],kind_label=reason_labels.get(x['kind'],x['kind']),years=x['years'],
        original_candidates=[dict(id=v,name=es.get(v,{}).get('base_name',v)) for v in x['candidate_parent_ids']],
        status='adopted' if shown and not left else 'partial' if shown else 'suspended',
        decision=f'正文采用 {period_words(ranges(shown))}；待考区保留 {period_words(ranges(left))}。',reason=why,
        confidence='中' if shown else '低',adopted_parentages=placements,evidence=[evidence(v) for v in uniq(vids) if v in evs],
        manual_review='核查本年父级是否实际存在；若仅兼督、寄治或宋代追述，仍不得补造州郡。',historical_final=False))

rules=[
 '原Work成果只读保留；机器判断另存，不把open原问题自动改为resolved。',
 '候选起年取最早有据、且不与同一实体明确得失或转属冲突者；“后”取所列年展示但不写成确置。',
 '只有晚期418或420名录者保留晚期锚；泛称江左、东晋的317—420搜索包络不当作317始置证据。',
 '归属优先使用明确行政属隶，其次同实体已确认前后及可靠阶段；原籍、寄治、兼督不自动作为父级。',
 '未能选择唯一父级或无足够时段者暂搁置，仍可查原文及侨置标记；不纳入正文确定数量或地图。',
 '侨州、侨郡、侨县性质独立；所有来源标记和阶段qiao保留，不能因上级实州而删侨县。',
 '本轮不增加国主、爵期、支郡制度或封国面，郡/国名称照来源。',
]
meta=dict(created='2026-10-11',status='machine_adjudication_for_human_review',open_issue_count=len(issues),
          structural_group_count=len(structural),research_sha256=hashlib.sha256(raw).hexdigest(),source_digest=hashlib.sha256(raw).hexdigest(),rules=rules,
          counts=dict(Counter(d['status'] for d in decisions)),kind_counts=dict(Counter(d['kind'] for d in decisions)),
          structural_counts=dict(Counter(d['status'] for d in structural)),phase_changes=phase_changes,
          added_parent_choices=len(parent_choices),historical_final=False)
report=dict(meta=meta,decisions=decisions,structural_decisions=structural)
(OUT/'machine-decisions.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
with (OUT/'machine-decisions.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f,lineterminator='\n');w.writerow(['编号','原问题编号','类型','条目','原问题','机器判断','采用年份与正文状态','理由','置信度','人工核对提示','历史定论'])
    for d in decisions:w.writerow([d['id'],d['issue_id'],d['kind_label'],d['label'],d['original_question'],d['decision'],d['display_summary'],d['reason'],d['confidence'],d['manual_review'],'否，展示暂用'])

for year,out in annual.items():
    (OUT/f'annual/{year}.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
(OUT/'index.json').write_text(json.dumps(dict(meta=meta,year_start=317,year_end=420,years=index),ensure_ascii=False,indent=2)+'\n')
(OUT/'parent-choices.json').write_text(json.dumps(parent_choices,ensure_ascii=False,indent=2)+'\n')

# Necessary data checks: one record per entity per year, every cited source exists,
# qiao at all three levels, unassigned must not be mapped, and every issue recorded.
checks=[]
assert len(issues)==445 and len(decisions)==445 and len(structural)==102
assert len(annual)==104
for year,rows in all_rows.items():
    visited=[]
    def walk(nodes):
        for row in nodes:
            visited.append(row['entity_id'])
            assert 'qiao' in row and row['qiao'] in (True,False,None)
            assert not (row['suspended'] and row['map_eligible'])
            walk(row.get('prefectures',[]));walk(row.get('counties',[]));walk(row.get('direct_counties',[]))
    walk(annual[str(year)]['states']);walk(annual[str(year)]['unassigned'])
    assert len(visited)==len(set(visited))==len(rows),(year,'duplicates or missing nodes')
for u in undatedrefs:source_ids.update(u['evidence_ids'])
for d in decisions:
    source_ids.update(e['id'] for e in d['evidence'])
assert not [v for v in source_ids if v not in evs], 'broken evidence refs'
# The original research payload is never written by this generator.
assert (SRC/'research.json').read_bytes()==raw

browser_meta=dict(years=list(range(317,421)),year_start=317,year_end=420,title='东晋第一轮建设',
  version='2026-10-11',rules=rules,judgment_report_url='reports/eastern-jin-machine-decisions-20261011.html',
  judgments_csv_url='data/eastern-jin-display/machine-decisions.csv',
  review_summary=f'已逐项判断445项开放问题；另保留102组年度归属附表。采用{meta["counts"].get("adopted",0)}项，部分采用{meta["counts"].get("partial",0)}项，保留注释{meta["counts"].get("retained_with_note",0)}项，暂搁置{meta["counts"].get("suspended",0)}项。')
compact_decisions={d['id']:{k:d[k] for k in ['id','issue_id','label','status','decision','reason','confidence','manual_review','display_summary']} for d in decisions}
browser=dict(meta=browser_meta,annual=annual,sources={vid:evidence(vid,650) for vid in sorted(source_ids)},decisions=compact_decisions)
# A structural content pool avoids repeating 104 almost identical annual trees.
# Negative integer references denote pooled objects/arrays; primitives stay literal.
pool=[];lookup={}
def pack(value):
    if isinstance(value,dict):
        packed={k:pack(v) for k,v in value.items()}
    elif isinstance(value,list):packed=[pack(v) for v in value]
    else:return value
    key=json.dumps(packed,ensure_ascii=False,separators=(',',':'),sort_keys=isinstance(packed,dict))
    if key not in lookup:
        lookup[key]=len(pool);pool.append(packed)
    return -(lookup[key]+1)
ref=pack(browser)
js='/* Eastern Jin first construction. Generated; edit scripts/build-eastern-jin-display.py. */\n'
js+='window.EASTERN_JIN_DATA=(()=>{const p='+json.dumps(pool,ensure_ascii=False,separators=(',',':'))+';const memo=[];function read(v){if(typeof v!=="number"||v>=0)return v;const i=-v-1;if(memo[i])return memo[i];const a=p[i];const out=Array.isArray(a)?[]:{};memo[i]=out;if(Array.isArray(a))a.forEach(x=>out.push(read(x)));else for(const k in a)out[k]=read(a[k]);return out;}return read('+str(ref)+');})();\n'
(ROOT/'data/eastern-jin-data.js').write_text(js)
check_report=dict(status='passed',years=104,open_issues_accounted=445,structural_groups_accounted=102,
   immutable_research=True,unique_entity_per_year=True,qiao_fields_preserved=True,source_references_valid=True,
   browser_bytes=len(js.encode()),pooled_nodes=len(pool),undated_entities=len(undatedrefs),
   sampled_counts={str(y):annual[str(y)]['counts'] for y in [317,382,418,420]},
   scope='仅生成器与数据接入必要检查；未进行全面历史复核或反复网页审核。')
(OUT/'validation.json').write_text(json.dumps(check_report,ensure_ascii=False,indent=2)+'\n')
import subprocess, sys
subprocess.run([sys.executable, str(ROOT/'scripts/render-eastern-jin-review.py')], check=True)
print(json.dumps(dict(decision_counts=meta['counts'],structural_counts=meta['structural_counts'],phase_changes=phase_changes,
                     added_parent_choices=len(parent_choices),browser_bytes=check_report['browser_bytes'],undated_entities=len(undatedrefs)),ensure_ascii=False,indent=2))
