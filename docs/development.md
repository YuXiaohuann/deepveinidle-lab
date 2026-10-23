# 本地开发

[项目入口](../README.md) · [技术方案与上游更新](technical.md) · [发布流程](release.md)

需要 Node.js 20+。本地运行网页无需安装开发依赖：

```sh
node scripts/serve.mjs
```

打开 [本机页面](http://127.0.0.1:4173)。服务仅监听本机，可通过 `PORT` 环境变量修改端口；支持 `/combat`、`/gather`、`/craft`、`/enhance`、`/mastery`、`/forecast`、`/formulas`、隐藏收藏页 `/collection` 和调试页 `/debug`。调试页仅提供角色配置 JSON 导出、战斗／强化配置文件导入；完整角色快照捕获、导入、导出与模拟已在当前版本移除。

运行测试（功能修改默认仅选相关测试，完整测试用于发布前验证）：

```sh
node --test tests/*.test.mjs
```

物品价格协议与命令测试为 `tests/price-protocol.test.mjs`、`tests/price-service.test.mjs`，官方接口解析见 `tests/market-import.test.mjs`。运行 `node tests/price-refactor-browser.mjs` 验证六项数据、全市场挂单总量、收藏四选项及默认全局价、强化方案覆盖与清空，以及价格消费者页面导航；输出位于 `.test-artifacts/price-refactor/protocol/`。沿用市场价格、收藏及收藏计划浏览器专项，需要本机端口和 Chrome 进程权限，不能替代完整发布验收。协议见[物品价格模块](modules/item-prices.md)。

重新提取原始计算代码时，安装开发依赖后执行：

```sh
pnpm install --frozen-lockfile
node scripts/extract.mjs
```

当前完整公开资源位于 `vendor/game-original.js`，来源、摘要、语义导出及声明摘要记录于 `vendor/manifest.json`；当前生成模块完整来自已核验的 1.0.1199，无混合版本或局部替换；`vendor/game-combat-1187.js` 和局部映射文件仅保留为此前战斗阶段的证据，不再被当前提取器使用。`vendor/game-combat-update.js` 保留为历史局部更新的原始证据。禁止手工修改生成文件 `src/upstream.js`；更新原始资源须遵循 [上游更新流程](technical.md#64-上游更新流程)，完成映射审阅、重新提取及回归验证。

本机服务有意不开放 `docs/`、`reports/` 与 `AGENTS.md`；文档通过仓库或本地编辑器阅读。README 与 DESIGN 仍可直接访问，但其拆分文档链接不属于网页预览服务范围。无需为文档整理扩大服务器访问范围。

## 公式内容维护

公式页面仅中文；修改 `src/content/formulas/combat.zh.md` 后刷新页面即可读取新内容。只使用标题、列表、表格和文本公式块，不嵌入原始 HTML。二、三级标题自动进入目录；章节链接按标题顺序生成，调整章节顺序时需同步检查旧链接。

markdown-it 在 `package.json` 中以固定版本开发依赖管理，锁文件记录包完整性及依赖。安装后执行 `pnpm vendor:markdown`，从安装包同步浏览器发行文件、源码映射、许可证和来源摘要到 `vendor/markdown-it/`；`pnpm vendor:markdown --check` 检查版本及字节一致性。升级时先更新固定版本与锁文件，再同步发行文件并运行公式专项。网页运行使用本地发行文件，无需访问 CDN 或在运行时安装依赖。

专项单元与发布资源测试：`node --test tests/formulas.test.mjs tests/release-tools.test.mjs`。浏览器专项：`node tests/formulas-browser.mjs`，使用本机 Chrome 和临时回环服务，结果与截图保存在 `.test-artifacts/formulas/`；需要允许本机监听与浏览器进程。其验证公式页面、错误重试、目录、路由、布局和模拟状态保留，不替代完整发布验收。

## 精通最优分配专项

`node --test tests/mastery-optimizer.test.mjs tests/mastery.test.mjs tests/mastery-controls.test.mjs` 覆盖重置／保留模式预算、十项等级下限、独立小预算穷举、跨级取整平台、原始战斗模拟与估值对照、种子／缓存／复核、缺价、死亡和异常；修改共用模拟或价格协议时按影响范围另选 `tests/simulation.test.mjs`、`tests/price-protocol.test.mjs`。`node tests/mastery-optimizer-browser.mjs [输出目录] [目标网址]` 启动本机服务及独立无头 Chrome，验证两种模式的真实优化 Worker、收入／投入／差异精简清单、无复制入口、自动应用最佳与手动应用备选、下方等级／成本／存档同步、应用校验拒绝和保存失败提示、双语桌面／390px、默认折叠、键盘展开、折叠状态跨重绘／完成保留、开始／取消共用按钮及其双语状态、运行中语言切换、应用后重绘不重复应用、模式切换／取消与迟到消息、预算／当前等级失效及价格变化提示与结果保留、目标草稿独立及回到战斗页编辑。另检查怪物等级降序与默认深渊恐魔、两种模式统一开始按钮，以及价格提示跨进度／完成／语言切换保留、重算使用最新价格。保留模式额外检查非战斗精通投入、零余点和当前超预算拒绝。提供目标网址时直接验证该目标，不启动本机服务；默认日志摘要和截图输出至 `.test-artifacts/mastery-optimizer/`，人工审阅截图；需要回环监听和浏览器进程，不连接真实账号。完整日志可用重定向另行保存，不替代发布验收。

## 赞赏弹窗专项

运行 `node tests/appreciation-browser.mjs`，使用本机 Chrome 和临时回环服务，检查双语桌面／窄屏、各页面入口、弹窗交互、图片失败重试及静态资源交付，以及外部文案随机选择、失败隐藏、超时和关闭／重绘竞态（以请求替身验证，不依赖外部服务可用性）；结果与截图保存在 `.test-artifacts/appreciation/`。需要允许本机监听与浏览器进程，不下载浏览器、不连接支付服务。图片维护于 `src/assets/appreciation.jpg`，按原始字节纳入发行包；替换图片后重跑专项。

<a id="角色捕获-worker-专项"></a>

## 角色捕获专项

运行 `node --test tests/character-capture.test.mjs tests/character-import.test.mjs tests/market-import.test.mjs` 验证角色捕获、保存协调、市场捕获移除、角色桥接及官方市场价格适配。运行 `node scripts/check-capture-browser.mjs` 后，在 Chrome 打开 `http://127.0.0.1:4186/`，页面自动验证直接捕获（不提供 Worker／Blob API）、字段裁剪、慢存储合并、跨连接隔离和失败提示，完成后显示 PASS。此服务只暴露测试页与当前候选脚本，不连接游戏，GM 存储和 WebSocket 使用合成替身；`PORT` 可修改端口。源码变化后刷新重测，结束后停止服务。

本地合成消息验证不代表脚本管理器沙箱兼容或真实账号卡顿改善；安装／更新角色脚本后仍须刷新游戏和实验室（生产基线及本地候选见 [当前状态](status.md)），并单独记录该环境的验收。角色数据不兼容或保存失败时明确提示失败并要求刷新。

## 发布工具开发

发布前检查、打包及目标验收使用 `pnpm release:check`、`pnpm release:package`、`pnpm release:verify`，参数及证据规则见 [发布流程](release.md)。三个入口不自动提交、登录或部署。开发发布工具时先运行 `node --test --test-reporter=tap tests/release-tools.test.mjs`；其中 HTTP 测试只使用临时回环服务器。完整应用测试仍在正式发布前执行。

完整独立原始计算对照的常规入口为 `node scripts/native-audit.mjs`，复用已核验全部页面审计；日期型报告脚本仅保留历史证据。浏览器依赖为固定版本 playwright-core，需本机 Chrome／Chromium，或通过 RELEASE_BROWSER 指定可执行文件；不下载浏览器，也不使用用户已有会话和游戏账号。

## 官方市场价格与价格弹窗专项

运行 `node --test tests/market-import.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs tests/item-price-status.test.mjs`。运行 `node tests/market-prices-browser.mjs` 验证官方 API 真实跨域、双语桌面／390px 弹窗、导入与锁定、错误保留及直接捕获（不提供 Worker／Blob API）；需要网络、本机监听和 Chrome。结果和截图保存在 `.test-artifacts/market-prices/`；接口异常明确失败，不以请求替身通过代替真实跨域验证。功能场景使用可控响应替身，不连接游戏账号。

价格设置及自动导入专项可运行 `node tests/market-prices-browser.mjs --toolbar-only`，覆盖双语桌面／390px 筛选、手动导入、锁定、分类兜底、重置、自动导入开关、5 分钟边界与不轮询，以及成功／失败通知 30 秒自动关闭和点击／键盘关闭。行情使用请求替身，不重跑真实 API 或角色捕获专项。默认结果保存至 `.test-artifacts/price-toolbar/`；可用 `--out <目录>` 单独保存本轮证据，使用 `--base-url <目标网址>` 对指定候选或生产目标执行相同专项。目标参数不启动本机服务，也不代表完整发布验收通过。

## 上游版本适配专项

`node --test tests/upstream-1199.test.mjs tests/upstream-1196.test.mjs tests/upstream-1194.test.mjs tests/enhancement.test.mjs tests/mastery.test.mjs` 验证书台恢复、1198 缺字段配置迁移、统一碎片／经验及保留 30 秒尝试，以及烟花有效品质／定价／收藏排除、升级收藏、预测初始化以及强化目标 +20、既有 +100 编码／导入保留、精通 +50% 封顶及锻造录 +15 计点边界／15,662 总上限。

`node --test tests/upstream-1190.test.mjs` 覆盖迁移战斗区域、自动及两个指定仓库、巨像六件五品质材料、保存兼容与任务自动领奖隔离。独立离线对照使用 `scripts/native-questless.mjs` 按日边界分段保持空任务，以数学日／周编号独立于应用适配函数核验。

`node tests/upstream-browser.mjs --out .test-artifacts/upstream-1199/browser` 检查双语桌面／390px 战斗完成、来源版本、巨像材料／经验与库存计划刷新保存，书台恢复／保存与缺字段迁移、强化成功率、新旧目标与高强化存档、精通加成封顶、烟花有效品质／火药定价／计划保存，以及合成消息下的直接捕获（不提供 Worker／Blob API）；需要本机监听和 Chrome。指定 `--url https://dvi-lab.pages.dev --out <证据目录>` 时检查该实际目标四组页面，不把本地角色捕获专项当作生产测试。截图和机器结果落盘，仍需人工审阅。

## 采集与制造表格专项

`node --test tests/crafting-display.test.mjs` 验证配方列序、品质、周期换算、制造次数取整、经验明细与异常行。浏览器专项使用 `node tests/gathering-table-browser.mjs [输出目录]`、`node tests/crafting-table-browser.mjs [输出目录]`，需要本机监听和 Chrome；默认分别输出至 `.test-artifacts/gathering-table/`、`.test-artifacts/crafting-table/`，复验时指定独立目录以保留历史证据。覆盖双语桌面／390px、排序、经验展开、周期切换、等待／失败及计划输入；正常计算使用真实 Worker，异常场景使用受控消息，不替代完整发布验收。

## 制造订单专项

`node --test tests/crafting-orders.test.mjs tests/crafting.test.mjs tests/crafting-display.test.mjs` 验证订单数量、批量操作、三项加工费、材料合并和独立模拟。`node tests/crafting-orders-browser.mjs [输出目录] [目标网址]` 使用本机服务和独立 Chrome，覆盖独立订单管理面板、无订单自动建单、默认勾选及空单状态保存、多配方订单、自动加入、隐藏项批量修改、整单选择、复制／删除、真实 Worker 按订单计费、库存一次抵扣、存档恢复与坏存档保护，以及双语桌面／390px。提供目标网址时不启动本机服务，直接验证该站点。默认输出 `.test-artifacts/crafting-orders/orders/`，截图须审阅；不连接游戏账号，不替代发布验收。制造表格及配置导入专项已使用新版订单存档，历史 `dvi-crafting-v1` 不作为新版输入。

制造库存专项：`node --test tests/character-inventory.test.mjs tests/crafting-orders.test.mjs tests/collection.test.mjs tests/collection-plan.test.mjs tests/character-import.test.mjs`；`node tests/crafting-inventory-browser.mjs [输出目录]` 验证进入／聚焦自动读取、只读仓库与背包合计、未知库存、失败／倒退保留、切页迟到隔离、角色导入原子更新、缓存及双语桌面／390px。默认输出 `.test-artifacts/crafting-inventory/`，使用受控角色桥接与真实制造 Worker，不连接游戏账号。

## 收藏页专项

`node --test tests/collection.test.mjs tests/i18n.test.mjs` 验证收藏目标、价格、奖励、原始事件和名称翻译。`node tests/collection-browser.mjs --out .test-artifacts/collection/local` 运行本机专项，`--url https://dvi-lab.pages.dev --out <目录>` 验证指定线上目标；结果包含目标 URL、按类型独立筛选／保存与错误恢复、分页及批量加入、仅材料采购展开区、受控桥接／报价、双语桌面与320／390／740px筛选截图。需要本机监听及Chrome；实际账号与成交不在验证范围，页面设计和边界见[收藏页面](pages/collection.md)。

执行计划与自动导入专项：`node --test tests/collection-plan.test.mjs tests/collection-plan-transfer.test.mjs`；`node tests/collection-plan-browser.mjs --out .test-artifacts/collection/plan-auto-local` 检查最高目标去重、材料归并、保存／导入保留、仓库与背包合计、计划 JSON／压缩剪贴板往返、每次焦点触发和无定时轮询、并发与过期响应，以及自动移除、材料备齐高亮、排序与双语桌面／320／390／768px布局。支持 `--url <目标地址>`；自动导入使用受控桥接及浏览器时钟，不连接真实账号。本地待发布规则应使用本机目标核验，不以生产旧版本结果替代。

## 共用角色自动更新专项

`node --test tests/character-auto-import.test.mjs tests/character-inventory.test.mjs tests/character-import.test.mjs tests/collection.test.mjs tests/collection-plan.test.mjs tests/crafting-orders.test.mjs tests/crafting-display.test.mjs` 验证配置／库存独立导入、偏好迁移与坏存档保护、生命周期和并发；`node tests/character-auto-import-browser.mjs [输出目录]` 使用独立 Chrome 和本机服务验证六页配置开关、两页库存开关、每页保存、焦点合并、重绘稳定、配置／库存隔离及双语桌面／390px。默认输出 `.test-artifacts/character-auto-import/browser/`，角色与市场均用受控响应，不连接游戏账号；配合制造库存专项和收藏计划专项回归，不替代发布验收。
