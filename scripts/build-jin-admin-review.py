#!/usr/bin/env python3
"""Replay the approved 2026-10-04 text review without rewriting the source table.

County transfers display their post-change affiliation in the source event year;
the destination's annual note records the old state and commandery.
Unknown dates are bounded by source text and 281/304 observations, never promoted
to known event dates. IDs are scoped by parent because two old county IDs repeat.
"""
from pathlib import Path
import copy
import collections
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
YEARS = range(266, 317)
source_path = ROOT / 'data/jin-data.js'
raw = json.loads(source_path.read_text().split('=', 1)[1].strip().rstrip(';'))
data = copy.deepcopy(raw)
entities, original, parents, states, byid = {}, {}, {}, {}, collections.defaultdict(list)
for st in data['states']:
    entities[st['id']] = st
    states[st['id']] = st['id']
    byid[st['id']].append(st['id'])
    for p in st['prefectures']:
        entities[p['id']] = p
        parents[p['id']] = st['id']
        states[p['id']] = st['id']
        byid[p['id']].append(p['id'])
        for c in p['counties']:
            key = p['id'] + '/' + c['id']
            entities[key] = c
            parents[key] = p['id']
            states[key] = st['id']
            byid[c['id']].append(key)
original = copy.deepcopy(entities)

def key(ref):
    if ref in entities:
        return ref
    assert len(byid[ref]) == 1, (ref, byid[ref])
    return byid[ref][0]

def phase_at(e, y):
    matches = [p for p in e.get('phases', []) if p['start'] <= y <= p['end']]
    return copy.deepcopy(sorted(matches, key=lambda p: -p['start'])[0]) if matches else None

annual = {k: {y: p for y in YEARS if (p := phase_at(e, y))} for k, e in entities.items()}
ledger, notes = [], collections.defaultdict(dict)

def source(ref):
    e = original[key(ref)]
    return copy.deepcopy(e.get('source', {}))

def note(ref, years, text, refs=None):
    k = key(ref)
    sources = [source(x) for x in (refs or [ref])]
    for y in years:
        if not 266 <= y <= 316:
            continue
        old = notes[k].get(str(y))
        if old:
            if text not in old['summary']:
                old['summary'] += '；' + text
        else:
            notes[k][str(y)] = {'summary': text, 'sources': sources}

def log(kind, refs, reason, **kwargs):
    record = {'id': f'JR{len(ledger)+1:04}', 'kind': kind,
              'entity_keys': [key(r) for r in refs], 'reason': reason,
              'source_pages': sorted({source(r).get('book_page') for r in refs if source(r).get('book_page')})}
    record.update(kwargs)
    ledger.append(record)
    return record

def sample(ref, year=None):
    k = key(ref)
    if year in annual[k]:
        return copy.deepcopy(annual[k][year])
    candidates = list(annual[k])
    assert candidates, k
    nearest = min(candidates, key=lambda y: abs(y - (year or candidates[0])))
    return copy.deepcopy(annual[k][nearest])

def include(ref, start, end, template_year=None, **flags):
    k = key(ref)
    p = sample(k, template_year if template_year is not None else start)
    p.update(flags)
    for y in range(max(266, start), min(316, end) + 1):
        annual[k][y] = copy.deepcopy(p)

def exclude(ref, start, end):
    k = key(ref)
    for y in range(max(266, start), min(316, end) + 1):
        annual[k].pop(y, None)

def bounded_join(old, new, first_new, old_stop, new_original_start, reason, bounds):
    # first_new is an observed/inferred display boundary, not the event year.
    exclude(old, first_new, old_stop)
    if first_new < new_original_start:
        include(new, first_new, new_original_start - 1, new_original_start,
                uncertain=True, review_dating='bounded_observation')
    elif first_new > new_original_start:
        exclude(new, new_original_start, first_new - 1)
    log('bounded_affiliation', [old, new], reason, event_year=None,
        event_bounds=bounds, first_destination_display_year=first_new)
    text = reason + '；此為有界年度列示，並非考定該年轉屬。'
    note(old, [first_new - 1], text, [old, new])
    note(new, [first_new], text, [old, new])

