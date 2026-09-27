// Explicit source corrections; the original OCR-derived geography remains intact.
window.LIANG_ADMINISTRATIVE_CORRECTIONS = {
  meta: {
    scope: '校正富春、臨江兩郡始見年及549年吳郡隸州重疊；武原郡549年已在吳州原表，揚州層仍從550年起。',
    source: '《梁書》卷四、卷五十六；《通史》下卷第八編揚州、吳州沿革',
    note: '三郡為侯景控制下的建置，列示不表示梁廷在此時實際控制該地。'
  },
  prefectures: {
    liang_s0001_p015: {
      original_raw: '557前—557', start: 557,
      raw: '557（此前復屬確年未详；不再將557前解析為502起）',
      source: {
        source_label: '《通史》第八編揚州東陽郡、婺州沿革；《陳書》卷一太平二年八月策文',
        excerpt: '普通五年東陽移東揚州，承聖二年前移婺州，太平二年八月策文已列揚州東陽。原始557前—557被機器展開成502—557，與東揚州段重疊。保留502—523舊段，復屬段只從可直證的557列示；中段另附婺州、縉州。',
        editorial_note: '557是有明文的展示年，不是斷言實際復屬發生於557。553之前轉婺州、556之前改縉州的確年尚待考。'
      }
    },
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
