# 部署与发布

[本地开发](development.md) · [当前状态](status.md)

## 使用前准备

安装固定开发依赖：`pnpm install --frozen-lockfile`。网页运行仍不需要这些依赖。发布工具使用 playwright-core 控制本机 Chrome／Chromium；默认查找系统安装路径，其他位置通过 `RELEASE_BROWSER` 指定浏览器可执行文件。缺失依赖或浏览器明确失败，不跳过验收，不依赖 Codex 个人缓存。

## 三阶段操作

先完成版本号和发布范围调整，再执行完整检查。以下目录示例必须是全新目录：

```sh
pnpm release:check --out .test-artifacts/release/candidate-check
pnpm release:package --evidence .test-artifacts/release/candidate-check --out /private/tmp/dvi-candidate-package
```

检查证据包含 `check.json`、五阶段完整日志、28 张截图、浏览器与 HTTP 机器结果及简短 `report.md`。终端仅输出步骤、耗时与测试总结，失败返回非零退出码、有限诊断及完整日志路径。通常只读取 report 和目标字段，不整份展开输入清单、成功日志或历史归档。

打包须使用同轮通过的证据；功能文件、测试、脚本、文档／报告、依赖清单及记录的运行环境变化后拒绝旧证据。包目录已存在、包含符号链接、隐藏文件或非应用文件时明确失败；只允许根入口／路由和 src、vendor 内的 js、css、svg、json 文件。`package.json` 清单保存在检查证据目录，绝不加入发布包。

使用 Cloudflare Pages 项目 `dvi-lab`，通过 Wrangler Direct Upload 发布到生产分支 `main`；此命令由发布者明确执行，工具不会自动部署：

```sh
npx wrangler pages deploy /private/tmp/dvi-candidate-package --project-name dvi-lab --branch main
pnpm release:verify --evidence .test-artifacts/release/candidate-check --package /private/tmp/dvi-candidate-package --url https://dvi-lab.pages.dev --out .test-artifacts/release/production-verify
```

`release:verify` 必须指定 URL，无默认生产目标。它重新核对候选输入与包摘要，独立运行目标路由、资源及28组浏览器检查，生成 `verify.json`、截图与 report；成功只表示该目标验收通过，不把本机／预览结果写成生产发布。认证有效时无需每次登录；Wrangler 明确报告认证失效后，才用 `npx wrangler login --scopes account:read user:read pages:write` 重新授权。

预览通道使用 `--branch preview`，并对 `https://preview.dvi-lab.pages.dev` 单独验收；生产不受影响。也可先验收 Cloudflare 返回的精确部署地址，再验收生产别名，两个目标分别保存证据。

Worker 捕获需安装／更新角色 userscript 2.6.0 后刷新游戏与实验室（旧 2.5.2 的角色／市场桥接仍兼容）；脚本通过 `https://*.dvi-lab.pages.dev/*` 支持该项目各通道。

## 发布验证

本机预览将 `/`、`/combat`、`/gather`、`/craft`、`/enhance`、`/mastery`、`/forecast`、`/debug` 及各页面的尾斜线形式映射到同一 `index.html`。项目文档不随生产或预览发布。Cloudflare Pages 使用 `_redirects` 的 200 代理规则映射到 `/`；不能以 `/index.html` 为代理目标，否则规范化跳转可能丢失页面路径。

使用 Wrangler Direct Upload，项目 `dvi-lab`、生产分支 `main`，生产地址 <https://dvi-lab.pages.dev/>；预览分支 `preview`，别名 <https://preview.dvi-lab.pages.dev/>。每次使用干净的独立发布目录，发布包仅包含 `index.html`、`_redirects`、`src/`、`vendor/`，保持模块 Worker 与资源路径。项目文档与验证证据继续保留在仓库中，页面不提供这些文档或报告的链接。既有部署及历史发布证据保持原状。旧项目不自动删除或重定向，不同域名配置不自动迁移。

当前游戏资源基线为 1.0.1187，角色 userscript 2.6.0 的桥接及数据协议保持兼容。当前版本已删除完整角色快照功能；原角色配置、价格、采集配置、制造计划与材料库存、强化及精通方案继续保留。角色及市场协议保持兼容；2.5.2 已支持分类型捕获提示及 5 秒隐藏，2.6.0 将解析、裁剪和合并移入 Worker；Worker 不可用或积压超限时明确失败，不回退主线程。旧调试脚本不再被实验室读取，用户可在脚本管理器自行移除；旧完整快照模拟格式明确拒绝。

发布前执行完整测试、独立原始计算对照、生成摘要及未知摘要拒绝检查、源码语法、仓库文档引用、双语桌面与窄屏浏览器检查。发布验收覆盖十五个入口及路径保留、脚本／样式／Worker／原始资源及来源清单可访问、发布内容逐文件一致、双语版本和普通战斗完成。正式版准备不等同部署成功，部署及线上验收须单独记录。历史发布证据见 [历史验证归档](../reports/validation-history.md)，当前发布状态见 [当前状态](status.md)。

## 发布工具与证据设计

已实现的优化范围：提供发布前检查、白名单打包和生产验收三个脚本入口，完整日志落盘，仅输出检查计数、耗时、异常与证据路径；保留现有完整测试、独立原始计算对照、生成校验、双语桌面／窄屏及线上验收要求，不执行部署或更改计算规则。

- `release:check` 针对当前完整候选输入依次执行完整测试、唯一完整独立对照、隔离重复提取与未知摘要拒绝、源码语法／文档链接／版本／路由定义检查，以及本地十五路由、资源清单和七页双语两视口浏览器验收。完整日志和结构化结果保存到独立证据目录；各非测试阶段显式写入独立JSON结果，父进程不依赖stdout最后一行，缺失结果文件明确失败；失败、取消、跳过、超时或缺失浏览器均明确失败，不能标记通过。
- `release:package` 只接受本轮全部检查通过且当前输入摘要未改变的证据，创建全新目录，只复制 `index.html`、`_redirects`、`src/`、`vendor/`；清单保存在证据目录，不夹带进发布包。拒绝符号链接、过时证据、缺失文件和非白名单内容；提交号不替代完整输入摘要。
- `release:verify` 接收显式 URL、发布包和本轮证据，重新核对输入与包摘要，独立检查目标十五路由、全部公开资源、HTML 应用入口（仅允许已知 analytics loader、Cloudflare Web／Pages Analytics 边界注释及标签间空白）与双语版本、28 组布局、独立滚动／键盘／滚轮／页脚和完整普通战斗。HTTP 与浏览器错误不得忽略，线上失败不改写发布前通过身份。生成包含目标 URL 的机器结果和简短报告。
- 完整候选输入包含应用、上游资源、测试、发布脚本、文档／报告和依赖清单，证据同时记录运行环境；这些输入改变后重新执行发布前检查，不以历史报告代替。本轮证据完整且输入未变时，不重复跑完整验证。
- 复用现有全部页面独立对照代码，保留日期型原文件作为历史证据；常规发布不再叠加执行其战斗子集。浏览器自动化依赖显式固定，浏览器路径可配置；不绑定此前临时脚本或个人缓存目录。
- 视觉或功能变更仍须按所属页面执行必要专项与人工截图审阅；基础矩阵不能证明所有交互或视觉正确。工具保存截图，专项结果在本轮发布报告中单独记录；没有执行不能声称通过。

验收包括成功摘要与完整日志、失败非零退出及诊断、输入变更导致证据失效、白名单／符号链接／现有目录保护、路由路径保留、资源摘要不一致及目标版本错误拒绝；工具验证不等于已发布。实现状态与本次实际核查另记实施报告。
