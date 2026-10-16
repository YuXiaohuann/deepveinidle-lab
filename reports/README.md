# 报告索引

本目录保存调研、实施、发布及验证证据。现行规则从 [设计索引](../DESIGN.md) 查阅，生产基线与未验证事项见 [当前状态](../docs/status.md)。历史报告中的版本、“当前”“本轮”和“未发布”均指原记录时点；早期方案可能已被后续实现替代，不能作为当前需求或本次重跑结果。

同一功能的短篇阶段记录按专题合并，保留原日期、结果、失败、验证边界和证据路径；发布报告仍按版本独立保存。公式筹备稿由 [正式正文](../src/content/formulas/combat.zh.md) 接替，旧稿可从 Git 历史追溯。

截图、JSON／日志及原始复现脚本保留原路径，按报告中的引用查阅，不将历史脚本视为当前操作入口。以下索引覆盖纳入版本管理的 Markdown 报告；未跟踪本地资料保持原状，不纳入清理。

## 发布记录

- [1.3.6 发布与验证](v1.3.6-release-2026-10-16.md)（2026-10-16）
- [1.3.5 发布报告](v1.3.5-release-2026-10-16.md)（2026-10-16）
- [1.3.4 发布报告](v1.3.4-release-2026-10-16.md)（2026-10-16）
- [1.3.3 发布报告](v1.3.3-release-2026-10-16.md)（2026-10-16）
- [1.3.2 发布报告](v1.3.2-release-2026-10-15.md)（2026-10-15）
- [1.3.1 发布报告](v1.3.1-release-2026-10-15.md)（2026-10-15）
- [1.3.0 发布报告](v1.3.0-release-2026-10-15.md)（2026-10-15）
- [1.2.6 Patch 发布](v1.2.6-release-2026-10-14.md)（2026-10-14）
- [1.2.5 Patch 发布核验](v1.2.5-release-2026-10-14.md)（2026-10-14）
- [1.2.4 Patch 发布核验](v1.2.4-release-2026-10-14.md)（2026-10-14）
- [1.2.3 Patch 发布核验](v1.2.3-release-2026-10-14.md)（2026-10-14）
- [1.2.2 Patch 发布核验](v1.2.2-release-2026-10-13.md)（2026-10-13）
- [1.2.1 Patch 发布核验](v1.2.1-release-2026-10-13.md)（2026-10-13）
- [1.2.0 Minor 发布核验](v1.2.0-release-2026-10-13.md)（2026-10-13）
- [1.1.0 Minor 发布核验](v1.1.0-release-2026-10-12.md)（2026-10-12）
- [1.0.0 再发布核验](v1.0.0-rerelease-2026-10-12.md)（2026-10-12）

## 计算机制与方案

- [战斗配置导入全部生效世界增益调研](combat-world-buffs-research-2026-10-16.md)（2026-10-16）
- [强化模拟器调研](enhancement-simulator-research-2026-10-07.md)（2026-10-07）
- [采集原始机制核验与验证边界](gathering-engine-audit-2026-10-09.md)（2026-10-09）
- [热门加成可预测性调研](hot-bonus-predictability-2026-10-06.md)（2026-10-06）
- [采集／制造混合计算实施与验证](work-expectation-implementation-2026-10-13.md)（2026-10-13）
- [采集、制造的模拟与数学期望混合方案调研](work-expectation-research-2026-10-13.md)（2026-10-13）
- [战斗页面世界首领表格调研](world-boss-table-research-2026-10-13.md)（2026-10-13）

## 功能实施与专项验证

- [战斗世界增益导入与文案实施验证](combat-world-buffs-implementation-2026-10-16.md)（2026-10-16）
- [制造首版实施与发布验证](crafting-implementation-2026-10-12.md)（2026-10-12）
- [预报配色、多选与面板实施验证](forecast-implementation-2026-10-16.md)（2026-10-16）
- [预报日程按技能着色调研](forecast-skill-row-colors-research-2026-10-16.md)（2026-10-16）
- [公式页面实施与验证](formulas-implementation-2026-10-15.md)（2026-10-15）
- [游戏文本核对明细](game-text-audit-2026-10-14.md)（2026-10-14）
- [官方行情与价格弹窗实施验证](market-prices-implementation-2026-10-16.md)（2026-10-16）
- [制造与强化重置范围验证](panel-reset-2026-10-15.md)（2026-10-15）
- [物品价格弹窗卡顿调查](price-dialog-performance-2026-10-16.md)（2026-10-16）
- [设置参数影响核验](settings-audit.md)

## 角色捕获与性能

- [预测入口自动识别调研](predictor-auto-detection-research-2026-10-08.md)（2026-10-08）
- [战斗快照捕获失效排查](snapshot-capture-investigation-2026-10-08.md)（2026-10-08）
- [userscript 捕获卡顿调研](userscript-performance-research-2026-10-14.md)（2026-10-14）
- [角色捕获 Worker 实施与验证](userscript-worker-implementation-2026-10-14.md)（2026-10-14）
- [角色捕获 Worker：实际 Chrome 验证](userscript-worker-live-2026-10-14.md)（2026-10-14）

## 上游适配与历史差异

- [全部页面 1.0.1187 适配](all-pages-update-2026-10-13.md)（2026-10-13）
- [战斗模拟一致性核验与修复](combat-consistency-2026-10-04.md)（2026-10-04）
- [1.0.1187 战斗局部更新实施与验证](combat-update-implementation-2026-10-13.md)（2026-10-13）
- [战斗页面上游更新调查](combat-update-investigation-2026-10-13.md)（2026-10-13）
- [普通角色导入与战斗模拟更新核验](upstream-compatibility-audit-2026-10-11.md)（2026-10-11）
- [游戏更新兼容性核验](upstream-update-audit-2026-10-06.md)（2026-10-06）
- [当前游戏资源与快照核验](upstream-update-audit-2026-10-08.md)（2026-10-08）
- [游戏 1.0.1190 更新调研与适配范围](upstream-update-research-2026-10-16.md)（2026-10-16）

## 配装与早期价格方案

- [全局物品价格与市场导入方案调研](item-prices-research-2026-10-12.md)（2026-10-12）

## 开发流程与验证归档

- [文档重构调研与验收](documentation-restructure-2026-10-14.md)（2026-10-14）
- [正式版 1.0.0 发布核验](release-readiness-2026-10-12.md)（2026-10-12）
- [发布流程的 token 消耗评估与优化方案](release-token-efficiency-2026-10-14.md)（2026-10-14）
- [发布工具优化实施与验证](release-tooling-2026-10-14.md)（2026-10-14）
- [历史验证归档](validation-history.md)
