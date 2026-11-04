# 当前状态与验证入口

<a id="当前功能"></a>

更新日期：2026-11-04。此文件维护已记录的部署基线、本地待发布变更与仍有效的限制；现行功能规则见[设计索引](../DESIGN.md)，历史发布见[报告索引](../reports/README.md)。下述发布结果属于对应候选的既有证据，不表示当前工作树已重新验收。

## 已发布基线

生产为 **1.9.8**（正式 patch），游戏资源 **1.0.1208**；角色 userscript **2.9.0**、桥接 **2.4**、数据协议 **2**。入口为[生产实验室](https://dvi-lab.pages.dev/)，精确部署为 [457ca384.dvi-lab.pages.dev](https://457ca384.dvi-lab.pages.dev)，发布提交 `6e4f46c`。

[1.9.8 发布报告](../reports/v1.9.8-release-2026-11-04.md)记录采集和制造筛选控件保留、完整三阶段、生产基础验收及筛选专项。后续发布遵循[发布流程](release.md)。

<a id="已发布范围与本地待发布"></a>

## 本地待发布

制造页配方选择表沿用战斗普通敌人表的对齐方式。基于已提交代码叠加此变更，制造展示单测与浏览器表格专项通过，覆盖中英文桌面和 390px、展开、滚动编辑及等待／失败行。

## Preview 与历史

已记录的 Preview 为 **1.9.0-preview.2**，候选提交 `e3f1359`，精确部署为 [2be971f9.dvi-lab.pages.dev](https://2be971f9.dvi-lab.pages.dev)，入口为 [Preview 精通页](https://preview.dvi-lab.pages.dev/mastery)。该候选的发布前检查通过，线上完整浏览器验收因 Cloudflare 统计请求 CORS 及伴随资源错误未通过；完整证据见[Preview.2 报告](../reports/v1.9.0-preview.2-release-2026-10-28.md)。Preview 不代替生产验收。

逐版发布、实施和调研证据统一从[报告索引](../reports/README.md)查阅；[验证归档](../reports/validation-history.md)保留更早记录，不作为当前规则或本次验证结果。个人调研保留于本地 `.test-artifacts/local-research-20261023/reports/` 和 `.test-artifacts/local-research-20261027/reports/`，不纳入发布包。

## 已知限制

- 真实脚本管理器安装升级、真实账号操作、长时性能及打赏微信扫码支付未验证。安装／更新角色脚本后须刷新游戏和实验室，导入世界增益须使用完整捕获数据，具体要求见[导入协议](technical.md#61-角色导入组件与-userscript-协议)。
- 采集最近点规则来自公开客户端，真实服务端行为未独立核验；规则与证据入口见[采集页面](pages/gathering.md)。制造每配方／品质及两个仓库的选点一致性仍需继续核验，见[原始代码复用](technical.md#62-原始代码复用)。
- 宽泛搜索或大量已定价／已锁定结果仍可能较慢，见[价格弹窗性能调查](../reports/price-dialog-performance-2026-10-16.md)；其中数值是历史测量，不是当前候选的性能保证。
- [早期真实环境验证](../reports/userscript-worker-live-2026-10-14.md)仅覆盖当时的角色／报价保存与只读桥接，不能据此认定当前卡顿或断连已解决。Opera 原生菜单问题仍未实机复现，见[空白反馈排查](../reports/legendary-blank-tab-investigation-2026-10-30.md)。
- 精通搜索不保证全局最优，世界首领仅为客户端静态估算，强化分位数可能触及资源上限；具体边界分别见[精通](pages/mastery.md)、[战斗](pages/combat.md#34-属性利润与列表交互)与[强化](pages/enhancement.md)设计。
