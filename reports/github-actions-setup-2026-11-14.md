# GitHub Actions 双通道发布接入

日期：2026-11-14。应用版本保持 1.10.4。现行操作与凭证约定见[发布流程](../docs/release.md#github-actions-双通道发布)，最新运行结果见 [CI](https://github.com/yukixz/deepveinidle-lab/actions/workflows/ci.yml)，生产由正式 Release 触发，本次没有发布生产。

## 实施范围

新增 PR 完整检查、main 自动部署 Preview、正式 Release 自动部署生产，以及共用的固定工具安装、版本与提交归属校验、防版本倒退、过时 Preview 拒绝上传、证据保存及结果摘要。候选输入新增 `.github/`；发布包仍为 75 个应用白名单文件，不包含工作流、文档及证据。两个 Environment 已配置 main／`v*` 来源限制、Account ID 及 API Token；仅核对密钥名称，不读取其值。

## 本地验证

- actionlint 1.7.7 通过；15 项发布工具与正式版本保护专项通过。
- `.test-artifacts/ci-final-20261114/check/` 的完整检查通过：630 项测试、独立原始计算对照、隔离提取、17 路由、73 资源及 32 组浏览器基础验收。
- 同轮白名单打包 75 文件通过，证据在 `.test-artifacts/ci-final-20261114/`。
- 上述完整检查在状态文档收尾前执行，收尾仅检查源码语法及文档引用；不复用该输入摘要为 CI 候选证据。

## 首轮 GitHub runner 与线上结果

[运行 43571079918](https://github.com/yukixz/deepveinidle-lab/actions/runs/43571079918)，候选提交 `ed120a43714980ae2ff9dde340667754f0979688`。Ubuntu runner 的完整检查通过，其中 630 项测试约 352 秒，独立计算、隔离提取及本机浏览器矩阵通过；打包、API Token 认证及 Preview 上传均通过。

精确部署为 `https://fce326d7.dvi-lab.pages.dev`。线上 17 路由、73 资源逐文件一致性及未知路径检查通过；32 组浏览器用例已执行，最终检测到 206 条控制台错误，来源为 Cloudflare 自动注入统计脚本的 `cloudflareinsights.com/cdn-cgi/rum` CORS 失败及伴随资源错误，因此工作流失败，不视为验收通过。固定域名步骤因上一步失败未执行；另在本机对 `https://preview.dvi-lab.pages.dev` 做独立诊断，32 组用例已执行，同样因 194 条统计相关控制台错误失败，不替代 GitHub runner 验收。

首轮 artifact 为 `evidence-CI-43571079918-1`；下载证据保留于 `.test-artifacts/github-run-43571079918/`，固定域名本机诊断保留于 `/tmp/dvi-ci-preview-diagnostic/`。上传后失败没有自动回退，Preview 已更新，生产未更新。

[Cloudflare 官方 FAQ](https://developers.cloudflare.com/web-analytics/faq/)说明，统计 Hostname 不匹配或缺少 Referer／Origin 可触发此类 CORS，基础域名可覆盖子域名。用户已在 Web Analytics 确认 Configured hostname(s) 为 `dvi-lab.pages.dev`，该站点由 Pages 管理，没有独立 Hostname 编辑入口；域名不匹配的排查方向未成立。现有 Wrangler OAuth 查询统计配置返回 405，未修改统计设置，也未放宽验收或忽略错误。后续修复及每次复验的实际结论以 Actions 对应候选的独立证据为准，不能将本报告首轮结果改写为通过。

## 统计请求进一步诊断

隔离浏览器实际访问生产、Preview 固定域名及精确部署地址，三个地址注入的统计标识一致，页面 Referrer Policy 为 `strict-origin-when-cross-origin`。生产统计 POST 返回 204，包含匹配生产 Origin 的 CORS 响应头。对 Preview 固定域名的浏览器网络协议诊断确认：OPTIONS 预检返回 200 并允许该 Origin；实际 POST 已携带正确 Origin 和 Referer，但服务返回 404 且未附加 Allow-Origin，最终浏览器报告 MissingAllowOriginHeader。精确部署地址也复现统计 CORS，本次没有单独采集其被隐藏的 POST 状态码，不能将 Preview 固定域的 404 推定为全部地址的已验证事实。

诊断保留于 `.test-artifacts/analytics-diagnostic-20261114/`，包括页面与脚本信息、真实请求头及浏览器网络协议事件。本次没有调整线上统计或验收规则；提出的后续取舍为：将 Preview／精确部署地址的第三方统计从应用浏览器验收中显式隔离，并标注覆盖边界，生产固定域名保留真实完整验收；或继续保持现行门槛等待平台修复。用户随后明确授权 Preview 与生产 CI 均排除统计脚本；这一变更不改写首轮失败结论，也不改变线上统计功能。

## 用户确认的 CI 验收边界

Preview 和生产 CI 的精确地址及固定域名均使用显式 `--analytics exclude`。只替代已知 Cloudflare 统计脚本，不执行其上报；HTTP 校验及其余浏览器错误保持原有门槛。手工验收默认真实模式，JSON、报告及 Actions 摘要注明排除模式与拦截数。统计可用性不再由 CI 发布成功推定。线上应用、统计设置及版本保持不变；本轮不触发正式 Release，生产工作流的实际上传仍需下一次正式发布验证。

新增受控浏览器专项验证排除与真实模式的差异及其他脚本错误保留。新候选的实际验证结果保留于后续 Actions 独立证据，不复用首轮或修改前候选摘要。

统计隔离实施后的本地验证：17 项发布工具／版本保护／统计模式测试通过；受控 Chromium 的 live、exclude 两组通过，确认其他脚本和应用错误保留；实际 Preview 的 32 组浏览器矩阵通过，统计模式为 exclude，记录 11 次脚本替代、零浏览器错误，证据在 `.test-artifacts/analytics-exclude-preview-20261114/`。源码语法、文档引用及 actionlint 通过。本地结果不替代新候选的 GitHub runner 完整检查及线上逐文件验证，后者由推送后的独立 CI 证据记录。