# The eight spellings explicitly approved by the user. Geography homonyms are
# scoped to reviewed entities, never changed by a global character replacement.
spellings = {'c1022':'睢陵', 'c1230':'下雋', 'c1300':'下雋', 'c1549':'下雋',
             'c1183':'汎陽', 'c1043':'郯', 'c1500':'陽羨'}
for k,e in entities.items():
    if '/' in k and e['base_name'] == '荏平':
        spellings[k] = '茌平'
for ref, name in spellings.items():
    k=key(ref); before=entities[k]['base_name']; entities[k]['base_name']=name
    for p in annual[k].values():
        p['name']=name
    log('approved_spelling', [k], '使用者2026-10-04指定統一用字', before=before, after=name)
    note(k, annual[k], f'本輪依使用者裁定統一作「{name}」，原底表作「{before}」。')
# These were already correct; protect them against replacement by faulty OCR.
for k,e in entities.items():
    if '/' in k and e['base_name'] in ('全椒','麊冷'):
        log('retain_reviewed_spelling', [k], '保留使用者指定全椒／麊冷，不按OCR全淑／麓冷倒改', after=e['base_name'])

# User requested annotations, rather than silently renaming these three groups.
for ref, correct in [('c0697','什邡'),('c0701','什邡'),('c0949','新沓'),('c0981','黔陬')]:
    k=key(ref)
    text=f'原表顯示「{entities[k]["base_name"]}」；本書縱向注釋及281年橫表作「{correct}」。本輪先補此校勘說明，名稱保留待定。'
    note(k,annual[k],text)
    log('annotation_only_spelling',[k],text, proposed_name=correct)

# Same-level state changes follow the source year. Resolve the sole whole-
# commandery overlap caused by both sides using the same "307後" endpoint.
for pid in ['p214','p215','p216']:
    exclude(pid,307,307)
    for c in entities[pid]['counties']:
        exclude(pid+'/'+c['id'],307,307)
    note(pid,[308],'本書作307年後移屬湘州，確年未詳；307年仍於原州列示，自308年在不確定標記下銜接。')
    log('bounded_whole_prefecture_state_change',[pid],'307後不能同年在廣州與湘州重複列郡',event_year=None,event_bounds=[308,316],first_destination_display_year=308)

# 281 is an observed cross-section, not an invented founding year. Extend only
# to the independently observed year; earlier years remain uncertain/unexpanded.
observed_counties = ['c0112','c0436','c0439','c0440','c0460','c0486','c0491','c0496','c0497','c0499',
 'c0505','c0551','c0589','c0614','c0623','c0624','c0785','c0792','c0798','c0870','c0879',
 'c0886','c0887','c0888','c0898','c0907','c0908','c0909','c1120','c1166','c1199','c1216','c1222','c1475','c1799']
for ref in observed_counties:
    k=key(ref)
    later=min(y for y in annual[k] if y>=281)
    if later>281:
        include(k,281,later-1,later,uncertain=True,review_dating='observed_by_281')
        text='281年橫表已列本縣，據此補足281年起的可見斷面；原書始年帶「前」，確切置年仍未詳，不把281年稱為始置年。'
        note(k,range(281,later+1),text)
        log('281_presence_bound',[k],text,event_year=None,observed_by=281,original_numeric_start=later)
include('p052',281,281,282,uncertain=True,review_dating='observed_by_281')
for old,new in [('c0401','c0404'),('c0402','c0405'),('c0403','c0406')]:
    bounded_join(old,new,281,282,282,'281年橫表廣寧郡列下洛、潘、涿鹿，上谷只列二縣；以此約束「282年前」分郡', [266,281])
note('p052',[281],'281年橫表已見廣寧郡，原書作282年前置，確切置年未詳。')
log('281_prefecture_presence_bound',['p052'],'281橫表已列廣寧；不把282前當作282始置',event_year=None,observed_by=281)

