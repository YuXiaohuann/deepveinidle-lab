# 部署与发布

[本地开发](development.md) · [当前状态](status.md)

## 部署操作

使用 Cloudflare Pages 的已有项目 `dvi-lab`，通过 Wrangler Direct Upload 发布到生产分支 `main`。

将 `index.html`、`_redirects`、`src/`、`vendor/` 复制到独立发布目录，再执行：

```sh
npx wrangler login
npx wrangler pages deploy <发布目录> --project-name dvi-lab --branch main
```

市场导入需要安装／更新角色 userscript 2.5.2，然后刷新游戏与实验室。角色脚本通过 `https://*.dvi-lab.pages.dev/*` 支持该项目全部预览通道与部署地址。

发布预览通道时，将部署命令的分支改为 `--branch preview`；预览地址为 <https://preview.dvi-lab.pages.dev/>，生产不受影响。

授权过期时，可用 `npx wrangler login --scopes account:read user:read pages:write` 重新授权。发布后核验页面路由、公开资源、双语界面及普通战斗计算，完整要求见 [发布验证](#发布验证)。

## 发布验证

本机预览将 `/`、`/combat`、`/gather`、`/craft`、`/enhance`、`/mastery`、`/forecast`、`/debug` 及各页面的尾斜线形式映射到同一 `index.html`。项目文档不随生产或预览发布。Cloudflare Pages 使用 `_redirects` 的 200 代理规则映射到 `/`；不能以 `/index.html` 为代理目标，否则规范化跳转可能丢失页面路径。

使用 Wrangler Direct Upload，项目 `dvi-lab`、生产分支 `main`，生产地址 <https://dvi-lab.pages.dev/>；预览分支 `preview`，别名 <https://preview.dvi-lab.pages.dev/>。每次使用干净的独立发布目录，发布包仅包含 `index.html`、`_redirects`、`src/`、`vendor/`，保持模块 Worker 与资源路径。项目文档与验证证据继续保留在仓库中，页面不提供这些文档或报告的链接。既有部署及历史发布证据保持原状。旧项目不自动删除或重定向，不同域名配置不自动迁移。

当前游戏资源基线为 1.0.1187，角色 userscript 2.5.2 的桥接及数据协议保持兼容。当前版本已删除完整角色快照功能；原角色配置、价格、采集配置、制造计划与材料库存、强化及精通方案继续保留。角色及市场协议保持兼容；需更新至 2.5.2 才能使用分类型捕获提示及 5 秒隐藏。旧调试脚本不再被实验室读取，用户可在脚本管理器自行移除；旧完整快照模拟格式明确拒绝。

发布前执行完整测试、独立原始计算对照、生成摘要及未知摘要拒绝检查、源码语法、仓库文档引用、双语桌面与窄屏浏览器检查。发布验收覆盖十五个入口及路径保留、脚本／样式／Worker／原始资源及来源清单可访问、发布内容逐文件一致、双语版本和普通战斗完成。正式版准备不等同部署成功，部署及线上验收须单独记录。历史发布证据见 [历史验证归档](../reports/validation-history.md)，当前发布状态见 [当前状态](status.md)。
