# 当前状态与验证入口

<a id="当前功能"></a>

更新日期：2026-11-08。此文件维护已记录的部署基线、本地待发布变更与仍有效的限制；现行功能规则见[设计索引](../DESIGN.md)，历史发布见[报告索引](../reports/README.md)。下述发布结果属于对应候选的既有证据，不表示当前工作树已重新验收。

## 已发布基线

生产为 **1.9.10**（正式 patch），游戏资源 **1.0.1212**；角色 userscript **2.9.1**、桥接 **2.4**、数据协议 **2**。入口为[生产实验室](https://dvi-lab.pages.dev/)，精确部署为 [f96247fe.dvi-lab.pages.dev](https://f96247fe.dvi-lab.pages.dev)。发布候选为本轮验收工作树，完整输入摘要为 `7fd5c408076fcfa7ce449addf543d523bf2478cd2e74fb5fdad9c2463d370129`，源码快照保存在 `.test-artifacts/release/v1.9.10-source-20261106/`。

[1.9.10 发布报告](../reports/v1.9.10-release-2026-11-06.md)记录游戏 1.0.1212、新工具／副手／套装、价格选项及强化默认配置发布。完整三阶段通过：599 项测试、独立原始引擎对照、隔离提取与本机验收通过，71 个白名单文件打包；正式生产域名 17 路由、69 项公开资源逐文件一致和 32 组浏览器验收通过。新装备 8 组、价格选项 6 组、强化默认配置 4 组专项均分别在本机与正式域名通过，已人工抽查截图。完整日志、机器结果及截图见报告列出的 `.test-artifacts/release/v1.9.10-*` 证据。本轮价格专项使用受控行情，未重验官方 API 真实跨域。

<a id="已发布范围与本地待发布"></a>

## 本地待发布

**1.9.11 patch 候选**：精通方案双栏保存、卡片与反馈精简、配置变化误报修正和运行进度高亮已完成实现及清理；只保留上次正式版 1.9.10 的既有存档兼容性。具体范围、验证进度和证据见[1.9.11 发布报告](../reports/v1.9.11-release-2026-11-08.md)。本轮完整发布检查、打包及生产验收尚待执行，当前生产仍为 1.9.10。

## Preview 与历史

已记录的 Preview 为 **1.9.0-preview.2**，候选提交 `e3f1359`，精确部署为 [2be971f9.dvi-lab.pages.dev](https://2be971f9.dvi-lab.pages.dev)，入口为 [Preview 精通页](https://preview.dvi-lab.pages.dev/mastery)。该候选的发布前检查通过，线上完整浏览器验收因 Cloudflare 统计请求 CORS 及伴随资源错误未通过；完整证据见[Preview.2 报告](../reports/v1.9.0-preview.2-release-2026-10-28.md)。Preview 不代替生产验收。

逐版发布、实施和调研证据统一从[报告索引](../reports/README.md)查阅；[验证归档](../reports/validation-history.md)保留更早记录，不作为当前规则或本次验证结果。个人调研保留于本地 `.test-artifacts/local-research-20261023/reports/` 和 `.test-artifacts/local-research-20261027/reports/`，不纳入发布包。

## 已知限制

- 真实脚本管理器安装升级、真实账号操作、长时性能及打赏微信扫码支付未验证。安装／更新角色脚本后须刷新游戏和实验室，导入世界增益须使用完整捕获数据，具体要求见[导入协议](technical.md#61-角色导入组件与-userscript-协议)。
- 采集最近点规则来自公开客户端，真实服务端行为未独立核验；规则与证据入口见[采集页面](pages/gathering.md)。制造每配方／品质及两个仓库的选点一致性仍需继续核验，见[原始代码复用](technical.md#62-原始代码复用)。
- 宽泛搜索或大量已定价／已锁定结果仍可能较慢，见[价格弹窗性能调查](../reports/price-dialog-performance-2026-10-16.md)；其中数值是历史测量，不是当前候选的性能保证。
- [早期真实环境验证](../reports/userscript-worker-live-2026-10-14.md)仅覆盖当时的角色／报价保存与只读桥接，不能据此认定当前卡顿或断连已解决。Opera 原生菜单问题仍未实机复现，见[空白反馈排查](../reports/legendary-blank-tab-investigation-2026-10-30.md)。
- 精通搜索不保证全局最优，世界首领仅为客户端静态估算，强化分位数可能触及资源上限；具体边界分别见[精通](pages/mastery.md)、[战斗](pages/combat.md#34-属性利润与列表交互)与[强化](pages/enhancement.md)设计。
