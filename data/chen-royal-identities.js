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
    meta: { version: '2026-09-10', source_title: '《陳書》卷二十八、卷六、卷三十六',
      source_urls: ['https://zh.wikisource.org/zh-hant/陳書/卷28', 'https://zh.wikisource.org/zh-hant/陳書/卷6', 'https://zh.wikisource.org/zh-hant/陳書/卷36'],
      policy: '依明載父子關係和年度皇位變化補色、校驗。559、566為年內易帝，保留原表姓名色而不作整年同父歸一；582後主正月即位，依即位後身份。死亡次年起不補色；皇帝本人不按皇兄弟補色。原表與身份色衝突記入驗證報告。' },
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
    deaths: { 陳伯宗: 570, 陳伯茂: 568, 陳伯固: 582, 陳伯謀: 583, 陳叔陵: 582, 陳叔獻: 580, 陳昌: 560 },
    // Reigning emperors are excluded from familial automatic colours.
    emperors: [{ name: '陳霸先', start: 557, end: 559 }, { name: '陳蒨', start: 559, end: 566 }, { name: '陳伯宗', start: 566, end: 568 }, { name: '陳頊', start: 569, end: 582 }, { name: '陳叔寶', start: 582, end: 588 }],
    individual: { 陳頊: [{ start: 560, end: 565, category: '皇弟', color: '#FF0000' }, { start: 567, end: 568, category: '始封王（非皇弟皇子）', color: '#D99694' }] },
    // Existing fief display periods are the authority for accession to these
    // inherited titles; their editor's mourning-year convention is retained.
    successors: ['陳方泰', '陳至澤', '陳孝寬', '陳鄷'],
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