for old,new,stop,old_new_start in [('c0115','c0078',282,282),('c0136','c0151',282,282),
 ('c0259','c0235',282,282),('c0950','c0973',283,283),('c1153','c1165',283,283),
 ('c1154','c1167',282,282),('c1155','c1168',283,283),('c0711','c0722',283,283),
 ('c0723','c0712',282,282)]:
    bounded_join(old,new,281,stop,old_new_start,'281年橫表已列新屬；以横表約束原文「前」字，保留確年未詳',[266,281])
for ref,end in [('c0128',280),('c1156',280)]:
    old_end=max(annual[key(ref)])
    exclude(ref,end+1,old_end)
    log('281_absence_bound',[ref],'281橫表不列，縱向條目亦言太康初年前省；只收緊最遲可見界，不確定省年',event_year=None,last_display_year=end)
    note(ref,[end],'281年橫表已不列，縱向文字作太康初年前省；最後列示年不等同考定廢年。')
exclude('c0095',281,282)
log('281_temporary_absence_bound',['c0095'],'發乾於282年前暫廢、283復置，281橫表不列，補出281—282觀察缺段',event_year=None)
include('c0959',281,281,280,uncertain=True,review_dating='observed_in_281')
log('281_presence_bound',['c0959'],'於陵縱向作280後省，281横表仍列，不在280即截斷',event_year=None,observed_in=281)
note('c0959',[281],'281年橫表仍見於陵；原文「280年後省」不表示280年即已省。具體省年未詳。')

# Repair Xiu-wu's unbounded '?' using its explicitly attested new affiliation.
exclude('c0072',280,316)
exclude('c0062',266,279)
include('c0062',280,280,280,uncertain=True,review_dating='attested_by_280')
log('unknown_end_bounded',['c0072','c0062'],'汲郡正文明言太康元年修武已移屬；河内？不能无限延续',event_year=None,event_bounds=[267,280],first_destination_display_year=280)
note('c0072',[279],'修武轉屬確年未詳，惟太康元年（280）已見屬汲郡；以此約束河內條目的不詳終年，不能無限續列。',['c0072','c0062'])
note('c0062',[280],'太康元年已見修武屬汲郡，是新屬的可證上限，並非確定轉屬恰發生於280年。',['c0072','c0062'])

# Two short returns need their source observations retained. The 280 Wei entry
# is an attestation, not a dated transfer; Wu-yi's return is only "after 290".
annual[key('c0115')][280]['review_dating']='attested_in_280'
note('c0115',[280],'太康元年已見廣平縣屬魏郡；這是當年所屬的見載，不能據此確定轉入魏郡恰在280年。')
for old,new in [('c0300','c0303'),('c0301','c0304'),('c0302','c0305')]:
    exclude(old,290,290)
    annual[key(old)][291]['review_dating']='after_290_return'
    note(new,[290],'289年轉入武邑國，該年即列武邑；惠帝時回屬長樂的確年未詳，原文作290年後，故本年仍列武邑，291年起暫接長樂。',[old,new])
    log('bounded_return_after_290',[new,old],'武邑、武遂、觀津之回屬作290後；避免相鄰兩次轉屬將武邑階段全部抹去',event_year=None,event_bounds=[291,304],first_destination_display_year=291)

# Unknown terminal dates remain explicitly bounded by the parent or the reviewed
# observation window. They are not silently turned into proof of continuous life.
for ref in ['c0034','c0035','c0224','c0466','c1099','c1100','c1101','c1102','p157','p158']:
    k=key(ref)
    parent=parents[k]
    bound=min(316,max(annual[parent]))
    exclude(k,bound+1,316)
    text=f'終年原作不詳；目前只在父級有效區間／本項觀察窗內暫列至{bound}年，並保留推定標記，不表示已考定逐年存續。'
    note(k,annual[k],text)
    log('unknown_end_observation_bound',[k],text,observational_upper_bound=bound,event_year=None)
