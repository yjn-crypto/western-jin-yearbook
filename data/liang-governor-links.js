/* Source-specific Liang governor entity decisions; keep held entries separate. */
window.LIANG_GOVERNOR_LINKS = {
  "meta": {
    "title": "梁代同名方鎮逐條行政入口裁決",
    "schema_version": "liang-governor-links-v1",
    "reviewed_on": "2026-09-27",
    "source_governors_sha256": "beebb79bc808e94cca6951dde740ab270c918508d423f7f538ca2658cab918b0",
    "source_ocr_sha256": "033eea8e97f3e654d3db3e12042458bff1255d9af4d2ad199fdff7bf634d793e",
    "record_count": 37,
    "attached_decisions": 16,
    "held_decisions": 21,
    "match_rule": "year + state + source_page_index + exact original summary_lines; no name-only fallback for held or stale decisions",
    "scope": "覆蓋既有同年度重複州名的全部20條，並補相關高州、梁州沿革；不代表1049條已全部完成行政實體考證。",
    "hold_rule": "hold保留分源獨立入口及原因；candidate_target_ids不授權自動掛接或修改實體年代。",
    "target_rule": "attach須由target_id在本年活動實體中解析，允許原書省稱與實體名不同；目標不活動時轉待考，不回退首個同名州。",
    "historical_limit": "只連接原有逐年史料，不推定全部長官實際到任，不推展任期，保留原書遙領與未任注。"
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
