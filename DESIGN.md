# Deep Vein Idle · 设计索引

当前功能、交互、计算规则与验收按用途分文件维护；本索引是统一入口，不复制规则正文。生产基线、本地待发布变更及验证情况见 [当前状态](docs/status.md)。项目简介见 [README](README.md)，维护流程见 [AGENTS](AGENTS.md)。

## 1. 产品目标与范围

项目名称为“Deep Vein Idle · 实验室”（Deep Vein Idle · Lab），页头、浏览器标题、启动提示及用户文档保持一致。产品通过战斗与采集利润比较、强化成功率与期望成本、热门加成预报，辅助选择目标和角色配置。精通页面支持限定点数试配与不限制点数的升级成本计算。

当前支持普通怪物完整战斗模拟及可选范围的敌人列表，以及采矿、钓鱼、伐木、偷窃四种连续技能的采集模拟，默认所有采集点等权平均；详见 [采集页面](docs/pages/gathering.md)。制造页面已实现，详见 [制造页面](docs/pages/crafting.md)；战斗页面增加世界首领静态估算，实际团战模拟未实现。计算优先复用原始实现，在访问者浏览器本地执行，静态网页部署到 Cloudflare Pages。

手动配置为主要路径，另支持角色 userscript 导入配置；隐藏调试页提供角色配置文件导出和战斗／强化配置文件导入，不提供完整角色快照捕获、导入、导出或模拟，也不提供粘贴导入，不包含账号登录、角色操作或私有接口调用。userscript 负责角色及市场报价读取与本地传递，不计算利润；不维护利润用户脚本，保留模拟器 Worker 与原始预测回归测试。

## 2. 共用页面框架

详见 [共用页面框架](docs/shared.md)。

## 3. 战斗页面

详见 [战斗页面](docs/pages/combat.md)。

### 3.3.2 装备

