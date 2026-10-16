# 价格列表筛选前置验证

日期：2026-10-16。本地改动，未部署。实现用户确认的“无筛选不显示物品”，并删除状态中的“未定价／未锁定”；当前规则见 [共用价格设计](../docs/shared.md#24-全局物品价格)。

## 行为与范围

- 分类、稀有度及状态全为全部、搜索去空白后为空、强化为 0 时直接返回空物品列表，不生成完整候选集合或物品行。保留本地数据与行情，显示“请先设置筛选条件 / Set a filter to show items”。
- 状态选项只保留“全部／已定价／已锁定”。输入框的“未定价”占位及批量解锁功能继续保留；删除范围仅为两个筛选选项和对应筛选分支。
- 五类筛选中任一项设置具体条件即可显示匹配项，普通稀有度的 0 值有效；仅空白搜索不激活。有效条件无结果时显示原来的无匹配提示。
- 恢复全部默认条件后隐藏物品、清除勾选并禁用全选／批量操作；本页会话内的筛选继续随关闭重开及语言切换保留。上方分类价格来源不是列表筛选，不激活列表。
- 一键导入和清空未锁定价格仍按全局范围执行，无筛选也可操作，完成后列表仍为空；锁定保护、报价缓存、偏好、手动价格及零价保持原规则。打开弹窗仍不请求官方行情。

代码只修改 `src/item-price-controls.js`；同步共用设计、开发、状态与相关测试。没有修改原始游戏代码、计算规则、存储协议或 API 请求实现。

## 本轮实际验证

- `node --test tests/item-price-status.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs`：43 项通过，0 失败／取消／跳过。覆盖双语空状态、隐藏已设置与已报价变体、选项移除、全部保留条件独立激活、普通稀有度／零价格、空白／无匹配搜索、清除勾选、筛选保留、空列表全局导入及清空、锁定与报价保留。
- `node tests/market-prices-browser.mjs --toolbar-only`：中文／英文、1280px／390px 四组通过；每组验证初始空列表、移除的状态项、全部保留筛选及恢复默认、勾选清除、空列表导入与清空、版本 2 迁移、手动零价／空值、锁定、错误持续与显式重试、关闭与焦点。无阻断性脚本错误或弹窗横向溢出。八张初始／筛选截图已人工审阅。
- 修改文件语法、文档本地引用及差异空白检查通过。

## 实际代码性能复测

沿用 [调查报告](price-dialog-performance-2026-10-16.md) 的本机 Chrome、同一份 1,044 条报价／387 条有效价样本；这次测量实际修改的应用代码，没有通过路由替换功能实现。各场景连续四次打开，行情请求均为 0、实际物品行均为 0，弹窗内元素为 298 个。

| 环境 | 首次同步打开处理 | 后三次重开处理 |
| --- | --- | --- |
| 1280px 桌面，无 CPU 降速 | 10.0ms | 5.9–6.5ms |
| 390px 窄屏，无 CPU 降速 | 9.6ms | 5.5–6.5ms |
| 1280px，浏览器 CPU 4 倍降速 | 36.6ms | 24.5–30.0ms |

此前相同官方样本的桌面重开同步处理为 196.4–230.6ms，原因是生成 1,543 行、20,357 个元素。本次结果仅说明默认无筛选场景在该环境的改善，不能保证宽泛搜索或大量已定价／已锁定结果都流畅；CPU 降速是模拟条件，不等同真实低配设备。

完整日志、浏览器结果、截图与性能记录保存在 `.test-artifacts/price-filter-gate/`（`unit.log`、`browser.log/json`、`performance.log/json`、诊断脚本 `measure.mjs`）。未执行完整应用测试、真实官方 API、角色 Worker、独立原始计算对照、完整发布检查或部署；此前提交验证不作为本轮重跑结果。

## 已审阅截图

- [中文桌面初始](price-filter-gate-empty-zh-desktop-2026-10-16.png)／[筛选后](price-filter-gate-filtered-zh-desktop-2026-10-16.png)
- [中文窄屏初始](price-filter-gate-empty-zh-mobile-2026-10-16.png)／[筛选后](price-filter-gate-filtered-zh-mobile-2026-10-16.png)
- [英文桌面初始](price-filter-gate-empty-en-desktop-2026-10-16.png)／[筛选后](price-filter-gate-filtered-en-desktop-2026-10-16.png)
- [英文窄屏初始](price-filter-gate-empty-en-mobile-2026-10-16.png)／[筛选后](price-filter-gate-filtered-en-mobile-2026-10-16.png)

## 空状态文案与高亮

后续将空状态文案改为“物品数量较多，请先设置筛选条件”，英文为“Many items to display; set a filter first”，仅此提示使用现有金色和 650 字重。通过独立样式类作用于无筛选占位单元格；有筛选但无匹配的提示保留原文和样式。

此文案／样式调整实际运行 19 项价格控件测试及双语桌面／390px 四组浏览器专项，全部通过；四张最新初始截图已审阅。日志与机器结果为 `.test-artifacts/price-filter-gate/prompt-unit.log`、`prompt-browser.log` 和 `prompt-browser.json`。未重跑前文模型／存储测试或性能测量，不把前文 43 项及性能结果作为此次重跑结果。文档引用和差异空白检查通过，未部署。

- [当前提示：中文桌面](price-filter-prompt-zh-desktop-2026-10-16.png)／[中文窄屏](price-filter-prompt-zh-mobile-2026-10-16.png)
- [当前提示：英文桌面](price-filter-prompt-en-desktop-2026-10-16.png)／[英文窄屏](price-filter-prompt-en-mobile-2026-10-16.png)
