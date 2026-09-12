/* Presentation-only boundaries for book excerpts. The original OCR stays in data/. */
(function (global) {
  'use strict';

  const contexts = new WeakMap();
  const qiaoSources = new WeakSet();
  const qiaoKeys = new Set();
  const cache = new WeakMap();
  const equivalents = {
    吳:'吴',興:'兴',揚:'扬',陽:'阳',陰:'阴',寧:'宁',東:'东',縣:'县',國:'国',
    陳:'陈',臨:'临',會:'会',豐:'丰',縉:'缙',烏:'乌',長:'长',樂:'乐',壽:'寿',
    廣:'广',廬:'庐',義:'义',華:'华',萬:'万',龍:'龙',豫:'豫',蘭:'兰',歸:'归',
    蘄:'蕲',濟:'济',馮:'冯',趙:'赵',隴:'陇',滎:'荥',鞏:'巩',緱:'缑',薊:'蓟',
    襄:'襄',並:'并',兗:'兖',鄧:'邓',廢:'废',臺:'台',脩:'修',鍾:'钟',鐘:'钟',
    鹽:'盐',錢:'钱',潛:'潜',淵:'渊',婁:'娄',鄉:'乡',綏:'绥',蓮:'莲',鄴:'邺',
    懷:'怀',盧:'卢',穀:'谷',鄆:'郓',韋:'韦',蒼:'苍',潁:'颍',汝:'汝',鄰:'邻',
    莊:'庄',營:'营',濱:'滨',潯:'浔',貴:'贵',資:'资',羅:'罗',閩:'闽',晉:'晋',
    南:'南',陸:'陆',蕭:'萧',隨:'随',歷:'历',祿:'禄',涇:'泾',雲:'云',遷:'迁',
    開:'开',遼:'辽',帶:'带',肅:'肃',滄:'沧',漢:'汉',湯:'汤',涼:'凉',蘇:'苏',
    黃:'黄',雋:'隽',簡:'简',嶺:'岭',監:'监',門:'门',內:'内',農:'农',渾:'浑',
    鄭:'郑',陝:'陕',楊:'杨',澤:'泽',聞:'闻',慮:'虑',獲:'获',溫:'温',鄲:'郸',
    館:'馆',發:'发',頓:'顿',衛:'卫',蕩:'荡',儀:'仪',棗:'枣',溝:'沟',馬:'马',
    範:'范',離:'离',單:'单',張:'张',須:'须',無:'无',剛:'刚',萊:'莱',蕪:'芜',
    強:'强',愛:'爱',風:'风',龐:'庞',軍:'军',遠:'远',藥:'药',觀:'观',應:'应',
    齊:'齐',當:'当',倫:'伦',賓:'宾',編:'编',鳶:'鸢',於:'于',婺:'婺'
  };

  function normalizedName(value) {
    return String(value || '').replace(/[\u3400-\u9fff]/g, char => equivalents[char] || char)
      .replace(/[\s※?？]/g, '');
  }

  function sourceKey(source) {
    return `${source?.source_title || ''}|${source?.book_page || ''}|${source?.pdf_page || ''}|${source?.excerpt || ''}`;
  }

  function markQiao(source) {
    if (!source || typeof source !== 'object') return;
    qiaoSources.add(source);
    qiaoKeys.add(sourceKey(source));
  }

  function indexData(data) {
    function visit(node, inherited) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(item => visit(item, inherited)); return; }
      let context = inherited;
      if (node.id && (node.name || node.base_name || node.n)) {
        context = {
          id:node.id,
          names:[node.name, node.base_name, node.n, ...(node.phases || node.ph || []).map(phase => phase.name)].filter(Boolean),
          level:Array.isArray(node.prefectures) || Array.isArray(node.p) ? 'state' : Array.isArray(node.counties) ? 'prefecture' : 'county'
        };
      }
      if (context && ('excerpt' in node || 'book_page' in node || 'pdf_page' in node)) contexts.set(node, context);
      const qiao = node.qiao_annotation;
      if (qiao) (qiao.sources || [qiao.source].filter(Boolean)).forEach(markQiao);
      Object.values(node).forEach(value => visit(value, context));
    }
    visit(data, null);
  }

  function heading(line) {
    const text = line.trim().replace(/^#{1,6}\s*/, '')
      .replace(/\\underline\{([^{}]+)\}/g, '$1').replace(/\^\{[^{}]*\}/g, '').replace(/[*_]/g, '');
    const county = text.match(/^\d+\s*[.．、]\s*([\u3400-\u9fff、]{1,24})(?=\s*(?:[（(，,]|$))/);
    if (county) return {level:'county', name:county[1]};
    const prefecture = text.match(/^(?:[（(]?[一二三四五六七八九十百]+[）)]\s*)?([\u3400-\u9fff、]{1,24}(?:郡|國|国|尹))(?=\s*(?:[（(，,]|$))/);
    if (prefecture) return {level:'prefecture', name:prefecture[1]};
    const state = text.match(/^(?:第[一二三四五六七八九十百]+[節节]\s*|[一二三四五六七八九十百]+[、．.]\s*)?([\u3400-\u9fff、]{1,20}州)(?=\s*(?:沿革|[（(，,]|$))/);
    if (state) return {level:'state', name:state[1]};
    // A prefecture with one county often has no "1." before the county title.
    const unnumberedCounty = text.match(/^([\u3400-\u9fff]{1,12})\s*[（(]\s*\d{3}[^）)]*[）)]\s*$/);
    if (unnumberedCounty) return {level:'county', name:unnumberedCounty[1]};
    if (/^[圖图]\s*\d+\s/.test(text)) return {level:'figure', name:''};
    return null;
  }

  function sameName(name, context) {
    return context.names.some(candidate => normalizedName(candidate) === normalizedName(name));
  }

  function scopedExcerpt(source, context = contexts.get(source)) {
    const original = String(source?.excerpt || '');
    if (!context || !original) return original;
    // Some OCR rows flattened two numbered county headings onto one line.
    const lines = original.replace(/[ \t]+(?=\d+\s*[.．]\s*[\u3400-\u9fff]{1,12}\s*[（(]\s*\d{3})/g, '\n').split(/\r?\n/);
    const headings = lines.map((line, index) => ({...heading(line), index})).filter(item => item.level);
    // Exact entity names also resolve ambiguous suffixes, e.g. 昌國 is a county.
    const own = headings.find(item => sameName(item.name, context));
    // A number/title lost to OCR is not enough evidence to remove the opening text.
    // For a clear same-level heading, a known title match takes priority over any preceding tail.
    const start = own?.index ?? 0;
    const boundary = headings.find(item => item.index > start && !(
      context.level === 'state' && item.level === 'state' && (
        sameName(item.name, context) || normalizedName(item.name) === normalizedName(headings[0]?.name)
      )
    ));
    let excerpt = lines.slice(start, boundary?.index ?? lines.length).join('\n').trim();
    if (!own && headings[0]?.index === 0 && headings[0].level !== context.level) {
      // An inherited parent excerpt is not the county's own entry. Some OCR
      // records have the wrong parent title followed by a valid county note;
      // retain that note only when it explicitly names the current entity.
      excerpt = lines.slice(1, boundary?.index ?? lines.length).join('\n').split(/\n\s*\n/)
        .filter(paragraph => /^按[：:]/.test(paragraph.trim()) && context.names.some(name =>
          normalizedName(paragraph).includes(normalizedName(name))
        )).join('\n\n').trim();
    }

    // On book p.1366 the OCR put the 武康 note after 烏程. Move the existing
    // paragraph back to its county in the display, without editing the OCR record.
    if (source.book_page === 1366 && ['ch_c0032', 'ch_c0033'].includes(context.id)) {
      const wukang = original.match(/按：齐吴兴郡领有武康县[^\n]*/)?.[0];
      if (context.id === 'ch_c0032' && wukang && !excerpt.includes(wukang)) excerpt += `\n\n${wukang}`;
      if (context.id === 'ch_c0033' && wukang) excerpt = excerpt.replace(wukang, '').trim();
    }
    // Other verified OCR paragraph-order errors use the surviving county note,
    // not the adjoining county's misplaced heading. These are literal extracts.
    const noteCorrections = {
      ch_c0396:{page:1415, opening:'按：《地形志》中豫州广陵郡宋安：'},
      ch_c0397:{page:1415, opening:'按：《地形志》中豫州广陵郡光城：'},
      ch_c0689:{page:1456, opening:'按：齐始安郡领有荔浦县'},
      ch_c0690:{page:1456, opening:'按：齐始安郡领有永丰县'},
      ch_c0798:{page:1471, opening:'按：《方舆纪要》卷110《广西五》南宁府横州蒙泽废县条：'},
      ch_p0234:{page:1471, opening:'按：梁置岭山郡'}
    };
    const correction = noteCorrections[context.id];
    if (correction?.page === source.book_page) {
      const note = original.split(/\r?\n/).find(line => line.startsWith(correction.opening));
      if (note) excerpt = context.level === 'prefecture' && own ? `${lines[own.index]}\n\n${note}` : note;
    }
    return excerpt;
  }

  function displaySource(source, options = {}) {
    if (!source || typeof source !== 'object') return {excerpt:'', pagesOnly:false};
    const pagesOnly = !!options.pagesOnly || qiaoSources.has(source) || qiaoKeys.has(sourceKey(source));
    if (pagesOnly) return {excerpt:'', pagesOnly:true};
    if (!cache.has(source)) cache.set(source, scopedExcerpt(source));
    return {excerpt:cache.get(source), pagesOnly:false};
  }

  [global.JIN_DATA, global.CHEN_DATA, global.LIANG_DATA].filter(Boolean).forEach(indexData);
  global.SOURCE_ANNOTATIONS = {displaySource, scopedExcerpt, indexData, heading};
})(window);
