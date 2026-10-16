# 采集两项世界增益实施与验证

日期：2026-10-16。本地已实现，未部署；生产仍为1.3.7。规则见 [采集页面](../docs/pages/gathering.md)，参照 [战斗页世界增益](../docs/pages/combat.md#335-完整手动模拟条件)。

## 实现与边界

- 采集“其它”按公会经验、世界增益经验、世界增益稀有发现、祝福的顺序展示；两项世界增益默认0，范围0–10000000%，增减步进0.1%，手动输入及导入完整小数不截断。各自下方显示战斗页同款中英文全程生效说明，替换旧内置预测说明。
- 新增 `src/world-buffs.js`，抽出战斗原有窗口校验、捕获时汇总及升级提示。战斗继续使用同一规则；采集通过共用工作导入器的明确选项启用，制造保留每周 gathered／felled 标签经验导入，未新增制造稀有度配置。
- 捕获必须有 `worldBuffsVersion: 1`；汇总全部有效窗口，名称重复或省略不影响，起止均包含，过期及未来不计。倍率缺省为1；窗口格式／范围或汇总无效时两项清零。旧捕获清零并提示更新userscript、刷新后重新捕获，其它有效字段照常导入。世界增益清零提示独立于“其它字段保留原值”的提示，不误报沿用旧增益。
- 经验沿用 `weeklyXp` 并允许小数，稀有度使用 `worldRarity`；原始context窗口从初始化至模拟结束全程生效，热门仍独立处理。世界稀有度进入原始工作抽样和主产物／适用奖励机会期望，原始引擎与生成文件不因本功能修改。配置保存、Worker失效及重新模拟沿用现有流程，固定幸运属性面板仍不包含context窗口。
- userscript已经捕获两类倍率和能力标记，本次不升级脚本或协议。没有新增种子输入、次数停止、剩余时长、等级内经验等其它核查项。

## 本次实际验证

`node --test tests/gathering-world-buffs.test.mjs tests/gathering.test.mjs tests/combat-world-buffs.test.mjs tests/character-import.test.mjs tests/crafting.test.mjs tests/work-expectation.test.mjs tests/collection.test.mjs`：117项全部通过，无失败、取消、跳过或待办。完整日志 `.test-artifacts/gathering-world-buffs/unit-tests.log`。

覆盖任意／无名称、同名叠加、起止包含、过期／未来排除、倍率省略、有效空列表、旧能力标记、异常倍率／时刻及汇总超限清零；人工35.25%经验／70.75%稀有度算例、小数保存、最大范围；三个热门模式初始化／末刻边界；品质普通概率由 `1−1/40` 变为世界稀有度+100%时的 `1−2/40`。四技能分别以回仓和丢弃策略执行1小时原始离线对照，经验、金币、抽样产出和保留主产物总量一致。制造旧导入、战斗共用规则及当前本地收藏消费者回归一并通过。

`node tests/gathering-world-buffs-browser.mjs`：中英文1440px／390px四组场景通过，无页面错误。真实Worker核验旧存储默认、全部窗口DOM桥接导入、两项说明与名称、小数手动修改／保存／刷新、切换技能保留、语言只重绘、旧Worker终止、丢弃兼容、旧／异常／空捕获提示及清空。四张截图已审阅，无控件遮挡或整页横向溢出。结果、完整日志与截图保存在 `.test-artifacts/gathering-world-buffs/`。

另以临时本机服务重跑 `tests/combat-world-buffs-browser.mjs`：真实Blob捕获Worker及四组双语两视口导入／提示／保存／清空场景通过。证据 `.test-artifacts/gathering-world-buffs/combat-regression/` 与 `combat-regression.log`，无浏览器错误。

首次采集浏览器运行发现原有通用数值校验按HTML步进拒绝20.75%等有效小数，已对两项世界增益采用有限数及范围校验，保留0.1的增减步进；上述最终浏览器和117项测试均在修复后执行。语法、文档本地链接及空白检查通过。本次没有执行完整发布门槛、部署、生产验收、真实账号或实际脚本管理器验证；不能以此替代下一轮发布检查。
