# 采集／制造配置核查与补漏

历史证据说明：以下本机日志、结果及截图路径未纳入版本管理，当前工作区已不再保留；本报告保留当时记录，不表示本次重跑或现存证据。

日期：2026-10-19。本地实施，未发布；依据仓库已核验的游戏 1.0.1194 快照、适配层与设计文件，不声称核验了当日线上新资源。没有修改原始生成引擎、角色脚本或既有独立调研资料。

## 核查结论

| 配置 | 采集 | 制造 |
| --- | --- | --- |
| 世界增益经验 | 已有输入、全部窗口导入、小数和全程模拟 | 已有输入和模拟，但导入仅识别 gathered／felled 两种每周目标且规范化取整；本轮补齐 |
| 世界增益稀有发现 | 已有输入、导入、品质及期望映射 | 当前 172 个普通配方均有输入材料且无 bonus；指定品质制造不读取随机品质增益，不添加无效控件 |
| 铁人模式 | 已有配置及导入 | 原始制造会掉落坐骑，但原配置不能设置铁人模式；本轮补齐 |
| 工具／护符／坐骑、药水、家园、精通、特权、公会经验、祝福 | 适用选项已有 | 工具、坐骑、矿脉灵药、疾行、制造速度设施、制造／经验／移动精通、口袋／快手／烹饪稳手、公会经验、祝福已有；不增加无效战斗或随机品质配置 |

核查原始 `workModifiers`、`workXpMultiplier`、`workChance`、`burnChance`、`windowModifiers`、工作产出及坐骑分支：世界稀有度用于无材料采集及 bonus 的随机品质；坐骑概率读取完成概率，品质只读取装备幸运，不读取世界稀有度。制造不提供护符；因此也不为坐骑增加猎手药剂、世界稀有度或稀有精通。当前不存在制造 bonus 配方，新增上游配方后须重新检查这一边界。

指定种子、准确起始经验、剩余药效、有限仓库、采集任务限次、队列与农耕属于新的模拟能力，不作为本轮配置补漏扩展。战斗也有这些原始角色字段，但不因此将其全部开放为工作页控件。

## 实施

- `src/work-import.js` 统一两页世界窗口导入，移除旧的名称过滤分支；复用战斗的完整能力标记、窗口校验、起止边界和累加规则。制造只保存有效的世界经验，不增加世界稀有度字段。有效空窗口清零；旧／异常数据清零并明确提示，其它有效字段继续导入。
- `src/crafting-model.js` 保留世界经验小数，新增默认关闭的铁人模式，复用原始角色映射；旧存档默认非铁人。
- `src/crafting-controls.js` 世界经验步进 0.1%，允许更细小数，增加全程生效说明与铁人开关；共用世界警告支持只显示经验，避免错误声称保留原值。铁人模式参与计划与速率缓存签名；配置变化重算，清空角色配置保留计划及已有材料。
- 原始模拟与共用奖励期望已经读取 `player.ironman`，无需新增公式；即时升级继续固定经验、确定产物及零耗时。
- 先更新制造设计，再实现；同步采集与技术文档中旧的制造例外描述。无入口变化，无需改 README。

## 本次验证

- 52 项：`node --test tests/crafting-options.test.mjs tests/crafting.test.mjs tests/crafting-upgrades.test.mjs tests/crafting-display.test.mjs tests/gathering-world-buffs.test.mjs tests/combat-world-buffs.test.mjs` 全部通过，含全部普通制造配方五品质原始离线对照，以及本轮五技能世界经验／铁人模式原始离线对照。日志：unit.log（`.test-artifacts/work-options-2026-10-19/unit.log`）。
- 71 项：`node --test tests/gathering.test.mjs tests/character-import.test.mjs tests/work-expectation.test.mjs` 全部通过。日志：regression.log（`.test-artifacts/work-options-2026-10-19/regression.log`）。
- 制造 4 组：`node tests/crafting-options-browser.mjs`，中文／英文 × 1440px／390px，通过旧存档、小数导入与手填、铁人开关、真实速率及计划 Worker、刷新保存、技能／语言切换、旧／异常／空窗口提示、清空配置保留计划及材料；无脚本异常。结果（`.test-artifacts/crafting-options/results.json`）、日志（`.test-artifacts/work-options-2026-10-19/crafting-browser.log`）。四张制造截图已审阅：中文桌面（`.test-artifacts/crafting-options/zh-1440.png`）、中文窄屏（`.test-artifacts/crafting-options/zh-390.png`）、英文桌面（`.test-artifacts/crafting-options/en-1440.png`）、英文窄屏（`.test-artifacts/crafting-options/en-390.png`）。
- 采集 4 组：`node tests/gathering-world-buffs-browser.mjs`，相同语言和宽度组合，共用导入、世界两项小数、保存重置、Worker 替换及丢弃兼容回归通过，无脚本异常。结果（`.test-artifacts/gathering-world-buffs/results.json`）、日志（`.test-artifacts/work-options-2026-10-19/gathering-browser.log`）。
- `git diff --check` 通过。

浏览器测试首次受到沙箱本机监听限制，获准以临时本机服务和无头 Chrome 执行。制造验证脚本首次错误地将默认计划消息类型期望为显式 `plan`，修正为 `mode ?? 'plan'` 后四组通过；此为验证脚本修正，未据此更改产品行为。

未执行全量发布验证、未部署；未使用真实游戏账号或实际脚本管理器验证。上述数据均为本次实际执行，不复用历史通过结果。
