// Explicit source corrections; the original OCR-derived geography remains intact.
window.LIANG_ADMINISTRATIVE_CORRECTIONS = {
  meta: {
    scope: '校正富春、臨江兩郡始見年及549年吳郡隸州重疊；武原郡549年已在吳州原表，揚州層仍從550年起。',
    source: '《梁書》卷四、卷五十六；《通史》下卷第八編揚州、吳州沿革',
    note: '三郡為侯景控制下的建置，列示不表示梁廷在此時實際控制該地。'
  },
  prefectures: {
    liang_s0001_p004: {
      original_start: 502, end: 548,
      raw: '502—548（549年七月移屬吳州，州郡層按年末列示）',
      source: {
        source_label: '《梁書》卷四《簡文帝紀》・太清三年七月／大寶元年二月；《通史》第八編揚州吳郡條',
        excerpt: '太清三年七月「戊辰，以吳郡置吳州」；大寶元年二月「省吳州，如先為郡」。549年年末吳郡隸吳州，故不再同時列於揚州。550年返屬揚州的既有時段保留。',
        editorial_note: '縣層按人工表保留改屬當年，海鹽在549年的吳郡、武原郡並見；兩郡此年均列吳州。武原549年在吳州原表已存在，550是返屬揚州年，不是建郡年。'
      }
    },
    liang_s0001_p006: {
      original_start: 550, start: 549,
      raw: '549—557（始置年據《梁書》校正）',
      source: {
        source_label: '《梁書》卷五十六《侯景傳》・太清三年十一月',
        excerpt: '「景以錢塘為臨江郡，富陽為富春郡。」本條承太清三年敘事，故富春郡549年已置。舊抽取起年為550，今依原文校為549；其後沿革沿用原資料。',
        editorial_note: '侯景所置；不以郡名推定任何新的控制範圍。',
        epub_member: 'OEBPS/text00005.html', paragraph_id: 'LS-C58-P0079'
      }
    },
    liang_s0001_p007: {
      original_start: 550, start: 549,
      raw: '549—557（始置年據《梁書》校正）',
      source: {
        source_label: '《梁書》卷五十六《侯景傳》・太清三年十一月',
        excerpt: '「景以錢塘為臨江郡，富陽為富春郡。」本條承太清三年敘事，故臨江郡549年已置。舊抽取起年為550，今依原文校為549；其後沿革沿用原資料。',
        editorial_note: '侯景所置；錢塘改屬當年依人工表在吳、臨江兩郡並見。',
        epub_member: 'OEBPS/text00005.html', paragraph_id: 'LS-C58-P0079'
      }
    }
  }
};
