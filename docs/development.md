# 本地开发

[项目入口](../README.md) · [技术方案与上游更新](technical.md) · [发布流程](release.md)

需要 Node.js 20+。本地运行网页无需安装开发依赖：

```sh
node scripts/serve.mjs
```

打开 [本机页面](http://127.0.0.1:4173)。服务仅监听本机，可通过 `PORT` 环境变量修改端口；支持 `/combat`、`/gather`、`/craft`、`/enhance`、`/mastery`、`/forecast`、`/formulas` 和隐藏调试页 `/debug`。调试页仅提供角色配置 JSON 导出、战斗／强化配置文件导入；完整角色快照捕获、导入、导出与模拟已在当前版本移除。

运行测试：

```sh
node --test tests/*.test.mjs
```

重新提取原始计算代码时，安装开发依赖后执行：

```sh
pnpm install --frozen-lockfile
node scripts/extract.mjs
```

当前完整公开资源位于 `vendor/game-original.js`，来源、摘要、语义导出及声明摘要记录于 `vendor/manifest.json`；当前生成模块完整来自已核验的 1.0.1190，无混合版本或局部替换；`vendor/game-combat-1187.js` 和局部映射文件仅保留为此前战斗阶段的证据，不再被当前提取器使用。`vendor/game-combat-update.js` 保留为历史局部更新的原始证据。禁止手工修改生成文件 `src/upstream.js`；更新原始资源须遵循 [上游更新流程](technical.md#64-上游更新流程)，完成映射审阅、重新提取及回归验证。

本机服务有意不开放 `docs/`、`reports/` 与 `AGENTS.md`；文档通过仓库或本地编辑器阅读。README 与 DESIGN 仍可直接访问，但其拆分文档链接不属于网页预览服务范围。无需为文档整理扩大服务器访问范围。

## 公式内容维护

公式页面仅中文；修改 `src/content/formulas/combat.zh.md` 后刷新页面即可读取新内容。只使用标题、列表、表格和文本公式块，不嵌入原始 HTML。二、三级标题自动进入目录；章节链接按标题顺序生成，调整章节顺序时需同步检查旧链接。

markdown-it 在 `package.json` 中以固定版本开发依赖管理，锁文件记录包完整性及依赖。安装后执行 `pnpm vendor:markdown`，从安装包同步浏览器发行文件、源码映射、许可证和来源摘要到 `vendor/markdown-it/`；`pnpm vendor:markdown --check` 检查版本及字节一致性。升级时先更新固定版本与锁文件，再同步发行文件并运行公式专项。网页运行使用本地发行文件，无需访问 CDN 或在运行时安装依赖。

专项单元与发布资源测试：`node --test tests/formulas.test.mjs tests/release-tools.test.mjs`。浏览器专项：`node tests/formulas-browser.mjs`，使用本机 Chrome 和临时回环服务，结果与截图保存在 `.test-artifacts/formulas/`；需要允许本机监听与浏览器进程。其验证公式页面、错误重试、目录、路由、布局和模拟状态保留，不替代完整发布验收。

## 赞赏弹窗专项

运行 `node tests/appreciation-browser.mjs`，使用本机 Chrome 和临时回环服务，检查双语桌面／窄屏、各页面入口、弹窗交互、图片失败重试及静态资源交付，以及外部文案随机选择、失败隐藏、超时和关闭／重绘竞态（以请求替身验证，不依赖外部服务可用性）；结果与截图保存在 `.test-artifacts/appreciation/`。需要允许本机监听与浏览器进程，不下载浏览器、不连接支付服务。图片维护于 `src/assets/appreciation.jpg`，按原始字节纳入发行包；替换图片后重跑专项。

## 角色捕获 Worker 专项

运行 `node --test tests/capture-worker.test.mjs tests/character-import.test.mjs tests/market-import.test.mjs` 验证角色捕获、保存协调、市场捕获移除、角色桥接及官方行情适配。运行 `node scripts/check-capture-browser.mjs` 后，在 Chrome 打开 `http://127.0.0.1:4186/`，页面自动验证真实 Blob Worker、字段裁剪、慢存储合并、跨连接隔离和失败提示，完成后显示 PASS。此服务只暴露测试页与当前候选脚本，不连接游戏，GM 存储和 WebSocket 使用合成替身；`PORT` 可修改端口。源码变化后刷新重测，结束后停止服务。

本地真实 Worker 验证不代表脚本管理器沙箱兼容或真实账号卡顿改善；安装／更新 2.7.0 后仍须刷新游戏和实验室，并单独记录该环境的验收。Worker 不可用时明确提示失败并要求刷新，不会回退到主线程捕获。

## 发布工具开发

发布前检查、打包及目标验收使用 `pnpm release:check`、`pnpm release:package`、`pnpm release:verify`，参数及证据规则见 [发布流程](release.md)。三个入口不自动提交、登录或部署。开发发布工具时先运行 `node --test --test-reporter=tap tests/release-tools.test.mjs`；其中 HTTP 测试只使用临时回环服务器。完整应用测试仍在正式发布前执行。

完整独立原始计算对照的常规入口为 `node scripts/native-audit.mjs`，复用已核验全部页面审计；日期型报告脚本仅保留历史证据。浏览器依赖为固定版本 playwright-core，需本机 Chrome／Chromium，或通过 RELEASE_BROWSER 指定可执行文件；不下载浏览器，也不使用用户已有会话和游戏账号。

## 官方行情与价格弹窗专项

运行 `node --test tests/market-import.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs tests/item-price-status.test.mjs`。运行 `node tests/market-prices-browser.mjs` 验证官方 API 真实跨域、双语桌面／390px 弹窗、导入与锁定、错误保留及真实 Blob Worker；需要网络、本机监听和 Chrome。结果和截图保存在 `.test-artifacts/market-prices/`；接口异常明确失败，不以请求替身通过代替真实跨域验证。功能场景使用可控响应替身，不连接游戏账号。

仅修改价格筛选、操作栏布局、提示或导入请求时机时，运行 `node --test tests/item-price-status.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs` 及 `node tests/market-prices-browser.mjs --toolbar-only`，后者仅执行双语桌面／390px 操作栏和弹窗四组验证，包含无筛选空状态、保留的状态选项、五类独立筛选与清空勾选、空列表全局导入／清空、打开／重开零请求、错误持续与显式重试；同时保存初始与已筛选截图。结果保存至 `.test-artifacts/price-toolbar/`，不重跑无关的真实 API 或角色 Worker 专项。此模式仍需要本机监听及 Chrome，行情使用请求替身。

## 上游版本适配专项

`node --test tests/upstream-1190.test.mjs` 覆盖迁移战斗区域、自动及两个指定仓库、巨像六件五品质材料、保存兼容与任务自动领奖隔离。独立离线对照使用 `scripts/native-questless.mjs` 按日边界分段保持空任务，以数学日／周编号独立于应用适配函数核验。

`node tests/upstream-browser.mjs --out .test-artifacts/upstream-1190` 检查双语桌面／390px 战斗完成、来源版本、巨像材料／经验与库存计划刷新保存，以及合成消息下的真实 Blob Worker；需要本机监听和 Chrome。指定 `--url https://dvi-lab.pages.dev --out <证据目录>` 时检查该实际目标四组页面，不把本地 Worker 当作生产测试。截图和机器结果落盘，仍需人工审阅。
