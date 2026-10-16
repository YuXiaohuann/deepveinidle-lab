# 世界增益配置文案验证

2026-10-16，已修改，尚未发布。战斗“其它”中的“世界增益稀有度 (%)”更名为“世界增益稀有发现 (%)”，英文为 World buff rare finds (%)。世界增益经验与世界增益稀有发现两项下方均显示“导入捕获时生效的世界增益，整个模拟周期保持生效。”，英文同步。配置位置、字段和计算规则不变；设计正文已同步。

运行已有 `tests/combat-world-buffs-browser.mjs`，本机 `http://127.0.0.1:4173` 共 5 组通过：真实 Blob Worker 及中文／英文各 1440px、390px。页面明确断言新名称、两项相同说明，并回归导入、小数保存、旧快照提示与清空。无页面错误，见[结果](combat-world-buffs-copy-browser-2026-10-16/result.json)。四张截图已审阅，无截断或遮挡：[中文桌面](combat-world-buffs-copy-browser-2026-10-16/zh-1440.png)、[中文窄屏](combat-world-buffs-copy-browser-2026-10-16/zh-390.png)、[英文桌面](combat-world-buffs-copy-browser-2026-10-16/en-1440.png)、[英文窄屏](combat-world-buffs-copy-browser-2026-10-16/en-390.png)。

`git diff --check` 通过；本轮为文案修改，未重跑计算测试、完整发布检查、真实账号验证或生产验收，未部署。此前实施报告及截图保留原阶段语境。
