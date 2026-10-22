# 制造订单 preview 部署

日期：2026-10-21。版本：`1.6.0-preview.1`；工作分支：`codex/crafting-orders`。已部署至 Cloudflare Pages `dvi-lab` 的 `preview` 通道。本次未部署生产通道，此次部署时的生产基线为1.5.2；当前状态见[发布基线](../docs/status.md#已发布基线)。

- 预览入口：https://preview.dvi-lab.pages.dev/craft
- 精确部署：https://f7fd4521.dvi-lab.pages.dev
- Wrangler：4.151.3；直接上传，命令显式指定 `--branch preview`。

## 范围

制造多配方订单、数量自动加入与批量替换、默认执行与自动建单、点击订单行切换、固定／比例／时间加工费、执行配方及材料采购、表格对齐和普通输入高度。移除旧制造存档、计划汇总和订单批量操作；其他页面配置及全局价格保持独立。规则见[制造页面](../docs/pages/crafting.md)，实施证据见[制造订单重构](crafting-orders-2026-10-21.md)。

## 实际发布与验证

发布过程中用户明确要求“跳过测试”。正在执行的 `release:check` 已通过静态阶段（140脚本、114文档、702引用、19路由定义），随后在全量测试阶段按要求中止，退出码130。检查记录标为 `cancelled`，没有完整通过凭据；未执行完的全量测试、独立原始计算、提取及本机浏览器矩阵不标记通过，也未执行 `release:verify` 或部署后浏览器专项。

按该授权改用发布文件白名单与摘要核对生成独立包，共71个文件，不包含项目文档或本地调研资料。Wrangler报告5个文件新上传、65个复用，并上传 `_redirects`，部署成功。

部署后仅执行基本HTTP核对：preview的 `/craft` 返回200并保留路径；`src/app.js`、`src/crafting-orders.js`、`src/crafting-controls.js`、`src/style.css` 的线上摘要与发布包一致，中英文版本均为1.6.0-preview.1。此结果不是完整发布验收。

最终候选在用户要求跳过测试之前，已实际执行本机制造订单专项9组，全部通过，人工抽查中文桌面、英文390px订单管理和中文桌面材料计划截图；只作为该专项的事实记录，不替代本轮完整检查或线上验收。

## 证据

| 内容 | 路径 |
| --- | --- |
| 已取消的完整检查及静态结果 | `.test-artifacts/release/crafting-preview-20261021-01-check/` |
| 最终候选本机订单专项9组及截图 | `.test-artifacts/release/crafting-preview-20261021-01-orders-local/` |
| 白名单包清单及基本线上核对 | `.test-artifacts/release/crafting-preview-20261021-01-manual/` |
| Wrangler完整部署日志 | `.test-artifacts/release/crafting-preview-20261021-01-deploy.log` |
| 实际部署包 | `/private/tmp/dvi-crafting-preview-20261021-01` |

生产未更新；本次preview明确跳过完整测试及浏览器验收，后续正式发布须重新履行发布流程。
