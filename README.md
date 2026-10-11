# Deep Vein Idle · Lab

## 简介

玩家制作的非官方 Deep Vein Idle 实验室，提供战斗收益比较、强化成功率与期望成本、热门加成预报。同时提供采矿、钓鱼、伐木、偷窃的采集模拟：默认逐个模拟任务的全部采集点并取等权平均，另支持最近采集点、指定单点及角色配置导入。0.13.0 新增 `/mastery` 精通模拟页：填写当前与目标等级，可限定本次可用点数试配，或不限制点数计算升级成本；可通过左侧高亮导入区读取角色总点数、可用点数和已分配精通等级，导入后恢复限定点数模式；左侧仅配置模式和总点数，可用点数自动由总点数减去当前已分配等级的累计成本计算；修改总点数或当前等级后立即重算，总点数不足时明确提示；左侧“所有等级归零”可清零当前与目标等级，保留模式和总点数；电脑与手机均使用紧凑精通卡片，桌面按可用宽度显示两至四列、手机单列，目标操作按等级、+1、−1、MAX 排列；方案独立保存，已发布。支持简体中文和英文，计算在浏览器本地执行，无需登录游戏。战斗与采集页均可在“模拟配置”中切换“按商人价格计算掉落价值”。各页面的“导入游戏角色”默认展开；战斗页导入角色配置保留现有“模拟配置”全部选项。

当前补丁 0.13.2 同步战斗回仓取食后的立即连续进食，userscript 无需升级。

[打开线上实验室](https://dvi-lab.pages.dev/) · [功能与设计](DESIGN.md) · [协作指引](AGENTS.md)

项目作者（游戏昵称）：Alice；交流 QQ 群：897891232。原游戏代码、素材及相关资源归原作者或相应权利人所有，本项目独立维护，不代表官方授权或认可。

## 开发

需要 Node.js 20+。本地运行网页无需安装开发依赖：

```sh
node scripts/serve.mjs
```

打开 [本机页面](http://127.0.0.1:4173)。服务仅监听本机，可通过 `PORT` 环境变量修改端口；支持 `/combat`、`/gather`、`/enhance`、`/mastery`、`/forecast` 和隐藏调试页 `/debug`。

运行测试：

```sh
node --test tests/*.test.mjs
```

重新提取原始计算代码时，安装开发依赖后执行：

```sh
pnpm install --frozen-lockfile
node scripts/extract.mjs
```

基础完整公开资源位于 `vendor/game-original.js`；战斗回仓函数的补充完整资源位于 `vendor/game-combat-update.js`。两份来源、摘要与局部替换的依赖绑定记录于 `vendor/manifest.json`。禁止手工修改生成文件 `src/upstream.js`；更新原始资源须遵循 [上游更新流程](DESIGN.md#64-上游更新流程)，完成映射审阅、重新提取及回归验证。

## 部署

使用 Cloudflare Pages 的已有项目 `dvi-lab`，通过 Wrangler Direct Upload 发布到生产分支 `main`。

将 `index.html`、`_redirects`、`src/`、`vendor/`、`DESIGN.md`、`README.md` 及文档引用的报告和截图复制到独立发布目录，再执行：

```sh
npx wrangler login
npx wrangler pages deploy <发布目录> --project-name dvi-lab --branch main
```

预览页面导入角色前，安装／更新角色 userscript 2.4.1（调试脚本为 1.0.1），然后刷新游戏与预览页。两个脚本通过 `https://*.dvi-lab.pages.dev/*` 支持该项目全部预览通道与部署地址。

发布预览通道时，将部署命令的分支改为 `--branch preview`；预览地址为 <https://preview.dvi-lab.pages.dev/>，生产不受影响。

授权过期时，可用 `npx wrangler login --scopes account:read user:read pages:write` 重新授权。发布后核验页面路由、公开资源、双语界面及普通战斗计算，完整要求见 [静态托管与发布](DESIGN.md#65-静态托管与发布)。
