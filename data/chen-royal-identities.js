(() => {
  'use strict';
  // Display-only genealogy. Do not infer kinship from the surname or generation
  // character: the named children below are explicitly listed in Chen shu 28.
  const families = [
    { father: '陳蒨', children: '伯宗 伯茂 伯山 伯固 伯恭 伯信 伯仁 伯義 伯禮 伯智 伯謀'.split(' '),
      periods: [{ start: 560, end: 565, category: '皇子', color: '#C00000' }, { start: 567, end: 568, category: '皇兄弟', color: '#FF0000' }, { start: 569, end: 588, category: '文帝皇子（太建元年後）', color: '#BC6C64' }] },
    { father: '陳頊', children: '叔寶 叔陵 叔英 叔堅 叔卿 叔明 叔獻 叔齊 叔文 叔彪 叔重 叔儼 叔慎 叔雄 叔虞 叔平 叔達 叔敖 叔興 叔宣 叔穆 叔儉 叔澄 叔韶 叔純 叔謨 叔顯 叔隆 叔坦 叔榮 叔匡 叔叡 叔忠 叔弘 叔毅 叔訓 叔武 叔處 叔封'.split(' '),
      periods: [{ start: 569, end: 581, category: '皇子', color: '#C00000' }, { start: 582, end: 588, category: '皇弟', color: '#FF0000' }] },
    { father: '陳叔寶', children: '深 莊 胤 嶷 彥 兢 虔 恬 祗 恮 蕃 總 觀 明 綱 統 沖 洽 縚 綽 威 辯'.split(' '),
      periods: [{ start: 582, end: 588, category: '皇子', color: '#C00000' }] },
  ];
  window.CHEN_ROYAL_IDENTITIES = {
    meta: { version: '2026-09-13-touchup', source_title: '《陳書》卷十四、十五、二十八及原年表',
      source_urls: ['https://zh.wikisource.org/zh/陳書/卷14', 'https://zh.wikisource.org/zh/陳書/卷15', 'https://zh.wikisource.org/zh/陳書/卷28'],
      policy: '非陳姓綠色。卷十五明載遠支宗室及其子用褐系；紫色須有襲王記載與本年有效承襲記錄，服喪未襲王、縣侯不得紫；例外依使用者2026-09-13指定，鄱陽國世子陳君范用嗣王紫色，陳仲華用異姓綠色。已證父子關係而未襲王的皇子之子用藍色，不將長子擅稱庶出。559、566年內易帝不作整年同父歸一；582依即位後身份。原文、原字體及既有任期資料不改。' },
    families,
    // Reviewed names occurring in the workbook and governor summaries. These
    // are text-recognition keys, not claims of kinship or new appointments.
    // Keep documented source spellings so source text need not be rewritten.
    source_people: `陳霸先 陳蒨 陳頊 陳昌 陳褒 陳裒 陳諠 陳擬 陳詳 陳寶應 陳慧紀 陳方慶 陳袞 陳稜 陳桃根 陳文盛 陳正理 陳法武 陳秣
      蕭勃 蕭莊 蕭摩訶 蕭允 蕭濟 蕭瓛 蕭巖 蕭韶 蕭泰 司馬消難
      張立 荀朗 荀法尚 侯安都 侯安鼎 侯瑱 侯曉 紀機 寧猛力 寧逵 裴景徽 裴忌 裴子烈
      周文育 周寶安 周令真 周令珍 周迪 周敷 周炅 周確 周法僧 周法尚 周羅睺
      王奉國 王質 王瑒 王勇 王勵 王勱 王琳 孫瑒
      沈邁 沈恪 沈泰 沈欽 沈君理 沈君高 俞文冏 甘他 林馮 陸琰 陸瓊 陸山才 陸子隆 陸子才 陸見賢
      李綜 李幼榮 李暈 李賭 田龍升 吳超 吳明徹 吳明徽 吳慧覺 吳惠覺 吳世興 黃法氍 黃恪 黃偲
      楊寶安 楊縉 楊林甫 謝儼 謝基 施文慶 錢季卿 錢道戢 錢道戩 畢寶
      熊曇朗 熊門超 胡穎 劉廣德 韓子高 歐陽頠 歐陽紇 歐陽邃 歐陽盛
      趙知禮 孔奐 蔡景歷 皋文奏 鄭萬頃 留異 余孝頃 餘孝頃 程靈洗 程文季 駱牙 戴僧朔 戴晃
      馬靖 任忠 樊猛 樊毅 徐度 徐敬成 魯悉達 魯廣達 魯廣达 魯天念 華皎 淳于量 區白獸 顧覺 鄧嵩 呂子廓 戴智烈`.trim().split(/\s+/),
    deaths: { 陳伯宗: 570, 陳伯茂: 568, 陳伯固: 582, 陳伯謀: 583, 陳叔陵: 582, 陳叔獻: 580, 陳昌: 560, 陳擬: 560, 陳詳: 564, 陳訬: 564 },
    // Reigning emperors are excluded from familial automatic colours.
    emperors: [{ name: '陳霸先', start: 557, end: 559 }, { name: '陳蒨', start: 559, end: 566 }, { name: '陳伯宗', start: 566, end: 568 }, { name: '陳頊', start: 569, end: 582 }, { name: '陳叔寶', start: 582, end: 588 }],
    individual: {
      陳君范: [{ start: 557, end: 588, category: '嗣王色（鄱陽國世子；使用者指定）', color: '#7030A0', evidence: '使用者2026-09-13明確指定：鄱陽國世子陳君范，使用嗣王紫色；此為展示特例，不新增已襲王的史料判定' }],
      陳仲華: [{ start: 557, end: 588, category: '異姓（使用者指定）', color: '#00B050', evidence: '使用者2026-09-13明確指定：子國陳仲華使用異姓綠色' }],
      陳頊: [{ start: 557, end: 558, category: '始興嗣王（遙襲封）', color: '#7030A0', evidence: '《陳書》卷二、卷二十八明載襲封始興王' }, { start: 560, end: 565, category: '皇弟', color: '#FF0000' }, { start: 567, end: 568, category: '始封王（非皇弟皇子）', color: '#D99694' }],
      陳昌: [{ start: 557, end: 559, category: '皇子', color: '#C00000', evidence: '《陳書》卷十四：高祖第六子' }, { start: 560, end: 560, category: '皇弟（當年詔議稱謂）', color: '#FF0000', evidence: '《陳書》卷十四天嘉元年奏議稱第六皇弟昌' }],
      陳曇朗: [{ start: 557, end: 561, category: '南康嗣王（朝廷遙襲封；561年始知遇害）', color: '#7030A0', evidence: '《陳書》卷十四明載遙襲南康王；朝廷天嘉二年始聞凶問' }],
      陳叔英: [{ start: 560, end: 568, category: '皇弟之子（建安侯，未襲王）', color: '#0070C0', evidence: '《陳書》卷二十八：高宗第三子，天嘉元年封建安侯' }],
      陳叔堅: [{ start: 560, end: 568, category: '皇弟之子（豐城侯，未襲王）', color: '#0070C0', pending: true, evidence: '《陳書》卷二十八：高宗第四子，天嘉中封豐城侯；具體始封年沿用現表推定' }],
      陳叔陵: [{ start: 562, end: 568, category: '皇弟之子（康樂侯，未襲王）', color: '#0070C0', evidence: '《陳書》卷二十八父子名錄及卷三十六康樂侯記載；原年表568年江州同見' }],
    },
    // Existing fief display periods are the authority for accession to these
    // inherited titles; their editor's mourning-year convention is retained.
    successors: ['陳方泰', '陳至澤', '陳孝寬', '陳鄷'],
    // These are named relations, never a surname/generation-character guess.
    remote_relatives: Object.fromEntries('陳擬 陳褒 陳晃 陳炅 陳訬 陳諠 陳祏 陳詳 陳慧紀 陳敬雅 陳敬泰 陳黨 陳正理 陳正平'.split(' ').map(name => [name, {
      category: '疏遠宗室（卷十五）', color: name === '陳慧紀' ? '#632523' : '#984807',
      evidence: name === '陳黨' ? '《陳書》卷十五：陳擬子黨嗣侯' : name === '陳正理' ? '《陳書》卷十五：陳詳子正理嗣侯' : name === '陳正平' ? '《陳書》卷十五：慧紀子正平' : '《陳書》卷十五宗室封爵詔及本傳；依使用者指定為遠支宗室褐系',
      source_url: 'https://zh.wikisource.org/zh/陳書/卷15',
    }])),
    blue_relatives: {
      陳元基: { father: '陳伯義', category: '皇子之子（長子，湘潭侯；未襲王）', evidence: '《陳書》卷二十八：江夏王伯義長子元基，先封湘潭侯', source_url: 'https://zh.wikisource.org/zh/陳書/卷28' },
      陳番: { father: '陳伯仁', category: '皇子之子（長子，湘濱侯；未襲王）', evidence: '《陳書》卷二十八：廬陵王伯仁長子番，先封湘濱侯；不是後主子陳蕃', source_url: 'https://zh.wikisource.org/zh/陳書/卷28' },
      陳方慶: { father: '陳曇朗', category: '南康王之子（臨汝侯；未襲王）', evidence: '《陳書》卷十四：曇朗子方慶，天嘉中封臨汝縣侯；沿用原表藍色', source_url: 'https://zh.wikisource.org/zh/陳書/卷14' },
      陳方泰: { father: '陳曇朗', category: '南康國世子（本年未襲王）', evidence: '《陳書》卷十四父子與襲爵記載；未襲年度沿用既有封國紀年', source_url: 'https://zh.wikisource.org/zh/陳書/卷14' },
      陳至澤: { father: '陳伯宗', category: '皇子之子（本年未襲王）', evidence: '《陳書》卷四至澤世系；襲爵年度沿用既有封國紀年', source_url: 'https://zh.wikisource.org/zh/陳書/卷4' },
      陳孝寬: { father: '陳叔獻', category: '皇子之子（本年未襲王）', evidence: '《陳書》卷二十八：叔獻子孝寬，至德元年始襲河東王', source_url: 'https://zh.wikisource.org/zh/陳書/卷28' },
      陳鄷: { father: '陳伯謀', category: '皇子之子（本年未襲王）', evidence: '《陳書》卷二十八：伯謀子酆嗣；具體年度沿用既有封國紀年', source_url: 'https://zh.wikisource.org/zh/陳書/卷28' },
    },
    title_blocks: { 陳叔忠: '《陳書》卷二十八明列高宗子叔忠未及封；現封國表的永城王同名條未能對證，暫不補爵號' },
    title_overrides: { 陳君范: { start: 557, end: 588, title: '鄱陽國世子', evidence: '使用者2026-09-13明確指定姓名顯示為鄱陽國世子陳君范；不改任期與來源文字' } },
    // These relatives have stable kinship categories. Fill a missing annual
    // name colour from a dated workbook sample, keeping its precise shade.
    stable_relatives: {
      陳慧紀: { category: '疏屬（武帝從孫）', evidence: '《陳書》卷十五、《南史》卷六十五明載武帝從孫', source_url: 'https://zh.wikisource.org/zh-hant/南史_(四庫全書本)/卷65' },
      陳方慶: { category: '南康王陳曇朗之子（沿用原表藍色）', evidence: '《南史》卷六十五列南康愍王曇朗之子方泰、方慶', source_url: 'https://zh.wikisource.org/zh-hant/南史_(四庫全書本)/卷65' },
      陳褒: { category: '宗室侯（鍾陵侯）', evidence: '使用者封國考訂將575—576年合州刺史繫於鍾陵侯陳褒；同一宗元饒劾奏事，《陳書》卷二十九作陳裒、《南史》卷六十八作陳褒', source_url: 'https://zh.wikisource.org/zh-hant/南史/卷68' },
    },
    aliases: { 陳淵: '陳深', 陳酆: '陳鄷', 陳裒: '陳褒', 黃法戵: '黃法氍', 蕭巌: '蕭巖', 蕭𤩽: '蕭瓛' },
  };
})();