note('c0030',[279],'終年原作279？；原文只證太康元年前已移屬河南尹。279為暫列的舊屬終界，不是考定279年轉屬。')
log('uncertain_endpoint_retained',['c0030'],'陸渾轉屬的原書279？與280年前限定保留，不另造精確事件年',event_year=None,observed_destination_by=280)
note('c1110',annual[key('c1110')],'原書始年作306？、正文僅推惠帝末年置，沿用本書推定數字展開306—316，並保留不確定；不能把306年稱為確切始置年。縱向原文作「灄陽」，底表「瀑陽」的字形差異另留校勘。')
log('uncertain_start_retained',['c1110'],'沿用原書306？推定始年及父郡觀察窗，惠帝末年之寬限不壓成新的確年',event_year=None,inferred_display_start=306,observational_upper_bound=316)

# Disjoint same-entity name phases. A source observation can constrain a name
# without establishing the exact renaming date.
for ref, first_new in [('c0158',281),('c0168',281),('p029',280),('p070',291),
                       ('c0679',283),('c1031',281),('c1242',291),('c1267',283),('c1425',281)]:
    k=key(ref); phases=original[k]['phases']
    if len(phases)<2: continue
    old,new=copy.deepcopy(phases[0]),copy.deepcopy(phases[1])
    for y in list(annual[k]):
        if y<first_new and y>=old['start']:
            annual[k][y]=copy.deepcopy(old)
        elif y>=first_new and y<=new['end']:
            annual[k][y]=copy.deepcopy(new)
    for y in annual[k]:
        annual[k][y]['uncertain']=True
    text=f'同一實體的名稱階段不重疊；按原文前後限定及281橫表，從{first_new}年列新名，確切改名年仍未詳。'
    if ref=='c1031':text='281年改北淩有原文明文；原「281年前—280」階段只保留可證的280年，281年起列北凌，不把起訖倒置的數字強行互換。'
    note(k,[first_new],text)
    log('name_phase_boundary',[k],text,event_year=281 if ref=='c1031' else None,first_new_name_display_year=first_new)

# A reviewed catalogue of physical county identities. Only these explicit
# lineages may participate in transfer resolution; globally equal names do not.
lineage_names = '''陸渾 新安 盧氏 商 上洛 汲 共 林慮 獲嘉 修武 廣平 頓丘 繁陽 陰安 衛 東阿 谷城 臨邑 範 長平 南頓 陳 項 陽夏 武平 苦 公丘 蕃 薛 安風 松滋 安豐 蓼 中丘 平鄉 下曲陽 鄡 武邑 武遂 觀津 廣川 上曲陽 雍奴 安樂 泉州 狐奴 下洛 潘 槐里 始平 武功 臨洮 狄道 河關 沙頭 廣至 冥安 宜禾 淵泉 伊吾 雒 新都 綿竹 什 南充國 宕渠 北井 漢昌 宣漢 谷昌 連然 秦臧 雙柏 俞元 滇池 建伶 比蘇 梁鄒 東朝陽 莒 東武 諸 壯武 淳於 高密 昌安 平昌 朱虛 營陵 姑幕 長廣 不其 挺 安丘 廣 劇 淮陵 司吾 下相 徐 堂邑 昌慮 蘭陵 承 戚 合鄉 蒙陰 東莞 臨 蓋 南新市 雲杜 竟陵 華容 監利 州陵 山都 鄧 蔡陽 棘陽 新野 隨 朝陽 平林 穰 下雋 巴陵 柴桑 尋陽 歷陽 烏江 永世 羅江 候官 彭澤 揭陽 贛 平固 南康 寧都 臨賀 盧容 象林 朱吾 西卷 比景 廣化 海安 莫陽 化平'''.split()
lineages=[]
for name in lineage_names:
    ks=[k for k,e in entities.items() if '/' in k and e['base_name']==name]
    if len({entities[parents[k]]['base_name'] for k in ks})>1:
        lineages.append({'name':name,'keys':ks})
