# Deep Vein Idle · Lab

玩家制作的非官方 Deep Vein Idle 实验室，提供战斗利润比较、采集与制造模拟、强化期望成本、精通点数规划及热门加成预报。支持简体中文和英文，计算在浏览器本地执行，无需登录游戏；可手动配置，也可通过角色 userscript 导入配置与市场报价。

[打开线上实验室](https://dvi-lab.pages.dev/) · [功能与设计](DESIGN.md) · [当前版本与待发布变更](docs/status.md)

## 快速启动

需要 Node.js 20+。运行网页无需安装开发依赖：

```sh
node scripts/serve.mjs
```

打开 [本机页面](http://127.0.0.1:4173)。安装依赖、测试、原始代码提取与本机服务边界见 [本地开发](docs/development.md)。

## 文档入口

| 用途 | 文件 |
| --- | --- |
| 功能、交互、计算规则与验收 | [设计索引](DESIGN.md)，按页面及共用能力查阅 |
| 本地运行、测试、重新提取 | [本地开发](docs/development.md) |
| 模块职责、导入协议、原始代码与上游更新 | [技术方案](docs/technical.md) |
| 发布包、Cloudflare 部署与发布验收 | [部署与发布](docs/release.md) |
| 生产基线、本地待发布变更与验证入口 | [当前状态](docs/status.md) |
| 尚未实现的功能方向 | [后续范围](docs/roadmap.md) |
| 历史调研、实施和发布证据 | [历史验证归档](reports/validation-history.md)及 `reports/` 专项报告 |
| 协作流程及文档维护 | [AGENTS.md](AGENTS.md) |

项目作者（游戏昵称）：Alice；交流 QQ 群：897891232。原游戏代码、素材及相关资源归原作者或相应权利人所有，本项目独立维护，不代表官方授权或认可。
