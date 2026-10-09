# Deep Vein Idle · Lab

## 简介

玩家制作的非官方 Deep Vein Idle 实验室，提供战斗收益比较、强化成功率与期望成本、热门加成预报。支持简体中文和英文，计算在浏览器本地执行，无需登录游戏。

[打开线上实验室](https://dvi-lab.pages.dev/) · [功能与设计](DESIGN.md) · [协作指引](AGENTS.md)

项目作者（游戏昵称）：Alice；交流 QQ 群：897891232。原游戏代码、素材及相关资源归原作者或相应权利人所有，本项目独立维护，不代表官方授权或认可。

## 开发

需要 Node.js 20+。本地运行网页无需安装开发依赖：

```sh
node scripts/serve.mjs
```

打开 [本机页面](http://127.0.0.1:4173)。服务仅监听本机，可通过 `PORT` 环境变量修改端口；支持 `/combat`、`/enhance`、`/forecast` 和隐藏调试页 `/debug`。

运行测试：

```sh
node --test tests/*.test.mjs
```

重新提取原始计算代码时，安装开发依赖后执行：

```sh
pnpm install --frozen-lockfile
node scripts/extract.mjs
```

完整公开资源位于 `vendor/game-original.js`，来源及摘要记录于 `vendor/manifest.json`。禁止手工修改生成文件 `src/upstream.js`；更新原始资源须遵循 [上游更新流程](DESIGN.md#64-上游更新流程)，完成映射审阅、重新提取及回归验证。

## 部署

使用 Cloudflare Pages 的已有项目 `dvi-lab`，通过 Wrangler Direct Upload 发布到生产分支 `main`。

将 `index.html`、`_redirects`、`src/`、`vendor/`、`DESIGN.md`、`README.md` 及文档引用的报告和截图复制到独立发布目录，再执行：

```sh
npx wrangler login
npx wrangler pages deploy <发布目录> --project-name dvi-lab --branch main
```

授权过期时，可用 `npx wrangler login --scopes account:read user:read pages:write` 重新授权。发布后核验页面路由、公开资源、双语界面及普通战斗计算，完整要求见 [静态托管与发布](DESIGN.md#65-静态托管与发布)。