for name,refs in [('平夷',['c0799','c0927','c0935']),('永寧',['c0802','c0870','c0941']),
 ('東安',['c1063','c1079','c1100']),('西平',['c1775','c1780']),
 ('雩都',['c1488','c1492','c1621']),('鮦陽',['c0214','c0223']),
 ('黔陬',['c0981','c1001']),('臨朐',['c1066','c1076','c1011']),
 ('陽羨',['c1380','c1500']),('邾',['c1287','c0273'])]:
    # Explicit alternatives include old OCR spellings, not different places.
    ks=[key(r) for r in refs]
    for existing in list(lineages):
        if set(ks)&set(existing['keys']):
            ks=list(dict.fromkeys(ks+existing['keys']));lineages.remove(existing)
    lineages.append({'name':name,'keys':ks})

def visible(k,y,maps=annual):
    return y in maps[k] and y in maps[parents[k]] and (y in maps[states[k]] or states[k]=='s01' and y>=312)

def physical_parent(k):
    return original[parents[k]]['base_name']

def affiliation(k,y):
    def label(ref):
        return annual[ref].get(y,{}).get('name') or entities[ref].get('base_name') or entities[ref].get('name')
    return label(states[k])+label(parents[k])

def transfer_metadata(origin,destination,year,certainty='dated_in_source'):
    return {'transfer_origin_id':parents[origin],'transfer_origin_state_id':states[origin],
            'transfer_destination_id':parents[destination],'transfer_destination_state_id':states[destination],
            'transfer_event_certainty':certainty,'transfer_source_year':year,
            'transfer_event_year':year if certainty=='dated_in_source' else None}

def qualifier(p, edge):
    text=p.get('period_label','')
    if edge=='start':
        m=re.match(r'\s*\d+([前後后？?]*)',text)
    else:
        m=re.search(r'[—-]\s*\d+([前後后？?]*)',text)
    return m.group(1) if m else ''

# Resolve overlaps only within declared identities. Use the preceding affiliation
# to identify the old record, then keep the attested new record in the event year.
duplicate_decisions=[]
inferred_numeric_transfers={(266,'p003/c0028'):[267,282],(266,'p023/c0210'):[266,275]}
for group in lineages:
    ks=group['keys']
    for y in YEARS:
        active=[k for k in ks if visible(k,y)]
        if len(active)<2: continue
        # A "before Y" phase is already attested by Y. Its numeric endpoint
        # is a bound, so the unknown event cannot be delayed as though it were
        # a known event happening in Y. This also preserves the 316 returns.
        bounded_new=[k for k in active if (p:=phase_at(original[k],y)) and p['start']==y and '前' in qualifier(p,'start')]
        if len(bounded_new)==1:
            keep=bounded_new[0]
            removed=[k for k in active if k!=keep]
            for k in removed:annual[k].pop(y,None)
            annual[keep][y]['review_dating']='attested_by_source_bound'
            text=f'原文作{y}年前已入本郡；以{y}年作新屬可證上限，原屬不再同年重列。實際轉屬年未詳，不把觀察上限當成確定轉屬年。'
            note(keep,[y],text,[keep]+removed)
            log('bounded_before_year_affiliation',[keep]+removed,text,event_year=None,observed_by=y,first_destination_display_year=y)
            continue
        previous=[k for k in active if visible(k,y-1)]
        if len(previous)==1:
            keep=previous[0]
        else:
            endings=[k for k in active if annual[k][y]['end']==y]
            if len(endings)==1: keep=endings[0]
            elif y==266:
                endings=[k for k in active if original[k]['period_text']=='266' or original[k]['period_text'].startswith('266，')]
                assert len(endings)==1,(group['name'],y,active)
                keep=endings[0]
            else:
                raise ValueError(('Unresolved lineage collision',group['name'],y,active))
        origin=keep
        destinations=[k for k in active if k!=keep]
        exact=all((p:=phase_at(original[k],y)) and p['start']==y and not qualifier(p,'start') for k in destinations)
        inferred=exact and (y,keep) in inferred_numeric_transfers
        text=(f'本年初屬{affiliation(origin,y-1)}；{y}年轉屬'+
              '、'.join(affiliation(k,y) for k in destinations)+'，本年列示改動後的新屬。') if exact else (
              '原文前／後限定未能確定轉屬年；本年保留原屬，後段從下一年度在不確定標記下銜接，不能據此稱本年為確切轉屬年。')
        if exact:
            assert len(destinations)==1
            keep=destinations[0]
        if inferred:
            bounds=inferred_numeric_transfers[(y,origin)]
            if bounds[0]>y:keep=origin
            text=f'原屬{affiliation(origin,y-1)}；本書數字期段在{y}年相接，但正文仍屬推定，轉屬確年未詳（見載約束{bounds[0]}—{bounds[1]}）。'
            text+=('本年仍在可證轉屬下限之前，暫留原屬，新屬從下一年度銜接。' if keep==origin else '本年按本書推定期段列新屬。')
            text+='此數字邊界不作確切轉屬年。'
            annual[keep][y]['uncertain']=True
        if exact:
            annual[keep][y].update(transfer_metadata(origin,destinations[0],y,'inferred_source_year' if inferred else 'dated_in_source'))
        removed=[k for k in active if k!=keep]
        for k in removed:annual[k].pop(y,None)
        note(keep,[y],text,[origin]+destinations)
        log('inferred_numeric_transfer' if inferred else 'same_year_transfer_overlap' if exact else 'bounded_overlap_resolution',[origin]+destinations,text,
            event_year=y if exact and not inferred else None,first_destination_display_year=y if keep!=origin else y+1,retained_key=keep)
        duplicate_decisions.append({'year':y,'name':group['name'],'kept':keep,'removed':removed,'event_year':y if exact and not inferred else None})

