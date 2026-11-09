# 精通经验目标与搜索选择实施

日期：2026-11-09；本地功能，尚未发布。现行规则见[精通页面](../docs/pages/mastery.md)，生产基线见[当前状态](../docs/status.md)。

精通优化新增战斗经验最多、采集经验最多、制造经验最多。三个目标均按固定24小时真实模拟经验增量排序，不依赖价格；战斗为全部技能经验之和，工作为任务技能。制造读取制造页配装，另选单配方／品质，复用材料充足的制造时间窗口与装备升级路线。新目标分别使用六／四／三维搜索，经验参与搜索，不使用战斗收入忽略升级的生成近似。沿用两种预算、独立种子复核、保存／恢复与目标应用。

原有四个目标及模拟公式未修改，原有结果引擎版本保持兼容；新增制造结果匹配配方、品质和角色配置，忽略订单、库存和来源时长。未修改生成文件或部署。

## 经验目标实现阶段验证

- `node --test tests/mastery-optimizer.test.mjs tests/mastery-result-store.test.mjs tests/mastery-controls.test.mjs tests/mastery.test.mjs tests/crafting.test.mjs tests/crafting-orders.test.mjs`：76项通过。覆盖三个经验目标在重置／剩余模式的预算与精通下限、经验参与搜索、无价格、无效经验／提前停止拒绝、制造参数与等级校验、保存恢复／匹配；完整24小时结果与战斗、采集、普通制造及传说品质装备升级模拟逐复核种子对照一致，输入不变。
- `node tests/mastery-xp-browser.mjs .test-artifacts/mastery-xp/browser`：4组通过，真实Worker覆盖三个目标、经验指标、自动应用、双栏保存、中英文390px布局、制造罕见品质、刷新恢复／品质失配与制造导航，来源页存储不变。
- `node tests/mastery-optimizer-browser.mjs .test-artifacts/mastery-xp/optimizer-regression`：原有专项通过，浏览器错误为空；覆盖原目标、四档搜索、预算、取消／迟到隔离、价格提示、存储失败与应用等。
- 已人工查看采集中文、制造中英文390px结果截图，未见横向溢出、重叠或截断。`git diff --check`通过。

日志分别保存于 `.test-artifacts/mastery-xp/unit-tests.log`、`browser.log`、`optimizer-regression.log`；机器结果和截图位于对应子目录。浏览器测试最初遇到本机监听权限及测试等待空值／配方等级选择问题，修正测试并获准使用临时本机服务后重跑通过；上述结论只采用最终成功运行。

未执行完整发布三阶段、生产验收、真实账号验证或长时性能测量。搜索仍为有界启发式，不保证全局最优；制造假设材料充足，不计算实际材料预算。

## 搜索选择与界面清理

目标怪物、全部采集目标的采集任务和制造配方改为可搜索选择框，复用强化页的 `src/search-select.js`，不修改共用控件行为。保留排序、默认值、配方品质校验及已确认选择；支持中英文名称与英文大小写搜索、鼠标及键盘确认。未确认搜索不改变实际选择或取消计算，Escape／Tab／失焦恢复原选项；只有确认不同选项才清除旧结果并取消运行。语言切换保留选择，恢复对应语言名称。窄屏列表限高滚动、选项至少44px；计算规则未变。

同时保留此前移除未实现强化成本选项的调整，优化目标菜单只包含七个已实现目标。

### 搜索选择实现阶段验证

- `node --test tests/mastery-controls.test.mjs tests/mastery-optimizer.test.mjs tests/mastery-result-store.test.mjs tests/mastery.test.mjs tests/enhancement-items.test.mjs`：56项通过。包括共用搜索选择的双语筛选／确认与取消语义、精通控件和原优化计算／存储回归。
- `node tests/mastery-search-browser.mjs .test-artifacts/mastery-search/search`：3组通过；三类完整候选排序、中英文／大小写、无结果与非法文本拒绝、鼠标／方向键／回车、Escape／Tab／失焦恢复、同项选择与未确认搜索不取消、不同选项取消运行、请求中的实际目标、语言切换与1440px／390px布局均通过。此专项的运行中断场景使用受控等待Worker，不冒充真实模拟完成。
- `node tests/mastery-optimizer-browser.mjs .test-artifacts/mastery-search/optimizer-regression`：19组通过，原有收入／精通产出目标、四档搜索、预算、取消、价格提示与保存／应用等回归通过。
- `node tests/mastery-xp-browser.mjs .test-artifacts/mastery-search/xp-regression`：4组通过，真实Worker验证三个经验目标、可搜索制造配方确认、品质、自动应用、双栏保存、刷新恢复及中英文窄屏。
- 三套浏览器专项均无记录的浏览器错误。已人工查看制造配方中文390px及怪物英文1440px的展开列表截图，未见横向溢出或选项文字截断；浮层正常覆盖下方内容。语法检查及 `git diff --check` 通过。

完整日志为 `.test-artifacts/mastery-search/unit-tests.log`、`search.log`、`optimizer-regression.log`、`xp-regression.log`；机器结果和截图位于对应子目录。此处仅记录上述本轮执行，未重跑完整发布检查，未部署或进行生产验收。

## 发布整理

发布候选统一为1.10.0。复用强化页搜索控件，合并两套新增浏览器专项的临时服务、合成角色、价格隔离和Worker观测准备，修正专项默认输出目录；既有收入／精通产出优化与保存引擎版本保持兼容。此前文档归档路径及Opera反馈说明一并提交，不代表本轮重新执行其历史验证。最终候选及生产验证见[1.10.0发布报告](v1.10.0-release-2026-11-09.md)。
