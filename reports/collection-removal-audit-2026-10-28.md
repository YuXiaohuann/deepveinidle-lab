# 收藏页删除后的依赖核对

日期：2026-10-28。范围：本地 `/collection` 删除后的设计、运行时代码、测试及上游导出核对；尚未部署。现行规则见[共用框架](../docs/shared.md#21-导航与网址)、[价格模块](../docs/modules/item-prices.md)及[上游适配](../docs/technical.md)。

## 发现与处理

| 项目 | 引用核对与结果 |
| --- | --- |
| `price-service.refreshMarket`、存储层 `quotesOnly` | 唯一页面消费者为已删除的收藏控制器；删除服务入口和专用分支，价格导入继续通过 `importPrices` 使用分类偏好、锁定及并发请求合并 |
| `collectionThresholds` 上游导出 | 唯一适配层消费者为已删除收藏模型；删除公开映射，原始计点函数仍依赖的内部声明保留 |
| `potionDurationTicks` 上游导出 | 唯一消费者为已删除收藏离线验证辅助代码；删除映射并通过提取器移除无依赖声明，未手工编辑生成代码 |
| 收藏页设计 | 当前设计索引和开发入口已移除；`docs/pages/collection.md` 仅保留已移除说明及历史报告链接，避免旧报告引用失效 |

核对使用已删除模块在 Git 中的导入／原始函数调用清单，与当前 `src`、`scripts`、`tests` 引用及设计文档对照；另检查当前源码导出和页面／发布入口。未发现其他仅供收藏页使用的运行时代码残留。

## 保留项及实际消费者

- `collections`／`forgeLog` 捕获及导入：精通页计算总点数；原始模拟仍需要角色状态。
- `collectionPoints`／`collectionExcluded`、采集 `collectionItems` 统计：精通优化器的品质加权产出评分。
- `collectionItems` 原始目录：原始计点／物品事件及上游边界回归。
- `character-inventory`：制造页仓库、背包合并、库存抵扣及快照校验。
- 工作品质、烧焦、奖励期望、世界增益与工作配置导入：采集及制造现有功能。
- 旧地址回归及旧存档保留检查：验证删除行为；历史报告仅保存当时实施与验证证据。

## 本次验证

- 83 项价格服务／存储／协议、模型、精通／优化器及库存相关测试通过；日志 `.test-artifacts/collection-removal/dependency-tests.log`。
- 4 组中文／英文、1280px／390px 价格浏览器检查通过，页面脚本错误为空；日志 `dependency-price-browser.log`，机器结果及截图位于同目录的 `dependency-price-protocol/`。
- 隔离重复提取、当前生成文件一致性、未知摘要拒绝及拒绝后输出保留均通过；摘要 `dependency-extraction.json`。
- 文档引用及差异空白检查通过。仅复核本次影响范围，未重跑完整发布验收，也未部署。
