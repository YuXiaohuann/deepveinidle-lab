# 收藏性价比首版实施与验证

日期：2026-10-17。范围：隐藏 `/collection` 页首次实施，候选版本 1.4.0；发布状态及完整验收见[当前状态](../docs/status.md)。现行规则仅维护于[页面设计](../docs/pages/collection.md)，本报告保存实现依据、验证和边界，不维护逐次需求修改记录。

## 实现与原始依据

- `collection-model.js` 保存首版单份配置和数量，复用采集／制造导入、原始工作属性、品质与收藏奖励；只生成九技能受支持主产物的全部未来档，金额分别处理缺价和超限。
- `collection-simulation.js` 与 Worker 按请求显式目标运行原始事件循环，最多 30 日；配置变化取消旧样本，价格／语言／筛选仅更新展示。目标不写入角色存档。
- `collection-controls.js` 提供统一配置、默认制造及等级达标筛选、两行筛选区、七列结果与详情。排序使用时间／材料每点升序及利润每点降序，名称按基础物品翻译；列指标有独立标识，浏览器断言不依赖可变列序。
- 提取器只增加所需收藏目录、门槛、累计奖励及药剂时长导出；移除未使用的来源／单档奖励别名。按提取器重新生成 719 个声明及 manifest，未手工编辑生成文件；公开资源仍为已核验 1.0.1190，未重新核验在线游戏版本。

收藏原始定位为 `Fd/Hd/S$/Rd/ku/e9/a7`，工作速度／经验／稀有为 `IT/g7/Fg/Fk/Lu`，烧焦／被捕为 `p7/qT`，药剂时长 `D2=6000` tick。数量收藏与发现标记分离，金币不作为主产物数量，升级只更新发现，宠物奖励独立；首版不将副产物奖励点数叠加。17 个原始数值探针及定位保留于[调研数据](mastery-efficiency-research-2026-10-16.json)。

代码清理去除了开发期双配置结构、单目标持久化、未支持来源展示、废弃每点净投入指标及重复归一化；共用角色桥接协议 2 和旧捕获世界增益警告仍是有效外部协议，不属于开发存档兼容。

## 当前验证入口

- 单元／相关回归：`node --test tests/collection.test.mjs tests/gathering.test.mjs tests/crafting.test.mjs tests/work-expectation.test.mjs tests/gathering-world-buffs.test.mjs tests/model.test.mjs tests/i18n.test.mjs`。
- 浏览器：`node tests/collection-browser.mjs --out <目录>`；正式目标用 `--url https://dvi-lab.pages.dev`。覆盖双语桌面／390px、收藏导入、单份配置、名称与品质、全部目标、报价／排序、金额超限、真实 Worker、取消、样本隔离及存储错误。结果保存目标 URL，不将本机结果当作生产结果。
- 发布完整检查按[三阶段流程](../docs/release.md)执行；发布报告记录完整测试、独立原始对照、提取、HTTP／浏览器矩阵及专项，不以此处历史通过结果代替。

本次清理实际执行的验证（发布完整检查另计）：

- 112 项相关测试通过，含收藏、采集、制造、工作期望、世界增益、基础模型及翻译；`cleanup-related-2026-10-17.log`。显式目标原始事件对照从当前9个直接达到100个，确认停止条件、材料91份和新增4点一致。
- 15 组浏览器专项通过，无页面错误或行情请求；`cleanup-local-2026-10-17/result.json`，含最终“名称 · 品质”、首版存档、稳定列标识、目标档隔离及全部交互。双语1440px／390px截图位于同目录。
- 提取重复一致、当前生成输出同步、未知摘要拒绝且不改产物；`cleanup-extraction-2026-10-17.json`。
- 相关代码语法、文档引用与 `git diff --check` 通过。以上证据位于 `.test-artifacts/collection/`，不作为部署或生产验收结果。

## 开发期证据归档

下列证据均为开发期结果，不代表当前候选重跑。原始截图、JSON 和日志保留于 `.test-artifacts/collection/`；原调研、材料价格、加成核对和统一配置五篇 Markdown 已收敛到本报告与页面设计，旧默认值和已替换交互不再作为规则。

| 日期／主题 | 当时验证及证据 |
| --- | --- |
| 2026-10-16 初始模型、全部目标及点数筛选 | 93 项 `unit.log`、81 项 `calculation.log`、12 项 `final-collection.log`、13 项 `point-target-unit.log`；原始提取 `extraction.json` |
| 2026-10-16 金额超限隔离 | 14 项 `amount-overflow-unit.log`；双语 1440／390 截图 `collection-语言-宽度.png`，通用 `result.json` 随后续重跑更新，不作为冻结的历史结果 |
| 2026-10-17 材料来源与点数列 | 16 项 `material-price-unit-2026-10-17.log`、`material-price-browser-2026-10-17.json` |
| 2026-10-17 加成与提取 | 109 项 `bonus-related-2026-10-17.log`、22 项 `bonus-unit-2026-10-17.log`、`bonus-extraction-2026-10-17.json`、`bonus-browser-2026-10-17.json`、`gather-mastery-browser-2026-10-17.json` |
| 2026-10-17 统一配置 | 110 项 `unified-config-related-2026-10-17.log`、11 组 `unified-config-browser-2026-10-17.json`、`unified-config-zh-390.png`／`unified-config-en-1440.png` |
| 2026-10-17 筛选、默认值与排序 | `type-filter-browser-2026-10-17.json`（12组）、`level-filter-browser-2026-10-17.json`、`filter-layout-browser-2026-10-17.json`、`default-crafting-browser-2026-10-17.json`（各13组）、`sorting-browser-2026-10-17.json`（14组） |
| 2026-10-17 利润口径、总材料列、翻译 | 23 项 `profit-display-unit-2026-10-17.log`、`profit-display-browser-2026-10-17.json`／`total-material-browser-2026-10-17.json`（各14组）、2项 `item-translations-unit-2026-10-17.log`、15组 `item-names-browser-2026-10-17.json` |

开发验证发现的缺失导入、进度重建取消控件、保存错误提示覆盖、快速切换丢失展开状态等均已处理。先前启动本机服务受沙箱监听限制，授权后重跑通过；新手首动作原始概率固定为 1，速度测试改用 2 级；详情重复点击收起和新增列后的旧序号断言已修正。标题空格微调当时只做静态检查，最终候选应由新一轮浏览器确认。

## 验证边界

桥接和报价使用受控数据，没有操作真实游戏账号或脚本管理器，没有验证实际行情成交。角色从等级最低经验开始；动作期望不含行程与成长，样本才包含这些过程。药剂按持续消耗折算，不模拟整瓶库存或实际续用；祝福费用、设备购置、交易等待／费用不计。长期性能、全部配置的到达时间分布、未支持来源及跨路线最优计划仍未核验。
