# 使用统计

使用 Cloudflare 免费版 Pages Functions 和 D1，按 UTC 日统计实验室使用次数、活跃角色数和角色名单。一次页面加载后成功导入角色才计一次使用。统计在 D1 Console 查询，全站 Visits 继续使用现有 Web Analytics。部署状态见[当前状态](../status.md#已发布基线)。

## 上报规则

- 仅在正式站 `https://dvi-lab.pages.dev`，战斗、采集、制造、强化或精通成功应用并保存 userscript 导入后自动上报。手动导入和自动更新共用入口。页面浏览、手动配置、调试文件导入以及被现有逻辑跳过的自动更新均不触发。无需新增提示或开关。 [现有导入规则](../shared.md#导入游戏角色与自动更新)
- 从快照 `player.id` 和 `player.name` 读取角色身份。ID 和名称都相同才是同一个角色。任一字段不同就分别计数。同一账号的多个角色也分别计数。缺少有效身份字段的旧快照仍可按现有规则导入。
- 正式站每次页面加载生成一个 `session_id`（`crypto.randomUUID()`），仅保存在当前页面内存。刷新或另开标签页生成新值，站内切页沿用原值。同一次加载只允许一个在途请求，收到 `204` 后停止上报。失败后可在下次符合条件的导入时沿用同一个 `session_id` 重试。上报异步执行，失败不影响导入或计算。

## 接口与存储

- 同源 `POST /api/usage` 使用 `Content-Type: application/json`。正文是包含 `id` 和 `name` 的 JSON 对象。`id` 转成十进制字符串，再和 `name` 分别按 ASCII 字节编码为小写十六进制字符串。例如角色 `123456`、`Alice` 的正文为 `{"id":"313233343536","name":"416c696365"}`。`session_id` 以原始 UUID 字符串放在 `X-Session-Id` 请求头。
- Function 校验 UUID 格式、正文长度和 JSON 对象字段。两个字段值须为非空、偶数长度且只含 `[0-9a-f]` 的字符串。分别解码后，校验并将 `id` 还原为正安全整数，校验 `name` 为游戏 ASCII 名称。保留角色名原样，区分大小写。无效请求返回空 `400`，写入失败返回空错误响应。
- 用参数绑定向 D1 写入 `utc_date`、`id`、`name`、`session_id`，以 `session_id` 为主键。日期取服务端首次成功入库所用的 UTC 日期。重复请求忽略，首次写入和重复请求均返回 `204 No Content`。同一次加载换角色或跨日重试也只计一次，保留首次入库的角色和日期。客户端上报的身份未经游戏服务器认证。
- 每日使用次数按 `utc_date` 数行；活跃角色数及名单在同一天按 `(id, name)` 去重。

在 D1 Console 查询最近 30 个 UTC 日的使用次数和活跃角色数。

```sql
SELECT utc_date, SUM(uses) AS uses, COUNT(*) AS active_roles
FROM (
  SELECT utc_date, id, name, COUNT(*) AS uses
  FROM usage_sessions
  WHERE utc_date >= date('now', '-29 days')
  GROUP BY utc_date, id, name
)
GROUP BY utc_date
ORDER BY utc_date DESC
```

## 验收

1. 验收手动及自动导入、跨页沿用会话、刷新后生成新会话、失败后沿用会话重试，以及预览或本机页面不自动上报。
2. 用合成数据验收编码往返、非法请求拒绝、同一会话重复及并发请求只存一条、跨日重试保留原记录，以及不同会话的使用次数和活跃角色数。
3. 预览验收使用独立 D1 库，生产绑定单独配置。线上浏览器验收拦截合成角色的统计请求。核对静态路由和现有计算仍正常。 [发布流程](../release.md)

按日均 1,000 次 Visits、每次平均 5 次上报估算，Functions 请求约为免费日额度的 5%。D1 以每次请求最多预算两行写入估算，约为免费日写入额度的 10%。实际用量按 Cloudflare 后台计量。 [Pages Functions 定价](https://developers.cloudflare.com/pages/functions/pricing/) · [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)
