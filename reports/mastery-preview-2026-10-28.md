# 精通优化目标 Preview 发布

日期：2026-10-28。版本 **1.9.0-preview.1** 已部署到 [Preview 精通页](https://preview.dvi-lab.pages.dev/mastery)，精确部署为 [995c8e35.dvi-lab.pages.dev](https://995c8e35.dvi-lab.pages.dev)，游戏资源 1.0.1204。**完整线上验收未通过**，原因为 Cloudflare 注入的统计请求 CORS 错误；上传成功、专项通过和资源一致性通过不能代替完整验收。生产保持 1.8.1，本次未部署生产。

## 范围与执行顺序

功能来源 `d55e74e`：新增采集收入、战斗精通点数、采集精通点数，固定模拟 24 小时；任务按技能和等级排序，点数汇总位于装备下一行，说明分三行。发布仅修改 Preview 版本标识，计算、角色脚本及导入协议不变；功能证据见[实施报告](mastery-objectives-2026-10-28.md)。

首次上传按用户当时授权的 Preview 例外，执行轻量静态检查、独立白名单打包与目标专项。上传完成后用户撤销例外要求；协作指引、README、开发和发布流程均恢复原有完整三阶段规则，没有保留 Preview 全量测试豁免。随后补做完整检查、正式打包和目标验收；这些补验发生于首次上传之后，不能记作上传前已执行。

Wrangler 4.151.3 通过 `--project-name dvi-lab --branch preview` 上传。原包 `/private/tmp/dvi-preview-mastery-20261028-01` 为 76 文件白名单包。补验后的正式包 `/private/tmp/dvi-preview-mastery-full-20261028-01` 与上传包逐文件一致，因此没有重复上传或修改部署内容。上传时工作树未提交警告对应版本标识和文档改动；清单记录功能提交与应用文件摘要。

## 本轮实际验证

| 范围 | 结果 |
| --- | --- |
| 完整 `release:check` | 通过：607 项测试，无失败／取消／跳过；静态检查、独立原始计算对照、隔离提取及本机 19 路由／74 资源／36 组浏览器通过。 |
| 正式 `release:package` | 通过：76 文件，候选输入摘要 `c98cdfea02c534f9ecf8eed74ee88519de2ea43cb1c7ed5ebec3d34bdfa40ac2`，与已上传包逐文件一致。 |
| 精确地址与 Preview 别名 HTTP | 分别通过 19 路由、74 资源和 3 类未知路径重定向，资源与上传包一致。正式 `release:verify` 再次核验 Preview 别名 HTTP 通过。 |
| Preview 精通专项 | 17 组通过，浏览器 pageerror 为空；覆盖真实 Worker、固定 24 小时、新目标、应用、取消及双语窄屏。人工查看英文 390px 采集精通点数截图，说明分行、摘要与结果可读，无横向溢出。 |
| Preview 完整 `release:verify` | **失败**：36 组布局和 4 组战斗场景完成，但记录 222 条控制台错误，为 `cloudflareinsights.com/cdn-cgi/rum` CORS 及伴随 `net::ERR_FAILED` 资源错误，最终 Browser warnings/errors 断言失败。未过滤错误、未禁用统计、未将结果改为通过。 |

精通专项只监听 pageerror；完整浏览器矩阵同时检查控制台错误，因此专项通过与完整验收失败并不矛盾。该统计服务问题与[历史 Preview 记录](mastery-cards-preview-2026-10-23.md)一致，本次没有修改共享托管统计配置。

## 证据与边界

- `.test-artifacts/preview-mastery-20261028/`：首次静态结果、独立包清单、部署日志、精确地址／别名 HTTP 结果、线上精通专项与截图，以及完整三阶段进程日志。
- `.test-artifacts/preview-mastery-full-20261028-check/`：完整五阶段结果、日志、本机截图与正式包清单。
- `.test-artifacts/preview-mastery-full-20261028-verify/`：实际 Preview 完整验收失败结果、222 条错误、36 张矩阵截图和失败截图。

以上只适用于本轮 Preview，不能作为生产验收；未操作真实游戏账号。部署后仅整理发布记录，应用文件与包保持一致。完整线上验收失败仍是待解决事项。
