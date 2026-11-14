# 当前状态与验证入口

<a id="当前功能"></a>

更新日期：2026-11-14。此文件维护已记录的部署基线、本地待发布变更与仍有效的限制；现行功能规则见[设计索引](../DESIGN.md)，历史发布见[报告索引](../reports/README.md)。下述发布结果属于对应候选的既有证据，不表示当前工作树已重新验收。

## 已发布基线

生产为 **1.10.4**（正式补丁版），游戏资源 **1.0.1214**；角色 userscript **2.9.2**、桥接 **2.4**、数据协议 **2**。入口为[生产实验室](https://dvi-lab.pages.dev/)，精确部署为 [3c8d297a.dvi-lab.pages.dev](https://3c8d297a.dvi-lab.pages.dev)。最终候选提交 `6b8dacb`（精通及版本提交 `4fe564e`），完整输入摘要为 `a5782ea880827920bd0d93345596a891386cf5467eae1776e808a8203a7d39ba`；526 项候选输入已复制并逐文件核验。

[1.10.4 发布报告](../reports/v1.10.4-release-2026-11-12.md)记录制造移动占比与精通计算面板调整。完整检查 627 项测试、独立原始计算对照、隔离提取及本机 32 组基础验收全部通过，75 个白名单文件打包；正式域名 17 路由、73 项资源逐文件一致，32 组基础浏览器验收与 46 组相关专项通过。完整日志、机器结果、截图及候选快照位于 `.test-artifacts/release/v1.10.4-20261112/`，实际执行证据另保留于 `/private/tmp/dvi-release-1.10.4-20261112/`；已抽查本机及生产关键截图。真实账号、官方 API 真实跨域及长时性能不由本轮推定通过。

<a id="已发布范围与本地待发布"></a>

## 本地待发布

当前无本地待发布应用变更。新增 GitHub Actions 双通道配置：PR 完整检查、main 自动发布 Preview、正式 Release 自动发布生产；不改变应用版本。远端 `preview`、`production` Environment 已创建，分别限制 main 分支及 `v*` 标签，Account ID 已配置，两个环境的 `CLOUDFLARE_API_TOKEN` 已核对存在（未读取密钥值）。首轮 GitHub runner 完整检查及 Preview 上传已通过，Token 的上传权限已实测；精确地址的线上浏览器验收因统计上报 CORS 失败。后续复验和部署结果以 [Actions 本轮执行证据](https://github.com/yukixz/deepveinidle-lab/actions/workflows/ci.yml)为准，不由密钥存在推定通过。

本轮本地 actionlint 1.7.7、15 项发布工具专项、完整 630 项测试、独立原始计算对照、隔离提取、32 组浏览器基础验收及 75 文件白名单打包通过，证据在 `.test-artifacts/ci-final-20261114/`。该完整候选检查在本段状态文档收尾前执行，不能复用为后续 CI 发布证据；文档收尾另检引用及语法。生产 Release 工作流本次不触发，现有生产基线保持上节记录。

配置与操作规则见[发布流程](release.md#github-actions-双通道发布)。制造配方表可排序的“移动占比”已随 1.10.4 发布，规则见[制造页面](pages/crafting.md)；精通计算面板现为快速 120、标准 360（默认）、全面 720，桌面选项按计算模式、搜索次数、优化目标、目标及品质排列为一行，规则见[精通页面](pages/mastery.md)。现行命名、导航及图标规则见[共用页面](shared.md#项目命名)，公式仍可通过 `/formulas` 直接访问，阅读与导航规则见[公式页面](pages/formulas.md)。

自动食物导入仍需使用2.9.2角色脚本并刷新游戏重新捕获，旧捕获缺锁定数据时保留食物选择并提示。游戏资源1.0.1214、桥接2.4、数据协议2不变。后续发布遵循[发布流程](release.md)，不能将已有证据用于不同候选。

## Preview 与历史

Preview 现由 main push 自动更新，入口为 [Preview](https://preview.dvi-lab.pages.dev/)，当前版本、提交、精确部署地址和验收状态以 [CI 执行记录](https://github.com/yukixz/deepveinidle-lab/actions/workflows/ci.yml) 为准。首轮候选为 1.10.4、提交 `ed120a4`，上传至 [fce326d7.dvi-lab.pages.dev](https://fce326d7.dvi-lab.pages.dev)；HTTP 逐文件一致性通过，浏览器 32 组用例已执行，但统计请求 CORS 导致最终失败，不视为发布验收成功。证据见 [CI 接入报告](../reports/github-actions-setup-2026-11-14.md)。

此前记录的 Preview 为 **1.9.0-preview.2**，候选提交 `e3f1359`，精确部署为 [2be971f9.dvi-lab.pages.dev](https://2be971f9.dvi-lab.pages.dev)，入口为 [Preview 精通页](https://preview.dvi-lab.pages.dev/mastery)。该候选的发布前检查通过，线上完整浏览器验收因 Cloudflare 统计请求 CORS 及伴随资源错误未通过；完整证据见[Preview.2 报告](../reports/v1.9.0-preview.2-release-2026-10-28.md)。Preview 不代替生产验收。

逐版发布、实施和调研证据统一从[报告索引](../reports/README.md)查阅；[验证归档](../reports/validation-history.md)保留更早记录，不作为当前规则或本次验证结果。个人调研已迁出项目，保留于本机私有的 `../deepveinidle-play/archives/` 下三组 `local-research-20261023/`、`local-research-20261027/`、`local-research-20261106/` 归档，不纳入源码或发布包。公开源码准备已将 13 个个人评估报告、真实角色复现输入及页面对照文件移出版本库，并移除公开报告中的对应个人读数。本地 6 个开发分支及发布工作树的历史已完成重写，保留 267 个提交；逐提交核对应用源码、测试及构建文件未变，文档引用和 Git 对象完整性检查通过，未重跑应用测试。完整项目及工作树备份已迁至 `../deepveinidle-play/backups/project-backup-20261106/`，包含个人资料，不可随源码分享。本次迁移的 149 个文件（含完整备份包）均按文件大小和 SHA-256 核验一致，迁出后原归档及备份目录已不存在；归档入口和校验清单位于私有目标目录。用户已手动强制推送；2026-11-06 只读核对远端仅有 `main`、无标签，远端 `main` 与本地脱敏提交 `ce96243` 一致。提交作者姓名／邮箱及主动公开的昵称、交流群、赞赏码未在此次个人评估清理中删除；截图此前仅抽查，未完成全部历史图片的逐张隐私复核。

## 已知限制

- 真实脚本管理器安装升级、真实账号操作、长时性能及打赏微信扫码支付未验证。安装／更新角色脚本后须刷新游戏和实验室，导入世界增益须使用完整捕获数据，具体要求见[导入协议](technical.md#61-角色导入组件与-userscript-协议)。
- 采集最近点规则来自公开客户端，真实服务端行为未独立核验；规则与证据入口见[采集页面](pages/gathering.md)。制造每配方／品质及两个仓库的选点一致性仍需继续核验，见[原始代码复用](technical.md#62-原始代码复用)。
- 宽泛搜索或大量已定价／已锁定结果仍可能较慢，见[价格弹窗性能调查](../reports/price-dialog-performance-2026-10-16.md)；其中数值是历史测量，不是当前候选的性能保证。
- [早期真实环境验证](../reports/userscript-worker-live-2026-10-14.md)仅覆盖当时的角色／报价保存与只读桥接，不能据此认定当前卡顿或断连已解决。Opera 原生菜单问题仍未实机复现，见[空白反馈排查](../reports/legendary-blank-tab-investigation-2026-10-30.md)。
- 精通搜索不保证全局最优，世界首领仅为客户端静态估算，强化分位数可能触及资源上限；具体边界分别见[精通](pages/mastery.md)、[战斗](pages/combat.md#34-属性利润与列表交互)与[强化](pages/enhancement.md)设计。
