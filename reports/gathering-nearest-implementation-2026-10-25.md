# 采集最近点策略实施

2026-10-25，依据[公开客户端核验](gathering-selection-audit-2026-10-25.md)及用户后续要求实施。先更新[采集设计](../docs/pages/gathering.md)，再调整代码。源码核验与当前产品行为分别维护，现行要求以采集设计为准。

## 最终行为

- 每任务复用原始最近点函数，从模拟角色经预测初始化后的起点选择一个任务点，同距保留原始点位顺序。
- 自动起点明确为仓库 1，手动选择从相应仓库出发。修正旧最近模式在选点后按目标点重设自动仓库的问题，选点与模拟使用同一起点。
- 移除全点平均函数、旧点数统计字段、重复起点赋值和选点控件和“实际随机选择”说明；旧 `siteSelection` 字段被规范化忽略，导入／清空／技能切换使用同一策略。地点、仓库、种子及结束等级仍可查看。
- 保留原始采集过程、机会期望估值、世界增益、丢弃和 Worker 取消机制。模拟器内部单点入口保留，供全部任务点原始对照；它不构成页面指定点功能。
- 原始资源和生成模块保持 1.0.1199。此次规则与已核验的当前公开客户端一致，不能据此声称真实账号起点／库存／服务端行为完全复现。

## 本次验证

命令与证据：

- `node --test tests/gathering.test.mjs tests/gathering-world-buffs.test.mjs tests/work-seed.test.mjs tests/work-expectation.test.mjs`：**143 项通过**，无失败／取消／跳过。日志 `.test-artifacts/gathering-selection-20261025/cleanup-tests.log`。
- `node tests/gathering-table-browser.mjs .test-artifacts/gathering-selection-20261025/cleanup-table`：通过，页面错误为空；覆盖旧指定点存档转最近点、单点真实 Worker、8 列结果、周期／排序／展开、等待／失败、偷窃及中英文 1440／390px 视口。日志、JSON 与截图在该目录及相邻 `cleanup-table-browser.log`。
- `node tests/gathering-discard-browser.mjs`：通过，页面错误为空；覆盖真实 Worker 丢弃、保存刷新、切换技能、导入／重置与双语两视口。证据 `.test-artifacts/gathering-discard/`，本次日志 `.test-artifacts/gathering-selection-20261025/cleanup-discard-browser.log`。
- `git diff --check` 通过，核对当前设计、技术文档及源码，已无有效全点平均或实际随机选择要求。人工查看本次中文窄屏截图，表格保持容器内横向滚动。

单元检查新增 30 个任务 × 3 种起始仓库的选点／起点／原始离线结果对照；保留四技能全部点位的 bank／drop 原始过程对照，避免移除平均后误缩小底层验证范围。发布独立审计脚本也改为显式遍历全部有效点；本次未运行该完整发布脚本。

浏览器脚本首次因沙箱禁止本机监听而停止，获得工具执行许可后重跑通过。补入旧选点存档及真实单点断言后通过；清理旧统计字段、重复赋值和过时结论后，再次执行上述 143 项测试及表格／丢弃两项浏览器专项，均通过。

未执行完整发布检查、打包、部署或真实服务端验收，不沿用此前发布结果作为本次通过依据。
