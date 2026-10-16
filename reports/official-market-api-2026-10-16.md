# 官方市场价格导入改造

日期：2026-10-16。范围：将游戏市场捕获与 userscript 桥接替换为官方公开 API 导入，同时移除数据导入 userscript 的市场功能。仅本地实施，未发布；包版本与生产仍为 1.3.2，角色脚本候选为 2.7.0（生产仍为 2.6.0）。此前重置范围调整保留，本次不扩大其范围。

## 变更明细

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

## 本轮验证

- `node --test tests/market-import.test.mjs tests/item-price-status.test.mjs tests/item-price-store.test.mjs tests/item-prices.test.mjs tests/capture-worker.test.mjs tests/character-import.test.mjs`：97 项通过，0 失败／取消／跳过。
- `node tests/market-prices-browser.mjs`：六组通过。包括无 userscript 的官方 API 真实浏览器跨域、中英文 1280px／390px 四组交互，以及真实 Blob Worker。此次真实 API 响应适配 1,058 个物品变体，未知项统计为 0；行情生成时间 `2026-10-16T00:55:08.026Z`，不是本次请求时间。该计数为本次快照事实，不保证市场未来固定数量。
- 四组弹窗验证：版本 2 存档迁移、打开仅缓存、分类选项顺序、导入锁定保护、行情时间、手动 0／清空并锁定、HTTP 失败保留、错误持续、解锁重试、关闭和焦点返回、无弹窗横向溢出；无阻断性脚本错误。四张截图已人工审阅，见下方。
- 真实 Blob Worker：角色字段裁剪、市场消息不触发任何保存、慢存储期间不回传中间快照、结束后保存最新角色、跨连接串行保存及异常明确提示均通过。没有真实账号参与，不以此宣称性能改善或脚本管理器安装通过。
- 已核验 API 返回 HTTP 200、`Access-Control-Allow-Origin: *`、`Cache-Control: public, max-age=300` 及 `refreshSeconds: 300`。网页不新增轮询，遵循浏览器缓存。
- 本次修改文件语法、文档本地链接及 `git diff --check` 检查通过；没有执行完整应用测试、独立原始计算对照、完整发布检查或部署。

本地完整日志、API 初次快照／响应头、机器结果与截图位于 `.test-artifacts/market-prices/`。`unit.log` 是本次单测日志，`browser.log`／`browser.json` 为最终浏览器结果；该目录不纳入发布包。

## 失败与修正

初次沙箱运行因本机监听 EPERM 未启动浏览器，随后使用获准的本机监听／Chrome 环境运行。浏览器迭代中修正三处测试问题：手动输入失焦前记录基线导致更新时间比较失败；解析真实 Worker 的初始“验证中”占位文本失败；慢存储测试连续发送百条含巨型无关历史的角色帧触发既有积压保护，改为首帧大数据裁剪加后续小型角色更新。最终六组专项全部通过，未放宽产品积压上限或隐藏失败。后两轮失败结果分别保存在 `browser-failed-wait.*` 与 `browser-failed-burst.*`。

## 使用与未覆盖范围

市场价格导入无需安装脚本或在游戏打开市场。要让已安装的旧数据导入脚本停止游戏侧市场捕获，需要安装／更新 2.7.0 并刷新游戏；角色导入仍使用同一入口和协议。新脚本的真实 Tampermonkey／其他脚本管理器安装、真实账号操作及长时性能尚未验证。生产功能尚未改变，本次未运行完整发布检查或部署。

## 已审阅截图

- [中文桌面](official-market-api-zh-desktop-2026-10-16.png)
- [中文窄屏](official-market-api-zh-mobile-2026-10-16.png)
- [英文桌面](official-market-api-en-desktop-2026-10-16.png)
- [英文窄屏](official-market-api-en-mobile-2026-10-16.png)
