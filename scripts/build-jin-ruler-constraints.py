#!/usr/bin/env python3
"""Separate possible succession bounds from years that identify a living ruler.

The original imported genealogies remain unchanged. Broad eras and succession
order constrain possibilities; they are never expanded into certain reigns.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_js(name):
    return json.loads((ROOT / name).read_text().split(' = ', 1)[1].rstrip(';\n'))


def endpoint(raw, value):
    if not raw or '?' in raw or '？' in raw:
        return [None, None]
    years = [int(x) for x in re.findall(r'(?<!\d)(\d{3,4})(?!\d)', raw)]
    if '年代' in raw and years:
        return [years[0], years[0] + 9]
    if '或' in raw and years:
        return [min(years), max(years)]
    if years:
        return [years[0], years[0]]
    return [value, value] if value is not None else [None, None]


def bounds(period, raw, note=''):
    text = re.sub(r'[―–－−]', '—', raw or '').replace('-', '—')
    if '—' in text:
        left, right = text.split('—', 1)
        begin, end = endpoint(left, period.get('start')), endpoint(right, period.get('end'))
    elif '年代' in text:
        # An observation somewhere in a decade is not a ten-year reign.
        begin = endpoint(text, None)
        end = list(begin)
        begin[1], end[0] = None, None
    elif text.strip() in ('', '?', '?年', '？'):
        begin, end = [None, None], [None, None]
    else:
        begin, end = endpoint(text, period.get('start')), endpoint(text, period.get('end'))
    # A displayed approximate number is a candidate bound, not an exact date.
    if '—' in text:
        left, right = text.split('—', 1)
        if ('?' in left or '？' in left) and period.get('start') is not None:
            begin[0] = period['start']
        if ('?' in right or '？' in right) and period.get('end') is not None:
            end[1] = period['end']
    posthumous = bool(re.search(r'追封|追贈|追赠', text))
    return {'start_min': begin[0], 'start_max': begin[1],
            'end_min': end[0], 'end_max': end[1],
            'accession_known': begin[0] is not None and begin[0] == begin[1],
            'posthumous': posthumous,
            'note': '保留原表明确有限期段；问号、年代与世系次序仅约束可能范围，不补成连续在位。'}


def constrain_succession(items, inherit_after_predecessor=False):
    """Monotonic lower/upper bounds only, never dated attestations."""
    for index, (_, c) in enumerate(items):
        if c['start_min'] is None:
            previous = [x for _, x in items[:index]]
            lower = [x['end_min'] + 1 if inherit_after_predecessor and x['end_min'] is not None else x['start_min']
                     for x in previous]
            lower = [x for x in lower if x is not None]
            if lower:
                c['start_min'] = max(lower)
                c.setdefault('derived', []).append('依2026-10-07使用者規則，起年不詳者暫自前任已知卒年下一年約束；此為展示排年，不是確切即位年。' if inherit_after_predecessor else '前列表項起年只作最早可能年約束，非繼位確年。')
        if c['end_max'] is None:
            following = [x['start_max'] for _, x in items[index + 1:] if x['start_max'] is not None]
            if following:
                c['end_max'] = min(following)
                c.setdefault('derived', []).append('后列表项起年只作最晚可能年约束，非终年确证。')


def finish(c):
    # A death/transfer inside a decade narrows that accession decade. Example:
    # '300s—303' permits 300—303, not an impossible accession as late as 309.
    if c['start_max'] is not None and c['end_max'] is not None:
        c['start_max'] = min(c['start_max'], c['end_max'])
    if c['end_min'] is not None and c['start_min'] is not None:
        c['end_min'] = max(c['end_min'], c['start_min'])
    if 'certain_periods' not in c:
        # A known endpoint attests the holder in that event year only. It does
        # not license continuation through the unknown half of an interval.
        lo, hi = c['start_max'], c['end_min']
        if lo is None:
            lo = hi
        if hi is None:
            hi = lo
        c['certain_periods'] = [[lo, hi]] if lo is not None and hi is not None and lo <= hi else []
    if c['posthumous'] or c.get('identity_unknown'):
        c['certain_periods'] = []
    c['display_start'] = c['start_min'] if c['accession_known'] else None
    return c


princes = read_js('data/princes.js')['records']
fiefs = read_js('data/five-rank-fiefs.js')['records']
pc = {r['id']: bounds(r, r['time_text'], r.get('note', '')) for r in princes}


def patch(key, note, **kwargs):
    pc[key].update(kwargs)
    pc[key]['note'] = note


# All uncertain prince entries are reviewed here or handled by the generic
# finite/unknown endpoint rule. No date below is an invented accession year.
patch('w0005', '安平邃之只见东晋太元十一年（386）卒；不得跨越百年空档接到281年后。',
      start_min=317, start_max=386, accession_known=False, dynasty='eastern_jin')
patch('w0010', '原注为永宁元年以后复封，不是301年确封；未有可定位在年身份。',
      start_min=301, start_max=None, accession_known=False, certain_periods=[])
patch('w0016', '承章武滔之后，327随苏峻、328被杀；不将未知嗣年倒移到西晋。',
      start_min=314, start_max=327, accession_known=False, certain_periods=[[327, 328]])
patch('w0025', '约291改中丘是约数；仅285的原表起点确定，不能以291为确切终年。',
      end_min=None, end_max=293, certain_periods=[[285, 285]])
patch('w0026', '中丘起年约291；同人293卒为上界，不能计算291起的年次。',
      start_min=285, start_max=293, accession_known=False, certain_periods=[[293, 293]])
patch('w0033', '311被俘仅原表疑说，不能用作已证任王见证；封年无考。',
      start_min=265, start_max=None, end_min=None, end_max=311, certain_periods=[])
patch('w0038', '建兴间（313—316）袭乐成；窗口末316以后可确认人名，但不能伪造元年。',
      start_min=313, start_max=316, accession_known=False)
patch('w0057', '父邵之390起；本人的起讫全不详，只受世系下界约束。',
      start_min=390, dynasty='eastern_jin', certain_periods=[])
patch('w0058', '继东晋邵之、崇之之后，420国除；不能前推到西晋。',
      start_min=390, dynasty='eastern_jin')
patch('w0068', '元帝立冲为东海世子；传叙永昌初（322）之后、裴太妃死后才即王位，确年未详；341卒。世子不能当已即王位。',
      start_min=322, start_max=341, accession_known=False, dynasty='eastern_jin', source_ids=['JS064'])
patch('w0075', '继新蔡确（311死）后，314还本宗；嗣年无确数，只有314年身份转换可定。',
      start_min=311, start_max=314, accession_known=False)
patch('w0143', '出继东安繇（304死）后，不久死；不把未知死年续至316。',
      start_min=304, start_max=None, certain_periods=[])
patch('w0119', '原数值300与本条291封王相抵；惠帝纪元康元年八月明载进西阳公为王。304被废，306复爵，305不显示姓名。',
      start_min=291, start_max=291, accession_known=True,
      certain_periods=[[291,304],[306,326]],
      display_reigns=[{'begin':291,'end':304,'accession':291},{'begin':306,'end':326,'accession':306}],
      source_ids=['JS004','JS059'])
patch('w0145', '继淮陵漼（301封）后，无子而绝；399另封蘊，之间不能按顺序补满。',
      start_min=301, end_max=399, certain_periods=[])
patch('w0144', '《晉書》卷38載漼廢趙王倫有功，301進封淮陵王，卒後融嗣；卒年未詳，304不能僅憑國名補定是漼或融。',
      source_ids=['JS038'], certain_periods=[[301,301]])
patch('w0147', '出继淮陵蘊（415死），420国除；仅属东晋末。',
      start_min=415, start_max=420, dynasty='eastern_jin', accession_known=False)
patch('w0157', '元帝立为梁王、317卒；原记是元帝时期，不用作西晋312—316继承人。',
      start_min=317, start_max=317, accession_known=False, dynasty='eastern_jin')
patch('w0174', '太元为376—396，原注276—396是百年讹字；起年仍不详，402卒。',
      start_min=376, start_max=396, accession_known=False, dynasty='eastern_jin')
patch('w0181', '300遐卒后覃嗣，表列301；保留300—301起年约束而不强算301为即位元年。',
      start_min=300, start_max=301, accession_known=False)
patch('w0192', '265初封；咸宁初增封渔阳说明存续到275以后，但死年未详，不无限延续到幾出现。',
      end_min=275, end_max=302, source_ids=['JS038'])
patch('w0193', '出继燕机年不详；302被囚可知该年身份，不倒填机的整个未知尾段。',
      start_min=275, start_max=302, accession_known=False)
patch('w0194', '280封乐平后不久卒国除；不久不能转换成任意固定年数或延续至后世。',
      end_max=None, certain_periods=[[280, 280]])
patch('w0199', '秦柬291死后郁嗣，300遇害；292为旧表排年，原典不明即位确年。',
      start_min=291, start_max=300, accession_known=False, source_ids=['JS064'])
patch('w0203', '301封汉，永嘉（307—312）改济南且311遇害，故汉位终止窗口为307—311。',
      end_min=306, end_max=311, source_ids=['JS064'])
patch('w0204', '承接同人汉王条，永嘉改济南而311遇害；起年307—311，不能填满该窗口。',
      start_min=307, start_max=311, accession_known=False, source_ids=['JS064'])
patch('w0211', '永嘉间由宜都嗣淮南，311遇害；只能由窗口约束确认311，不强定307。',
      start_min=307, start_max=311, accession_known=False, source_ids=['JS064'])
patch('w0212', '原注明言东晋后期，400年代不是400年确终；不进入西晋正文。',
      start_min=317, start_max=None, end_min=None, end_max=409,
      accession_known=False, dynasty='eastern_jin', certain_periods=[])
patch('w0213', '289受封，304前已有廓出继改中都；演死年未知，不能延续至拓跋代王前。',
      end_min=None, end_max=304, certain_periods=[[289, 289]], source_ids=['JS064'])
patch('w0216', '惠帝末封新蔡：只以惠帝290—306为宽约束，不把末年硬定304；308转清河。',
      start_min=290, start_max=306, accession_known=False)
patch('w0217', '惠帝末封上庸，306改豫章；帝世限290—306，只有306转换年可定。',
      start_min=290, start_max=306, accession_known=False)
patch('w0219', '惠帝末封广川，307改豫章；帝世限290—306。',
      start_min=290, start_max=306, accession_known=False)
patch('w0221', '原注约咸宁三年后封，286卒；下界277仅宽约束，286人名可定。',
      start_min=277, start_max=286, accession_known=False)
patch('w0228', '永嘉初先华容，后复成都；307和311均旧表疑数，王号转换年未明，不能径作成都确定在位段。',
      start_min=307, start_max=None, end_min=None, end_max=316,
      accession_known=False, certain_periods=[])
patch('w0233', '晏子祥初封南平年未明，301转宜都；只由转换年确认南平身份。',
      start_min=289, start_max=301, accession_known=False)
patch('w0234', '301封宜都，永嘉307—311间转淮南；不续至未知终年。',
      end_min=306, end_max=311)
patch('w0235', '晏子衍初封新都，无确年；永嘉间转济阴，不能占满277年新都该以后所有年份。',
      start_min=289, start_max=None, end_min=None, end_max=311, certain_periods=[])
patch('w0236', '同人新都条记永嘉改济阴且311遇害；不将问号扩至265。',
      start_min=307, start_max=311, accession_known=False)
patch('w0249', '姓名重复曹奐且注明身份不详；不是已证继任者，不在正文输出此人。',
      start_min=302, end_max=326, identity_unknown=True, certain_periods=[])
patch('w0253', '义熙为405—418，且接383—408曹灵诞之后；409不能冒充已证即位年。',
      start_min=408, start_max=418, accession_known=False, dynasty='eastern_jin')

# Explicit 2026-10-07 Word decisions apply only to Western Jin display.
# display_periods are editorial hypotheses, never historical attestations.
def display_patch(key, periods, note, **kwargs):
    patch(key, note, display_periods=periods, display_inferred=True,
          accession_known=False, source_ids=['USER_DOCX_20261007'], **kwargs)

display_patch('w0004', [[284,309]], '本輪暫以309國絕、310回郡；309是展示推定，不是确證卒年。', end_max=309)
patch('w0010', '301以後復封棘陽縣王，始終年未詳；只在西晉可能範圍提供縣王爵號與世系，不當郡國。', level='county', start_min=301, end_max=316)
patch('w0028', '270封南宮縣王，289進武邑郡王；當年按變更後結果，縣王止288。', level='county', end_min=288, end_max=288, certain_periods=[[270,288]])
display_patch('w0029', [[289,297]], '承卒只知惠帝時；本輪暫置298，故武邑獨國展示止297，298歸長樂作支郡。', end_min=None, end_max=298)
display_patch('w0032', [[302,305]], '原311終年僅疑推；為與306東海增封下邳不衝突，本輪獨國展示暫止305，不稱305卒年。', end_min=None, end_max=305, certain_periods=[[302,302]])
for key in ['w0037','w0038','w0172']:
    pc[key]['level']='county'
patch('w0027', '司馬鑠294嗣中丘；311遇難僅表注疑推，非確證國除年。294—310仍循既有在位段，311後不硬填本年國主，封國本身按寬泛規則另列。',
      end_min=None,end_max=316,certain_periods=[[294,310]])
pc['w0172'].update(end_min=302,end_max=302, certain_periods=[[302,302]])
patch('w0119', '291先為縣王；本輪因元康初及官歷暫以293進郡王。305廢，306復爵；293為展示推定，不改稱史料確年。', start_min=291,start_max=293,accession_known=False,level_periods=[{'begin':291,'end':292,'level':'county'},{'begin':293,'end':304,'level':'prefecture'},{'begin':306,'end':326,'level':'prefecture'}], certain_periods=[[291,304],[306,326]], display_inferred=True, display_periods=[[291,304],[306,316]], display_reigns=[{'begin':291,'end':292,'accession':291,'accession_known':True},{'begin':293,'end':304,'accession':None,'accession_known':False},{'begin':306,'end':326,'accession':306,'accession_known':True}])
patch('w0122', '本輪Word按由汝陽公進封及兄弟子國關係作郡王展示，至少有汝陽縣；原王表稱縣王，保留此異說。',level='prefecture',display_inferred=True)
display_patch('w0143', [[305,306]], '繼繇後尋薨；依本輪Word暫以305—306作展示期，非确證嗣卒年。',start_min=304,start_max=306,end_min=None,end_max=306,certain_periods=[])
patch('w0144', '301進淮陵王，其後漼卒融嗣，交替年未詳；本輪只將封國展示止306，307回郡，不填本年姓名。',end_max=306,certain_periods=[[301,301]])
patch('w0145', '漼卒後融嗣，無子國絕；本輪307回郡純為展示推定，不能確定各年在位人。',start_min=301,end_max=306,certain_periods=[])
display_patch('w0194', [[280,281]], '病重受封後尋薨；本輪以282國除作展示推定，280—281顯示樂平國。',end_min=None,end_max=281,certain_periods=[[280,280]])
display_patch('w0203', [[301,306]], '永嘉改濟南，本輪暫取307，漢王展示止306。',end_min=None,end_max=306)
display_patch('w0204', [[307,311]], '永嘉改濟南，本輪暫取最早307作展示，起年非史載確年。',start_min=307,start_max=311)
display_patch('w0211', [[307,311]], '永嘉由宜都轉淮南，本輪暫取307展示。',start_min=307,start_max=311)
display_patch('w0217', [[301,305]], '惠帝末受封上庸，本輪依表候選以301展示，306改豫章；301非确年。',start_min=301,start_max=305,end_min=305,end_max=305,certain_periods=[])
display_patch('w0219', [[301,306]], '惠帝末受封廣川，本輪依表候選以301展示，307改豫章；301非确年。',start_min=301,start_max=306,end_min=306,end_max=306,certain_periods=[])
display_patch('w0221', [[277,286]], '原表約咸寧三年後封，本輪暫以277開始展示；非受封確年。',start_min=277,start_max=286)
patch('w0228','先華容縣王、後成都王；本輪荊州成都國起304為地圖採用方案，通史作永嘉中仍留异說。建興中省郡暫取313，姓名不因疆域展示而確定。',start_min=307,start_max=None,end_max=312,certain_periods=[])
display_patch('w0233', [[301,301]], '初封南平無確年，本輪以父王301復爵之年暫定；同年改宜都。',start_min=301,start_max=301)
display_patch('w0234', [[301,306]], '301改宜都，永嘉改淮南本輪取307，因此宜都展示止306。',end_min=None,end_max=306)
display_patch('w0235', [[301,306]], '新都初封未載，本輪暫以301受封、307轉濟陰展示；新都地望未定，不把新安郡整面當國。',start_min=301,start_max=None,end_min=None,end_max=306)
display_patch('w0236', [[307,311]], '永嘉改濟陰暫取307展示；其地望與東海濟陽支郡有衝突，文字保留王爵而不任意畫另一重郡國。',start_min=307,start_max=311)
patch('w0268','澹311死後喆嗣、亦為石勒所害，卒年未知；318晞繼以前的世系，不把父子同算311卒。',start_min=312,start_max=None,end_min=None,end_max=317,accession_known=False,certain_periods=[],source_ids=['JS038','USER_DOCX_20261007'])
patch('w0269','隨縣王封年未詳，288進郡王；西晉266—287只是可能顯示範圍，只標爵號、不確認本年姓名。',level='county',start_min=266,start_max=None,end_min=None,end_max=287,accession_known=False,certain_periods=[])
patch('w0270','永嘉初先封華容縣王、後復成都王；具體轉換年未詳，307—312僅可能範圍。',level='county',start_min=307,start_max=None,end_min=None,end_max=312,accession_known=False,certain_periods=[])

# The display cutoff does not erase an independently known accession.
for key in ['w0004','w0029','w0032','w0194','w0203','w0234']:
    pc[key]['accession_known']=True

groups = {}
for r in princes:
    groups.setdefault(r['fief'], []).append((r['id'], pc[r['id']]))
for group in groups.values():
    constrain_succession(group)
for r in princes:
    c = pc[r['id']]
    if r.get('start') is not None and r['start'] >= 317:
        c.setdefault('dynasty', 'after_western_jin')
    finish(c)

fc = {}
for f in fiefs:
    group = []
    for hi, h in enumerate(f['holders']):
        for pi, p in enumerate(h['periods'] or [{}]):
            key = f"{f['id']}:{hi}:{pi}"
            c = bounds(p, p.get('raw', h['time_text']), h.get('note', ''))
            c.update(holder_index=hi, period_index=pi)
            if not h['person'] or h['person'] in ['?', '？']:
                c['identity_unknown'] = True
            fc[key] = c
            group.append((key, c))
    constrain_succession(group, inherit_after_predecessor=True)
    for key, c in group:
        if c['start_min'] is not None and c['start_min'] >= 317:
            c['dynasty'] = 'after_western_jin'
        finish(c)

# Cross-title transfers and raw extraction failures in the five-rank list.
for key, changes in {
    'fr0049:0:0': {'end_min':303, 'end_max':304, 'certain_periods':[[289,303]], 'note':'同人司马澹304进武陵王；东武公不无限延伸。'},
    'fr0058:0:0': {'note':'290年代为起封窗口，最迟299；306追封新城不能作原爵续存。'},
    'fr0219:0:0': {'start_min':None, 'start_max':275, 'accession_known':False, 'display_start':None, 'certain_periods':[[275,275]], 'note':'原文“—275年”只有终年，旧抽取误作275—275；不得算275元年。'},
    'fr0263:1:0': {'start_min':346, 'start_max':358, 'note':'谢奕承父谢裒（346卒）后，358卒，不能提前到西晋。'},
    'fr0263:2:0': {'start_min':358, 'note':'谢渊承父谢奕（358卒）之后，起讫不详，不能提前到西晋。'},
    'fr0003:2:0': {'start_min':282, 'start_max':282, 'accession_known':True, 'display_start':282,
                    'certain_periods':[[282,300]], 'source_ids':['JS040'],
                    'note':'《晉書》贾充傳：282充薨後，郭槐以外孫韓謐奉充後，詔為魯公世孫以嗣其國；300遭誅。原表問號據此收緊。'},
    'fr0003:3:0': {'start_min':301, 'start_max':303, 'end_min':301, 'end_max':303,
                    'accession_known':False, 'display_start':None, 'certain_periods':[], 'source_ids':['JS040'],
                    'note':'《晉書》稱趙王倫敗後議立充後，以眾子禿後充，又病死，後於永興中另立湛。依本輪裁定，禿封、卒皆約束在301—303，不把301當確切即位年。'},
    'fr0003:4:0': {'start_min':304, 'start_max':306, 'end_min':None, 'end_max':316,
                    'accession_known':False, 'display_start':None, 'certain_periods':[],
                    'inferred_end':316, 'inferred_end_reason':'依使用者本輪裁定，以西晉覆滅年暫收束遭亂死及國除；不是史料明載卒年。',
                    'source_ids':['JS040'],
                    'note':'永興中封魯公，故即位窗口304—306；遭亂死、國除，確切卒年未詳。本輪暫以316作推定終界，不延至東晉，也不以推定終年證成逐年在位。'},
    'fr0136:1:0': {'start_min':289, 'start_max':None, 'accession_known':False, 'display_start':None,
                    'certain_periods':[], 'source_ids':['JS039'],
                    'note':'《晉書》荀勖傳：太康十年（289）卒，輯嗣；即位不早於父卒，不能用父親265封侯作子的即位下界。確切嗣年仍未詳。'},
    'fr0136:2:0': {'start_min':289, 'certain_periods':[], 'source_ids':['JS039'],
                    'note':'荀輯卒後畯嗣，輯卒年未詳；只保留不早於前代荀勖289卒的寬下界，不補定確切在年。'},
    'fr0136:3:0': {'start_min':289, 'certain_periods':[], 'source_ids':['JS039'],
                    'note':'荀畯無子，弟子荀識承襲；前任卒年未詳，依次承襲不等於可以把空段填滿。'},
}.items():
    fc[key].update(changes)

# Word succession assumptions are visible editorial periods, not attestations.
for key, changes in {
    'fr0001:1:0': {'start_min':274,'start_max':274,'display_periods':[[274,300]],'note':'依本輪Word採父石苞273卒後隔年274承襲；274為展示排年。'},
    'fr0002:1:0': {'start_min':282,'start_max':282,'display_periods':[[282,282]],'note':'父陳騫281卒，本輪暫定282承襲；終年仍未詳，不能把282後所有年份都指為陳輿。'},
    'fr0003:2:0': {'start_min':283,'start_max':283,'certain_periods':[[300,300]],'display_periods':[[283,300]],'note':'充282卒，本輪依隔年承襲規則以283作賈謐展示起年。'},
    'fr0003:3:0': {'start_min':301,'start_max':301,'end_min':304,'end_max':306,'certain_periods':[],'display_periods':[[301,303]],'note':'本輪Word優先於舊稿：禿301趙王倫敗後封；病卒在304—306之間，湛必於禿卒後受封。301為展示排年，304後交替不定，不強填某一人。'},
    'fr0003:4:0': {'start_min':304,'start_max':306,'end_min':None,'end_max':316,'certain_periods':[],'note':'湛在永興304—306中且禿卒後受封；316遇亂卒國除仍僅本輪展示推定，不延至東晉。'},
    'fr0004:1:0': {'start_min':272,'start_max':272,'end_min':274,'end_max':274,'certain_periods':[],'display_periods':[[272,274]],'note':'父裴秀271卒、弟裴頠275承襲，本輪暫排裴濬272—274。'},
    'fr0005:1:0': {'start_min':None,'start_max':None,'end_min':None,'end_max':302,'certain_periods':[],'note':'孫秀後是否續封不詳；本輪303起不再作會稽公國。'},
    'fr0009:1:0': {'start_min':292,'end_max':311,'certain_periods':[[311,311]],'note':'本輪將永嘉改封江夏暫置307；蘭陵與江夏分段展示，同人世系保留。'},
    'fr0011:1:0': {'start_min':301,'start_max':301,'end_min':317,'end_max':None,'certain_periods':[],'display_periods':[[301,316]],'note':'陳準300卒，本輪暫排陳眕301嗣；過江依元帝，故至少活至317以後，西晉段可作此展示。'},
    'fr0011:2:0': {'start_min':318,'certain_periods':[],'dynasty':'after_western_jin','note':'陳逵為眕子，須在眕去世後承襲；眕317後尚生存，子不得回填西晉。'},
    'fr0011:3:0': {'start_min':318,'certain_periods':[],'dynasty':'after_western_jin','note':'陳準七世孫，不得以前代未知卒年倒填西晉。'},
    'fr0012:0:0': {'end_min':310,'end_max':317,'certain_periods':[[303,310]],'note':'段務勿塵卒年未知，生平至少延續至310；子不得在此前即位。'},
    'fr0012:1:0': {'start_min':311,'start_max':318,'certain_periods':[[318,318]],'note':'父務勿塵310以後卒，按隔年承襲下限311，實際即位年仍未詳。'},
    'fr0136:1:0': {'start_min':290,'certain_periods':[],'note':'荀勖289卒，荀輯依本輪隔年承襲展示規則不早於290；嗣卒年未詳。'},
    'fr0136:2:0': {'start_min':290,'certain_periods':[]},
    'fr0136:3:0': {'start_min':290,'certain_periods':[]},
    'fr100701:0:0': {'start_min':291,'start_max':299,'certain_periods':[],'display_periods':[[291,299]],'note':'張華元康291—299年間受封，本輪採寬年號取首年291的展示規則，非史料確年；300國除。'},
    'fr100703:0:0': {'start_min':311,'start_max':317,'certain_periods':[],'display_periods':[[311,316]],'note':'宣城裒受封未詳，本輪暫取311展示，不是史料確年。'},
    'fr100704:0:0': {'start_min':307,'start_max':311,'certain_periods':[[311,311]],'display_periods':[[307,311]],'note':'永嘉中徙江夏，本輪暫置307。'}
}.items():
    fc[key].update(changes)
    fc[key].update(accession_known=False, display_start=None, display_inferred=True)
    fc[key].setdefault('source_ids',[]).append('USER_DOCX_20261007')

data = {'schema_version':'1.1.0', 'reviewed_at':'2026-10-07',
        'policy':'只在有据的在年区间确认姓名；可能上下界、前后任次序和年号窗口不等于精确即位。追封不作为当年在世封君。原世系完整保留。',
        'sources':[
            {'id':'USER_DOCX_20261007','title':'使用者《兩晉郡級封國相關分析》','local':'work/jin-docx-review-20261007/source-text.txt','note':'日期與地圖展示推定依本輪Word；不充作原典確證。'},
            {'id':'PRINCES_LOCAL','title':'项目既有晋朝藩王列表及逐项年号注释','url':'https://zh.wikipedia.org/wiki/晉朝藩王列表'},
            {'id':'FIVE_RANK_LOCAL','title':'项目既有五等爵列表及逐人原始时间文字','local':'data/five-rank-fiefs.js'},
            {'id':'JS038','title':'晋书卷三十八，燕王机等传','url':'https://zh.wikisource.org/zh-hans/晉書/卷038'},
            {'id':'JS039','title':'晉書卷三十九，荀勖傳','url':'https://zh.wikisource.org/zh-hant/晉書/卷039'},
            {'id':'JS040','title':'晉書卷四十，賈充傳','url':'https://zh.wikisource.org/zh-hans/晉書/卷040'},
            {'id':'JS004','title':'晋书卷四，惠帝纪','url':'https://zh.wikisource.org/zh-hans/晉書/卷004'},
            {'id':'JS059','title':'晋书卷五十九，西阳王羕传','url':'https://zh.wikisource.org/zh-hans/晉書/卷059'},
            {'id':'JS064','title':'晋书卷六十四，武十三王、元四王','url':'https://zh.wikisource.org/zh-hans/晉書/卷064'}],
        'princes':pc,'five_rank':fc}
out = ROOT / 'data/jin-fief-research/ruler-constraints-20261004.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
(ROOT / 'data/jin-ruler-constraints.js').write_text('window.JIN_RULER_CONSTRAINTS = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(f'{len(pc)} prince records; {len(fc)} five-rank holder periods constrained')
