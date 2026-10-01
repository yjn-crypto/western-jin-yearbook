#!/usr/bin/env python3
"""Build a source-backed layer; never rewrite the 744 records or manual decisions."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = Path(os.environ.get('YEARBOOK_SOURCE_DIR', str(Path.home() / 'Downloads' / '年表资料')))
SOURCE = SOURCES / '中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf_by_PaddleOCR-VL-1.6.md'
lines = SOURCE.read_text().splitlines()
reviewed = json.loads((ROOT / 'data/liang-county-reviewed.json').read_text())
sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()


def evidence(title, first, last, note=''):
    return {'source_label': '《中國行政區劃通史》下卷第八編 · ' + title,
            'source_filename': SOURCE.name, 'source_sha256': sha,
            'markdown_lines': [first, last],
            'excerpt': '\n'.join(lines[first - 1:last]), 'editorial_note': note,
            'verification': 'text_verified_original_page_pending'}


data = {'meta': {'version': 1, 'source_sha256': sha,
    'policy': '原744縣、753時段、87人工意見不改；新增層只補有正文依據的實體與連接。地域是資料編排分區，不一定等於所屬州的分區。跨分區必須有逐條實體ID和來源。',
    'date_policy': '新增郡按正文沿革分段；文獻始見年不冒充設置年，推定續存與未明邊界保留※。不從第十編○△符號生成全朝時段。',
    'compound_policy': '二郡合題按原書合題行連接，不拆成兩個郡，不據此斷言某縣只屬其中一郡。'},
    'supplemental_prefectures': [], 'county_links': [], 'research_notes': []}


def pref(pid, sid, name, start, end, source, order=1, qiao=False, uncertain=False):
    data['supplemental_prefectures'].append({'id': pid, 'state_id': sid,
        'n': name, 'o': order, 'q': qiao, 'qi': None, 'research_source': source,
        'ph': [{'start': start, 'end': end, 'name': name, 'uncertain': uncertain,
                'raw': f'{start}—{end}（正文沿革補入）', 'source': source}]})


def link(nums, ids, start, end, source, reason, override=False, uncertain=False):
    for num in nums:
        cid = f'lc_{num:04d}'
        for a in reviewed['assignments']:
            if a['county_id'] != cid:
                continue
            data['county_links'].append({'id': a['id'] + '-E' + str(start),
                'county_id': cid, 'assignment_id': a['id'], 'start': start, 'end': end,
                'prefecture_ids': ids, 'source': source, 'reason': reason,
                'override_machine_hold': override, 'uncertain': uncertain})


src = evidence('南徐州蘭陵郡', 10852, 10856, '502年四月改南東海為蘭陵。丹徒是實縣，不能因其所屬為侨郡而標作侨縣。蘭陵縣改名確年仍未明，本輪只確立郡實體及丹徒的連接。')
pref('liang_s0007_q_lanling', 'liang_s0007', '蘭陵郡', 502, 557, src, .5, True)
link([72], ['liang_s0007_q_lanling'], 502, 557, src, '南東海為蘭陵郡舊名；正文明确改名，不是同名搜索。')

src = evidence('南徐州南琅邪、（南）彭城二郡及江乘縣', 10876, 10878,
    '南琅邪承齊舊，537年始見二郡合題，分設確年不詳。502—536以舊名附列並標※；537以後合題亦保留始年不詳，不以537斷言分設年。江乘依原縣表535年省廢當年仍列。')
pref('liang_s0007_q_langye', 'liang_s0007', '南琅邪郡', 502, 536, src, 6, True, True)
pref('liang_s0007_q_langye_pengcheng', 'liang_s0007', '南琅邪、（南）彭城二郡', 537, 557, src, 6, True, True)
link([88], ['liang_s0007_q_langye'], 502, 535, src, '江乘附南琅邪郡，原機器義興郡為錯配；縣535終年保留。', True, True)
data['research_notes'].append({'county_id': 'lc_0073', 'status': 'name_date_pending', 'source': src,
    'note': '蘭陵縣屬蘭陵侨郡已可辨明，但武進改蘭陵的確年正文未載，原待考入口保留，不假定502已改縣名。'})

src = evidence('南兗州、西兗州秦郡', 11660, 11662, '秦郡550年移置西兗州，555年陷；按政區年末口徑不在555年續列。')
pref('liang_s0015_q_qin', 'liang_s0015', '秦郡', 502, 549, src, 2.5, True)
src2 = evidence('西兗州秦郡', 11700, 11704, src['editorial_note'])
pref('liang_s0018_q_qin', 'liang_s0018', '秦郡', 550, 554, src2, 1, True)
link([204], ['liang_s0015_q_qin', 'liang_s0018_q_qin'], 502, 554, src2, '六合附秦郡，按南兗州至西兗州沿革連接。')

src = evidence('北兗州山陽郡', 11688, 11692, '太清三年失守，郡層年末口徑止548；縣表山陽549終年仍保留於原資料。齊末屬南兗州，梁移北兗州確年不詳；此處承正文郡屬作附列，整段標※，不視502為已考定轉州年。')
pref('liang_s0017_q_shanyang', 'liang_s0017', '山陽郡', 502, 548, src, .5, True, True)
link([169, 170], ['liang_s0017_q_shanyang'], 502, 548, src, '原機器海陵郡與正文山陽郡衝突，依本地域正文侨郡改正。', True)

src = evidence('青冀二州北海郡', 12398, 12404, '正文說明承齊侨郡，549年四月州沒；郡層年末口徑止548。')
pref('liang_s0043_q_beihai', 'liang_s0043', '北海郡', 502, 548, src, .5, True)
link([213], ['liang_s0043_q_beihai'], 502, 548, src, '本地域北海侨郡領贛榆，原郡行漏提取。')
src = evidence('青冀二州北東海郡', 12414, 12416, '正文承齊北東海侨郡並記梁增臨海縣；縣起年沿用複核表，不以侨置標記推年。')
pref('liang_s0043_q_beidonghai', 'liang_s0043', '北東海郡', 502, 548, src, 3.5, True)
link([220], ['liang_s0043_q_beidonghai'], 502, 548, src, '臨海附青冀二州北東海郡，與南徐州南東海分開。')

src = evidence('益州、新州西宕渠郡', 16134, 16136, '承齊舊；552移新州，553隨州而沒；依現有蜀地郡層553終年口徑。')
pref('liang_s0139_q_xidangqu', 'liang_s0139', '西宕渠郡', 502, 551, src, 10.5, True)
src2 = evidence('新州西宕渠郡', 16250, 16252, src['editorial_note'])
pref('liang_s0144_q_xidangqu', 'liang_s0144', '西宕渠郡', 552, 553, src2, 6, True, True)
link([721], ['liang_s0139_q_xidangqu', 'liang_s0144_q_xidangqu'], 502, 553, src, '通泉所附西宕渠侨郡依正文及州地域定位。')

src = evidence('婺州、縉州東陽郡', 10838, 10844,
    '553前、557前不是502起年。僅在553年婺州、556年縉州兩個文獻錨年附東陽，不由單年記錄補滿554—555。557揚州復屬有當年策文。這些是本年有見，不是設州年或年末隸屬已全部考定；其他轉屬確年仍待考。')
pref('liang_s0005_p_dongyang', 'liang_s0005', '東陽郡', 553, 553, src, 1, False, True)
dongyang = data['supplemental_prefectures'][-1]
dongyang['ph'][0]['raw'] = '553（本年文獻有婺州，非確定建州年）'
dongyang['ph'].append({'start': 556, 'end': 556, 'name': '東陽郡', 'uncertain': True,
    'raw': '556（本年文獻有縉州刺史領東陽太守，非確定轉屬年）', 'source': src})

src = evidence('江漢吳昌縣', 13374, 13376, '縣條雖編入江漢，正文明确齊末湘州長沙郡；不能用資料分區阻擋。')
link([315], ['liang_s0115_p001'], 502, 557, src, '原書县條所在分區與州郡分區不同；正文明記長沙郡。')
for n, row in [(598, 63), (617, 65)]:
    src = {'source_label': f'縣郡複核工作簿 · 剩余人工判断第{row}行',
        'excerpt': '人工确认：巴陵郡。縣表屬沅湘資料分區，州郡表的郢州巴陵郡列江漢；保留人工郡屬，僅解除資料分區造成的阻擋。',
        'editorial_note': '有效時段仍與原縣時段及郢州巴陵郡時段相交，不因連接補出新郡年。'}
    link([n], ['liang_s0058_p009'], 502, 557, src, '人工明定巴陵郡；跨資料分區的具名實體對應。')

src = evidence('蜀中泰昌、北井縣', 16440, 16446,
    '兩縣在夔州路大昌，屬治巫的建平郡；不是寧州南中同名建平郡。依既有益州502—522、信州523—553兩郡段連接。')
link([703, 704], ['liang_s0139_p017', 'liang_s0143_p003'], 502, 553, src, '按原書地域及附郡上下文排除寧州同名建平。')

# The source already has one combined row. Keep that row and the manuscript's compound attribution.
groups = [([242, 243, 244], '001', 12560, 12570), ([245, 247], '002', 12572, 12584),
          ([251, 252], '004', 12598, 12604), ([254], '007', 12610, 12612),
          ([255, 256], '008', 12614, 12620), ([258], '005', 12628, 12630)]
for nums, suffix, first, last in groups:
    src = evidence('淮北陳州雙頭郡及附縣', first, last,
        '原書結論與底表均為二郡合題，直接附同地域合題實體；未拆分到單郡。528—548與原有陳州郡段相交。')
    link(nums, ['liang_s0042_p' + suffix], 528, 548, src, '合題行已存在，無須人工拆郡；原機器僅因合題而攔截。', True)
src = evidence('西恆農、陳南／陳留二郡及胡城、南頓', 12586, 12592,
    '原書引文陳南、作者結論陳留有異；人工確認西恆農、陳留雙頭郡。本層以相同地域、治胡城及二縣上下文確認是底表合題實體，保留異文與人工原文。')
link([248, 249], ['liang_s0042_p003'], 528, 548, src, '陳南／陳留異文的定向實體映射；不改人工雙頭郡結論。')
src = evidence('陳州東、汝南二郡及濟陽', 12394, 12396,
    '人工暫系東郡，底表以東、汝南合題列示；附該合題行並保留暫系※，不改為確屬汝南郡。')
src['excerpt'] += '\n\n' + '\n'.join(lines[12594 - 1:12596])
src['additional_markdown_lines'] = [12594, 12596]
link([250], ['liang_s0042_p010'], 528, 548, src, '人工暫系的東郡為此合題郡一部；保留暫系。', False, True)
src = evidence('益州巴西、梓潼二郡及涪縣', 16170, 16172,
    '治涪的巴西、梓潼雙頭郡，與巴漢地區治閬中的北巴西郡不同。人工確認涪屬巴西，於合題行列示，不改判為梓潼單郡。')
link([729], ['liang_s0139_p019', 'liang_s0149_p001'], 502, 553, src, '依治所涪和蜀中上下文連接雙頭郡。')

from liang_october_source_repairs import augment
data = augment(data, lines, sha, SOURCES)

for suffix in ['json', 'js']:
    text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if suffix == 'js':
        text = '// Source-backed entity links; generated by scripts/build-liang-entity-links.py\nwindow.LIANG_ENTITY_LINKS = ' + text.rstrip() + ';\n'
    (ROOT / f'data/liang-entity-links.{suffix}').write_text(text)
print(json.dumps({'prefectures': len(data['supplemental_prefectures']), 'county_links': len(data['county_links'])}))
