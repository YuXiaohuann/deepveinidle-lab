# 本地开发

[项目入口](../README.md) · [技术方案与上游更新](technical.md) · [发布流程](release.md)

需要 Node.js 20+。本地运行网页无需安装开发依赖：

```sh
node scripts/serve.mjs
```

打开 [本机页面](http://127.0.0.1:4173)。服务仅监听本机，可通过 `PORT` 环境变量修改端口；支持 `/combat`、`/gather`、`/craft`、`/enhance`、`/mastery`、`/forecast` 和隐藏调试页 `/debug`。调试页仅提供角色配置 JSON 导出、战斗／强化配置文件导入；完整角色快照捕获、导入、导出与模拟已在当前版本移除。

运行测试：

```sh
node --test tests/*.test.mjs
```

重新提取原始计算代码时，安装开发依赖后执行：

```sh
pnpm install --frozen-lockfile
node scripts/extract.mjs
```

当前完整公开资源位于 `vendor/game-original.js`，来源、摘要、语义导出及声明摘要记录于 `vendor/manifest.json`；当前生成模块完整来自已核验的 1.0.1187，无混合版本或局部替换；`vendor/game-combat-1187.js` 和局部映射文件仅保留为此前战斗阶段的证据，不再被当前提取器使用。`vendor/game-combat-update.js` 保留为历史局部更新的原始证据。禁止手工修改生成文件 `src/upstream.js`；更新原始资源须遵循 [上游更新流程](technical.md#64-上游更新流程)，完成映射审阅、重新提取及回归验证。

本机服务有意不开放 `docs/`、`reports/` 与 `AGENTS.md`；文档通过仓库或本地编辑器阅读。README 与 DESIGN 仍可直接访问，但其拆分文档链接不属于网页预览服务范围。无需为文档整理扩大服务器访问范围。
