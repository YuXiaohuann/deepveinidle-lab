# 游戏文本核对明细

日期：2026-10-14。依据：本地已核验游戏 1.0.1187 的 `vendor/game-combat-1187.js`、生成模块四组翻译字典；未联网检查更新版本。修改仅在本地，未发布。

范围：逐个检索全部手写 `src/*.js` 字符串及模板片段，人工核对 `index.html`。原始资源和生成模块只读，不修改。报告及测试中的历史游戏文案不作为运行界面替换对象。完整检索库存见 [JSON 明细](game-text-inventory-2026-10-14.json)，含内部键和 HTML 片段，供检索追溯，不将其全部计为可见游戏文本。

## 实际替换

共 60 个字符串位置、40 组不同替换。复合字符串在表中完整列出；表中同一行的位置合并展示，逐位置记录保留在 JSON 中。

| 替换前 | 替换后 | 位置 |
| --- | --- | --- |
| 生命 | 生命值 | src/app.js:28 |
| 腿部 | 护腿 | src/app.js:28 |
| 空 | 无 | src/app.js:28、src/crafting-controls.js:150、src/gathering-controls.js:43 |
| 命中值 | 命中 | src/app.js:28 |
| 最大生命 | 生命上限 | src/app.js:28 |
| 练武桩 | 练武木桩 | src/app.js:28 |
| 该品质不存在，本件未计入 | 该稀有度不存在，本件未计入 | src/app.js:28 |
| Warrior tonic | Warrior's tonic | src/app.js:28 |
| Sparring post | The sparring post | src/app.js:28 |
| Archery target | The archery target | src/app.js:28 |
| Altar | The altar | src/app.js:28 |
| rarity | Rarity | src/app.js:54、src/crafting-controls.js:150、src/gathering-controls.js:43 |
| enhancement | Enhance | src/app.js:54、src/crafting-controls.js:150、src/gathering-controls.js:43 |
| 天赋 | 特权 | src/character-import.js:4、src/crafting-controls.js:151、src/crafting-controls.js:155、src/gathering-controls.js:58、src/gathering-controls.js:107、src/manual-controls.js:12 |
| 仓库没有符合策略及品质上限的食物 | 仓库没有符合策略及稀有度上限的食物 | src/character-import.js:8 |
| No warehouse food matches the strategy and quality cap | No warehouse food matches the strategy and rarity cap | src/character-import.js:8 |
| 自动进食品质上限无效 | 自动进食稀有度上限无效 | src/character-import.js:8 |
| The automatic food quality cap is invalid | The automatic food rarity cap is invalid | src/character-import.js:8 |
| 稀有 | 稀有度 | src/combat-hot.js:33、src/forecast-controls.js:3 |
| 制造次数、耗时、移动、回仓、经验及材料消耗来自<strong class="simulation-caveat">原始模拟</strong>；普通制造产物按指定品质计算，烹饪产物与稀有掉落为基于本次模拟机会的<strong class="simulation-caveat">数学期望</strong>，活动礼盒仍按原始模拟统计；利润结合产物期望、实际材料消耗及物品价格推算，不扣药水成本与市场手续费。材料需求与购买预算按计划次数计算，即时装备升级直接计算。 | 制造次数、耗时、移动、回仓、经验及材料消耗来自<strong class="simulation-caveat">原始模拟</strong>；普通制造产物按指定稀有度计算，烹饪产物与稀有掉落为基于本次模拟机会的<strong class="simulation-caveat">数学期望</strong>，活动礼盒仍按原始模拟统计；利润结合产物期望、实际材料消耗及物品价格推算，不扣药水成本与市场手续费。材料需求与购买预算按计划次数计算，即时装备升级直接计算。 | src/crafting-controls.js:53 |
| 品质筛选 | 稀有度筛选 | src/crafting-controls.js:54 |
| 品质 | 稀有度 | src/crafting-controls.js:69、src/crafting-controls.js:150、src/enhancement-controls.js:74、src/gathering-controls.js:43、src/item-price-controls.js:59 |
| 已有数量 | 已拥有 | src/crafting-controls.js:98 |
| 背包容量 | 背包格子 | src/crafting-controls.js:105、src/gathering-controls.js:74 |
| Vein blessing | Vein Blessing | src/crafting-controls.js:155、src/gathering-controls.js:107、src/manual-controls.js:13 |
| 请选择可强化的装备及有效品质。 | 请选择可强化的装备及有效稀有度。 | src/enhancement-controls.js:17 |
| Gold | Coins | src/enhancement-controls.js:48、src/enhancement-controls.js:51 |
| Gold (incl. 3% budget reserve) | Coins (incl. 3% budget reserve) | src/enhancement-controls.js:51 |
| Gold valuation | Coin valuation | src/enhancement-controls.js:52 |
| Uses success chances and fees from the verified game source. Gold and shards are spent on success and failure. Unprotected failures reset to +0; protected failures lose one level and spend one scroll. Materials and scrolls are plentiful. Colossus cores are excluded. | Uses success chances and fees from the verified game source. Coins and shards are spent on success and failure. Unprotected failures reset to +0; protected failures lose one level and spend one scroll. Materials and scrolls are plentiful. Colossus cores are excluded. | src/enhancement-controls.js:54 |
| 全局价格在页头设置。本方案填写只影响当前强化；底装费用关联当前品质及起始强化。空值表示未定价。 | 全局价格在页头设置。本方案填写只影响当前强化；底装费用关联当前稀有度及起始强化。空值表示未定价。 | src/enhancement-controls.js:77 |
| Voidshard unit price (gold) | Voidshard unit price (coins) | src/enhancement-controls.js:77 |
| Protection scroll unit price (gold) | Protection scroll unit price (coins) | src/enhancement-controls.js:77 |
| Base item purchase (gold) | Base item purchase (coins) | src/enhancement-controls.js:77 |
| 总量 | 总计 | src/gathering-controls.js:82 |
| 品质与稀有发现 | 稀有度与稀有发现 | src/gathering-controls.js:107 |
| 优先差食物 | 优先吃最差的食物 | src/manual-controls.js:11 |
| 食物品质 | 食物稀有度 | src/manual-controls.js:11 |
| 自动进食品质上限 | 自动进食稀有度上限 | src/manual-controls.js:11 |
| 经验 +5% · 稀有 +10% · 无限仓库 | 经验 +5% · 稀有度 +10% · 无限仓库 | src/manual-controls.js:13 |