# Derive non-overlapping transitions only within reviewed physical lineages.
# Work from the post-anchor schedule; leave each event-year destination intact.
schedule=copy.deepcopy(annual)
events=[]
for group in lineages:
    ks=group['keys']
    for y in range(267,317):
        old=[k for k in ks if visible(k,y-1,schedule)]
        new=[k for k in ks if visible(k,y,schedule)]
        if len(old)!=1 or len(new)!=1 or old[0]==new[0] or physical_parent(old[0])==physical_parent(new[0]): continue
        a,b=old[0],new[0];op=schedule[a][y-1];np=schedule[b][y]
        # An overlap already resolved at this year has its own evidence record.
        if any(d['year']==y and d['event_year']==y and d['kept']==b for d in duplicate_decisions):continue
        # An uncertain overlap retained in the preceding year is not a new event.
        if any(d['year']==y-1 and d['kept']==a and b in d['removed'] for d in duplicate_decisions):continue
        original_new=phase_at(original[b],y)
        if np.get('review_dating') or qualifier(np,'start') or qualifier(op,'end') or original_new is None:
            text=f'{y}年按已有文字觀察界銜接新屬；原書限定或前段終年不確，並非認定轉屬恰在{y}年。'
            note(b,[y],text,[a,b])
            log('bounded_transition_retained',[a,b],text,event_year=None,first_destination_display_year=y)
            continue
        # A known transfer must start a source phase; late naming changes cannot
        # manufacture another transfer of the same physical county.
        if original_new['start']!=y: continue
        events.append((y,group,a,b))

for y,group,a,b in sorted(events,key=lambda x:(x[0],x[2])):
    annual[b][y].update(transfer_metadata(a,b,y))
    text=f'本年初屬{affiliation(a,y-1)}；{y}年轉屬{affiliation(b,y)}，本年列示改動後的新屬。'
    note(b,[y],text,[a,b])
    log('dated_county_transfer_result_year',[a,b],text,event_year=y,origin_last_display_year=y-1,destination_display_from=y)

