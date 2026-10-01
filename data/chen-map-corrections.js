// Explicit, dated links based on administrative-source locations.
// A source feature at another level is used only when the book states co-location.
window.CHEN_MAP_CORRECTIONS = {
  version: 1,
  reviewed: '2026-10-01',
  source_book: '中國行政區劃通史·三國兩晉南朝卷（下）',
  seat_links: [
    {
      entity_id: 'ch_s0054', level: 'state', name: '桂州', start: 558, end: 588,
      source: 'CHGIS V6', source_level: 'prefecture', source_id: '35077', source_name: '始安郡',
      x: 2491.3, y: 2767.7,
      method: 'documented-co-location',
      reason: '通史明載桂州治始安（今廣西桂林市），與始安郡同治；原地圖沒有桂州治所記錄，使用有來源的同治所定位。',
      evidence: { book_page: 1456, pdf_page: 558, excerpt: '桂州（558—588），治始安（今广西桂林市）。……（一）始安郡（558—588）——治始安（今广西桂林市）', original_page_reviewed: true },
      corroborating_source: { source: 'CHGIS V6', source_level: 'county', source_id: '43738', source_name: '始安縣' }
    },
    {
      entity_id: 'ch_p0195', level: 'prefecture', name: '安成郡', parent_id: 'ch_s0054', start: 558, end: 588,
      source: 'CHGIS V6', source_level: 'prefecture', source_id: '35068', source_name: '安成郡',
      x: 2356.4, y: 3014.1,
      method: 'documented-location-and-parent',
      reason: '桂州安成在廣西賓陽，與江州／高州安成（江西安福）分屬不同實體；不得在缺少州治時取第一個同名郡點。',
      evidence: { book_page: 1457, pdf_page: 559, excerpt: '（五）安成郡（558—588）——治安成（今广西宾阳县东）。……梁置安成郡，属桂州。', original_page_reviewed: true },
      area_source: { source: 'CHGIS V5', source_id: '93318' }
    },
    {
      entity_id: 'ch_c0699', level: 'county', name: '安成', parent_id: 'ch_p0195', start: 558, end: 588,
      source: 'CHGIS V6', source_level: 'prefecture', source_id: '35068', source_name: '安成郡',
      x: 2356.4, y: 3014.1,
      method: 'documented-co-location',
      reason: '原書明載安成郡治安成縣，郡縣同治；縣點借用郡治的來源坐標，不另造縣治點。',
      evidence: { book_page: 1457, pdf_page: 559, excerpt: '（五）安成郡（558—588）——治安成（今广西宾阳县东）。……则陈有安成郡，并领有安成县。安成（558—588）', original_page_reviewed: true }
    },
    {
      entity_id: 'ch_p0059', level: 'prefecture', name: '安成郡', parent_id: 'ch_s0011', start: 558, end: 562,
      source: 'CHGIS V6', source_level: 'prefecture', source_id: '32576', source_name: '安成郡',
      x: 2967.9, y: 2509,
      method: 'documented-location-and-parent',
      reason: '江西安成在天嘉四年以前屬高州，治平都；與廣西桂州安成分開定位。',
      evidence: { book_page: 1395, pdf_page: 497, excerpt: '（四）安成郡（558—562）——治平都（今江西安福县东南）。……天嘉四年移属江州。', original_page_reviewed: true }
    },
    {
      entity_id: 'ch_p0050', level: 'prefecture', name: '安成郡', parent_id: 'ch_s0010', start: 563, end: 588,
      source: 'CHGIS V6', source_level: 'prefecture', source_id: '32576', source_name: '安成郡',
      x: 2967.9, y: 2509,
      method: 'documented-location-and-parent',
      reason: '天嘉四年罷高州後，江西安成移屬江州，沿用同一平都治所。',
      evidence: { book_page: 1390, pdf_page: 492, excerpt: '（十）安成郡（563—588）——治平都（今江西安福县东南）。……安成郡天嘉四年来属。', original_page_reviewed: true },
      area_source: { source: 'CHGIS V6', source_id: '97155' }
    }
  ],
  boundary_rules: [
    {
      source: 'CHGIS V4', source_id: '98090', name: '揚州', start: 587, end: 588, action: 'hold',
      reason: '此舊揚州面未反映祯明元年分置吳州；與以吳、吳興、錢塘郡面合成的吳州重疊，差異在安吉、建德附近形成袋狀區。暫停當作本年確定州界繪製，保留來源幾何和州治。不得以幾何差集把殘差解釋為飛地。',
      evidence: {
        book_page: 1371, pdf_page: 473,
        excerpt: '祯明元年十一月“乙亥，割扬州吴郡置吴州，割钱塘县为郡，属焉”。',
        related_entity_id: 'ch_s0002',
        annual_display_note: '保留原年表把吳州列在588年的既有分段；重建吳州面亦須按本年政區有效性顯示。',
        geometry_comparison: 'CHGIS V4 98090、CHGIS V4 98153 與重建面 ch_s0002-area 的局部輪廓不一致；安吉及建德治所落在舊揚州面内，未落在重建吳州面内。'
      }
    }
  ]
};
