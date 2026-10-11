东晋第一轮展示数据（2026-10-11）

原始输入 data/eastern-jin-research/research.json 与 issues、年度结构问题保持原样。
输入摘要见 index.json 的 meta.source_digest。

重建：python3 scripts/build-eastern-jin-display.py
该命令生成445项机器判断、102组结构问题附表、104份年度快照、浏览器去重数据包，以及可检索HTML报告。

发布：data/eastern-jin-data.js 为浏览器唯一必需年度资料，运行后生成 window.EASTERN_JIN_DATA。
用于人工核对的 machine-decisions.json、machine-decisions.csv 与 HTML 可以公开。
annual/ 为本地构建中间快照，重复元数据较多；无需提交或公开。

处理范围：候选最早年份、最可能有据行政归属、独立三级侨置标记。
本轮采用不是历史定论；无法定父级或完整时段者不入正文确定数量及地图，保留待考入口。
郡/国名称照来源；本轮没有迁入西晋王、公、侯制度或绘封国色。

本轮仅做可重建、引用、单年实体唯一及标记完整检查，没有重复全面历史审核。