详见 [装备规则](docs/pages/combat.md#332-装备)。

## 4. 强化页面

详见 [强化页面](docs/pages/enhancement.md)。

## 精通页面

详见 [精通页面](docs/pages/mastery.md)。

## 5. 预报页面

详见 [预报页面](docs/pages/forecast.md)。

## 调试页面

详见 [调试页面](docs/pages/debug.md)。

## 公式页面

详见 [公式页面](docs/pages/formulas.md)。

## 采集页面

详见 [采集页面](docs/pages/gathering.md)。

## 制造页面

详见 [制造页面](docs/pages/crafting.md)。

## 6. 共用技术与发布

导入协议、原始代码复用与模块职责见 [技术方案](docs/technical.md)；运行和测试见 [本地开发](docs/development.md)。

### 6.4 上游更新流程

详见 [上游更新流程](docs/technical.md#64-上游更新流程)。

### 6.5 静态托管与发布

详见 [部署与发布](docs/release.md)。

## 7. 验证状态

[当前状态与验证入口](docs/status.md)区分生产基线与本地待发布变更；[历史验证归档](reports/validation-history.md)保留原记录，历史通过不代表本次重跑。

## 8. 后续范围与文档维护

尚未实现的方向见 [后续范围](docs/roadmap.md)。当前规则只在所属文件完整维护，其他文件使用链接；协作流程见 [AGENTS.md](AGENTS.md)。历史报告及旧章节锚点仅用于证据追溯。

<details>
<summary>旧章节链接兼容入口</summary>

- <a id="21-导航与网址"></a> [2.1 导航与网址](docs/shared.md#21-导航与网址)
- <a id="22-语言布局与持久化"></a> [2.2 语言、布局与持久化](docs/shared.md#22-语言布局与持久化)
- <a id="23-项目页脚"></a> [2.3 项目页脚](docs/shared.md#23-项目页脚)
- <a id="24-全局物品价格"></a> [2.4 全局物品价格](docs/shared.md#24-全局物品价格)
- <a id="25-共用验收"></a> [2.5 共用验收](docs/shared.md#25-共用验收)
- <a id="31-页面结构"></a> [3.1 页面结构](docs/pages/combat.md#31-页面结构)
- <a id="32-导入配置"></a> [3.2 导入配置](docs/pages/combat.md#32-导入配置)
- <a id="33-角色与模拟配置"></a> [3.3 角色与模拟配置](docs/pages/combat.md#33-角色与模拟配置)
- <a id="331-战斗风格与技能"></a> [3.3.1 战斗风格与技能](docs/pages/combat.md#331-战斗风格与技能)
- <a id="332-装备"></a> [3.3.2 装备](docs/pages/combat.md#332-装备)
- <a id="333-食物与药水"></a> [3.3.3 食物与药水](docs/pages/combat.md#333-食物与药水)
- <a id="334-家园与精通"></a> [3.3.4 家园与精通](docs/pages/combat.md#334-家园与精通)
- <a id="335-完整手动模拟条件"></a> [3.3.5 完整手动模拟条件](docs/pages/combat.md#335-完整手动模拟条件)
- <a id="336-模拟配置"></a> [3.3.6 模拟配置](docs/pages/combat.md#336-模拟配置)
- <a id="34-属性利润与列表交互"></a> [3.4 属性、利润与列表交互](docs/pages/combat.md#34-属性利润与列表交互)
- <a id="35-静态计算规则"></a> [3.5 静态计算规则](docs/pages/combat.md#35-静态计算规则)
- <a id="36-连续模拟与结果统计"></a> [3.6 连续模拟与结果统计](docs/pages/combat.md#36-连续模拟与结果统计)
- <a id="37-验收与已知限制"></a> [3.7 验收与已知限制](docs/pages/combat.md#37-验收与已知限制)
- <a id="41-页面布局与角色配置"></a> [4.1 页面布局与角色配置](docs/pages/enhancement.md#41-页面布局与角色配置)
- <a id="42-装备保护与价格设置"></a> [4.2 装备、保护与价格设置](docs/pages/enhancement.md#42-装备保护与价格设置)
- <a id="43-角色配置导入"></a> [4.3 角色配置导入](docs/pages/enhancement.md#43-角色配置导入)
- <a id="44-结果展示与范围边界"></a> [4.4 结果展示与范围边界](docs/pages/enhancement.md#44-结果展示与范围边界)
- <a id="45-计算规则"></a> [4.5 计算规则](docs/pages/enhancement.md#45-计算规则)
- <a id="46-验收与验证边界"></a> [4.6 验收与验证边界](docs/pages/enhancement.md#46-验收与验证边界)
- <a id="页面与配置"></a> [页面与配置](docs/pages/mastery.md#页面与配置)
- <a id="计算规则与实现"></a> [计算规则与实现](docs/pages/mastery.md#计算规则与实现)
- <a id="验收"></a> [验收](docs/pages/mastery.md#验收)
- <a id="51-当前热门筛选与日程"></a> [5.1 当前热门、筛选与日程](docs/pages/forecast.md#51-当前热门筛选与日程)
- <a id="52-验收与已知限制"></a> [5.2 验收与已知限制](docs/pages/forecast.md#52-验收与已知限制)
- <a id="61-角色导入组件与-userscript-协议"></a> [6.1 角色导入组件与 userscript 协议](docs/technical.md#61-角色导入组件与-userscript-协议)
- <a id="62-原始代码复用"></a> [6.2 原始代码复用](docs/technical.md#62-原始代码复用)
- <a id="63-模块职责"></a> [6.3 模块职责](docs/technical.md#63-模块职责)

- <a id="71-页面专项历史验证"></a> [页面专项历史验证](reports/validation-history.md#71-页面专项历史验证)
- <a id="81-后续范围"></a> [后续范围](docs/roadmap.md)
- <a id="82-维护约定"></a> [维护约定](AGENTS.md)

</details>
