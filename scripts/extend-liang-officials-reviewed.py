#!/usr/bin/env python3
"""Append the September continuation's explicit editorial decisions.

Reads the local corpus; never regenerates/replaces the independently reviewed
first 29 records. Re-running skips existing IDs and preserves later edits.
Run the EPUB evidence verifier independently after adding a reviewed batch.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKS = {c: json.loads((ROOT / 'work/epub' / f'{c}-paragraphs.json').read_text()) for c in ('LS', 'CS')}
PARAS = {p['paragraph_id']: p for b in BOOKS.values() for p in b['paragraphs']}
DEST = ROOT / 'data/liang-officials-reviewed.json'
DATA = json.loads(DEST.read_text())
ADDITIONS = []


def evidence(pid, quote, role='office_and_time'):
    p = PARAS[pid]
    start = p['text'].index(quote)
    code = p['book']
    return {'book': '梁书' if code == 'LS' else '陈书',
            'volume': p['chapter_index'] - (2 if code == 'LS' else 1),
            'chapter': p['chapter'], 'paragraph_id': pid,
            'epub_member': p['member'], 'chapter_anchor': p['chapter_anchor'],
            'chapter_paragraph': p['chapter_paragraph'], 'file_paragraph': p['file_paragraph'],
            'quote': quote, 'quote_start': start, 'quote_end': start + len(quote),
            'role': role, 'epub_sha256': BOOKS[code]['metadata']['sha256']}


def add(person, place, years, era, pid, quote, note, *, office=None, full=None,
        status='appointment_only', kind='dated_appointment', extra=(), aliases=(),
        start=None, end=None, nature='正任'):
    office = office or place + '太守'
    n = 30 + len(ADDITIONS)
    ADDITIONS.append({'official_id': f'LIANG-EPUB-{n:04d}',
        'person_id': f'LIANG-EPUB-PERSON-{person}', 'person': person, 'person_aliases': list(aliases),
        'place': place, 'place_id': None,
        'geography_match_status': 'unmatched_requires_independent_geography_id',
        'office': office, 'full_title': full or office, 'level': '郡级正任',
        'dynasty': '梁', 'tenure_nature': nature, 'tenure_status': status,
        'review_status': 'reviewed_context_continuation_2026_09_27',
        'annual_presence_years': years,
        'annual_status_by_year': {str(y): status if y == start or len(years) == 1 else 'served' for y in years},
        'event_type': kind,
        'annual_semantics': '本年见载该职；授官与在任证据分别注明，不表示年末现任，不补中间年',
        'original_time': era,
        'tenure_time': {'start_lower': start, 'start_upper': start,
            'end_lower': end, 'end_upper': end,
            'start_status': 'exact_year' if start else 'unknown',
            'end_status': 'exact_year' if end else 'unknown',
            'start_semantics': 'documented_appointment_year_not_arrival_year' if start else 'unknown_start_year',
            'end_semantics': 'explicit_departure_or_death_year' if end else 'unknown_end_year'},
        'time_explanation': note,
        'evidence': [evidence(pid, quote)] + [evidence(*e) for e in extra],
        'research_notes': [], 'publication_eligibility': 'annual_evidence_only_after_geography_matching',
        'can_infer_between_anchor_years': False})


add('王骞', '东阳', [505], '天监四年', 'LS-C09-P0019',
    '天监四年，出为东阳太守，寻徙吴郡。',
    '天监四年为505。只取明确授东阳之年；“寻徙吴郡”不另定为505。', start=505,
    aliases=['王騫', '王玄成'], extra=[('LS-C09-P0018', '父骞，字思寂，本名玄成，与齐高帝偏讳同，故改焉。', 'person_identity'), ('LS-C09-P0015', '太宗简皇后王氏，讳灵宾，琅邪临沂人也。', 'family_context')])
add('宗夬', '东海', [502], '天监元年', 'LS-C21-P0005',
    '天监元年，迁征虏长史、东海太守，将军如故。二年，征为太子右卫率。',
    '元年为502，二年503为改官边界；只投授官锚502。原文东海不擅改为南东海。',
    start=502, end=503, full='征虏长史、东海太守',
    extra=[('LS-C21-P0003', '宗夬，字明扬，南阳涅阳人也，世居江陵。', 'person_identity')])
add('朱僧勇', '宣城', [510], '天监九年', 'LS-C23-P0080',
    '天监九年，宣城郡吏吴承伯挟祅道聚众攻宣城，杀太守硃僧勇。',
    '九年为510；遇害事件直接以宣城太守称之，证明本年在任及终任，不推定起任年。',
    status='served', kind='dated_death_in_office', end=510, aliases=['硃僧勇'])
add('蔡撙', '吴兴', [510], '天监九年', 'LS-C23-P0080',
    '天监九年，宣城郡吏吴承伯挟祅道聚众攻宣城，杀太守硃僧勇。因转屠旁县，逾山寇吴兴，所过皆残破，众有二万，奄袭郡城。东道不习兵革，吏民恇扰奔散，并请撙避之。撙坚守不动，募勇敢固郡。',
    '510年守吴兴事件，与上段吴兴太守官衔合读；本条仅投在任事件锚。',
    status='served', kind='dated_in_office_attestation',
    extra=[('LS-C23-P0078', '蔡撙，字景节，济阳考城人。', 'person_identity'), ('LS-C23-P0079', '复为侍中，吴兴太守。', 'office_context')])
add('蔡撙', '吴郡', [521], '普通二年', 'LS-C23-P0080',
    '普通二年，出为宣毅将军、吴郡太守。',
    '普通元年为520，二年521。后文四年卒未明书卒郡，不以卒年扩大本任期。',
    start=521, full='宣毅将军、吴郡太守',
    extra=[('LS-C23-P0078', '蔡撙，字景节，济阳考城人。', 'person_identity')])
add('白涡', '武陵', [524], '普通五年', 'LS-C27-P0009',
    '普通五年，南津获武陵太守白涡书，许遗舍面钱百万，津司以闻。',
    '普通五年524，文书事件直接称武陵太守；不能把本段周舍免官或卒年归给白涡。',
    status='served', kind='dated_in_office_attestation', aliases=['白渦'])
add('萧琛', '宣城', [502], '天监元年', 'LS-C28-P0026',
    '天监元年，迁庶子，出为宣城太守。',
    '元年502同句授官；次段在宣城取书叙事证明曾到任，但不到日不详。',
    start=502, status='appointment_with_service_context',
    extra=[('LS-C28-P0021', '萧琛，字彦瑜，兰陵人。', 'person_identity'), ('LS-C28-P0027', '始琛在宣城，有北僧南度，惟赉一葫芦，中有《汉书序传》。', 'service_context')])
add('萧琛', '江夏', [510], '天监九年', 'LS-C28-P0026',
    '三年，除太子中庶子、散骑常侍。九年，出为宁远将军、平西长史、江夏太守。',
    '同段起于天监元年，九年承天监为510；只证本年授江夏。',
    start=510, full='宁远将军、平西长史、江夏太守',
    extra=[('LS-C28-P0026', '天监元年，迁庶子，出为宣城太守。', 'era_context'), ('LS-C28-P0021', '萧琛，字彦瑜，兰陵人。', 'person_identity')])
add('萧琛', '晋陵', [529], '中大通元年', 'LS-C28-P0033',
    '中大通元年，为云麾将军、晋陵太守，秩中二千石。以疾自解，改授侍中、特进、金紫光禄大夫。',
    '中大通元年529授官；以疾自解没有独立抵郡语，不作已证履任。随后卒年也不硬定为529。',
    start=529, full='云麾将军、晋陵太守',
    extra=[('LS-C28-P0021', '萧琛，字彦瑜，兰陵人。', 'person_identity')])
add('陆杲', '义兴', [509], '天监八年', 'LS-C28-P0040',
    '八年，出为义兴太守，在郡宽惠，为民下所称。',
    '本传先列天监元年、五年，续列六年八年，八年即509；有在郡政绩，抵郡日期不详。',
    start=509, status='appointment_with_service_context',
    extra=[('LS-C28-P0034', '陆杲，字明霞，吴郡吴人。', 'person_identity'), ('LS-C28-P0036', '天监元年，除抚军长史，母忧去职。', 'era_context')])
add('陆杲', '临川', [521], '普通二年', 'LS-C28-P0040',
    '普通二年，出为仁威将军、临川内史。五年，入为金紫光禄大夫，又领扬州大中正。',
    '普通二年521授官，五年524改官；不投522、523。',
    start=521, end=524, office='临川内史', full='仁威将军、临川内史',
    extra=[('LS-C28-P0034', '陆杲，字明霞，吴郡吴人。', 'person_identity')])
add('夏侯亶', '宣城', [502], '天监元年', 'LS-C30-P0023',
    '天监元年，出为宣城太守。寻入为散骑常侍，领右骁骑将军。',
    '元年502明确授官；“寻入”不够定终任年月。', start=502,
    extra=[('LS-C30-P0023', '夏侯亶，字世龙，车骑将军详长子也。', 'person_identity')])
add('夏侯亶', '南郡', [507], '天监六年', 'LS-C30-P0023',
    '六年，出为平西始兴王长史、南郡太守，父忧解职。',
    '六年承本段天监为507；父忧解职未单独纪年，不确定终任年或抵郡日。',
    start=507, full='平西始兴王长史、南郡太守',
    extra=[('LS-C30-P0023', '天监元年，出为宣城太守。', 'era_context'), ('LS-C30-P0023', '夏侯亶，字世龙，车骑将军详长子也。', 'person_identity')])
add('夏侯亶', '安陆', [509], '天监八年', 'LS-C30-P0023',
    '八年，起为持节、督司州诸军事、信武将军、司州刺史，领安陆太守。服阕，袭封豊城县公。居州甚有威惠，为边人所悦服。',
    '八年承天监为509；兼领安陆。居州叙事不能单独证明到安陆郡履太守职，保留授官见载。',
    start=509, nature='兼领', full='持节、督司州诸军事、信武将军、司州刺史，领安陆太守',
    extra=[('LS-C30-P0023', '天监元年，出为宣城太守。', 'era_context'), ('LS-C30-P0023', '夏侯亶，字世龙，车骑将军详长子也。', 'person_identity')])
add('夏侯亶', '江夏', [516], '天监十五年', 'LS-C30-P0024',
    '十五年，出为信武将军、安西长史、江夏太守。十七年，入为通直散骑常侍、太子右卫率，',
    '上段连续天监纪年，十五年516授江夏、十七年518改官；不补517。',
    start=516, end=518, full='信武将军、安西长史、江夏太守',
    extra=[('LS-C30-P0023', '天监元年，出为宣城太守。', 'era_context'), ('LS-C30-P0023', '夏侯亶，字世龙，车骑将军详长子也。', 'person_identity')])
add('韦放', '盱眙', [502], '天监元年', 'LS-C30-P0037',
    '天监元年，为盱眙太守，还除通直郎，',
    '元年502为盱眙授官锚；后文“还除”不提供独立终任年。', start=502,
    extra=[('LS-C30-P0037', '韦放，字元直，车骑将军睿之子。', 'person_identity')])
add('徐摛', '新安', [531], '中大通三年', 'LS-C32-P0023',
    '中大通三年，遂出为新安太守。至郡，为治清静，教民礼义，劝课农桑，期月之中，风俗便改。',
    '中大通三年531授官并有至郡语；不以“期月”推定后续完整年度任期。',
    start=531, status='appointment_with_service_context',
    extra=[('LS-C32-P0022', '徐摛，字士秀，东海郯人也。', 'person_identity')])
add('萧子恪', '吴郡', [528, 529], '大通二年授官、三年卒郡', 'LS-C37-P0007',
    '大通二年，出为宁远将军、吴郡太守。三年，卒于郡舍，时年五十二。',
    '大通二年528授官；三年529卒于郡舍，是另一明确在任锚。同年另有中大通改元，不把“三年”读作中大通三年531。',
    start=528, end=529, status='appointment_with_service_context', kind='dated_appointment_and_death',
    full='宁远将军、吴郡太守',
    extra=[('LS-C37-P0003', '萧子恪，字景冲，兰陵人，齐豫章文献王嶷第二子也。', 'person_identity')])
add('王褒', '南平', [551], '大宝二年', 'LS-C43-P0009',
    '大宝二年，世祖命征褒赴江陵，既至，以为忠武将军、南平内史，俄迁吏部尚书、侍中。',
    '大宝二年551。既至指到江陵，不能当作已到南平履任；保留任命见载。',
    start=551, office='南平内史', full='忠武将军、南平内史',
    extra=[('LS-C43-P0009', '子褒，字子汉，七岁能属文。', 'person_identity'), ('LS-C43-P0004', '王规，字威明，琅邪临沂人。', 'father_identity')])
add('褚球', '南兰陵', [523], '普通四年', 'LS-C43-P0040',
    '普通四年，出为北中郎长史、南兰陵太守；入为通直散骑常侍，领羽林监。',
    '普通四年523授官，未另载到任或终任日期；不与本传后来未具年的再次南兰陵任职合并。',
    start=523, full='北中郎长史、南兰陵太守',
    extra=[('LS-C43-P0039', '褚球，字仲宝，河南阳翟人。', 'person_identity')])
add('刘孺', '江夏', [532], '中大通四年', 'LS-C43-P0044',
    '中大通四年，出为仁威临川王长史、江夏太守，加贞威将军。',
    '中大通四年532明确授官；次年司徒左长史“未拜”修饰后一官，不否定江夏任命。',
    start=532, full='仁威临川王长史、江夏太守，加贞威将军',
    extra=[('LS-C43-P0041', '刘孺，字孝稚，彭城安上里人也。', 'person_identity')])
add('刘孺', '晋陵', [539], '大同五年', 'LS-C43-P0044',
    '大同五年，守吏部尚书。其年，出为明威将军、晋陵太守。在郡和理，为吏民所称。七年，入为侍中，领右军。',
    '大同五年539授官并有在郡事迹；七年541改官边界，不补540。',
    start=539, end=541, status='appointment_with_service_context', full='明威将军、晋陵太守',
    extra=[('LS-C43-P0041', '刘孺，字孝稚，彭城安上里人也。', 'person_identity')])
add('刘潜', '临海', [544], '大同十年', 'LS-C43-P0054',
    '十年，出为伏波将军、临海太守。是时政网疏阔，百姓多不遵禁。孝仪下车，宣示条制，励精绥抚，境内翕然，风俗大革。中大同元年，入守都官尚书。',
    '前段大同三年续至十年，换算544；有下车治理。中大同元年546改官，仅作边界，不补545。',
    start=544, end=546, aliases=['刘孝仪', '劉潛', '劉孝儀'], status='appointment_with_service_context',
    full='伏波将军、临海太守',
    extra=[('LS-C43-P0051', '刘潜，字孝仪，秘书监孝绰弟也。', 'person_identity'), ('LS-C43-P0052', '大同三年，迁中书郎，以公事左迁安西谘议参军，兼散骑常侍。', 'era_context')])
add('刘潜', '豫章', [547, 548, 549], '太清元年授官、二年遣兵、三年失郡', 'LS-C43-P0054',
    '太清元年，出为明威将军、豫章内史。二年，侯景寇京邑，孝仪遣子励帅郡兵三千人，随前衡州刺史韦粲入援。三年，宫城不守，孝仪为前历阳太守庄铁所逼，失郡。',
    '547授官、548遣郡兵、549失郡均有逐年语句，三锚不是在起止之间插值；庄铁为前历阳太守，不投其549历阳在任。',
    start=547, end=549, aliases=['刘孝仪', '劉潛', '劉孝儀'], status='appointment_with_service_context', kind='dated_appointment_and_service',
    office='豫章内史', full='明威将军、豫章内史',
    extra=[('LS-C43-P0051', '刘潜，字孝仪，秘书监孝绰弟也。', 'person_identity')])
add('张嵊', '吴兴', [548, 549], '中大同元年后授官、太清二三年在任', 'LS-C45-P0017',
    '中大同元年，征为太府卿，俄迁吴兴太守。',
    '中大同元年546明确系于太府卿，随后“俄迁吴兴”不硬定同年；548率郡兵赴援、549守郡被俘分别有纪年，只投二锚，不补546、547。549被害由本段连续三年叙事定位。',
    end=549, status='served', kind='dated_in_office_attestation',
    extra=[('LS-C45-P0017', '张嵊，字四山，镇北将军稷之子也。', 'person_identity'), ('LS-C45-P0018', '太清二年，侯景围京城，嵊遣弟伊率郡兵数千人赴援。三年，宫城陷，御史中丞沈浚违难东归。', 'annual_service'), ('LS-C45-P0018', '乃执嵊以送景，景刑之于都市，子弟同遇害者十余人，时年六十二。', 'death_context')])
for place in ['南天水', '天门']:
    add('胡僧祐', place, [529], '中大通元年', 'LS-C48-P0003',
        '中大通元年，陈庆之送魏北海王元颢入洛阳，僧祐又得还国，除南天水、天门二郡太守，有善政。',
        '中大通元年529，二郡并授，分别保存郡官记录并共用原句；有善政语，不由此倒推抵郡日。',
        start=529, status='appointment_with_service_context', nature='二郡并领',
        full='南天水、天门二郡太守', aliases=['胡僧佑'],
        extra=[('LS-C48-P0003', '胡僧祐，字愿果，南阳冠军人。', 'person_identity')])
add('萧正德', '吴郡', [532], '中大通四年', 'LS-C57-P0023',
    '中大通四年，为信武将军、吴郡太守。',
    '中大通四年532明确授官；后文封临贺王不强定与授太守同年。',
    start=532, full='信武将军、吴郡太守',
    extra=[('LS-C57-P0022', '临贺王正德，字公和，临川靖惠王第三子也。', 'person_identity')])
add('周炅', '弋阳', [547], '太清元年', 'CS-C14-P0024',
    '太清元年，出为弋阳太守。',
    '太清元年547授弋阳；后文侯景之乱改西阳没有确年，不一并投547。',
    start=547, extra=[('CS-C14-P0024', '周炅，字文昭，汝南安城人也。', 'person_identity')])
for person, place in [('明绍世', '历阳'), ('鱼弘', '南谯'), ('张澄', '晋熙')]:
    add(person, place, [525], '普通六年', 'LS-C30-P0025',
        '六年，大举北伐。先遣豫州刺史裴邃帅谯州刺史湛僧智、历阳太守明绍世、南谯太守鱼弘、晋熙太守张澄，并世之骁将，自南道伐寿阳城，',
        '前段明确普通三年、五年，六年承普通为525。北伐时以现官称名，是在任锚，不据此确定初授年。',
        status='served', kind='dated_in_office_attestation',
        extra=[('LS-C30-P0024', '普通三年，入为散骑常侍，领右骁骑将军，转太府卿，常侍如故。以公事免，未几，优诏复职。五年，迁中护军。', 'era_context')])

existing = {r['official_id']: r for r in DATA['records']}
for row in ADDITIONS:
    if row['official_id'] in existing:
        old = existing[row['official_id']]
        if (old['person'], old['office']) != (row['person'], row['office']):
            raise SystemExit(f"ID conflict {row['official_id']}; refusing to replace existing editorial work")
        continue
    DATA['records'].append(row)

exclusions = [
    ('王筠', '永嘉太守', 'LS-C35-P0057', '中大同元年，出为明威将军、永嘉太守，以疾固辞，徙为光禄大夫，', '546授而以疾固辞；是文士王筠，不与535遇害的广晋令王筠合并。'),
    ('褚球', '江夏太守', 'LS-C43-P0040', '中大同中，出为仁威临川王长史、江夏太守，以疾不赴职。', '中大同546明确不赴职，不投江夏在任；不影响523南兰陵授官。')]
for person, office, pid, quote, reason in exclusions:
    if any(r['person'] == person and r['office'] == office for r in DATA['excluded']):
        continue
    DATA['excluded'].append({'person': person, 'office': office, 'reason_code': 'not_served',
        'reason': reason, 'annual_presence_years': [], 'evidence': [evidence(pid, quote)]})

meta = DATA['meta']
meta.update(title='萧梁郡县长官：EPUB原典分批精校', reviewed_on='2026-09-27',
    record_count=len(DATA['records']),
    annual_record_count=sum(len(r['annual_presence_years']) for r in DATA['records']),
    reviewed_exclusion_count=len(DATA['excluded']))
meta['scope_note'] = '分批整理，尚未覆盖两书全部任次。原首批29条的独立审校保留；续批区分授官与在任，不把间隔年自动补齐。'
meta['continuation_review'] = {'date': '2026-09-27', 'added_ids': [r['official_id'] for r in ADDITIONS],
    'rule': 'Explicit source-era anchors only; preserve the independent review of records 0001–0029.',
    'remaining': '未穷尽898个候选段落；缺具体年、同名及摄任材料仍需继续考证。'}
DEST.write_text(json.dumps(DATA, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'tenures': meta['record_count'], 'annual': meta['annual_record_count'],
                  'excluded': meta['reviewed_exclusion_count'], 'batch': len(ADDITIONS)}, ensure_ascii=False))