另调整 `src/i18n.js`：删除三个已存在的药水补丁（Gatherer's draught、Hunter's brew、Warrior's tonic）；Hunter's brew 从“猎手药剂”恢复为上游“猎人酿剂”，另两个中文不变。将缺词补丁移至四组游戏字典之前，确保不能覆盖游戏译文。

## 已有复用及覆盖

基础物品 309 个（含原始全部 1301 个品质变体）、普通怪物 20 个、设施 18 个、精通 10 个、特权 5 个均有现成中文名称；精通说明及特权效果也均有翻译。物品通过基础名称与稀有度分开展示；品质前缀组合没有完整词条不属于漏译。动态名称、说明及逐项译文全部列于 JSON 的 dynamic 数组。世界首领、技能、采集任务及制造配方通过既有 translatedName 路径复用游戏字典，检索库存保留调用参数。

## 缺词及保留项

| 原文 | 当前中文 | 原因 |
| --- | --- | --- |
| Upgrades | 升级 | 四组上游字典无独立词条，保留缺词补充 |
| Pickaxe | 镐 | 四组上游字典无独立词条，保留缺词补充 |
| Fishing rod | 鱼竿 | 四组上游字典无独立词条，保留缺词补充 |
| Axe | 斧 | 四组上游字典无独立词条，保留缺词补充 |
| Pan | 平底锅 | 四组上游字典无独立词条，保留缺词补充 |
| Hammer | 锤 | 四组上游字典无独立词条，保留缺词补充 |
| Knife | 刀 | 四组上游字典无独立词条，保留缺词补充 |
| Mortar | 研钵 | 四组上游字典无独立词条，保留缺词补充 |
| Needle | 针 | 四组上游字典无独立词条，保留缺词补充 |

以下保持上下文准确：

- 价格 Locked / Unlocked 表示禁止或允许导入覆盖，保留“锁定／未锁定”；游戏译文“未解锁／已解锁”表示内容开放状态。
- 所需等级、采集次数、模拟仓库、移动占比、工具速度、利润周期等保留统计或模拟限定语，不能缩成游戏通用词 Level、Gathering、Depot。
- 装备槽 Head / Body / Off-hand 保留“头部／胸部／副手”，这些槽包含兜帽、长袍和法术副手，不直接改为头盔／胸甲／盾牌。
- 家园分组统一使用“家园”，复用游戏 Home board 的现成译文；保留英文 Home，不采用它的短译“家”。说明中的“家园升级进度／家园设施等级”保持不变。
- 游戏 Perks 的分组译文为“特权”，具体条目 Hearty meals 等继续使用已有上游名称。
- 药水 effect 数据的八条简短效果原文没有逐字中文词条，保留现有中文解释及数值；没有把其他语境的近似句当作等价翻译。
- 模拟器的导入、保存、缺价、种子、成本估算、数学期望、误差、版权、加载与 JavaScript 提示没有等价游戏现成文本，保留项目说明。

## 本次验证

71 项相关测试通过：翻译字典优先级及完整名称、强化控件、精通控件、制造展示、战斗掉落展示、价格窗口、角色导入与热门预报。新增验证覆盖四组字典的全部最终词条、缺词补丁不重复、全部基础名称及品质变体名称。10 个修改模块语法与 `git diff --check` 通过；除翻译字典外各修改模块去除字符串值后的 AST 结构一致，计算与配置逻辑未改变。未运行完整发布测试，未进行实际浏览器视觉验收，未部署。
