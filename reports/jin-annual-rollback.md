# 西晋年度地图试验：保存与撤回

修改前基准：`1285c1c61d30d0620b310df9bf63b66d5e640164`（PR #8 合并后的 main）。

远端保存分支：[`archive/jin-before-annual-20261001`](https://github.com/yjn-crypto/western-jin-yearbook/tree/archive/jin-before-annual-20261001)。该分支保存修改前完整网页、设置、数据和地图。

本机完整备份：工作区 `outputs/jin-before-annual-20261001.zip`，从上述基准提交生成的全部已跟踪文件归档。没有将书籍、缓存或个人文件上传。

## 网页上切回

上方“西晋地图版本”选择“修改前原版（289、308年）”，或点击“切换至修改前地图”。原版只显示289、308两个已研究断面；从其他年度切换时自动选最近断面，同时记住切换前的年度。

原版界面的同一按钮会变成“返回年度地图（某年）”，点击后恢复先前年度并重置视野；也可在版本选择框中选择年度图。原版另选其他年份时自动打开该年年度图，避免空图。

直接入口：[289年原版](https://yjn-crypto.github.io/western-jin-yearbook/?year=289&jinmap=legacy)、[308年原版](https://yjn-crypto.github.io/western-jin-yearbook/?year=308&jinmap=legacy)。版本与返回年份写入网址，刷新后保留。例如`?year=308&jinmap=legacy&returnyear=304`表示查看308年原版，返回时恢复304年年度图。

原始 `data/jin-map-snapshots.js`、`data/jin-maps/289_map.geojson`、`data/jin-maps/308_map.geojson` 和文字锚点数据不被年度生成程序覆写。下载和导出入口继续隐藏。

## 完整撤回发布

如需恢复整个修改前界面，可以在 GitHub 撤销本轮年度地图 PR 的合并提交，保留之后独立提交；或由上述保存分支的完整树建立恢复提交并合并 main。正常 Pages 工作流会发布恢复后的网页。无需删除年度成果，也无需强制改写 main 历史。

## 试验界限

年度图按年末行政沿革与控制事件重建；研究报告记录异文、期段不确定及未定位政区。同年 CHGIS 治所与郡面优先。现有 CHGIS 包没有县域面，内部县域单元均是受参考郡面约束的县治空间拟合，只用于生成郡界，不在网页上展示县面或县界；由此合并的郡界、州界继承该几何不确定性。彩色封国范围表示制度关系，不能据此认定封君的军事实控。无色参考层补充失地及缺项区的地理轮廓，不将旧政区认定为本年有效建置。