# Every original audit candidate is explicitly accounted for, using scoped keys.
audit=json.loads((ROOT/'reports/jin-text-audit-20261004.json').read_text())
candidate_resolutions=[]
for candidate in audit['cross_parent_duplicate_candidates']:
    y=candidate['year'];ks=[r['prefecture_id']+'/'+r['county_id'] for r in candidate['rows']]
    active=[k for k in ks if visible(k,y)]
    matching=[g for g in lineages if set(ks)<=set(g['keys'])]
    assert matching,(candidate,'unreviewed original duplicate')
    assert len(active)<=1,(candidate,active)
    candidate_resolutions.append({'year':y,'name':candidate['name'],'entity_keys':ks,
        'retained_keys':active,'status':'reviewed_physical_transfer','lineage':matching[0]['name']})

def compress(k):
    out=[]
    for y in sorted(annual[k]):
        phase=copy.deepcopy(annual[k][y]);phase.pop('start',None);phase.pop('end',None)
        if out and out[-1]['end']==y-1 and {a:b for a,b in out[-1].items() if a not in ('start','end')}==phase:
            out[-1]['end']=y
        else:out.append({'start':y,'end':y,**phase})
    return out

overrides=[]
for k,e in entities.items():
    phases=compress(k)
    changed=phases!=original[k]['phases'] or e.get('base_name')!=original[k].get('base_name') or bool(notes[k])
    if not changed:continue
    patch={'key':k,'id':e['id'],'phases':phases}
    if '/' in k:patch['parent_id']=parents[k]
    if e.get('base_name')!=original[k].get('base_name'):patch['base_name']=e['base_name']
    if notes[k]:patch['year_notes']=notes[k]
    overrides.append(patch)
    e['phases']=phases
    if notes[k]:e['year_notes']=notes[k]

# Reject unexplained visible duplicates within each reviewed county lineage.
for group in lineages:
    for y in YEARS:
        active=[k for k in group['keys'] if visible(k,y)]
        assert len(active)<=1,(group['name'],y,active)

def current_name(ref,y):
    k=key(ref);p=annual[k].get(y)
    return (p or {}).get('name') or entities[k].get('base_name') or entities[k].get('name')

def effective_order(entity,phase,y):
    if phase.get('order') is not None:return phase['order']
    matches=[p for p in entity.get('order_overrides',[]) if p['start']<=y<=p['end']]
    return max(matches,key=lambda p:p['start'])['order'] if matches else entity.get('order',0)

export={}
for y in YEARS:
    rows=[]
    for st in data['states']:
        sid=st['id'];residual=sid=='s01' and 312<=y<=316 and y not in annual[sid]
        if y not in annual[sid] and not residual:continue
        for p in st['prefectures']:
            pid=p['id'];pp=annual[pid].get(y)
            if not pp:continue
            row={'id':pid,'name':current_name(pid,y),'base_name':p['base_name'],
                 'state_id':sid,'state_name':current_name(sid,y),'state_order':st.get('order',0),'order':effective_order(p,pp,y),
                 'source':{'book_page':p.get('source',{}).get('book_page')},
                 'uncertain':bool(pp.get('uncertain')),'is_fief':bool(pp.get('is_fief')),
                 'residual_state_grouping':residual,'transfer_origin_grouping':bool(pp.get('transfer_origin_grouping')),
                 'administrative_count':pp.get('administrative_count',True),'counties':[]}
            if pp.get('geometry_parent_id'):row['geometry_parent_id']=pp['geometry_parent_id']
            if str(y) in notes[pid]:row['year_note']=notes[pid][str(y)]['summary']
            for c in p['counties']:
                ck=pid+'/'+c['id'];cp=annual[ck].get(y)
                if not cp:continue
                row['counties'].append({'id':c['id'],'entity_key':ck,'name':cp.get('name',c['base_name']),
                     'base_name':c['base_name'],'prefecture_id':pid,'state_id':sid,
                     'order':effective_order(c,cp,y),'source':{'book_page':c.get('source',{}).get('book_page')},
                     'uncertain':bool(cp.get('uncertain')),
                     **{field:cp[field] for field in ('transfer_origin_id','transfer_origin_state_id','transfer_destination_state_id') if field in cp},
                     'transfer_destination_id':cp.get('transfer_destination_id'),
                     'transfer_event_certainty':cp.get('transfer_event_certainty'),
                     'transfer_source_year':cp.get('transfer_source_year'),
                     'transfer_event_year':cp.get('transfer_event_year'),
                     'year_note':notes[ck].get(str(y),{}).get('summary')})
            row['counties'].sort(key=lambda c:c['order'])
            if row['transfer_origin_grouping']:
                targets=sorted({c['transfer_destination_id'] for c in row['counties'] if c.get('transfer_destination_id')})
                row['geometry_parent_ids']=targets
                row['geometry_parent_id']=targets[0] if len(targets)==1 else None
            rows.append(row)
    rows.sort(key=lambda r:(r['state_order'],r['order']))
    export[str(y)]=rows

