# 部署与发布

[本地开发](development.md) · [当前状态](status.md)

## 使用前准备

先读当前状态及本次变更涉及的页面设计，完成版本号与发布范围调整，再对最终候选执行完整检查。安装固定开发依赖：`pnpm install --frozen-lockfile`；网页运行不需要这些依赖。

发布工具使用 playwright-core 控制本机 Chrome／Chromium，默认查找系统安装路径，其他位置通过 `RELEASE_BROWSER` 指定。缺失依赖或浏览器明确失败，不跳过验收，不依赖个人缓存。

## 三阶段操作

三个工具入口负责检查、打包和目标验收，不自动提交、登录或部署。检查、打包与验收输出均使用全新目录：

```sh
pnpm release:check --out .test-artifacts/release/candidate-check
pnpm release:package --evidence .test-artifacts/release/candidate-check --out /private/tmp/dvi-candidate-package
```

仅在已有用户发布授权范围内，由发布者执行 Wrangler Direct Upload。Cloudflare Pages 项目为 `dvi-lab`，生产分支为 `main`：

```sh
npx wrangler pages deploy /private/tmp/dvi-candidate-package --project-name dvi-lab --branch main
pnpm release:verify --evidence .test-artifacts/release/candidate-check --package /private/tmp/dvi-candidate-package --url https://dvi-lab.pages.dev --out .test-artifacts/release/production-verify
```

`release:verify` 必须显式指定 URL，无默认生产目标；成功只表示该目标通过，不能用本机／预览结果代替生产验收。预览发布使用 `--branch preview`，并单独验收 `https://preview.dvi-lab.pages.dev`；也可先验收精确部署地址，再验收生产别名，分别保存证据。

认证有效时无需每次登录；Wrangler 明确报告认证失效后，才用 `npx wrangler login --scopes account:read user:read pages:write` 重新授权。既有部署及历史证据保留，旧项目不自动删除或重定向，不同域名配置不自动迁移。

角色脚本升级及重新捕获要求见 [当前状态](status.md#已发布基线)；桥接、旧格式处理与捕获失败规则见 [导入协议](technical.md#61-角色导入组件与-userscript-协议)，价格存储迁移见 [全局物品价格](shared.md#24-全局物品价格)。

## 发布验证

| 阶段 | 检查范围与结果 |
| --- | --- |
| `release:check` | 完整测试、唯一完整独立原始计算对照、隔离重复提取与未知摘要拒绝、源码语法／文档引用／版本／路由定义，以及本机 17 路由、全部公开资源和八页双语两视口的 32 组浏览器验收。保存 `check.json`、五阶段完整日志、HTTP／浏览器结果、32 张截图与 `report.md`。 |
| `release:package` | 核对同轮通过证据与完整候选输入，按下节白名单创建全新包目录，包清单保存在检查证据目录。 |
| `release:verify` | 重新核对候选输入与包摘要，独立检查实际目标的 17 路由、路径保留、全部资源与来源清单、逐文件一致性、HTML 入口与双语版本，以及 32 组布局、独立滚动／键盘／滚轮／页脚与普通战斗完成。保存带目标 URL 的 `verify.json`、截图与报告。 |

独立计算验证须包含人工算例，不能再次调用同一函数生成预期值；完整对照已包含战斗子集，常规发布不叠加重跑。日期型原始对照文件继续作为历史证据保留。

视觉或功能变更仍须执行相关页面专项与人工截图审阅，并在本轮发布报告单独记录；基础矩阵不能证明全部交互或视觉正确，工具保存截图不等于人工审阅完成。

基础浏览器矩阵使用隔离的默认价格存档，关闭自动导价，避免外部市场响应触发重绘而干扰键盘、滚动和布局断言；自动导价及价格变化由对应专项验证。

桌面 PageDown、End 及切页／语言重绘验收按步骤等待原生 scrollend，再确认已请求位置实际到达、记录基线并严格验证保持；浏览器输入动画未结束时不能执行下一输入或提前读取位置，不添加固定延时、扩大容差或跳过断言。桌面键盘 End 验收保留严格的列底部及页脚可达断言；若异步状态使列高度在按键后变化，最多按新尺寸重试三次。尺寸未变时仍必须由键盘滚到底部，不能直接设置滚动位置绕过检查；持续变化或未到底部明确失败。

本机预览将 `/`、`/combat`、`/gather`、`/craft`、`/enhance`、`/mastery`、`/forecast`、`/formulas`、`/debug` 及各页面尾斜线形式映射到同一 `index.html`。未知路径通过 302 重定向到 `/combat`（托管规则放在已知路由、首页与静态资源保留规则之后；Cloudflare 重定向优先于静态文件）；HTTP 验收检查单层、多层及带查询参数的未知路径，浏览器验收检查最终地址及历史导航兜底。Cloudflare Pages 的 `_redirects` 对已知路由使用 200 代理到 `/`；不能代理到 `/index.html`，否则规范化跳转可能丢失页面路径。

HTML 一致性检查仅允许已知 analytics loader、Cloudflare Web／Pages Analytics 边界注释及标签间空白。HTTP 与浏览器错误不得忽略；线上失败不改写发布前已通过的结果，正式版准备也不等于部署成功。

## 发布工具与证据设计

### 候选与证据有效性

完整候选输入包含 `.gitattributes`、应用、上游资源、测试、发布脚本、文档／报告和依赖清单，证据同时记录运行环境。任一输入或记录环境变化后重新检查；提交号不能替代完整输入摘要。同轮证据完整且输入未变时，不重复完整验证，历史或专项结果不能代替本轮检查。

终端仅输出步骤、计数、耗时、异常与证据路径，完整日志落盘；通常只读取 `report.md` 与目标字段。非测试阶段显式写入独立 JSON 结果，父进程不依赖 stdout 最后一行。缺结果、失败、取消、跳过、超时或缺失环境均明确失败，返回非零退出码、有限诊断及完整日志路径，不能标记通过。

### 发布包白名单

包只包含 `index.html`、`_redirects`、`src/` 和 `vendor/`，保持模块 Worker 与资源路径。其中允许 js、css、svg、json，以及指定赞赏图片 `src/assets/appreciation.jpg`、公式专用目录 Markdown 和指定 markdown-it ESM／源码映射／许可证文件。`package.json` 包清单保存在证据目录，不放进发布包。

拒绝已存在的包目录、符号链接、隐藏文件、非白名单内容、缺失文件及过时证据。项目文档和验证证据不随生产或预览发布，页面不提供内部文档或报告链接。

工具开发验收覆盖成功摘要与完整日志、失败退出与诊断、输入变化使证据失效、白名单／符号链接／现有目录保护、路径保留，以及资源摘要不一致和目标版本错误拒绝。开发测试入口见 [本地开发](development.md#发布工具开发)，实际发布结果见 [当前状态](status.md)。
