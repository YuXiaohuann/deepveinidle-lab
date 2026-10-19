# 制造配方表格调整与验证

日期：2026-10-19；本地完成，未发布。交互规则见[制造页面](../docs/pages/crafting.md)。

## 实现范围

- 配方表调整为配方、经验、利润、制造次数、单次材料成本、单次产物价值、计划制造次数七列。
- 配方名称显示“物品 · 品质”，下方灰色小字显示所需等级，名称展开基础经验、烹饪安全等级及随机种子。名称表头按等级排序，默认降序，同配方品质顺序保留。
- 名称、经验及利润保持金色加粗，包含等待／失败状态；全部表头普通样式。制造次数在当前周期换算后四舍五入到个位并保留千分位，统计与排序精度不变。
- 移除标题数量，保留原固定位置的计算状态；三项速率保留每天／每小时单位，成本及价值仍为单次。即时升级保留每次经验、利润和“即时升级”状态，不混入普通速率排序。
- 复用原有展开、输入焦点及滚动位置保存机制；明细宽度仅限制制造配方表，不影响材料表或计划汇总。不改模拟引擎、计划保存键、价格及成本计算。

## 本轮验证

- `node --test tests/crafting-display.test.mjs tests/crafting.test.mjs tests/crafting-upgrades.test.mjs`：29 项通过，包含五技能全部有效配方／品质原始计算对照、即时升级与存档、七列顺序与品质名称、周期换算和次数取整、估值异常列数。日志 `.test-artifacts/crafting-table/unit.txt`。
- 随后简化异常行字符串拼接，重跑 `node --test tests/crafting-display.test.mjs`，9 项通过；日志 `.test-artifacts/crafting-table/display-final.txt`。
- `node tests/crafting-table-browser.mjs`：5 组通过；结果 `.test-artifacts/crafting-table/results.json`。正常场景使用真实 Worker，验证名称／品质／等级、默认及切换排序、高亮与锁定状态、周期表头、按原始结果换算的整数次数、筛选与空结果、双语桌面／390px、最后一列计划填写、即时升级单位与周期不变、计划与已有材料保留。受控进度／逐项错误消息验证等待和失败行、同一输入节点焦点及横向滚动保留。
- 截图 `.test-artifacts/crafting-table/{zh,en}-{1440,390}.png` 及 `upgrade-en-390.png`，已审阅双语桌面／窄屏及即时升级窄屏，名称、等级、表头与展开内容可读；窄表在自身容器滚动，页面无横向溢出。截图使用关闭自动导入的独立价格配置，避免通知遮挡；不连接真实账号。
- `node --check src/crafting-controls.js`、`git diff --check` 通过。

本轮只验证相关范围，未执行完整发布验证、未部署；生产基线仍为 1.4.7。