result={'schema_version':'1.1.0','reviewed_at':'2026-10-04',
 'source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
 'policy':{'date_basis':'通史现成年份；当年列示改动后州郡县归属，在新属处注明年初旧州旧郡；不创造不详事件年',
           'unknown_dates':'观察锚点只约束显示，不创造确切始置或转属年',
           '304_baseline':'保留原人工基准作为改前对照；本轮仅落实用户指定修订',
           'scope_key':'prefecture_id/county_id, because old source IDs can repeat'},
 'overrides':overrides,'ledger':ledger,'lineages':lineages,'candidate_resolutions':candidate_resolutions}
(ROOT/'data/jin-admin-review.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
# The browser only needs patches and policy; full evidence ledger is kept in JSON.
browser={k:result[k] for k in ['schema_version','reviewed_at','source_sha256','policy','overrides']}
(ROOT/'data/jin-admin-review.js').write_text('window.JIN_ADMIN_REVIEW_DATA = '+json.dumps(browser,ensure_ascii=False,separators=(',',':'))+';\n')
annual_out={'meta':{'schema_version':'1.1.0','reviewed_at':'2026-10-04','source_sha256':result['source_sha256'],
 'policy':result['policy'],'years':[266,316]},'years':export}
(ROOT/'data/jin-reviewed-annual-rows.json').write_text(json.dumps(annual_out,ensure_ascii=False,separators=(',',':'))+'\n')
summary={'overrides':len(overrides),'ledger_entries':len(ledger),'reviewed_lineages':len(lineages),
 'original_duplicate_candidates_resolved':len(candidate_resolutions),
 'dated_county_transfer_events':sum(r['kind'] in ('dated_county_transfer_result_year','same_year_transfer_overlap') for r in ledger),
 'nonoverlap_county_transfer_events':len(events),
 'snapshots':{y:{'prefectures':sum(r['administrative_count'] is not False for r in export[str(y)]),
                 'transfer_origin_groups':sum(r['transfer_origin_grouping'] for r in export[str(y)]),
                 'counties':sum(len(r['counties']) for r in export[str(y)])} for y in [266,281,304,312,316]}}
baseline=json.loads((ROOT/'reports/jin-304-reviewed-baseline-20261004.json').read_text())
before304={r['id']+'/'+c['id']:{'name':c['name'],'prefecture_id':r['id'],'state_id':s['id']}
           for s in baseline['states'] for r in s['rows'] for c in r['counties']}
after304={r['id']+'/'+c['id']:{'name':c['name'],'prefecture_id':r['id'],'state_id':r['state_id']}
          for r in export['304'] for c in r['counties']}
summary['changes_from_original_304']={
 'removed_scoped_records':[{'key':k,**before304[k]} for k in sorted(before304.keys()-after304.keys())],
 'added_scoped_records':[{'key':k,**after304[k]} for k in sorted(after304.keys()-before304.keys())],
 'renamed_scoped_records':[{'key':k,'before':before304[k]['name'],'after':after304[k]['name']} for k in sorted(before304.keys()&after304.keys()) if before304[k]['name']!=after304[k]['name']],
 'note':'轉屬當年列示新屬；原304人工基準保留為改前對照，實體去重與字形修訂分別記錄。'}
(ROOT/'reports/jin-admin-review-applied-20261004.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
