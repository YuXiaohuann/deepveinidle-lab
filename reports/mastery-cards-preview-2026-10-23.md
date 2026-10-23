# 精通卡片调整与 Preview 发布

日期：2026-10-23。Preview 版本 1.7.0-preview.2，游戏资源 1.0.1199。已部署到 Preview；生产保持 1.6.0。线上完整验收因统计服务跨域错误未通过。现行行为见[精通页面](../docs/pages/mastery.md)，部署状态见[当前状态](../docs/status.md)。

## 范围

- 当前等级改为只读文本，由导入、清空／归零及重置方案更新；目标等级仍可编辑。移除手动修改当前等级的事件分支与相应测试操作，导入和两种方案应用保留。
- 当前加成改为目标加成；增减级数在当前等级右侧显示，数值成组避免分离。任一等级非零时标题高亮，目标与当前不同时边框和本次成本高亮；相等时不显示差值，低于当前的草稿仍提示无效且不保存。
- 底部左侧显示“下一级：x 点”，右侧显示“还缺 x 点”；保留满级和超支提示。中英文桌面／手机布局同步。
- 修正当前等级导入触发优化器失效时，在新控件装配完成前刷新状态导致的异常；继续取消运行并清除旧结果。预算、加成、搜索和存档协议不变。

## 验证与边界

此前已运行精通相关 12 项测试和 14 组浏览器专项并审阅卡片截图，日志为本地 .test-artifacts/mastery-card-readonly*；这些不代替本轮最终候选的完整发布检查。

本轮执行 release:check、release:package、release:verify 三阶段，功能提交 `721226b`，分支 `codex/mastery-allocation-preview`。Wrangler 4.151.3 使用 `--branch preview` Direct Upload；仓库没有 Git remote。精确部署 [ee78e2f1.dvi-lab.pages.dev](https://ee78e2f1.dvi-lab.pages.dev)，Preview 别名 [preview.dvi-lab.pages.dev](https://preview.dvi-lab.pages.dev)。

| 检查 | 本轮结果 |
| --- | --- |
| 完整发布前检查 | **通过**：479 项测试，无失败／取消／跳过；150 脚本、119 文档、682 引用；原始计算对照与隔离提取通过。本机 19 路由／73 资源／36 组浏览器通过。 |
| 打包 | **通过**：75 文件白名单包，位于 `/private/tmp/dvi-mastery-cards-preview-20261023-01`。候选摘要 `ba0f533bae337f3306eb361268e225981c8ec628835c6a644a77a662839021af`；文档和证据不上传。 |
| 精通专项 | 本机／Preview 各 **14 组通过**：只读当前等级、差值及底部对齐、双语双视口、两模式真实 Worker、导入取消与重绘、应用与备选、存储失败、价格变化保留结果、迟到隔离。运行时异常为空；专项仅收集 pageerror，不替代完整控制台验收。 |
| Preview 完整线上验收 | **失败**：19 路由／73 资源逐文件一致，36 组页面检查和 4 组战斗完成断言均跑完；Cloudflare 注入统计请求产生 CORS／ERR_FAILED 控制台错误，未忽略。根因尚未确认，未修改共享托管统计配置。 |

证据位于本地 `.test-artifacts/release/`：

- `mastery-cards-preview-20261023-01-check/`：完整五阶段日志、结果、36 张截图和打包清单。
- `mastery-cards-preview-20261023-01-deploy.log`：上传与部署地址。
- `mastery-cards-preview-20261023-01-preview-verify/`：实际 Preview 目标的结果、日志与截图；外层同名 .log 保留进程完整输出。
- `mastery-cards-preview-20261023-01-mastery-local/`、`mastery-cards-preview-20261023-01-mastery-preview/` 及同名 .log：本机与线上精通专项。

已人工审阅本机和线上卡片中文 390px、英文 1440px截图，以及最终本机矩阵精通中文 1280px截图；未将全部截图称为人工已审阅。没有单独对精确部署地址执行完整验收，不能将别名验证结论扩展到该地址。

部署后仅同步发布文档，未改变应用文件或重新打包；最终文档静态检查保存于 `mastery-cards-preview-20261023-01-record-static.json`。本轮未执行生产部署或生产验收。

上一版 Preview 的统计请求跨域错误见[上一轮报告](mastery-allocation-preview-2026-10-23.md)，本轮独立复核仍失败，未以历史结果替代。不操作真实账号，不修改生产或共享托管统计配置。
