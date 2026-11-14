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

[Cloudflare 官方 FAQ](https://developers.cloudflare.com/web-analytics/faq/)说明，统计 Hostname 不匹配或缺少 Referer／Origin 可触发此类 CORS，基础域名可覆盖子域名。已要求核对统计站点 Hostname 为 `dvi-lab.pages.dev`；现有 Wrangler OAuth 查询该统计配置返回 405，未修改统计设置，也未放宽验收或忽略错误。后续修复及每次复验的实际结论以 Actions 对应候选的独立证据为准，不能将本报告首轮结果改写为通过。
