# 当前状态与验证入口

<a id="当前功能"></a>

更新日期：2026-11-17。此文件维护已记录的部署基线、本地待发布变更与仍有效的限制；现行功能规则见[设计索引](../DESIGN.md)，历史发布见[报告索引](../reports/README.md)。下述发布结果属于对应候选的既有证据，不表示当前工作树已重新验收。

## 已发布基线

生产为 **1.10.6**，游戏资源 **1.0.1214**；角色 userscript **2.10.1**、桥接 **2.4**、数据协议 **2**。入口为[生产实验室](https://dvi-lab.pages.dev/)，精确部署为 [98f13f05.dvi-lab.pages.dev](https://98f13f05.dvi-lab.pages.dev)，发布提交 `7fc2facbdc6f38776fcdb283add908e4b5d5d622`。

[1.10.6 发布报告](../reports/v1.10.6-release-2026-11-17.md)记录额外耗时重构及证据。[生产流水线 44070460571](https://github.com/yukixz/deepveinidle-lab/actions/runs/44070460571) 全部成功：639 项测试、独立原始计算对照、隔离提取、32 组本机浏览器验收及打包通过；精确地址与正式域名各通过 17 路由、74 资源逐文件一致性和 32 组浏览器验收。CI 排除第三方统计脚本，不证明统计可用性。证据已下载至 `.test-artifacts/release/v1.10.6-production-ci/`；Actions artifact 保留 30 天。

<a id="已发布范围与本地待发布"></a>

## 本地待发布

Preview 候选 **1.10.7-preview.1**：制造页功能裁剪已在本地实施，页面收敛为角色配置、制造属性和七列配方速率表，删除订单、加工费、执行计划、采购预算及真实角色库存；价格编辑移至配方材料／产物明细。有效旧配置迁入独立配置存档，共用自动更新仅保留角色配置通道，完整捕获及战斗选食用途不变。实施和本轮验证见[裁剪报告](../reports/crafting-trim-implementation-2026-11-17.md)；最终全量单元630项、相关浏览器专项、上游综合四组及语法／文档引用／路由检查均通过，截图已抽查。已获授权推送 Preview，待本轮 CI 完成完整检查、打包及两个 Preview 目标验收；本次不发布生产。


## Preview 与历史

Preview 现由 main push 自动更新，入口为 [Preview](https://preview.dvi-lab.pages.dev/)，修正统计验收边界后的工作流 [43581584123](https://github.com/yukixz/deepveinidle-lab/actions/runs/43581584123) 已成功；当前版本、提交、精确部署地址和验收状态以 [CI 执行记录](https://github.com/yukixz/deepveinidle-lab/actions/workflows/ci.yml) 为准。首轮候选为 1.10.4、提交 `ed120a4`，上传至 [fce326d7.dvi-lab.pages.dev](https://fce326d7.dvi-lab.pages.dev)；HTTP 逐文件一致性通过，浏览器 32 组用例已执行，但统计请求 CORS 导致最终失败，不视为发布验收成功。证据见 [CI 接入报告](../reports/github-actions-setup-2026-11-14.md)。

此前记录的 Preview 为 **1.9.0-preview.2**，候选提交 `e3f1359`，精确部署为 [2be971f9.dvi-lab.pages.dev](https://2be971f9.dvi-lab.pages.dev)，入口为 [Preview 精通页](https://preview.dvi-lab.pages.dev/mastery)。该候选的发布前检查通过，线上完整浏览器验收因 Cloudflare 统计请求 CORS 及伴随资源错误未通过；完整证据见[Preview.2 报告](../reports/v1.9.0-preview.2-release-2026-10-28.md)。Preview 不代替生产验收。

逐版发布、实施和调研证据统一从[报告索引](../reports/README.md)查阅；[验证归档](../reports/validation-history.md)保留更早记录，不作为当前规则或本次验证结果。个人调研已迁出项目，保留于本机私有的 `../deepveinidle-play/archives/` 下三组 `local-research-20261023/`、`local-research-20261027/`、`local-research-20261106/` 归档，不纳入源码或发布包。公开源码准备已将 13 个个人评估报告、真实角色复现输入及页面对照文件移出版本库，并移除公开报告中的对应个人读数。本地 6 个开发分支及发布工作树的历史已完成重写，保留 267 个提交；逐提交核对应用源码、测试及构建文件未变，文档引用和 Git 对象完整性检查通过，未重跑应用测试。完整项目及工作树备份已迁至 `../deepveinidle-play/backups/project-backup-20261106/`，包含个人资料，不可随源码分享。本次迁移的 149 个文件（含完整备份包）均按文件大小和 SHA-256 核验一致，迁出后原归档及备份目录已不存在；归档入口和校验清单位于私有目标目录。用户已手动强制推送；2026-11-06 只读核对远端仅有 `main`、无标签，远端 `main` 与本地脱敏提交 `ce96243` 一致。提交作者姓名／邮箱及主动公开的昵称、交流群、赞赏码未在此次个人评估清理中删除；截图此前仅抽查，未完成全部历史图片的逐张隐私复核。

## 已知限制

- 真实脚本管理器安装升级、真实账号操作、长时性能及打赏微信扫码支付未验证。安装／更新角色脚本后须刷新游戏和实验室，导入世界增益须使用完整捕获数据，具体要求见[导入协议](technical.md#61-角色导入组件与-userscript-协议)。
- 采集最近点规则来自公开客户端，真实服务端行为未独立核验；规则与证据入口见[采集页面](pages/gathering.md)。制造每配方／品质及两个仓库的选点一致性仍需继续核验，见[原始代码复用](technical.md#62-原始代码复用)。
- 宽泛搜索或大量已定价／已锁定结果仍可能较慢，见[价格弹窗性能调查](../reports/price-dialog-performance-2026-10-16.md)；其中数值是历史测量，不是当前候选的性能保证。
- [早期真实环境验证](../reports/userscript-worker-live-2026-10-14.md)仅覆盖当时的角色／报价保存与只读桥接，不能据此认定当前卡顿或断连已解决。Opera 原生菜单问题仍未实机复现，见[空白反馈排查](../reports/legendary-blank-tab-investigation-2026-10-30.md)。
- 精通搜索不保证全局最优，世界首领仅为客户端静态估算，强化分位数可能触及资源上限；具体边界分别见[精通](pages/mastery.md)、[战斗](pages/combat.md#34-属性利润与列表交互)与[强化](pages/enhancement.md)设计。
