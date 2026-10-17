# 收藏执行计划与自动导入实施

日期：2026-10-17。状态：本地已实施，未部署；生产仍为1.4.0。现行规则见[收藏页面设计](../docs/pages/collection.md)，数值与范围依据见[调研](collection-plan-research-2026-10-17.md)。

## 变更

- 执行计划独立保存，同物品／品质保留一个配方的最高目标，低目标标记已包含；计划操作独占结果最左列，位于物品名称左侧，正常可计算结果与计划不再显示“纯动作估算”；支持显式下调、移除和清空。筛选、排序、角色导入及配置清空保留计划。
- 基于当前收藏进度、动作期望和采购价格归并完整材料ID，品质分开、小数不提前取整；保留贡献来源。已完成目标需求为0，缺价、无效路线、数量或金额溢出明确提示，不伪造完整总计。不抵扣库存或其他计划产物。
- 自动导入默认关闭，选项为“自动导入（聚焦时及每60秒）”，取消独立说明段落。启用立即读取，离开收藏板块暂停，返回或刷新后恢复。统一调度避免并发；编辑配置、关闭或离开使迟到响应失效；未提交输入时跳过自动读取。失败保留角色与计划并显示错误，保持后续重试。
- 配方展开仅保留材料采购与产物回收，移除前端模拟Worker；离线原始事件回归保留。

## 本轮验证

- `node --test tests/collection.test.mjs tests/collection-plan.test.mjs tests/collection-auto-import.test.mjs tests/i18n.test.mjs tests/character-import.test.mjs`：72项通过；日志 `.test-artifacts/collection/plan-auto-unit-2026-10-17.log`。
- `node tests/collection-browser.mjs --out .test-artifacts/collection/plan-auto-existing-2026-10-17`：7组通过，展开区、价格／排序／筛选、导入、双语与窄屏；结果在该目录 `result.json`。
- `node tests/collection-plan-browser.mjs --out .test-artifacts/collection/plan-auto-browser-2026-10-17`：6组通过，计划去重／保存／导入重算、真实定时调度的浏览器时钟验证、焦点合并／板块暂停、过期响应／输入草稿／失败重试／坏存档；无页面错误。已审阅双语桌面及390px截图。
- 布局调整后重跑计划浏览器专项：6组通过，增加按钮独立左列与正常状态文字移除断言；证据 `.test-artifacts/collection/plan-column-2026-10-17/result.json`，390px截图已审阅。
- 导入面板空白核查：自动导入错误区复用 `import-status:empty`，空内容不占位，实际错误仍显示。重跑6组浏览器专项通过，增加正常隐藏／错误可见断言；证据 `.test-artifacts/collection/import-spacing-2026-10-17/result.json`。
- 文档本地链接与章节锚点、`git diff --check`通过。

浏览器使用临时本机服务、Chrome、受控角色桥接与行情，不连接真实游戏账号。后台浏览器可能节流定时器；未验证真实账号长时导入，未执行完整发布回归或部署。既有历史发布结果不计入本轮。
