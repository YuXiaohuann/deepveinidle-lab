# 物品价格模块重构与验证

日期：2026-10-19。状态：本地已实施，未发布；生产仍为 1.4.7。现行规则见[物品价格模块](../docs/modules/item-prices.md)。

## 实施范围

- `price-service.js` 提供协议 v1：六项数据读取、固定版本只读快照、设价和自动锁定、锁定／清空、偏好、官方刷新与导入命令。变更通知区分物品价格、行情、偏好及存储异常，减少无关重估。
- `price-protocol.js` 隔离内部存储，按完整 ID 提供物品价格、商人价格、最低卖价、全市场卖单总量、最高买价及全市场买单总量，携带来源、时间和字段状态。快照惰性读取任意合法变体，保持捕获时的数据，不随后续设置或网络结果改变。
- 官方接口新增解析 `sellQty/buyQty`，数量独立验证并与同份快照保存、替换、防倒退。缺失／非法数量显式异常；旧缓存没有数量时标记未读取；价格 null 与数量 0 分别保留。沿用价格存档版本 4 的可选扩展，不丢旧价格、偏好或锁定。
- 价格弹窗新增只读商人价格及“在售数量 / Quantity for sale”“求购数量 / Quantity wanted”（全市场物品数量）；手机在价格表内部滚动。战斗、采集、制造、收藏和强化通过服务读取，制造快捷改价调用统一命令。原估值函数保留纯价格映射入参兼容，不用于页面获取存储。
- 收藏新配置默认 global，保留 ask/bid/vendor 并保留旧存档原选择；候选及执行计划使用同一来源，global 缺价不兜底。强化三个用户输入、方案覆盖、零价、清空和完整 ID 绑定保持原设计。
- 本轮未改生成代码、角色协议、模拟引擎、包版本或部署。

## 本轮验证

相关单元测试 204 项通过（0 失败、0 跳过）：

```sh
node --test tests/price-protocol.test.mjs tests/price-service.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs tests/item-price-status.test.mjs tests/market-import.test.mjs tests/collection.test.mjs tests/collection-plan.test.mjs tests/collection-auto-import.test.mjs tests/crafting-display.test.mjs tests/drop-display.test.mjs tests/work-seed.test.mjs tests/combat-expectation.test.mjs tests/enhancement.test.mjs tests/enhancement-controls.test.mjs tests/enhancement-items.test.mjs tests/crafting.test.mjs tests/crafting-upgrades.test.mjs tests/gathering.test.mjs
```

| 浏览器专项 | 本轮结果 | 摘要与截图目录 |
| --- | --- | --- |
| `tests/market-prices-browser.mjs` | 15 组通过；真实官方接口 1084 个变体、1084 个变体两侧数量有效、invalid=0，生成时间 `2026-10-19T01:48:50.268Z` | `.test-artifacts/price-refactor/market/` |
| `tests/collection-browser.mjs` | 11 组通过；新增默认全局选项检查，原卖单测试明确选择 ask | `.test-artifacts/price-refactor/collection/` |
| `tests/collection-plan-browser.mjs` | 16 组通过；快照读取、库存、排序、自动导入、取整及异常保留 | `.test-artifacts/price-refactor/collection-plan/` |
| `tests/price-refactor-browser.mjs` | 4 组通过；中文／英文 × 1280px／390px，六项展示、全市场总量、收藏四选项与保存、强化方案覆盖／清空、消费者导航无脚本异常 | `.test-artifacts/price-refactor/protocol/` |

重构阶段浏览器共 46 组通过，无页面脚本异常。已审阅价格表英文桌面、中文手机及英文手机横向滚动到行情列的截图，未见页面横向撑宽；价格表继续使用内部横向滚动。

随后仅将数量表头调整为“在售数量”“求购数量”并同步英文；该文案调整执行价格界面专项单元测试 21 项通过、双语源码核对及空白检查，未重新执行浏览器专项，以上截图保留更名前的表头。

完整日志位于 `.test-artifacts/price-refactor/logs/`；市场专项摘要为 `market/browser.json`，其余浏览器目录为 `result.json`。运行入口：

```sh
node tests/market-prices-browser.mjs --out .test-artifacts/price-refactor/market
node tests/collection-browser.mjs --out .test-artifacts/price-refactor/collection
node tests/collection-plan-browser.mjs --out .test-artifacts/price-refactor/collection-plan
node tests/price-refactor-browser.mjs
```

初次浏览器执行受沙箱本机端口限制，允许本机服务后执行成功。旧测试对收藏选项数量及内部存储入参的断言已更新；独立旧卖单场景明确指定 ask 后完成重跑，未将初次失败计作通过。

## 验证边界

仅执行与本次修改相关的验证，未运行完整发布流程或生产验收。全市场挂单总量的含义由用户提供已核验结论；本轮实际核验接口字段及数量解析，不据此计算最优价位可成交数量。历史性能限制仍有效，本轮不宣称价格弹窗整体性能问题已解决。工作区既有独立调研文件及报告索引修改保留。
