/* Source-specific Liang governor entity decisions; keep held entries separate. */
window.LIANG_GOVERNOR_LINKS = {
  "meta": {
    "title": "梁代同名方鎮逐條行政入口裁決",
    "schema_version": "liang-governor-links-v1",
    "reviewed_on": "2026-10-01",
    "source_governors_sha256": "beebb79bc808e94cca6951dde740ab270c918508d423f7f538ca2658cab918b0",
    "source_ocr_sha256": "033eea8e97f3e654d3db3e12042458bff1255d9af4d2ad199fdff7bf634d793e",
    "record_count": 73,
    "attached_decisions": 48,
    "held_decisions": 24,
    "match_rule": "year + state + source_page_index + exact original summary_lines; no name-only fallback for held or stale decisions",
    "scope": "覆蓋既有同年度重複州名的全部20條，並補相關高州、梁州沿革；不代表1049條已全部完成行政實體考證。 2026-10-01補541—548名州任段、537—548蕭泰譙州任段及546跨州合段校正；仍不代表全部1049條考證完成。",
    "hold_rule": "hold保留分源獨立入口及原因；candidate_target_ids不授權自動掛接或修改實體年代。",
    "target_rule": "attach須由target_id在本年活動實體中解析，允許原書省稱與實體名不同；目標不活動時轉待考，不回退首個同名州。",
    "historical_limit": "只連接原有逐年史料，不推定全部長官實際到任，不推展任期，保留原書遙領與未任注。",
    "split_decisions": 1,
    "continuity_rule": "延續的是原表已有年度條目的行政實體身份，不由一個年份補出空白任期；州改名、遷治、失陷、人物轉任須分段。",
    "split_rule": "split必須以summary_line_indexes完整且互斥地覆蓋原摘要，分行後仍保留原state、頁碼、摘要；任何失配轉待考。"
  },
  "records": [
    {
      "id": "liang-governor-link-502-394-高州",
      "year": 502,
      "state": "高州",
      "source_page_index": 394,
      "summary_lines": [
        "巴山。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0014"
      ],
      "rejected_target_ids": [],
      "reason": "首年條目只有承聖、太平年間高州沿革的目錄補錄，摘要“巴山”不是502年長官或建置；保留原書入口，不建立502年度行政連接。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・高州",
          "source_page_indexes": [
            587,
            588
          ],
          "source_pdf_pages": [
            588,
            589
          ],
          "quote": "迪乃據有臨川之地，築城于工塘。梁元帝授迪持節、通直散騎常侍、壯武將軍、高州刺史。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 556,
          "source_section": "梁方鎮年表・太平元年丙子(556) 九月，改元。・高州",
          "source_page_indexes": [
            618
          ],
          "source_pdf_pages": [
            619
          ],
          "quote": "太平元年，割江州四郡置高州，以法氍爲使持節、散騎常侍、都督高州諸軍事、信武將軍、高州刺史，鎮于巴山。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "catalogue_not_annual_office",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-532-506-譙州",
      "year": 532,
      "state": "譙州",
      "source_page_index": 506,
      "summary_lines": [
        "羊鴉仁 都督譙州諸軍事、信威將軍、譙州刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "原書明辨羊鴉仁為新昌譙州；底表淮南南譙州領新昌郡，因此與淮北本年短置之譙州分開。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 532,
          "source_section": "梁方鎮年表・中大通四年壬子（532）・譙州",
          "source_page_indexes": [
            506
          ],
          "source_pdf_pages": [
            507
          ],
          "quote": "羊鴉仁所任當爲新昌之譙州。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-532-507-譙州",
      "year": 532,
      "state": "譙州",
      "source_page_index": 507,
      "summary_lines": [
        "劉世明 刺史。",
        "朱文開 刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0038",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0021"
      ],
      "reason": "劉世明、朱文開條直接記北魏南兗州降梁、改譙州及七月復失；與淮北532年譙州相合。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 532,
          "source_section": "梁方鎮年表・中大通四年壬子（532）・譙州",
          "source_page_indexes": [
            507
          ],
          "source_pdf_pages": [
            508
          ],
          "quote": "魏南兗州刺史劉世明以城降，改魏南兗州爲譙州，以世明爲刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0038",
          "name": "譙州",
          "region": "淮北",
          "phases": [
            {
              "start": 532,
              "end": 532,
              "name": "譙州",
              "uncertain": false,
              "raw": "532"
            }
          ],
          "prefecture_names": []
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-537-521-譙州",
      "year": 537,
      "state": "譙州",
      "source_page_index": 521,
      "summary_lines": [
        "#### 羊鴉仁",
        "蕭泰 仁威將軍、刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・譙州",
          "source_page_indexes": [
            521
          ],
          "source_pdf_pages": [
            522
          ],
          "quote": "#### 羊鴉仁\n蕭泰 仁威將軍、刺史。\n《南史》卷五二《蕭泰傳》：“泰字世怡，封豐城侯。歷位中書舍人，傾竭財產，以事時要，超爲譙州刺史。”《周書》卷四二《蕭世怡傳》：“梁武帝弟鄱陽王恢之子也。以名犯太祖諱，故稱字焉。……出爲持節、仁威將軍、譙州刺史。”《蕭泰墓誌》（《庾子山集》卷一五）：“大同元年，入直殿省。其年，轉太子中書舍人。……大同三年，授持節、仁威將軍、譙州刺史。”按：本書所引《庾子山集》之碑、誌，爲統一體例，題名皆用簡稱。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "Y293",
          "year": 537,
          "quote": "昌寶義\n豐城侯蕭泰",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-537-523-高州",
      "year": 537,
      "state": "高州",
      "source_page_index": 523,
      "summary_lines": [
        "孫冏 刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0090",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0014"
      ],
      "reason": "孫冏一系有廣州、交州及高涼置州的交叉記載，連到嶺南高州；保留孫固/孫冏「或即一人」原按語，不更改人名。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "乃表臺於高涼郡立州。敕仍以爲高州，以西江督護孫固爲刺史。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "《陳書·杜僧明傳》有高州刺史孫冏，或即一人。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・交州",
          "source_page_indexes": [
            531
          ],
          "source_pdf_pages": [
            532
          ],
          "quote": "臺遣高州刺史孫冏、新州刺史盧子雄將兵擊之，冏等不時進，皆於廣州伏誅。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-538-525-高州",
      "year": 538,
      "state": "高州",
      "source_page_index": 525,
      "summary_lines": [
        "孫冏"
      ],
      "decision": "attach",
      "target_id": "liang_s0090",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0014"
      ],
      "reason": "孫冏一系有廣州、交州及高涼置州的交叉記載，連到嶺南高州；保留孫固/孫冏「或即一人」原按語，不更改人名。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "乃表臺於高涼郡立州。敕仍以爲高州，以西江督護孫固爲刺史。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "《陳書·杜僧明傳》有高州刺史孫冏，或即一人。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・交州",
          "source_page_indexes": [
            531
          ],
          "source_pdf_pages": [
            532
          ],
          "quote": "臺遣高州刺史孫冏、新州刺史盧子雄將兵擊之，冏等不時進，皆於廣州伏誅。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-539-526-譙州",
      "year": 539,
      "state": "譙州",
      "source_page_index": 526,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 539,
          "source_section": "梁方鎮年表・大同五年己未（539）・譙州",
          "source_page_indexes": [
            526
          ],
          "source_pdf_pages": [
            527
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "Y295",
          "year": 539,
          "quote": "豐城侯蕭泰",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-539-527-高州",
      "year": 539,
      "state": "高州",
      "source_page_index": 527,
      "summary_lines": [
        "孫冏"
      ],
      "decision": "attach",
      "target_id": "liang_s0090",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0014"
      ],
      "reason": "孫冏一系有廣州、交州及高涼置州的交叉記載，連到嶺南高州；保留孫固/孫冏「或即一人」原按語，不更改人名。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "乃表臺於高涼郡立州。敕仍以爲高州，以西江督護孫固爲刺史。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "《陳書·杜僧明傳》有高州刺史孫冏，或即一人。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・交州",
          "source_page_indexes": [
            531
          ],
          "source_pdf_pages": [
            532
          ],
          "quote": "臺遣高州刺史孫冏、新州刺史盧子雄將兵擊之，冏等不時進，皆於廣州伏誅。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-540-529-高州",
      "year": 540,
      "state": "高州",
      "source_page_index": 529,
      "summary_lines": [
        "孫冏"
      ],
      "decision": "attach",
      "target_id": "liang_s0090",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0014"
      ],
      "reason": "孫冏一系有廣州、交州及高涼置州的交叉記載，連到嶺南高州；保留孫固/孫冏「或即一人」原按語，不更改人名。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "乃表臺於高涼郡立州。敕仍以爲高州，以西江督護孫固爲刺史。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "《陳書·杜僧明傳》有高州刺史孫冏，或即一人。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・交州",
          "source_page_indexes": [
            531
          ],
          "source_pdf_pages": [
            532
          ],
          "quote": "臺遣高州刺史孫冏、新州刺史盧子雄將兵擊之，冏等不時進，皆於廣州伏誅。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-541-529-江州",
      "year": 541,
      "state": "江州",
      "source_page_index": 529,
      "summary_lines": [
        "湘東王繹"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・江州",
          "source_page_indexes": [
            529
          ],
          "source_pdf_pages": [
            530
          ],
          "quote": "湘東王繹"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F297",
          "year": 541,
          "quote": "湘東王蕭繹\n王僧辯為雲騎將軍、府司馬，守湓城，監安陸郡，暫係於此",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-541-530-譙州",
      "year": 541,
      "state": "譙州",
      "source_page_index": 530,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・譙州",
          "source_page_indexes": [
            530
          ],
          "source_pdf_pages": [
            531
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-541-531-高州",
      "year": 541,
      "state": "高州",
      "source_page_index": 531,
      "summary_lines": [
        "孫冏 被殺。"
      ],
      "decision": "attach",
      "target_id": "liang_s0090",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0014"
      ],
      "reason": "孫冏一系有廣州、交州及高涼置州的交叉記載，連到嶺南高州；保留孫固/孫冏「或即一人」原按語，不更改人名。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "乃表臺於高涼郡立州。敕仍以爲高州，以西江督護孫固爲刺史。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 537,
          "source_section": "梁方鎮年表・大同三年丁巳（537）・廣州",
          "source_page_indexes": [
            523
          ],
          "source_pdf_pages": [
            524
          ],
          "quote": "《陳書·杜僧明傳》有高州刺史孫冏，或即一人。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 541,
          "source_section": "梁方鎮年表・大同七年辛酉（541）・交州",
          "source_page_indexes": [
            531
          ],
          "source_pdf_pages": [
            532
          ],
          "quote": "臺遣高州刺史孫冏、新州刺史盧子雄將兵擊之，冏等不時進，皆於廣州伏誅。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-542-532-江州",
      "year": 542,
      "state": "江州",
      "source_page_index": 532,
      "summary_lines": [
        "湘東王繹"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 542,
          "source_section": "梁方鎮年表・大同八年壬戌（542）・江州",
          "source_page_indexes": [
            532
          ],
          "source_pdf_pages": [
            533
          ],
          "quote": "湘東王繹"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F298",
          "year": 542,
          "quote": "湘東王蕭繹",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-542-532-譙州",
      "year": 542,
      "state": "譙州",
      "source_page_index": 532,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 542,
          "source_section": "梁方鎮年表・大同八年壬戌（542）・譙州",
          "source_page_indexes": [
            532
          ],
          "source_pdf_pages": [
            533
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-542-532-郢州",
      "year": 542,
      "state": "郢州",
      "source_page_index": 532,
      "summary_lines": [
        "邵陵王綸"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 542,
          "source_section": "梁方鎮年表・大同八年壬戌（542）・郢州",
          "source_page_indexes": [
            532
          ],
          "source_pdf_pages": [
            533
          ],
          "quote": "邵陵王綸"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H298",
          "year": 542,
          "quote": "邵陵王蕭綸",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-543-533-江州",
      "year": 543,
      "state": "江州",
      "source_page_index": 533,
      "summary_lines": [
        "湘東王繹"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 543,
          "source_section": "梁方鎮年表・大同九年癸亥(543)・江州",
          "source_page_indexes": [
            533
          ],
          "source_pdf_pages": [
            534
          ],
          "quote": "湘東王繹"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F299",
          "year": 543,
          "quote": "湘東王蕭繹",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-543-534-湘州",
      "year": 543,
      "state": "湘州",
      "source_page_index": 534,
      "summary_lines": [
        "張纘 宣惠將軍、都督湘桂東寧三州諸軍事、湘州刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0115",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0025",
        "liang_s0082"
      ],
      "reason": "543年張纘都督湘桂東寧三州，至548年河東王譽代任，原任段對應臨湘湘州。只附已有年度條，不補原表未列的544年；邵陵王綸未任等原注保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 543,
          "source_section": "梁方鎮年表・大同九年癸亥(543)・湘州",
          "source_page_indexes": [
            534
          ],
          "source_pdf_pages": [
            535
          ],
          "quote": "張纘 宣惠將軍、都督湘桂東寧三州諸軍事、湘州刺史。\n《梁書》卷三四《張纘傳》：“九年，遷宣惠將軍、丹陽尹，未拜，改爲使持節、都督湘桂東寧三州諸軍事、湘州刺史。”《廿二史考異》卷二六《梁書·張纘傳》：“東寧州之名，《本紀》亦失書。《隋志》，始安郡義熙縣，舊曰齊熙，置齊熙、黃水二郡及東寧州。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            394
          ],
          "source_printed_pages": [
            1292
          ],
          "quote": "湘州（502—557），治临湘（今湖南长沙市）。齐末有湘州。梁承之，改营阳郡为永阳郡，增置岳阳、乐梁、药山等郡。据衡州考证，天监六年（507）四月，临贺、始兴、桂阳三郡移置衡州；据桂州考证，大同六年（540）移桂州治于始安郡，始安郡乃移属桂州。太清三年（549）后，药山、岳阳郡移属罗州，永阳郡移置营州，承圣二年（553）初，永阳郡复还属湘州。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "J299",
          "year": 543,
          "quote": "張纘",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0115",
          "name": "湘州",
          "region": "沅湘",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "湘州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "長沙郡",
            "湘東郡",
            "衡陽郡",
            "零陵郡",
            "永陽郡",
            "臨賀郡",
            "樂梁郡",
            "邵陵郡",
            "岳陽郡",
            "藥山郡",
            "始興郡",
            "桂陽郡",
            "始安郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-543-534-譙州",
      "year": 543,
      "state": "譙州",
      "source_page_index": 534,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 543,
          "source_section": "梁方鎮年表・大同九年癸亥(543)・譙州",
          "source_page_indexes": [
            534
          ],
          "source_pdf_pages": [
            535
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-543-534-郢州",
      "year": 543,
      "state": "郢州",
      "source_page_index": 534,
      "summary_lines": [
        "邵陵王綸"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 543,
          "source_section": "梁方鎮年表・大同九年癸亥(543)・郢州",
          "source_page_indexes": [
            534
          ],
          "source_pdf_pages": [
            535
          ],
          "quote": "邵陵王綸"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H299",
          "year": 543,
          "quote": "邵陵王蕭綸\n平西諮議參軍加戎昭將軍劉顯",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-544-536-江州",
      "year": 544,
      "state": "江州",
      "source_page_index": 536,
      "summary_lines": [
        "湘東王繹"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 544,
          "source_section": "梁方鎮年表・大同十年甲子（544）・江州",
          "source_page_indexes": [
            536
          ],
          "source_pdf_pages": [
            537
          ],
          "quote": "湘東王繹"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F300",
          "year": 544,
          "quote": "湘東王蕭繹",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-544-536-譙州",
      "year": 544,
      "state": "譙州",
      "source_page_index": 536,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 544,
          "source_section": "梁方鎮年表・大同十年甲子（544）・譙州",
          "source_page_indexes": [
            536
          ],
          "source_pdf_pages": [
            537
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-544-537-郢州",
      "year": 544,
      "state": "郢州",
      "source_page_index": 537,
      "summary_lines": [
        "邵陵王綸"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 544,
          "source_section": "梁方鎮年表・大同十年甲子（544）・郢州",
          "source_page_indexes": [
            537
          ],
          "source_pdf_pages": [
            538
          ],
          "quote": "邵陵王綸"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H300",
          "year": 544,
          "quote": "邵陵王蕭綸",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-544-538-交州",
      "year": 544,
      "state": "交州",
      "source_page_index": 538,
      "summary_lines": [
        "楊暻 刺史。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0103"
      ],
      "rejected_target_ids": [
        "liang_s0062"
      ],
      "reason": "楊暻與陳霸先南討的官銜指嶺南交州；本年底表交州仍在李賁之亂期間而未列為梁控制，不得回退到江漢唯一同名交州。保留本年任官及征討條目，不推年末行政歸屬。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 544,
          "source_section": "梁方鎮年表・大同十年甲子（544）・交州",
          "source_page_indexes": [
            538
          ],
          "source_pdf_pages": [
            539
          ],
          "quote": "楊暻 刺史。\n《陳書》卷一《高祖紀上》：“高祖送喪還都，至大庾嶺，會有詔高祖爲交州司馬、領武平太守，與刺史楊曛南討。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            363
          ],
          "source_printed_pages": [
            1261
          ],
          "quote": "交州（502—540，546—557），治龙编（今越南北宁省仙游县东）。齐末有交州，梁承之。普通四年，九真郡移置爱州；大同八年前，宋寿郡移属安州；大同九年前，九德郡移置德州。又移新昌郡于兴州。《梁书》卷3《武帝纪下》：大同七年，“交州土民李贲攻刺史萧谘，谘输赂，得还越州”。大同十年“春正月，李贲于交趾窃位号，署置百官”。中大同元年（546）正月，“交州平”。则大同七年交州没，中大同元年复交州（此年之政区见图54）。太清二年五月，“辛亥，曲赦交、爱、德三州”。交州至梁末犹存。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "T300",
          "year": 544,
          "quote": "楊㬓\n交州司馬領武平太守陳霸先",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01"
    },
    {
      "id": "liang-governor-link-545-538-江州",
      "year": 545,
      "state": "江州",
      "source_page_index": 538,
      "summary_lines": [
        "湘東王繹"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 545,
          "source_section": "梁方鎮年表・大同十一年乙醜（545）・江州",
          "source_page_indexes": [
            538
          ],
          "source_pdf_pages": [
            539
          ],
          "quote": "湘東王繹"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F301",
          "year": 545,
          "quote": "湘東王蕭繹",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-545-538-湘州",
      "year": 545,
      "state": "湘州",
      "source_page_index": 538,
      "summary_lines": [
        "張纘"
      ],
      "decision": "attach",
      "target_id": "liang_s0115",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0025",
        "liang_s0082"
      ],
      "reason": "543年張纘都督湘桂東寧三州，至548年河東王譽代任，原任段對應臨湘湘州。只附已有年度條，不補原表未列的544年；邵陵王綸未任等原注保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 545,
          "source_section": "梁方鎮年表・大同十一年乙醜（545）・湘州",
          "source_page_indexes": [
            538
          ],
          "source_pdf_pages": [
            539
          ],
          "quote": "張纘"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            394
          ],
          "source_printed_pages": [
            1292
          ],
          "quote": "湘州（502—557），治临湘（今湖南长沙市）。齐末有湘州。梁承之，改营阳郡为永阳郡，增置岳阳、乐梁、药山等郡。据衡州考证，天监六年（507）四月，临贺、始兴、桂阳三郡移置衡州；据桂州考证，大同六年（540）移桂州治于始安郡，始安郡乃移属桂州。太清三年（549）后，药山、岳阳郡移属罗州，永阳郡移置营州，承圣二年（553）初，永阳郡复还属湘州。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "J301",
          "year": 545,
          "quote": "張纘",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0115",
          "name": "湘州",
          "region": "沅湘",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "湘州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "長沙郡",
            "湘東郡",
            "衡陽郡",
            "零陵郡",
            "永陽郡",
            "臨賀郡",
            "樂梁郡",
            "邵陵郡",
            "岳陽郡",
            "藥山郡",
            "始興郡",
            "桂陽郡",
            "始安郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-545-538-譙州",
      "year": 545,
      "state": "譙州",
      "source_page_index": 538,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 545,
          "source_section": "梁方鎮年表・大同十一年乙醜（545）・譙州",
          "source_page_indexes": [
            538
          ],
          "source_pdf_pages": [
            539
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "Y301",
          "year": 545,
          "quote": "譙州長史裴之平，不知何\n年，暫係於此",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-545-538-郢州",
      "year": 545,
      "state": "郢州",
      "source_page_index": 538,
      "summary_lines": [
        "邵陵王綸",
        "南平王恪 刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 545,
          "source_section": "梁方鎮年表・大同十一年乙醜（545）・郢州",
          "source_page_indexes": [
            538,
            539
          ],
          "source_pdf_pages": [
            539,
            540
          ],
          "quote": "邵陵王綸\n南平王恪 刺史。\n《梁書》卷二九《邵陵王綸傳》：“遷爲安前將軍、丹陽尹。”《南史》卷五二《南平王偉傳》：“世子恪嗣。……太清中，爲郢州刺史。”按：綸何年遷丹陽尹不詳，恪當繼綸。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H301",
          "year": 545,
          "quote": "邵陵王蕭綸",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-545-540-交州",
      "year": 545,
      "state": "交州",
      "source_page_index": 540,
      "summary_lines": [
        "#### 楊暻"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0103"
      ],
      "rejected_target_ids": [
        "liang_s0062"
      ],
      "reason": "楊暻與陳霸先南討的官銜指嶺南交州；本年底表交州仍在李賁之亂期間而未列為梁控制，不得回退到江漢唯一同名交州。保留本年任官及征討條目，不推年末行政歸屬。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 545,
          "source_section": "梁方鎮年表・大同十一年乙醜（545）・交州",
          "source_page_indexes": [
            540
          ],
          "source_pdf_pages": [
            541
          ],
          "quote": "#### 楊暻\n《陳書》卷一《高祖紀上》：“十一年六月，軍至交州，賁衆數萬於蘇歷江口立城栅以拒官軍。”《通鑑》卷一五九大同十一年六月《考異》：“《典略》作‘十二月癸丑至交州。’”《南史》卷九《陳武帝紀》：“帝益招勇敢，器械精利，暻委帝經略。時蕭勃爲定州刺史，於西江相會，勃知軍士憚遠役，因詭說留暻。暻集諸將問計，帝曰：‘交阯叛換，罪由宗室，節下奉辭伐罪，故當死生以之。’於是鼓行而進。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            363
          ],
          "source_printed_pages": [
            1261
          ],
          "quote": "交州（502—540，546—557），治龙编（今越南北宁省仙游县东）。齐末有交州，梁承之。普通四年，九真郡移置爱州；大同八年前，宋寿郡移属安州；大同九年前，九德郡移置德州。又移新昌郡于兴州。《梁书》卷3《武帝纪下》：大同七年，“交州土民李贲攻刺史萧谘，谘输赂，得还越州”。大同十年“春正月，李贲于交趾窃位号，署置百官”。中大同元年（546）正月，“交州平”。则大同七年交州没，中大同元年复交州（此年之政区见图54）。太清二年五月，“辛亥，曲赦交、爱、德三州”。交州至梁末犹存。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "T301",
          "year": 545,
          "quote": "楊㬓\n交州司馬領武平太守陳霸先",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01"
    },
    {
      "id": "liang-governor-link-546-541-江州",
      "year": 546,
      "state": "江州",
      "source_page_index": 541,
      "summary_lines": [
        "湘東王繹"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 546,
          "source_section": "梁方鎮年表・中大同元年丙寅（546）・江州",
          "source_page_indexes": [
            541
          ],
          "source_pdf_pages": [
            542
          ],
          "quote": "湘東王繹"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F302",
          "year": 546,
          "quote": "湘東王蕭繹\n鎮南湘東王長史尋陽太守張嵊 轉、府司馬新蔡太守王僧辯",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-546-541-譙州",
      "year": 546,
      "state": "譙州",
      "source_page_index": 541,
      "summary_lines": [
        "蕭泰",
        "蕭正表 都督北徐西徐仁睢安五州諸軍事、輕車將軍、北徐州刺史，鎮鍾離。"
      ],
      "decision": "split",
      "target_id": null,
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "方鎮匯入把蕭泰與北徐州蕭正表合成一條；按原官銜及工作簿Q302分行附着，保留原分源摘要供追溯。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 546,
          "source_section": "梁方鎮年表・中大同元年丙寅（546）・譙州",
          "source_page_indexes": [
            541
          ],
          "source_pdf_pages": [
            542
          ],
          "quote": "蕭泰\n蕭正表 都督北徐西徐仁睢安五州諸軍事、輕車將軍、北徐州刺史，鎮鍾離。\n《魏書》卷五九《蕭正表傳》：“歷東宮洗馬、淮南晉安二郡太守。轉輕車將軍、北徐州刺史，鎮鍾離。”《蕭正表墓誌》（《墓誌集成》七六九）：“授使持節、都督北徐西徐仁睢安五州諸軍事、北徐州刺史。”按：始任年不詳，斷於此。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "line_targets": [
        {
          "summary_line_indexes": [
            0
          ],
          "decision": "attach",
          "target_id": "liang_s0021",
          "display_state": "譙州",
          "reason": "蕭泰延續原譙州任段，對應新昌南譙州。",
          "evidence": [
            {
              "source": "《中國行政區劃通史》下卷第八編",
              "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
              "source_pdf_pages": [
                294
              ],
              "source_printed_pages": [
                1192
              ],
              "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
              "verification": "original_pdf_page_visually_verified"
            }
          ]
        },
        {
          "summary_line_indexes": [
            1
          ],
          "decision": "attach",
          "target_id": "liang_s0029",
          "display_state": "北徐州",
          "reason": "本行明言北徐州刺史、鎮鍾離，且原工作簿Q302同列北徐州；不可因匯入合段掛在譙州。",
          "evidence": [
            {
              "source": "《南朝刺史、長史、司馬年表》原工作簿",
              "workbook": "南朝刺史、長史、司馬年表.xlsx",
              "sheet": "Sheet1",
              "cell": "Q302",
              "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
              "year": 546,
              "quote": "北徐州：封山侯蕭正表"
            },
            {
              "source": "《中國行政區劃通史》下卷第八編",
              "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
              "source_pdf_pages": [
                297
              ],
              "source_printed_pages": [
                1195
              ],
              "quote": "南齐有北徐州，镇钟离。梁承之。",
              "verification": "ocr_text_and_original_page_locator_verified"
            }
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-546-541-豫州",
      "year": 546,
      "state": "豫州",
      "source_page_index": 541,
      "summary_lines": [
        "趙徵興 雲勇將軍、都督霍合豫諸軍事、豫州刺史。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0019",
        "liang_s0020"
      ],
      "rejected_target_ids": [
        "liang_s0011",
        "liang_s0046"
      ],
      "reason": "趙徵興墓誌任成、霍、豫州的年代原書明言皆不詳，546為編者暫繫年。其豫州可能涉及合肥/壽春改置前後，不能只按排在546年就裁成壽春；此條仍待考，並排除江表南昌及547年始置懸瓠。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 546,
          "source_section": "梁方鎮年表・中大同元年丙寅（546）・豫州",
          "source_page_indexes": [
            541,
            542
          ],
          "source_pdf_pages": [
            542,
            543
          ],
          "quote": "趙徵興 雲勇將軍、都督霍合豫諸軍事、豫州刺史。\n《趙征興墓誌》（《墓誌集成》九七七）：“大梁興運，解巾入仕，調爲電威將軍、湘東王開府中兵參軍事……又出爲東海齊二郡太守……尋遷假節、雲旗將軍、新昭縣開國侯，食邑二千户，成州刺史。……還朝，俄授持節、超武將軍，食邑如故，霍州刺史……仍擢爲使持節、雲勇將軍、始新縣開國侯、都督霍合豫諸軍事、豫州刺史……以梁太清二年，逆寇侯景，侮亂國經……乃仰慕魏氏親鄰之德，以武定七年，翻歸樂土。”按：趙征興所歷成、霍、豫州，年皆不詳，列於此。東魏武定七年即梁\n太清三年。太清年間豫州刺史爲羊鴉仁，如誌所云屬實，趙征興任豫州刺史當在太清以前，非在豫州刺史任上降附東魏。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            319
          ],
          "source_printed_pages": [
            1217
          ],
          "quote": "豫州，治悬瓠城（今河南汝南县）。《梁书》卷2《武帝纪中》：天监七年（508）冬十月“丁丑，魏悬瓠镇军主白阜生、豫州刺史胡逊以城内属，以阜生为镇北将军、司州刺史，逊为平北将军、豫州刺史”。然据《魏书》卷19下《中山王英传》，悬瓠旋为魏所复得。《梁书》卷3《武帝纪下》：太清元年（547）“秋七月庚申，羊鸦仁入悬瓠城。甲子，诏曰：‘二豫分置，其来久矣。今汝、颍克定，可依前代故事，以悬瓠为豫州，寿春为南豫，改合肥为合州，北广陵为淮州，项城为殷州，合州为南合州。’”《梁书》卷56《侯景传》：“景复请兵于司州刺史羊鸦仁，鸦仁遣长史邓鸿率兵至汝水，元庆军又夜遁。于是据悬瓠、项城，求遣刺史",
          "verification": "ocr_text_and_original_page_locator_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01"
    },
    {
      "id": "liang-governor-link-546-542-湘州",
      "year": 546,
      "state": "湘州",
      "source_page_index": 542,
      "summary_lines": [
        "張纘"
      ],
      "decision": "attach",
      "target_id": "liang_s0115",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0025",
        "liang_s0082"
      ],
      "reason": "543年張纘都督湘桂東寧三州，至548年河東王譽代任，原任段對應臨湘湘州。只附已有年度條，不補原表未列的544年；邵陵王綸未任等原注保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 546,
          "source_section": "梁方鎮年表・中大同元年丙寅（546）・湘州",
          "source_page_indexes": [
            542
          ],
          "source_pdf_pages": [
            543
          ],
          "quote": "張纘"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            394
          ],
          "source_printed_pages": [
            1292
          ],
          "quote": "湘州（502—557），治临湘（今湖南长沙市）。齐末有湘州。梁承之，改营阳郡为永阳郡，增置岳阳、乐梁、药山等郡。据衡州考证，天监六年（507）四月，临贺、始兴、桂阳三郡移置衡州；据桂州考证，大同六年（540）移桂州治于始安郡，始安郡乃移属桂州。太清三年（549）后，药山、岳阳郡移属罗州，永阳郡移置营州，承圣二年（553）初，永阳郡复还属湘州。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "J302",
          "year": 546,
          "quote": "張纘",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0115",
          "name": "湘州",
          "region": "沅湘",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "湘州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "長沙郡",
            "湘東郡",
            "衡陽郡",
            "零陵郡",
            "永陽郡",
            "臨賀郡",
            "樂梁郡",
            "邵陵郡",
            "岳陽郡",
            "藥山郡",
            "始興郡",
            "桂陽郡",
            "始安郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-546-542-郢州",
      "year": 546,
      "state": "郢州",
      "source_page_index": 542,
      "summary_lines": [
        "南平王恪"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 546,
          "source_section": "梁方鎮年表・中大同元年丙寅（546）・郢州",
          "source_page_indexes": [
            542
          ],
          "source_pdf_pages": [
            543
          ],
          "quote": "南平王恪"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H302",
          "year": 546,
          "quote": "南平嗣王蕭恪",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-546-543-交州",
      "year": 546,
      "state": "交州",
      "source_page_index": 543,
      "summary_lines": [
        "楊暻"
      ],
      "decision": "attach",
      "target_id": "liang_s0103",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0062"
      ],
      "reason": "本年明載楊暻克交趾嘉寧城、交州平，且《通史》嶺南交州546年復置；可明確接回龍編交州，排除江漢同名州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 546,
          "source_section": "梁方鎮年表・中大同元年丙寅（546）・交州",
          "source_page_indexes": [
            543
          ],
          "source_pdf_pages": [
            544
          ],
          "quote": "楊暻\n《梁書》卷三《武帝紀下》：“正月……交州刺史楊暻剋交趾嘉寧城，李賁竄入獠洞，交州平。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            363
          ],
          "source_printed_pages": [
            1261
          ],
          "quote": "交州（502—540，546—557），治龙编（今越南北宁省仙游县东）。齐末有交州，梁承之。普通四年，九真郡移置爱州；大同八年前，宋寿郡移属安州；大同九年前，九德郡移置德州。又移新昌郡于兴州。《梁书》卷3《武帝纪下》：大同七年，“交州土民李贲攻刺史萧谘，谘输赂，得还越州”。大同十年“春正月，李贲于交趾窃位号，署置百官”。中大同元年（546）正月，“交州平”。则大同七年交州没，中大同元年复交州（此年之政区见图54）。太清二年五月，“辛亥，曲赦交、爱、德三州”。交州至梁末犹存。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "T302",
          "year": 546,
          "quote": "楊㬓\n交州司馬領武平太守陳霸先",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0103",
          "name": "交州",
          "region": "嶺南",
          "phases": [
            {
              "start": 502,
              "end": 540,
              "name": "交州",
              "uncertain": false,
              "raw": "502—540"
            },
            {
              "start": 546,
              "end": 557,
              "name": "交州",
              "uncertain": false,
              "raw": "546—557"
            }
          ],
          "prefecture_names": [
            "交趾郡",
            "宋平郡",
            "武平郡",
            "新昌郡",
            "九真郡",
            "九德郡",
            "宋壽郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-547-544-江州",
      "year": 547,
      "state": "江州",
      "source_page_index": 544,
      "summary_lines": [
        "湘東王繹 遷荊州。",
        "當陽公大心 雲麾將軍、刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 547,
          "source_section": "梁方鎮年表・太清元年丁卯（547）二月，東魏侯景以河南十三州降梁。八月，蕭淵明北伐，十一月，敗績。・江州",
          "source_page_indexes": [
            544
          ],
          "source_pdf_pages": [
            545
          ],
          "quote": "湘東王繹 遷荊州。\n當陽公大心 雲麾將軍、刺史。\n《梁書》卷四四《潯陽王大心傳》：“太清元年，出爲雲麾將軍、江州刺史。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F303",
          "year": 547,
          "quote": "正月，湘東王蕭繹轉\n當陽公蕭大心",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-547-544-譙州",
      "year": 547,
      "state": "譙州",
      "source_page_index": 544,
      "summary_lines": [
        "蕭泰"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 547,
          "source_section": "梁方鎮年表・太清元年丁卯（547）二月，東魏侯景以河南十三州降梁。八月，蕭淵明北伐，十一月，敗績。・譙州",
          "source_page_indexes": [
            544
          ],
          "source_pdf_pages": [
            545
          ],
          "quote": "蕭泰"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "Y303",
          "year": 547,
          "quote": "趙伯超",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-547-545-豫州",
      "year": 547,
      "state": "豫州",
      "source_page_index": 545,
      "summary_lines": [
        "羊鴉仁 刺史，司州兼。"
      ],
      "decision": "attach",
      "target_id": "liang_s0046",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0011",
        "liang_s0020"
      ],
      "reason": "547年詔以懸瓠為豫州，羊鴉仁鎮懸瓠；548年棄城走仍是此任官事件，對應河南豫州。不能延續為此前壽春豫州，亦不表示548年末梁仍控制懸瓠。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 547,
          "source_section": "梁方鎮年表・太清元年丁卯（547）二月，東魏侯景以河南十三州降梁。八月，蕭淵明北伐，十一月，敗績。・豫州",
          "source_page_indexes": [
            545
          ],
          "source_pdf_pages": [
            546
          ],
          "quote": "羊鴉仁 刺史，司州兼。\n按：羊鴉仁見是年司州條。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            319
          ],
          "source_printed_pages": [
            1217
          ],
          "quote": "豫州，治悬瓠城（今河南汝南县）。《梁书》卷2《武帝纪中》：天监七年（508）冬十月“丁丑，魏悬瓠镇军主白阜生、豫州刺史胡逊以城内属，以阜生为镇北将军、司州刺史，逊为平北将军、豫州刺史”。然据《魏书》卷19下《中山王英传》，悬瓠旋为魏所复得。《梁书》卷3《武帝纪下》：太清元年（547）“秋七月庚申，羊鸦仁入悬瓠城。甲子，诏曰：‘二豫分置，其来久矣。今汝、颍克定，可依前代故事，以悬瓠为豫州，寿春为南豫，改合肥为合州，北广陵为淮州，项城为殷州，合州为南合州。’”《梁书》卷56《侯景传》：“景复请兵于司州刺史羊鸦仁，鸦仁遣长史邓鸿率兵至汝水，元庆军又夜遁。于是据悬瓠、项城，求遣刺史",
          "verification": "ocr_text_and_original_page_locator_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0046",
          "name": "豫州",
          "region": "河南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "豫州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": []
        }
      ]
    },
    {
      "id": "liang-governor-link-547-546-湘州",
      "year": 547,
      "state": "湘州",
      "source_page_index": 546,
      "summary_lines": [
        "張纘"
      ],
      "decision": "attach",
      "target_id": "liang_s0115",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0025",
        "liang_s0082"
      ],
      "reason": "543年張纘都督湘桂東寧三州，至548年河東王譽代任，原任段對應臨湘湘州。只附已有年度條，不補原表未列的544年；邵陵王綸未任等原注保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 547,
          "source_section": "梁方鎮年表・太清元年丁卯（547）二月，東魏侯景以河南十三州降梁。八月，蕭淵明北伐，十一月，敗績。・湘州",
          "source_page_indexes": [
            546
          ],
          "source_pdf_pages": [
            547
          ],
          "quote": "張纘"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            394
          ],
          "source_printed_pages": [
            1292
          ],
          "quote": "湘州（502—557），治临湘（今湖南长沙市）。齐末有湘州。梁承之，改营阳郡为永阳郡，增置岳阳、乐梁、药山等郡。据衡州考证，天监六年（507）四月，临贺、始兴、桂阳三郡移置衡州；据桂州考证，大同六年（540）移桂州治于始安郡，始安郡乃移属桂州。太清三年（549）后，药山、岳阳郡移属罗州，永阳郡移置营州，承圣二年（553）初，永阳郡复还属湘州。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "J303",
          "year": 547,
          "quote": "張纘",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0115",
          "name": "湘州",
          "region": "沅湘",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "湘州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "長沙郡",
            "湘東郡",
            "衡陽郡",
            "零陵郡",
            "永陽郡",
            "臨賀郡",
            "樂梁郡",
            "邵陵郡",
            "岳陽郡",
            "藥山郡",
            "始興郡",
            "桂陽郡",
            "始安郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-547-546-郢州",
      "year": 547,
      "state": "郢州",
      "source_page_index": 546,
      "summary_lines": [
        "南平王恪"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 547,
          "source_section": "梁方鎮年表・太清元年丁卯（547）二月，東魏侯景以河南十三州降梁。八月，蕭淵明北伐，十一月，敗績。・郢州",
          "source_page_indexes": [
            546
          ],
          "source_pdf_pages": [
            547
          ],
          "quote": "南平王恪"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H303",
          "year": 547,
          "quote": "南平嗣王蕭恪",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-548-550-江州",
      "year": 548,
      "state": "江州",
      "source_page_index": 550,
      "summary_lines": [
        "#### 當陽公大心"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "原表江州湘東王繹至當陽公大心的連續欄位，對應江表尋陽江州。原書另記蜀中江州不能因同名攔截此任段；只連接逐年原已存在的記錄。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・江州",
          "source_page_indexes": [
            550
          ],
          "source_pdf_pages": [
            551
          ],
          "quote": "#### 當陽公大心\n《梁書》卷四四《潯陽王大心傳》：“二年，侯景寇京邑。大心招集士卒，遠近歸之，衆至數萬，與上流諸軍赴援宮闕。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            268
          ],
          "source_printed_pages": [
            1166
          ],
          "quote": "江州（502—557），治所屡变。齐末有江州，梁承之。天监中，自晋安郡分置南安郡，普通五年，建安郡移属东扬州。大通二年（528）自临川、庐陵、豫章三郡析置巴山郡。又自寻阳郡析置太原郡。大宝元年前于豫章郡置豫州。据宁州考证，承圣元年于临川故郡置宁州；据高州考证，承圣二年，移鄱阳郡置吴州；绍泰元年后于豫章郡析置豫宁郡；据高州考证，太平元年十一月，分巴山、临川、安成、豫宁四郡置高州；据南江州考证，太平二年前，以豫章之新吴县置南江州；据西江州考证，太平二年，寻阳、太原等郡移属西江州；太平二年前豫州废，豫章郡复来属；太平二年南江州、西江州又废，寻阳、太原等郡复来属。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "F304",
          "year": 548,
          "quote": "當陽公蕭大心\n中兵參軍柳昕",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-548-550-譙州",
      "year": 548,
      "state": "譙州",
      "source_page_index": 550,
      "summary_lines": [
        "蕭泰 被執。",
        "趙伯超 刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0021",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0038"
      ],
      "reason": "537年蕭泰始任，548年侯景自壽春襲取之州，為淮南新昌譙州；依《通史》本名譙州、後稱南譙州的考證連接。532年淮北短置譙州既有分源裁決保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・譙州",
          "source_page_indexes": [
            550,
            551
          ],
          "source_pdf_pages": [
            551,
            552
          ],
          "quote": "蕭泰 被執。\n趙伯超 刺史。\n《梁書》卷三《武帝紀下》：“十月，侯景襲譙州，執刺史蕭泰。”卷五六《侯景傳》：“十月，景留其中軍王顯貴守壽春城，出軍僞向合肥，遂襲譙州，助防董紹先開城降之。執刺史豐城侯泰。”《南史》卷五二《蕭泰傳》：“江北人情獷强，前後刺史並綏撫之。泰至州，便徧發人丁，使擔腰輿扇繖等物，不限士庶。恥爲之者，重加杖責，多輸財者，即放免之，於是人皆思亂。及侯景至，人無戰心，乃先覆敗。”《周書》卷四二《蕭世怡傳》：“及侯景爲亂，路由城下，襲而陷之，世怡遂被執。尋遁逃得免，至于江陵。”按：趙伯超見是年武州條。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            294
          ],
          "source_printed_pages": [
            1192
          ],
          "quote": "南谯州，侨寄清流（今安徽全椒县西北二十里南谯故城）。原書辨明此州本名譙州；中大通四年另置譙州後，稱此州南譙州。",
          "verification": "original_pdf_page_visually_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "Y304",
          "year": 548,
          "quote": "豐城侯蕭泰\n助防董紹先",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0021",
          "name": "南譙州",
          "region": "淮南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "南譙州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": [
            "新昌郡",
            "高塘郡",
            "南梁郡",
            "臨滁郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-548-552-豫州",
      "year": 548,
      "state": "豫州",
      "source_page_index": 552,
      "summary_lines": [
        "羊鴉仁 棄城走。"
      ],
      "decision": "attach",
      "target_id": "liang_s0046",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0011",
        "liang_s0020"
      ],
      "reason": "547年詔以懸瓠為豫州，羊鴉仁鎮懸瓠；548年棄城走仍是此任官事件，對應河南豫州。不能延續為此前壽春豫州，亦不表示548年末梁仍控制懸瓠。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・豫州",
          "source_page_indexes": [
            552
          ],
          "source_pdf_pages": [
            553
          ],
          "quote": "羊鴉仁 棄城走。\n《梁書》卷三《武帝紀下》：“正月……魏陷渦陽。……豫州刺史羊鴉仁、殷州刺史羊思達，並棄城走，魏進據之。”卷三九《羊鴉仁傳》：“會侯景敗於渦陽，魏軍漸逼，鴉仁恐糧運不繼，遂還北司，上表陳謝，高祖大怒，責之，鴉仁懼，又頓軍於淮上。及侯景反，鴉仁率所部入援。”按：《通鑑》卷一六一太清二年正月《考異》引《典略》云羊鴉仁等棄城走在六月。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            319
          ],
          "source_printed_pages": [
            1217
          ],
          "quote": "豫州，治悬瓠城（今河南汝南县）。《梁书》卷2《武帝纪中》：天监七年（508）冬十月“丁丑，魏悬瓠镇军主白阜生、豫州刺史胡逊以城内属，以阜生为镇北将军、司州刺史，逊为平北将军、豫州刺史”。然据《魏书》卷19下《中山王英传》，悬瓠旋为魏所复得。《梁书》卷3《武帝纪下》：太清元年（547）“秋七月庚申，羊鸦仁入悬瓠城。甲子，诏曰：‘二豫分置，其来久矣。今汝、颍克定，可依前代故事，以悬瓠为豫州，寿春为南豫，改合肥为合州，北广陵为淮州，项城为殷州，合州为南合州。’”《梁书》卷56《侯景传》：“景复请兵于司州刺史羊鸦仁，鸦仁遣长史邓鸿率兵至汝水，元庆军又夜遁。于是据悬瓠、项城，求遣刺史",
          "verification": "ocr_text_and_original_page_locator_verified"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0046",
          "name": "豫州",
          "region": "河南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "豫州",
              "uncertain": true,
              "raw": "據沿革文字推定"
            }
          ],
          "prefecture_names": []
        }
      ]
    },
    {
      "id": "liang-governor-link-548-553-湘州",
      "year": 548,
      "state": "湘州",
      "source_page_index": 553,
      "summary_lines": [
        "張纘 遷雍州。",
        "邵陵王綸 平南將軍、刺史。未任。",
        "河東王譽 南中郎將、刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0115",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0025",
        "liang_s0082"
      ],
      "reason": "543年張纘都督湘桂東寧三州，至548年河東王譽代任，原任段對應臨湘湘州。只附已有年度條，不補原表未列的544年；邵陵王綸未任等原注保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・湘州",
          "source_page_indexes": [
            553,
            554
          ],
          "source_pdf_pages": [
            554,
            555
          ],
          "quote": "張纘 遷雍州。\n邵陵王綸 平南將軍、刺史。未任。\n河東王譽 南中郎將、刺史。\n《梁書》卷三《武帝紀下》：“三月……以鎮東將軍、南徐州\n刺史邵陵王綸爲平南將軍、湘州刺史、同三司之儀。……四月……以護軍將軍河東王譽爲湘州刺史。……五月……前湘州刺史張纘爲領軍將軍。”卷五五《河東王譽傳》：“出爲南中郎將、湘州刺史。”卷三四《張纘傳》：“太清二年，徵爲領軍，俄改授使持節、都督雍梁北秦東益郢州之竟陵司州之隨郡諸軍事、平北將軍、寧蠻校尉。纘初聞邵陵王綸當代己爲湘州，其後定用河東王譽，纘素輕少王，州府候迎及資待甚薄，譽深銜之。及至州，遂托疾不見纘，仍檢括州府庶事，留纘不遣。”《周書》卷四八《蕭詧傳》：“後聞侯景作亂，（譽）頗凌蹙纘。纘懼爲所擒，乃輕舟夜遁，將之雍部，復慮詧拒之。梁元帝時鎮江陵，與纘有舊，纘將因之以斃詧兄弟。”按：綸參見是年南徐州條，本傳未載其遷湘州刺史，當先遷湘州刺史，復遷中衛將軍。"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            394
          ],
          "source_printed_pages": [
            1292
          ],
          "quote": "湘州（502—557），治临湘（今湖南长沙市）。齐末有湘州。梁承之，改营阳郡为永阳郡，增置岳阳、乐梁、药山等郡。据衡州考证，天监六年（507）四月，临贺、始兴、桂阳三郡移置衡州；据桂州考证，大同六年（540）移桂州治于始安郡，始安郡乃移属桂州。太清三年（549）后，药山、岳阳郡移属罗州，永阳郡移置营州，承圣二年（553）初，永阳郡复还属湘州。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "J304",
          "year": 548,
          "quote": "張纘\n四月，河東王蕭譽",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0115",
          "name": "湘州",
          "region": "沅湘",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "湘州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "長沙郡",
            "湘東郡",
            "衡陽郡",
            "零陵郡",
            "永陽郡",
            "臨賀郡",
            "樂梁郡",
            "邵陵郡",
            "岳陽郡",
            "藥山郡",
            "始興郡",
            "桂陽郡",
            "始安郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-548-554-郢州",
      "year": 548,
      "state": "郢州",
      "source_page_index": 554,
      "summary_lines": [
        "#### 南平王恪"
      ],
      "decision": "attach",
      "target_id": "liang_s0058",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0034"
      ],
      "reason": "邵陵王綸、南平王恪此任段對應夏口郢州；548年引文明載武昌。不是淮南定城同名郢州。545年始任仍保留原書“當繼綸、確年不詳”的按語。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・郢州",
          "source_page_indexes": [
            554
          ],
          "source_pdf_pages": [
            555
          ],
          "quote": "#### 南平王恪\n《上清道類事相》卷一引《道學傳》：“許明業，扶風赤崗人也。……梁太清中爲州刺史南平王請出城北神王館供養。值亂，因入武昌清溪山立館。”"
        },
        {
          "source": "《中國行政區劃通史》下卷第八編",
          "source_pdf_filename": "中国行政区划通史：三国两晋南朝卷Ⅱ(1).pdf",
          "source_pdf_pages": [
            326
          ],
          "source_printed_pages": [
            1224
          ],
          "quote": "郢州（502—557），治夏口城（今湖北武汉市武昌区）。齐末有郢州，梁承之。竟陵、齐兴二郡移置北新州；大同五年增置上隽郡，又增置南阳、州城、营阳、沔阳、夜郎等郡；太清三年后，武陵郡移置武州；大宝元年，沔阳、营阳、州城、建安郡没于北；太清二年后，巴陵郡移置巴州；承圣三年，以上隽郡为隽州。《通鉴》卷166绍泰元年（555）正月：“齐主使清河王岳将兵攻魏安州，以救江陵。岳至义阳，江陵陷，因进军临江，郢州刺史陆法和及仪同三司宋莅举州降之；长史江夏太守王珉不从，杀之。”五月，北齐、萧梁言和，齐兵北撤。则郢州之江夏沦陷不足半年后复 $ ^{①} $。",
          "verification": "ocr_text_and_original_page_locator_verified"
        },
        {
          "source": "《南朝刺史、長史、司馬年表》原工作簿",
          "workbook": "南朝刺史、長史、司馬年表.xlsx",
          "sheet": "Sheet1",
          "source_sha256": "06e8b8f0d3b01dadce3b618a4cc49a4a7f45e77abc8bb995712d22b3c21ed07c",
          "cell": "H304",
          "year": 548,
          "quote": "南平嗣王蕭恪",
          "note": "用於確認原州欄位置；若人物繫年與方鎮書不同，兩套原文並存，不用行政連接裁決覆蓋工作簿人工內容。"
        }
      ],
      "annual_semantics": "只把本年已載方鎮條目附回原書/工作簿對應的州；不新增空白年度，不以任官事件推斷年末控制或到任。",
      "review_status": "source_region_and_annual_continuity_reviewed",
      "review_batch": "2026-10-01",
      "entity_basis": [
        {
          "id": "liang_s0058",
          "name": "郢州",
          "region": "江漢",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "郢州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "江夏郡",
            "沔陽郡",
            "營陽郡",
            "州城郡",
            "武昌郡",
            "西陽郡",
            "建安郡",
            "上雋郡",
            "巴陵郡",
            "武陵郡",
            "夜郎郡"
          ]
        }
      ]
    },
    {
      "id": "liang-governor-link-548-555-梁州",
      "year": 548,
      "state": "梁州",
      "source_page_index": 555,
      "summary_lines": [
        "陰子春徵還。",
        "蕭循 信武將軍、梁秦二州刺史。",
        "徐文盛 督梁南秦沙東益巴北巴六州諸軍事、仁威將軍、秦州刺史，湘東王署。"
      ],
      "decision": "attach",
      "target_id": "liang_s0119",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0063"
      ],
      "reason": "蕭循所任梁、南秦二州有南鄭、漢中明文；對應巴漢北梁州，不能因省稱梁州而連到江漢同名梁州。原條中的除授未任按語繼續保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・梁州",
          "source_page_indexes": [
            555
          ],
          "source_pdf_pages": [
            556
          ],
          "quote": "（蕭）循爲梁州，除信武府記室參軍，領南鄭令。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・梁州",
          "source_page_indexes": [
            591
          ],
          "source_pdf_pages": [
            592
          ],
          "quote": "梁梁州刺史、宜豐侯蕭循固守南鄭"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0119",
          "name": "北梁州",
          "region": "巴漢",
          "phases": [
            {
              "start": 502,
              "end": 504,
              "name": "梁州",
              "uncertain": false,
              "raw": "502—504梁州"
            },
            {
              "start": 536,
              "end": 551,
              "name": "北梁州",
              "uncertain": false,
              "raw": "536—551"
            }
          ],
          "prefecture_names": [
            "漢中郡",
            "魏興郡",
            "西晉壽郡",
            "東晉壽郡",
            "北巴西郡",
            "宋熙郡",
            "新城郡",
            "上庸郡",
            "涪陵郡",
            "南部郡",
            "歸化郡",
            "北水郡",
            "隆城郡",
            "安康郡",
            "北巴西郡",
            "齊興郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-548-557-高州",
      "year": 548,
      "state": "高州",
      "source_page_index": 557,
      "summary_lines": [
        "蘭裕 刺史。",
        "李遷仕 刺史。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0090"
      ],
      "rejected_target_ids": [],
      "reason": "本組有蘭裕、李遷仕及周炅等先後除授，現有引文多述嶺南、青溪、南康或武昌西陽軍事活動；尚未逐人確定高州治所與遙領關係，不以同名唯一實體強掛。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 549,
          "source_section": "梁方鎮年表・太清三年己巳(549) 三月，侯景陷宮城。五月，武帝死，太子綱即位。・衡州",
          "source_page_indexes": [
            568
          ],
          "source_pdf_pages": [
            569
          ],
          "quote": "京城陷後，嶺南互相吞并，蘭欽弟前高州刺史裕攻始興內史蕭紹基，奪其郡。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・高州",
          "source_page_indexes": [
            585
          ],
          "source_pdf_pages": [
            586
          ],
          "quote": "以功授持節、高州刺史。是時炅據武昌、西陽二郡"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "mixed_holders_location_review",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-549-565-梁州",
      "year": 549,
      "state": "梁州",
      "source_page_index": 565,
      "summary_lines": [
        "蕭循",
        "杜岸 平北將軍、北梁州刺史，湘東王署。被殺。"
      ],
      "decision": "attach",
      "target_id": "liang_s0119",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0063"
      ],
      "reason": "蕭循所任梁、南秦二州有南鄭、漢中明文；對應巴漢北梁州，不能因省稱梁州而連到江漢同名梁州。原條中的除授未任按語繼續保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・梁州",
          "source_page_indexes": [
            555
          ],
          "source_pdf_pages": [
            556
          ],
          "quote": "（蕭）循爲梁州，除信武府記室參軍，領南鄭令。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・梁州",
          "source_page_indexes": [
            591
          ],
          "source_pdf_pages": [
            592
          ],
          "quote": "梁梁州刺史、宜豐侯蕭循固守南鄭"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0119",
          "name": "北梁州",
          "region": "巴漢",
          "phases": [
            {
              "start": 502,
              "end": 504,
              "name": "梁州",
              "uncertain": false,
              "raw": "502—504梁州"
            },
            {
              "start": 536,
              "end": 551,
              "name": "北梁州",
              "uncertain": false,
              "raw": "536—551"
            }
          ],
          "prefecture_names": [
            "漢中郡",
            "魏興郡",
            "西晉壽郡",
            "東晉壽郡",
            "北巴西郡",
            "宋熙郡",
            "新城郡",
            "上庸郡",
            "涪陵郡",
            "南部郡",
            "歸化郡",
            "北水郡",
            "隆城郡",
            "安康郡",
            "北巴西郡",
            "齊興郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-549-568-高州",
      "year": 549,
      "state": "高州",
      "source_page_index": 568,
      "summary_lines": [
        "李遷仕"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0090"
      ],
      "rejected_target_ids": [],
      "reason": "本組有蘭裕、李遷仕及周炅等先後除授，現有引文多述嶺南、青溪、南康或武昌西陽軍事活動；尚未逐人確定高州治所與遙領關係，不以同名唯一實體強掛。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 549,
          "source_section": "梁方鎮年表・太清三年己巳(549) 三月，侯景陷宮城。五月，武帝死，太子綱即位。・衡州",
          "source_page_indexes": [
            568
          ],
          "source_pdf_pages": [
            569
          ],
          "quote": "京城陷後，嶺南互相吞并，蘭欽弟前高州刺史裕攻始興內史蕭紹基，奪其郡。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・高州",
          "source_page_indexes": [
            585
          ],
          "source_pdf_pages": [
            586
          ],
          "quote": "以功授持節、高州刺史。是時炅據武昌、西陽二郡"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "mixed_holders_location_review",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-550-575-梁州",
      "year": 550,
      "state": "梁州",
      "source_page_index": 575,
      "summary_lines": [
        "蕭循"
      ],
      "decision": "attach",
      "target_id": "liang_s0119",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0063"
      ],
      "reason": "蕭循所任梁、南秦二州有南鄭、漢中明文；對應巴漢北梁州，不能因省稱梁州而連到江漢同名梁州。原條中的除授未任按語繼續保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・梁州",
          "source_page_indexes": [
            555
          ],
          "source_pdf_pages": [
            556
          ],
          "quote": "（蕭）循爲梁州，除信武府記室參軍，領南鄭令。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・梁州",
          "source_page_indexes": [
            591
          ],
          "source_pdf_pages": [
            592
          ],
          "quote": "梁梁州刺史、宜豐侯蕭循固守南鄭"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0119",
          "name": "北梁州",
          "region": "巴漢",
          "phases": [
            {
              "start": 502,
              "end": 504,
              "name": "梁州",
              "uncertain": false,
              "raw": "502—504梁州"
            },
            {
              "start": 536,
              "end": 551,
              "name": "北梁州",
              "uncertain": false,
              "raw": "536—551"
            }
          ],
          "prefecture_names": [
            "漢中郡",
            "魏興郡",
            "西晉壽郡",
            "東晉壽郡",
            "北巴西郡",
            "宋熙郡",
            "新城郡",
            "上庸郡",
            "涪陵郡",
            "南部郡",
            "歸化郡",
            "北水郡",
            "隆城郡",
            "安康郡",
            "北巴西郡",
            "齊興郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-550-577-高州",
      "year": 550,
      "state": "高州",
      "source_page_index": 577,
      "summary_lines": [
        "#### 李遷仕"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0090"
      ],
      "rejected_target_ids": [],
      "reason": "本組有蘭裕、李遷仕及周炅等先後除授，現有引文多述嶺南、青溪、南康或武昌西陽軍事活動；尚未逐人確定高州治所與遙領關係，不以同名唯一實體強掛。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 549,
          "source_section": "梁方鎮年表・太清三年己巳(549) 三月，侯景陷宮城。五月，武帝死，太子綱即位。・衡州",
          "source_page_indexes": [
            568
          ],
          "source_pdf_pages": [
            569
          ],
          "quote": "京城陷後，嶺南互相吞并，蘭欽弟前高州刺史裕攻始興內史蕭紹基，奪其郡。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・高州",
          "source_page_indexes": [
            585
          ],
          "source_pdf_pages": [
            586
          ],
          "quote": "以功授持節、高州刺史。是時炅據武昌、西陽二郡"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "mixed_holders_location_review",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-581-潼州",
      "year": 551,
      "state": "潼州",
      "source_page_index": 581,
      "summary_lines": [
        "周鐵虎 仁威將軍、刺史，湘東王署。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0041"
      ],
      "rejected_target_ids": [
        "liang_s0149"
      ],
      "reason": "原書判周鐵虎為取慮潼州遙領；淮北潼州底表已止於547，不掛蜀中西益、潼二州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・潼州",
          "source_page_indexes": [
            581
          ],
          "source_pdf_pages": [
            582
          ],
          "quote": "取慮之潼州太清中已没於東魏，周鐵虎當遙領。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0041",
          "name": "潼州",
          "region": "淮北",
          "phases": [
            {
              "start": 527,
              "end": 547,
              "name": "潼州",
              "uncertain": false,
              "raw": "527—547"
            }
          ],
          "prefecture_names": []
        }
      ],
      "appointment_nature": "remote_appointment",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-583-新州",
      "year": 551,
      "state": "新州",
      "source_page_index": 583,
      "summary_lines": [
        "李漢 刺史。附齊。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0061"
      ],
      "rejected_target_ids": [
        "liang_s0089"
      ],
      "reason": "李漢本條只有附齊及與馬嵩仁等並降的記錄，未直接確定治所；江漢新州底表止於550，不能因551唯一活動同名州在嶺南便自動掛接。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・義州",
          "source_page_indexes": [
            580
          ],
          "source_pdf_pages": [
            581
          ],
          "quote": "梁交州刺史李景盛、梁州刺史馬嵩仁、義州刺史夏侯珍洽、新州刺史李漢等並率州內附。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0061",
          "name": "新州",
          "region": "江漢",
          "phases": [
            {
              "start": 527,
              "end": 550,
              "name": "新州",
              "uncertain": false,
              "raw": "527—550"
            }
          ],
          "prefecture_names": [
            "梁寧郡",
            "富水郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-583-梁州",
      "year": 551,
      "state": "梁州",
      "source_page_index": 583,
      "summary_lines": [
        "馬嵩仁 刺史。附齊。",
        "徐陵《梁貞陽侯重與王太尉書》(《文苑英華》卷六七七)：“立茲幼弱，非曰大勲，滅我宗祊，何所逃釁？今復遣前吉州刺史馬嵩仁至彼，更具往懷，想不逺而復無貽祗悔也。”按：馬嵩仁見是年義州條。《重與王太尉書》“梁州”作“吉州”，二州皆乏考，未知孰是。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0119"
      ],
      "reason": "馬嵩仁條原書明言梁州、吉州異文「二州皆乏考，未知孰是」；不得借同年蕭循之梁州定位。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・梁州",
          "source_page_indexes": [
            583
          ],
          "source_pdf_pages": [
            584
          ],
          "quote": "《重與王太尉書》“梁州”作“吉州”，二州皆乏考，未知孰是。"
        }
      ],
      "entity_basis": [],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-584-梁州",
      "year": 551,
      "state": "梁州",
      "source_page_index": 584,
      "summary_lines": [
        "蕭循"
      ],
      "decision": "attach",
      "target_id": "liang_s0119",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0063"
      ],
      "reason": "蕭循所任梁、南秦二州有南鄭、漢中明文；對應巴漢北梁州，不能因省稱梁州而連到江漢同名梁州。原條中的除授未任按語繼續保留。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 548,
          "source_section": "梁方鎮年表・太清二年戊辰(548) 八月，侯景舉兵。十月，圍建康。・梁州",
          "source_page_indexes": [
            555
          ],
          "source_pdf_pages": [
            556
          ],
          "quote": "（蕭）循爲梁州，除信武府記室參軍，領南鄭令。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・梁州",
          "source_page_indexes": [
            591
          ],
          "source_pdf_pages": [
            592
          ],
          "quote": "梁梁州刺史、宜豐侯蕭循固守南鄭"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0119",
          "name": "北梁州",
          "region": "巴漢",
          "phases": [
            {
              "start": 502,
              "end": 504,
              "name": "梁州",
              "uncertain": false,
              "raw": "502—504梁州"
            },
            {
              "start": 536,
              "end": 551,
              "name": "北梁州",
              "uncertain": false,
              "raw": "536—551"
            }
          ],
          "prefecture_names": [
            "漢中郡",
            "魏興郡",
            "西晉壽郡",
            "東晉壽郡",
            "北巴西郡",
            "宋熙郡",
            "新城郡",
            "上庸郡",
            "涪陵郡",
            "南部郡",
            "歸化郡",
            "北水郡",
            "隆城郡",
            "安康郡",
            "北巴西郡",
            "齊興郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-584-潼州",
      "year": 551,
      "state": "潼州",
      "source_page_index": 584,
      "summary_lines": [
        "#### 楊乾運"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0149"
      ],
      "rejected_target_ids": [
        "liang_s0041"
      ],
      "reason": "楊乾運屬巴渝、涪水潼州，與周鐵虎取慮遙領分開；底表西益、潼二州始於552，本年先保留附錄入口，不修改建置斷限。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・潼州",
          "source_page_indexes": [
            593
          ],
          "source_pdf_pages": [
            594
          ],
          "quote": "紀時已稱尊號，以乾運威服巴、渝，欲委方面之任，乃拜車騎將軍、十三州諸軍事、梁州刺史，鎮潼州。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 553,
          "source_section": "梁方鎮年表・承聖二年癸酉（553） 八月，西魏陷益州。・益州",
          "source_page_indexes": [
            600,
            601
          ],
          "source_pdf_pages": [
            601,
            602
          ],
          "quote": "尉遲迥帥衆逼涪水，潼州刺史楊乾運以城降之"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0149",
          "name": "西益、潼二州",
          "region": "蜀中（含南中）",
          "phases": [
            {
              "start": 552,
              "end": 553,
              "name": "西益、潼二州",
              "uncertain": false,
              "raw": "552—553"
            }
          ],
          "prefecture_names": [
            "巴西、梓潼二郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-585-新州",
      "year": 551,
      "state": "新州",
      "source_page_index": 585,
      "summary_lines": [
        "杜僧明清野將軍、刺史，湘東王署。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0089"
      ],
      "rejected_target_ids": [],
      "reason": "杜僧明的本條可證授新州刺史，但敘事為頓西昌、督安成廬陵及隨軍東討，沒有新州治所；先與李漢條分源保存，不按唯一同名州推定實際轄境。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・新州",
          "source_page_indexes": [
            585
          ],
          "source_pdf_pages": [
            586
          ],
          "quote": "留僧明頓西昌，督安成、廬陵二郡軍事。元帝承制授假節、清野將軍、新州刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0089",
          "name": "新州",
          "region": "嶺南",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "新州",
              "uncertain": true,
              "raw": "541前—557"
            }
          ],
          "prefecture_names": []
        }
      ],
      "appointment_nature": "appointment_location_unresolved",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-551-585-高州",
      "year": 551,
      "state": "高州",
      "source_page_index": 585,
      "summary_lines": [
        "#### 李遷仕",
        "周炅 刺史，湘東王署。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0090"
      ],
      "rejected_target_ids": [],
      "reason": "本組有蘭裕、李遷仕及周炅等先後除授，現有引文多述嶺南、青溪、南康或武昌西陽軍事活動；尚未逐人確定高州治所與遙領關係，不以同名唯一實體強掛。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 549,
          "source_section": "梁方鎮年表・太清三年己巳(549) 三月，侯景陷宮城。五月，武帝死，太子綱即位。・衡州",
          "source_page_indexes": [
            568
          ],
          "source_pdf_pages": [
            569
          ],
          "quote": "京城陷後，嶺南互相吞并，蘭欽弟前高州刺史裕攻始興內史蕭紹基，奪其郡。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・高州",
          "source_page_indexes": [
            585
          ],
          "source_pdf_pages": [
            586
          ],
          "quote": "以功授持節、高州刺史。是時炅據武昌、西陽二郡"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "mixed_holders_location_review",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-552-587-高州",
      "year": 552,
      "state": "高州",
      "source_page_index": 587,
      "summary_lines": [
        "周迪 壯武將軍、刺史。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0014"
      ],
      "rejected_target_ids": [
        "liang_s0090"
      ],
      "reason": "周迪有臨川築城的直接地理證據，屬江表脈絡；但底表高州僅557年活動，且周迪臨川高州與後來黃法氍巴山高州的建置關係仍需分期，不移掛嶺南高州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・高州",
          "source_page_indexes": [
            587,
            588
          ],
          "source_pdf_pages": [
            588,
            589
          ],
          "quote": "迪乃據有臨川之地，築城于工塘。梁元帝授迪持節、通直散騎常侍、壯武將軍、高州刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-552-589-潼州",
      "year": 552,
      "state": "潼州",
      "source_page_index": 589,
      "summary_lines": [
        "周鐵虎"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0041"
      ],
      "rejected_target_ids": [
        "liang_s0149"
      ],
      "reason": "原書判周鐵虎為取慮潼州遙領；淮北潼州底表已止於547，不掛蜀中西益、潼二州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・潼州",
          "source_page_indexes": [
            581
          ],
          "source_pdf_pages": [
            582
          ],
          "quote": "取慮之潼州太清中已没於東魏，周鐵虎當遙領。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0041",
          "name": "潼州",
          "region": "淮北",
          "phases": [
            {
              "start": 527,
              "end": 547,
              "name": "潼州",
              "uncertain": false,
              "raw": "527—547"
            }
          ],
          "prefecture_names": []
        }
      ],
      "appointment_nature": "remote_appointment",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-552-591-梁州",
      "year": 552,
      "state": "梁州",
      "source_page_index": 591,
      "summary_lines": [
        "蕭循 降西魏。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0119"
      ],
      "rejected_target_ids": [
        "liang_s0063"
      ],
      "reason": "蕭循守南鄭之地可定，但北梁州底表止於551，本條記552年投降；保留年度方鎮事件，待處理政區年末斷限，不延長實體或另掛江漢梁州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・梁州",
          "source_page_indexes": [
            591
          ],
          "source_pdf_pages": [
            592
          ],
          "quote": "梁梁州刺史、宜豐侯蕭循固守南鄭"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0119",
          "name": "北梁州",
          "region": "巴漢",
          "phases": [
            {
              "start": 502,
              "end": 504,
              "name": "梁州",
              "uncertain": false,
              "raw": "502—504梁州"
            },
            {
              "start": 536,
              "end": 551,
              "name": "北梁州",
              "uncertain": false,
              "raw": "536—551"
            }
          ],
          "prefecture_names": [
            "漢中郡",
            "魏興郡",
            "西晉壽郡",
            "東晉壽郡",
            "北巴西郡",
            "宋熙郡",
            "新城郡",
            "上庸郡",
            "涪陵郡",
            "南部郡",
            "歸化郡",
            "北水郡",
            "隆城郡",
            "安康郡",
            "北巴西郡",
            "齊興郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-552-593-潼州",
      "year": 552,
      "state": "潼州",
      "source_page_index": 593,
      "summary_lines": [
        "#### 楊乾運"
      ],
      "decision": "attach",
      "target_id": "liang_s0149",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0041"
      ],
      "reason": "楊乾運鎮潼州、巴渝及涪水之證對應蜀中西益、潼二州和巴西、梓潼二郡；不用淮北取慮潼州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・潼州",
          "source_page_indexes": [
            593
          ],
          "source_pdf_pages": [
            594
          ],
          "quote": "紀時已稱尊號，以乾運威服巴、渝，欲委方面之任，乃拜車騎將軍、十三州諸軍事、梁州刺史，鎮潼州。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 553,
          "source_section": "梁方鎮年表・承聖二年癸酉（553） 八月，西魏陷益州。・益州",
          "source_page_indexes": [
            600,
            601
          ],
          "source_pdf_pages": [
            601,
            602
          ],
          "quote": "尉遲迥帥衆逼涪水，潼州刺史楊乾運以城降之"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0149",
          "name": "西益、潼二州",
          "region": "蜀中（含南中）",
          "phases": [
            {
              "start": 552,
              "end": 553,
              "name": "西益、潼二州",
              "uncertain": false,
              "raw": "552—553"
            }
          ],
          "prefecture_names": [
            "巴西、梓潼二郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-552-595-高州",
      "year": 552,
      "state": "高州",
      "source_page_index": 595,
      "summary_lines": [
        "周炅 遷江州。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [],
      "rejected_target_ids": [],
      "reason": "周炅前任高州時據武昌、西陽，本年遷江州；引文不直接說明高州治所，不合併到周迪臨川高州，也不按唯一活動實體掛到嶺南。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・高州",
          "source_page_indexes": [
            585
          ],
          "source_pdf_pages": [
            586
          ],
          "quote": "以功授持節、高州刺史。是時炅據武昌、西陽二郡"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・江州",
          "source_page_indexes": [
            587
          ],
          "source_pdf_pages": [
            588
          ],
          "quote": "承聖元年，遷使持節、都督江定二州諸軍事、戎昭將軍、江州刺史。"
        }
      ],
      "entity_basis": [],
      "appointment_nature": "previous_office_location_unresolved",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-553-596-江州",
      "year": 553,
      "state": "江州",
      "source_page_index": 596,
      "summary_lines": [
        "杜煎 病卒。",
        "晉安王方智 平南將軍、刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0008",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0146"
      ],
      "reason": "杜崱承552年平侯景後的江州任，前後有湓口、九江軍事脈絡；553年晋安王方智接任此州，對應江表尋陽江州。與武陵王所署王開業西江州分開。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・江州",
          "source_page_indexes": [
            587
          ],
          "source_pdf_pages": [
            588
          ],
          "quote": "既至湓口，與僧辯會于白茅洲"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 553,
          "source_section": "梁方鎮年表・承聖二年癸酉（553） 八月，西魏陷益州。・江州",
          "source_page_indexes": [
            596
          ],
          "source_pdf_pages": [
            597
          ],
          "quote": "以晉安王方智爲江州刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0008",
          "name": "江州",
          "region": "江表",
          "phases": [
            {
              "start": 502,
              "end": 557,
              "name": "江州",
              "uncertain": false,
              "raw": "502—557"
            }
          ],
          "prefecture_names": [
            "尋陽郡",
            "豫章郡",
            "廬陵郡",
            "南康郡",
            "晉安郡",
            "南安郡",
            "鄱陽郡",
            "臨川郡",
            "安成郡",
            "巴山郡",
            "建安郡",
            "豫寧郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-553-597-高州",
      "year": 553,
      "state": "高州",
      "source_page_index": 597,
      "summary_lines": [
        "周迪"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0014"
      ],
      "rejected_target_ids": [
        "liang_s0090"
      ],
      "reason": "周迪有臨川築城的直接地理證據，屬江表脈絡；但底表高州僅557年活動，且周迪臨川高州與後來黃法氍巴山高州的建置關係仍需分期，不移掛嶺南高州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・高州",
          "source_page_indexes": [
            587,
            588
          ],
          "source_pdf_pages": [
            588,
            589
          ],
          "quote": "迪乃據有臨川之地，築城于工塘。梁元帝授迪持節、通直散騎常侍、壯武將軍、高州刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-553-598-潼州",
      "year": 553,
      "state": "潼州",
      "source_page_index": 598,
      "summary_lines": [
        "周鐵虎"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0041"
      ],
      "rejected_target_ids": [
        "liang_s0149"
      ],
      "reason": "原書判周鐵虎為取慮潼州遙領；淮北潼州底表已止於547，不掛蜀中西益、潼二州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 551,
          "source_section": "梁方鎮年表・大寶二年辛未（551）十月，簡文帝被殺。・潼州",
          "source_page_indexes": [
            581
          ],
          "source_pdf_pages": [
            582
          ],
          "quote": "取慮之潼州太清中已没於東魏，周鐵虎當遙領。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0041",
          "name": "潼州",
          "region": "淮北",
          "phases": [
            {
              "start": 527,
              "end": 547,
              "name": "潼州",
              "uncertain": false,
              "raw": "527—547"
            }
          ],
          "prefecture_names": []
        }
      ],
      "appointment_nature": "remote_appointment",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-553-601-潼州",
      "year": 553,
      "state": "潼州",
      "source_page_index": 601,
      "summary_lines": [
        "楊乾運 降西魏。"
      ],
      "decision": "attach",
      "target_id": "liang_s0149",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0041"
      ],
      "reason": "楊乾運鎮潼州、巴渝及涪水之證對應蜀中西益、潼二州和巴西、梓潼二郡；不用淮北取慮潼州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・潼州",
          "source_page_indexes": [
            593
          ],
          "source_pdf_pages": [
            594
          ],
          "quote": "紀時已稱尊號，以乾運威服巴、渝，欲委方面之任，乃拜車騎將軍、十三州諸軍事、梁州刺史，鎮潼州。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 553,
          "source_section": "梁方鎮年表・承聖二年癸酉（553） 八月，西魏陷益州。・益州",
          "source_page_indexes": [
            600,
            601
          ],
          "source_pdf_pages": [
            601,
            602
          ],
          "quote": "尉遲迥帥衆逼涪水，潼州刺史楊乾運以城降之"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0149",
          "name": "西益、潼二州",
          "region": "蜀中（含南中）",
          "phases": [
            {
              "start": 552,
              "end": 553,
              "name": "西益、潼二州",
              "uncertain": false,
              "raw": "552—553"
            }
          ],
          "prefecture_names": [
            "巴西、梓潼二郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-553-602-江州",
      "year": 553,
      "state": "江州",
      "source_page_index": 602,
      "summary_lines": [
        "王開業 刺史。"
      ],
      "decision": "attach",
      "target_id": "liang_s0146",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0008"
      ],
      "reason": "本條明書岷蜀、巴西及西江州刺史王開業，對應蜀中江州；不能因江表江州領郡較多而優先選取。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 553,
          "source_section": "梁方鎮年表・承聖二年癸酉（553） 八月，西魏陷益州。・江州",
          "source_page_indexes": [
            602
          ],
          "source_pdf_pages": [
            603
          ],
          "quote": "時岷蜀初開，民情尚梗。巴西人譙淹據南梁州，與梁西江州刺史王開業共爲表裏"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0146",
          "name": "江州",
          "region": "蜀中（含南中）",
          "phases": [
            {
              "start": 502,
              "end": 553,
              "name": "江州",
              "uncertain": true,
              "raw": "?—553"
            }
          ],
          "prefecture_names": []
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-554-604-高州",
      "year": 554,
      "state": "高州",
      "source_page_index": 604,
      "summary_lines": [
        "#### 周迪"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0014"
      ],
      "rejected_target_ids": [
        "liang_s0090"
      ],
      "reason": "周迪有臨川築城的直接地理證據，屬江表脈絡；但底表高州僅557年活動，且周迪臨川高州與後來黃法氍巴山高州的建置關係仍需分期，不移掛嶺南高州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・高州",
          "source_page_indexes": [
            587,
            588
          ],
          "source_pdf_pages": [
            588,
            589
          ],
          "quote": "迪乃據有臨川之地，築城于工塘。梁元帝授迪持節、通直散騎常侍、壯武將軍、高州刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-555-611-高州",
      "year": 555,
      "state": "高州",
      "source_page_index": 611,
      "summary_lines": [
        "周迪"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0014"
      ],
      "rejected_target_ids": [
        "liang_s0090"
      ],
      "reason": "周迪有臨川築城的直接地理證據，屬江表脈絡；但底表高州僅557年活動，且周迪臨川高州與後來黃法氍巴山高州的建置關係仍需分期，不移掛嶺南高州。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 552,
          "source_section": "梁方鎮年表・元帝承聖元年壬申(552) 三月，王僧辯平侯景。十一月，湘東王即位於江陵，改元。・高州",
          "source_page_indexes": [
            587,
            588
          ],
          "source_pdf_pages": [
            588,
            589
          ],
          "quote": "迪乃據有臨川之地，築城于工塘。梁元帝授迪持節、通直散騎常侍、壯武將軍、高州刺史。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-555-615-高州",
      "year": 555,
      "state": "高州",
      "source_page_index": 615,
      "summary_lines": [
        "侯安都 刺史。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0090"
      ],
      "rejected_target_ids": [],
      "reason": "侯安都有高州刺史官號，但555年事跡為宿衛建康臺省，556年轉南徐州；不能由此證成嶺南或江表的實際到任，保留獨立方鎮入口。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 555,
          "source_section": "梁方鎮年表・敬帝紹泰元年乙亥(555) 七月，王僧辯納蕭淵明。九月，陳霸先襲殺僧辯，立蕭方智。十月，改元。・揚州",
          "source_page_indexes": [
            608,
            609
          ],
          "source_pdf_pages": [
            609,
            610
          ],
          "quote": "留高州刺史侯安都、石州刺史杜稜宿衛臺省。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "appointment_location_unresolved",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-556-618-高州",
      "year": 556,
      "state": "高州",
      "source_page_index": 618,
      "summary_lines": [
        "黃法氍 都督高州諸軍事、信武將軍、高州刺史，鎮巴山。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0014"
      ],
      "rejected_target_ids": [
        "liang_s0090"
      ],
      "reason": "黃法氍鎮巴山、割江州四郡置州，明確排除嶺南高州；江表高州底表始年557與方鎮原典556存在斷限差，先保留556事件，不暗改政區底表。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 556,
          "source_section": "梁方鎮年表・太平元年丙子(556) 九月，改元。・高州",
          "source_page_indexes": [
            618
          ],
          "source_pdf_pages": [
            619
          ],
          "quote": "太平元年，割江州四郡置高州，以法氍爲使持節、散騎常侍、都督高州諸軍事、信武將軍、高州刺史，鎮于巴山。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-556-621-高州",
      "year": 556,
      "state": "高州",
      "source_page_index": 621,
      "summary_lines": [
        "侯安都 遷南徐州。"
      ],
      "decision": "hold",
      "target_id": null,
      "candidate_target_ids": [
        "liang_s0090"
      ],
      "rejected_target_ids": [],
      "reason": "侯安都有高州刺史官號，但555年事跡為宿衛建康臺省，556年轉南徐州；不能由此證成嶺南或江表的實際到任，保留獨立方鎮入口。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 555,
          "source_section": "梁方鎮年表・敬帝紹泰元年乙亥(555) 七月，王僧辯納蕭淵明。九月，陳霸先襲殺僧辯，立蕭方智。十月，改元。・揚州",
          "source_page_indexes": [
            608,
            609
          ],
          "source_pdf_pages": [
            609,
            610
          ],
          "quote": "留高州刺史侯安都、石州刺史杜稜宿衛臺省。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0090",
          "name": "高州",
          "region": "嶺南",
          "phases": [
            {
              "start": 521,
              "end": 557,
              "name": "高州",
              "uncertain": true,
              "raw": "520後—557"
            }
          ],
          "prefecture_names": [
            "高涼郡",
            "電白郡",
            "杜陵郡",
            "宋康郡",
            "海昌郡",
            "齊安郡",
            "連江郡",
            "南巴郡",
            "陽春郡",
            "齊康郡"
          ]
        }
      ],
      "appointment_nature": "appointment_location_unresolved",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    },
    {
      "id": "liang-governor-link-557-623-高州",
      "year": 557,
      "state": "高州",
      "source_page_index": 623,
      "summary_lines": [
        "#### 黃法氍"
      ],
      "decision": "attach",
      "target_id": "liang_s0014",
      "candidate_target_ids": [],
      "rejected_target_ids": [
        "liang_s0090"
      ],
      "reason": "黃法氍本年續列，前一年的巴山及江州四郡證據明確；557江表高州實體已活動，連到該實體，不能與嶺南高州混合。",
      "evidence": [
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 556,
          "source_section": "梁方鎮年表・太平元年丙子(556) 九月，改元。・高州",
          "source_page_indexes": [
            618
          ],
          "source_pdf_pages": [
            619
          ],
          "quote": "太平元年，割江州四郡置高州，以法氍爲使持節、散騎常侍、都督高州諸軍事、信武將軍、高州刺史，鎮于巴山。"
        },
        {
          "source": "魯力《魏晉南北朝方鎮年表新編·宋齊梁陳卷》",
          "year": 557,
          "source_section": "梁方鎮年表・太平二年丁醜(557) 十月，陳代梁。・高州",
          "source_page_indexes": [
            623
          ],
          "source_pdf_pages": [
            624
          ],
          "quote": "蕭勃遣歐陽頠攻法氍，法氍與戰，破之。"
        }
      ],
      "entity_basis": [
        {
          "id": "liang_s0014",
          "name": "高州",
          "region": "江表",
          "phases": [
            {
              "start": 557,
              "end": 557,
              "name": "高州",
              "uncertain": false,
              "raw": "557"
            }
          ],
          "prefecture_names": [
            "臨川郡",
            "安成郡",
            "豫寧郡",
            "巴山郡"
          ]
        }
      ],
      "appointment_nature": "source_record_retained_without_new_service_claim",
      "annual_semantics": "僅決定原有方鎮條目的政區入口；不新增任職年度，不以掛接表示實際到任。",
      "review_status": "reviewed_source_and_region_2026_09_27"
    }
  ]
};
