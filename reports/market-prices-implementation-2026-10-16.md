# 官方行情与价格弹窗实施验证

本报告合并同一专题的阶段记录，保留原日期、版本、实际验证、失败及未覆盖事项。各节中的“当前”“本轮”“未发布”均指该节记录时点，不代表现行规则，也不计为本次文档清理重新验证。

这些变更后随 [1.3.3](v1.3.3-release-2026-10-16.md) 发布；性能调查另见 [调查报告](price-dialog-performance-2026-10-16.md)。

## 阶段入口

- [官方市场价格导入改造](#api-adaptation)
- [价格操作栏与统一提示验证](#toolbar)
- [仅点击时导入官方行情](#explicit-import)
- [官方行情改造提交前验证](#commit-validation)
- [价格列表筛选前置验证](#filter-gate)

<a id="api-adaptation"></a>
## 官方市场价格导入改造

日期：2026-10-16。范围：将游戏市场捕获与 userscript 桥接替换为官方公开 API 导入，同时移除数据导入 userscript 的市场功能。仅本地实施，未发布；包版本与生产仍为 1.3.2，角色脚本候选为 2.7.0（生产仍为 2.6.0）。此前重置范围调整保留，本次不扩大其范围。

<a id="api-adaptation-变更明细"></a>
### 变更明细

| 文件／范围 | 实际变更 |
| --- | --- |
| `src/market-import.js` | 删除市场 CustomEvent 请求、响应监听、重试和旧脚本版本检测；直接 GET `https://deepveinidle.com/api/market/prices.json`，不发送凭据，10 秒超时，分别报告网络、HTTP、超时、JSON／结构及空数据错误。 |
| 官方数据适配 | 核验 `game`、`generatedAt`、`refreshSeconds` 和 `items`；完整 ID 映射，`lowestSell` → ask、`highestBuy` → bid、`generatedAt` → 行情时间。null 与缺字段／非法价分开，未知 ID 跳过统计，不按名称猜测。 |
| `src/item-price-controls.js` | 保留弹窗、折叠和导入按钮，安装链接改为官方来源链接；捕获文案改为已读取／报价物品数／报价更新时间。打开仅更新行情缓存，点击导入重新读取并应用；整份旧行情拒绝覆盖，失败保留当前价格和缓存，成功全量响应替换报价缓存。 |
| 分类价格表 | 保留卖单价、买单价、买单价商人兜底、商人价、不导入五种选择、默认值及持久化偏好。保留商人售价计算、变体 ID、缺价／异常／锁定跳过和导入统计。 |
| 手动价格设置 | 保留搜索和筛选、合法品质／强化变体、手动价格、0／空值、修改后自动锁定、单项／批量锁定解锁、清空未锁定价格及各页面估值联动。导入使用点击时分类偏好、应用时最新价格和锁定状态。 |
| `src/item-prices.js` | 价格状态升级至版本 3，原存储键不变。版本 2 迁移保留有效价格、来源、锁定、更新时间和分类偏好，丢弃旧游戏行情缓存，并清空原报价时间基准；首次读取不写盘，随后更新保存版本 3。其他旧格式仍拒绝。 |
| `src/character-import.user.js` | 版本 2.6.0 → 2.7.0；删除 marketBook／marketBooks／marketDepth 专用解析和合并、市场状态与修订、GM 市场缓存读写、dvi-market-request/response 桥接、市场成功／保存失败提示及脚本介绍中的市场功能。仅角色保存队列保留。 |
| 角色导入兼容 | 保留 Worker 与积压保护、角色配置字段、公会与世界窗口、首次成功 5 秒提示、慢存储合并及跨连接隔离。角色桥接仍为 2.4、数据协议仍为 2、存储键不变。旧 GM 市场数据不主动删除，也不再读写。 |
| 测试 | 重写市场捕获测试为 API 请求与适配测试；增加版本 2 迁移、失败原子性、旧行情拒绝、全量缓存替换及等待期间手动改价／锁定测试。角色 Worker 测试改为角色慢保存与市场忽略回归；真实 Worker 测试页同步更新。新增浏览器专项入口。 |
| 文档 | 同步 DESIGN、共用价格设计、技术协议、README、开发、发布及当前状态。历史报告和生产基线保持历史语境。 |

<a id="api-adaptation-本轮验证"></a>
### 本轮验证

- `node --test tests/market-import.test.mjs tests/item-price-status.test.mjs tests/item-price-store.test.mjs tests/item-prices.test.mjs tests/capture-worker.test.mjs tests/character-import.test.mjs`：97 项通过，0 失败／取消／跳过。
- `node tests/market-prices-browser.mjs`：六组通过。包括无 userscript 的官方 API 真实浏览器跨域、中英文 1280px／390px 四组交互，以及真实 Blob Worker。此次真实 API 响应适配 1,058 个物品变体，未知项统计为 0；行情生成时间 `2026-10-16T00:55:08.026Z`，不是本次请求时间。该计数为本次快照事实，不保证市场未来固定数量。
- 四组弹窗验证：版本 2 存档迁移、打开仅缓存、分类选项顺序、导入锁定保护、行情时间、手动 0／清空并锁定、HTTP 失败保留、错误持续、解锁重试、关闭和焦点返回、无弹窗横向溢出；无阻断性脚本错误。四张截图已人工审阅，见下方。
- 真实 Blob Worker：角色字段裁剪、市场消息不触发任何保存、慢存储期间不回传中间快照、结束后保存最新角色、跨连接串行保存及异常明确提示均通过。没有真实账号参与，不以此宣称性能改善或脚本管理器安装通过。
- 已核验 API 返回 HTTP 200、`Access-Control-Allow-Origin: *`、`Cache-Control: public, max-age=300` 及 `refreshSeconds: 300`。网页不新增轮询，遵循浏览器缓存。
- 本次修改文件语法、文档本地链接及 `git diff --check` 检查通过；没有执行完整应用测试、独立原始计算对照、完整发布检查或部署。

本地完整日志、API 初次快照／响应头、机器结果与截图位于 `.test-artifacts/market-prices/`。`unit.log` 是本次单测日志，`browser.log`／`browser.json` 为最终浏览器结果；该目录不纳入发布包。

<a id="api-adaptation-失败与修正"></a>
### 失败与修正

初次沙箱运行因本机监听 EPERM 未启动浏览器，随后使用获准的本机监听／Chrome 环境运行。浏览器迭代中修正三处测试问题：手动输入失焦前记录基线导致更新时间比较失败；解析真实 Worker 的初始“验证中”占位文本失败；慢存储测试连续发送百条含巨型无关历史的角色帧触发既有积压保护，改为首帧大数据裁剪加后续小型角色更新。最终六组专项全部通过，未放宽产品积压上限或隐藏失败。后两轮失败结果分别保存在 `browser-failed-wait.*` 与 `browser-failed-burst.*`。

<a id="api-adaptation-使用与未覆盖范围"></a>
### 使用与未覆盖范围

市场价格导入无需安装脚本或在游戏打开市场。要让已安装的旧数据导入脚本停止游戏侧市场捕获，需要安装／更新 2.7.0 并刷新游戏；角色导入仍使用同一入口和协议。新脚本的真实 Tampermonkey／其他脚本管理器安装、真实账号操作及长时性能尚未验证。生产功能尚未改变，本次未运行完整发布检查或部署。

<a id="api-adaptation-已审阅截图"></a>
### 已审阅截图

- [中文桌面](official-market-api-zh-desktop-2026-10-16.png)
- [中文窄屏](official-market-api-zh-mobile-2026-10-16.png)
- [英文桌面](official-market-api-en-desktop-2026-10-16.png)
- [英文窄屏](official-market-api-en-mobile-2026-10-16.png)


<a id="toolbar"></a>
## 价格操作栏与统一提示验证

日期：2026-10-16。仅本地变更，未发布，生产仍为 1.3.2。本报告接续 [官方行情改造](market-prices-implementation-2026-10-16.md#api-adaptation)；此前报告中的 API 链接、按钮位置和两行提示为前一阶段状态，当前界面以本报告和 [共用设计](../docs/shared.md#24-全局物品价格) 为准。

<a id="toolbar-实施范围"></a>
### 实施范围

- 删除“市场价格导入”中的“官方行情 API”链接；该折叠区仅保留分类价格选项表格。
- “一键导入价格”移至下方价格表操作栏，紧接“清空价格”，统一提示紧接导入按钮，位于同一弹性布局中。窄屏自然换行，不截断文案；折叠分类区后导入仍可用。
- 删除原行情摘要节点，行情、读取中、导入统计、锁定／解锁、清空及手动输入错误共用一个 `price-status`。读取中只显示一次“正在读取官方行情…”，自动读取成功只显示数量与行情时间；删除“未自动导入”重复提示。
- 导入结果固定显示更新、商人价、锁定跳过和缺报价四项，无法兜底／过旧／异常仅在非零时追加。行情错误优先于其他操作结果，持续到下一次成功读取；正常改价恢复摘要，不额外添加成功提示。
- 错误使用 `role=alert` 与现有高亮颜色，其他状态使用 `role=status`。手动输入时通过同一文案函数更新提示而不重绘当前输入框；原存档读取／保存警告保留独立区域。
- 分类选项、默认值、手动价格、锁定、清空、API 请求及 userscript 捕获范围不新增调整。中英文同步。

<a id="toolbar-本轮实际验证"></a>
### 本轮实际验证

- `node --test tests/item-price-status.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs`：38 项通过，0 失败／取消／跳过。
- `node tests/market-prices-browser.mjs --toolbar-only`：中文／英文、1280px／390px 四组通过。检查 API 链接消失、导入按钮位于清空之后、只有一个状态节点且紧接导入按钮、折叠分类后仍可导入、缓存读取与有效价隔离、版本 2 迁移、锁定保护、手动 0／空值、失败原子性、错误保留、重试及关闭／焦点返回。没有阻断性脚本错误或弹窗横向溢出。
- 单元验证额外覆盖读取中文案不重复、统计零值省略、异常统计双语、行情错误不被清空或合法手动改价覆盖、非法输入与恢复时更新同一无障碍状态。
- 四张截图已人工审阅：桌面显示按钮与后方提示，英文允许在余下宽度内换行；390px 操作栏自然换行，提示保持完整，物品表继续内部横向滚动。
- 修改的 JS／MJS 语法、文档本地引用及 `git diff --check` 通过。

本轮浏览器首轮因测试选择器替换错误（将“旧节点不存在”误写为“新节点不存在”）未通过，修正测试后四组通过；没有更改产品行为来迁就错误断言。失败与最终结果均保存在 `.test-artifacts/price-toolbar/`，包括 `browser-failed-selector.*`、`browser.log`、`browser.json`、`unit.log` 和截图。实施脚本首个编辑命令遇到编码错误，在解析阶段退出，没有部分写入；随后使用补丁完成修改。

本轮仅为操作栏专项，行情使用可控响应替身；未重跑真实官方 API、角色 Worker、完整应用测试、独立原始计算对照或完整发布检查，未部署。前一阶段结果保留其原语境。

<a id="toolbar-已审阅截图"></a>
### 已审阅截图

- [中文桌面](price-toolbar-zh-desktop-2026-10-16.png)
- [中文窄屏](price-toolbar-zh-mobile-2026-10-16.png)
- [英文桌面](price-toolbar-en-desktop-2026-10-16.png)
- [英文窄屏](price-toolbar-en-mobile-2026-10-16.png)

<a id="toolbar-导入按钮文字高亮"></a>
### 导入按钮文字高亮

按后续确认范围，仅对“一键导入价格”文字使用现有金色和 650 字重；撤销整块背景、边框和内描边高亮。背景、边框及按钮位置沿用普通次要按钮，读取中或分类全为不导入时保持禁用并降低透明度。代码仅调整 CSS，相关共用设计同步更新。

本轮实际执行 `node tests/market-prices-browser.mjs --toolbar-only`，中英文 1280px／390px 四组均通过，无阻断性脚本错误或横向溢出；下列四张截图已审阅。结果及日志保存为 `.test-artifacts/price-toolbar/text-highlight-browser.json` 和 `text-highlight-browser.log`。文档本地引用与 `git diff --check` 通过；未新增或重跑单元测试，未运行完整发布检查或部署。前文 38 项单测为操作栏布局阶段的结果。

- [文字高亮：中文桌面](price-import-text-zh-desktop-2026-10-16.png)
- [文字高亮：中文窄屏](price-import-text-zh-mobile-2026-10-16.png)
- [文字高亮：英文桌面](price-import-text-en-desktop-2026-10-16.png)
- [文字高亮：英文窄屏](price-import-text-en-mobile-2026-10-16.png)


<a id="explicit-import"></a>
## 仅点击时导入官方行情

日期：2026-10-16。仅本地修改，未发布；当前规则见 [共用物品价格](../docs/shared.md#24-全局物品价格)。

<a id="explicit-import-行为与实现"></a>
### 行为与实现

- 打开／重新打开弹窗仅渲染本地价格、缓存报价及已有状态，不请求官方 API；语言切换、分类折叠及手动操作不读取行情。无缓存时不显示读取中或读取成功提示。
- 点击“一键导入价格”才请求 API，成功后更新报价缓存并按分类偏好应用有效价。处理中保留防重复请求，失败保留原价格及缓存；关闭再打开不自动重试，错误保留到下次成功导入。
- `src/item-price-controls.js` 删除开窗双帧调度、取消标记及仅刷新缓存的分支，保留单一显式导入流程。价格选项、手动改价、锁定保护、原子应用、完整 ID、旧行情保护、金色按钮文字及单一提示布局保留。
- 更新提示与浏览器测试，替换前期“打开自动读取”断言；同步共用设计、开发入口与当前状态。此前报告及截图保留其阶段语境，不代表当前开窗行为。

<a id="explicit-import-本轮实际验证"></a>
### 本轮实际验证

- `node --test tests/item-price-status.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs`：39 项通过，0 失败／取消／跳过；覆盖本地缓存保留、空缓存不伪造提示、重开及切换语言零请求、显式导入与防重复、错误保留／重试、旧行情拒绝和全量缓存替换。
- `node tests/market-prices-browser.mjs --toolbar-only`：中文／英文 1280px／390px 四组通过。首次开窗、重开、语言切换及分类折叠均零行情请求；三次显式导入分别产生一次请求（成功、失败、重试成功），重开失败窗口不自动重试。验证版本 2 本地迁移在开窗时不写盘，点击导入后保存版本 3；锁定价及手动 0／清空功能正常。
- 四张截图已人工审阅：无缓存开窗时没有加载或成功提示；布局、金色文字、窄屏换行和内部物品表滚动正常，无阻断性脚本错误或弹窗横向溢出。
- 修改文件语法、文档本地引用及 `git diff --check` 通过。

完整单元日志、浏览器日志、机器结果与截图保存在 `.test-artifacts/price-explicit-import/`。行情由可控响应替身提供；本轮未重跑真实官方 API、角色 Worker、完整应用测试、独立原始计算对照或完整发布检查，未部署。

<a id="explicit-import-已审阅截图"></a>
### 已审阅截图

- [中文桌面](price-explicit-import-zh-desktop-2026-10-16.png)
- [中文窄屏](price-explicit-import-zh-mobile-2026-10-16.png)
- [英文桌面](price-explicit-import-en-desktop-2026-10-16.png)
- [英文窄屏](price-explicit-import-en-mobile-2026-10-16.png)


<a id="commit-validation"></a>
## 官方行情改造提交前验证

日期：2026-10-16。范围：本轮官方 API 价格导入、移除 userscript 市场捕获、存档迁移、按钮移位／文字高亮、统一提示及仅显式点击才请求的最终本地候选。包版本仍为 1.3.2，角色脚本候选为 2.7.0；未部署或推送。

<a id="commit-validation-实际执行结果"></a>
### 实际执行结果

| 检查 | 结果 |
| --- | --- |
| `node --test tests/*.test.mjs` | 319 项通过，失败／取消／跳过均为 0；总耗时约 171 秒。战斗选项全目标、多风格、24 小时回归占主要等待时间，完整运行结束后才记录通过。 |
| `node scripts/release-static.mjs .test-artifacts/market-api-commit/static.json` | 101 个 JS／MJS 文件语法、markdown-it 发行一致性、差异空白、版本、17 路由及文档本地引用检查通过；随后更新本报告与状态文档，再检查最终文档引用和暂存差异。 |
| `node tests/market-prices-browser.mjs` | 六组通过：官方 API 真实跨域、中英文 1280px／390px 四组、真实 Blob Worker。没有阻断性脚本错误。 |

官方 API 本次响应包含 1,059 个已适配物品变体，未知项为 0，行情生成时间为 `2026-10-16T01:25:08.081Z`；此计数仅描述本次响应。四组交互确认打开／重开／语言切换／分类折叠零请求，每次显式导入一次请求，失败重开不自动重试，重试成功；同时覆盖有效价格、存档迁移、锁定、手动零价／清空、统一状态、按钮位置与关闭焦点。真实 Worker 确认市场消息不保存、角色字段裁剪、慢存储合并、跨连接隔离及明确失败。四张本轮桌面／窄屏截图已审阅。

完整测试与静态日志保存在 `.test-artifacts/market-api-commit/`；本轮浏览器机器结果及截图从 `.test-artifacts/market-prices/` 复制到该目录留存。历史专项结果不替代上述本次执行。

<a id="commit-validation-提交与边界"></a>
### 提交与边界

提交仅包含本次功能、测试、相关文档和被报告引用的截图；原有无关未跟踪调研文档及精通截图不纳入。没有修改生成文件 `src/upstream.js`，没有升级包版本。范围与各阶段行为见 [共用价格设计](../docs/shared.md#24-全局物品价格)、[官方 API 改造](market-prices-implementation-2026-10-16.md#api-adaptation)、[操作栏及文字样式](market-prices-implementation-2026-10-16.md#toolbar) 和 [仅点击导入](market-prices-implementation-2026-10-16.md#explicit-import)。

本次不是发布验收：未运行独立原始计算对照、完整 `release:check`、打包、部署或生产验收。真实脚本管理器安装、真实账号操作及长时性能仍未验证。


<a id="filter-gate"></a>
## 价格列表筛选前置验证

日期：2026-10-16。本地改动，未部署。实现用户确认的“无筛选不显示物品”，并删除状态中的“未定价／未锁定”；当前规则见 [共用价格设计](../docs/shared.md#24-全局物品价格)。

<a id="filter-gate-行为与范围"></a>
### 行为与范围

- 分类、稀有度及状态全为全部、搜索去空白后为空、强化为 0 时直接返回空物品列表，不生成完整候选集合或物品行。保留本地数据与行情，显示“请先设置筛选条件 / Set a filter to show items”。
- 状态选项只保留“全部／已定价／已锁定”。输入框的“未定价”占位及批量解锁功能继续保留；删除范围仅为两个筛选选项和对应筛选分支。
- 五类筛选中任一项设置具体条件即可显示匹配项，普通稀有度的 0 值有效；仅空白搜索不激活。有效条件无结果时显示原来的无匹配提示。
- 恢复全部默认条件后隐藏物品、清除勾选并禁用全选／批量操作；本页会话内的筛选继续随关闭重开及语言切换保留。上方分类价格来源不是列表筛选，不激活列表。
- 一键导入和清空未锁定价格仍按全局范围执行，无筛选也可操作，完成后列表仍为空；锁定保护、报价缓存、偏好、手动价格及零价保持原规则。打开弹窗仍不请求官方行情。

代码只修改 `src/item-price-controls.js`；同步共用设计、开发、状态与相关测试。没有修改原始游戏代码、计算规则、存储协议或 API 请求实现。

<a id="filter-gate-本轮实际验证"></a>
### 本轮实际验证

- `node --test tests/item-price-status.test.mjs tests/item-prices.test.mjs tests/item-price-store.test.mjs`：43 项通过，0 失败／取消／跳过。覆盖双语空状态、隐藏已设置与已报价变体、选项移除、全部保留条件独立激活、普通稀有度／零价格、空白／无匹配搜索、清除勾选、筛选保留、空列表全局导入及清空、锁定与报价保留。
- `node tests/market-prices-browser.mjs --toolbar-only`：中文／英文、1280px／390px 四组通过；每组验证初始空列表、移除的状态项、全部保留筛选及恢复默认、勾选清除、空列表导入与清空、版本 2 迁移、手动零价／空值、锁定、错误持续与显式重试、关闭与焦点。无阻断性脚本错误或弹窗横向溢出。八张初始／筛选截图已人工审阅。
- 修改文件语法、文档本地引用及差异空白检查通过。

<a id="filter-gate-实际代码性能复测"></a>
### 实际代码性能复测

沿用 [调查报告](price-dialog-performance-2026-10-16.md) 的本机 Chrome、同一份 1,044 条报价／387 条有效价样本；这次测量实际修改的应用代码，没有通过路由替换功能实现。各场景连续四次打开，行情请求均为 0、实际物品行均为 0，弹窗内元素为 298 个。

| 环境 | 首次同步打开处理 | 后三次重开处理 |
| --- | --- | --- |
| 1280px 桌面，无 CPU 降速 | 10.0ms | 5.9–6.5ms |
| 390px 窄屏，无 CPU 降速 | 9.6ms | 5.5–6.5ms |
| 1280px，浏览器 CPU 4 倍降速 | 36.6ms | 24.5–30.0ms |

此前相同官方样本的桌面重开同步处理为 196.4–230.6ms，原因是生成 1,543 行、20,357 个元素。本次结果仅说明默认无筛选场景在该环境的改善，不能保证宽泛搜索或大量已定价／已锁定结果都流畅；CPU 降速是模拟条件，不等同真实低配设备。

完整日志、浏览器结果、截图与性能记录保存在 `.test-artifacts/price-filter-gate/`（`unit.log`、`browser.log/json`、`performance.log/json`、诊断脚本 `measure.mjs`）。未执行完整应用测试、真实官方 API、角色 Worker、独立原始计算对照、完整发布检查或部署；此前提交验证不作为本轮重跑结果。

<a id="filter-gate-已审阅截图"></a>
### 已审阅截图

- [中文桌面初始](price-filter-gate-empty-zh-desktop-2026-10-16.png)／[筛选后](price-filter-gate-filtered-zh-desktop-2026-10-16.png)
- [中文窄屏初始](price-filter-gate-empty-zh-mobile-2026-10-16.png)／[筛选后](price-filter-gate-filtered-zh-mobile-2026-10-16.png)
- [英文桌面初始](price-filter-gate-empty-en-desktop-2026-10-16.png)／[筛选后](price-filter-gate-filtered-en-desktop-2026-10-16.png)
- [英文窄屏初始](price-filter-gate-empty-en-mobile-2026-10-16.png)／[筛选后](price-filter-gate-filtered-en-mobile-2026-10-16.png)

<a id="filter-gate-空状态文案与高亮"></a>
### 空状态文案与高亮

后续将空状态文案改为“物品数量较多，请先设置筛选条件”，英文为“Many items to display; set a filter first”，仅此提示使用现有金色和 650 字重。通过独立样式类作用于无筛选占位单元格；有筛选但无匹配的提示保留原文和样式。

此文案／样式调整实际运行 19 项价格控件测试及双语桌面／390px 四组浏览器专项，全部通过；四张最新初始截图已审阅。日志与机器结果为 `.test-artifacts/price-filter-gate/prompt-unit.log`、`prompt-browser.log` 和 `prompt-browser.json`。未重跑前文模型／存储测试或性能测量，不把前文 43 项及性能结果作为此次重跑结果。文档引用和差异空白检查通过，未部署。

- [当前提示：中文桌面](price-filter-prompt-zh-desktop-2026-10-16.png)／[中文窄屏](price-filter-prompt-zh-mobile-2026-10-16.png)
- [当前提示：英文桌面](price-filter-prompt-en-desktop-2026-10-16.png)／[英文窄屏](price-filter-prompt-en-mobile-2026-10-16.png)
