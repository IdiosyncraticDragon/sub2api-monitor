# Sub2API 后台 API 摘要

> 数据来源后台 = 开源项目 **Sub2API**（https://github.com/Wei-Shaw/sub2api，
> 后端 Go/Gin/Ent，前端 Vue3）。本文件供监控助手开发与跨平台交接参考。

## 认证

- **方式**：JWT Bearer Token。
- **请求头**：`Authorization: Bearer <token>`
- **Web 端存储**：站点版本会变化；本助手登录窗扫描 localStorage/sessionStorage 中的 JWT。
- **续期**：401 时使用 refresh token 自动刷新（Web 前端 axios 拦截器逻辑；桌面端
  `AuthService.refreshAccessToken()` 同步实现，失败才回退登录窗）。

## Base URL

```
{configured-origin}/api/v1
```

## 统一响应包

```jsonc
{ "code": 0, "message": "ok", "data": { /* ... */ } }
```
`code === 0` 取 `data`，否则按业务错误处理（本助手 `unwrap` 抛 `ApiError`）。
分页数据形如 `{ items: [...], total, page, page_size }`。

## 核心端点

| 端点 | 方法 | 用途 | 关键参数 |
|------|------|------|----------|
| `/admin/dashboard/stats` | GET | 今日/累计汇总 | 无 |
| `/admin/accounts` | GET | 账户列表 | `status=active`、`page`、`page_size`、`group`、`platform`、`search`、`sort_by`、`sort_order` |
| `/admin/accounts/{id}/usage` | GET | 单账户用量 | `source=passive\|active`、`force` |
| `/admin/accounts/today-stats/batch` | POST | 批量今日统计 | body: `{ account_ids: number[] }` |
| `/admin/groups` | GET | 分组列表 | `status=active`、`page`、`page_size` |
| `/admin/users` | GET | 用户列表（用于今日使用用户监控） | `page`、`page_size` |

> 本助手默认请求：`GET /admin/accounts?status=active&page=1&page_size=100`、`GET /admin/dashboard/stats`。

## 仪表盘字段（`GET /admin/dashboard/stats` → `data`，已联调核对 2026-06-29）

| 字段 | 类型 | 说明 |
|------|------|------|
| `today_tokens` | number | 今日 Token 总量（汇总条「今日 tok」） |
| `today_requests` | number | 今日请求数（汇总条「请求」） |
| `today_cost` | number | 今日花费（美元） |
| `today_input_tokens` / `today_output_tokens` | number | 今日输入/输出 token |
| `normal_accounts` | number | 正常账户数；另有 `ratelimit_accounts`/`total_accounts` |
| `tpm` / `rpm` | number | 每分钟 token / 请求 |
| `stats_updated_at` | string | 统计更新时间（ISO） |

## 账户字段（`GET /admin/accounts` → `data.items[]`，已联调核对 2026-06-29）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 账户 ID |
| `name` | string | 名称 |
| `status` | string | `active` / `inactive` |
| `platform` | string | 平台（anthropic/openai/gemini…） |
| `type` | string | 接入类型（如 `oauth`） |
| `last_used_at` | string\|null | 最近使用时间（ISO，带时区） |
| `extra.session_window_utilization` | number | **当前会话窗口（5h）利用率，0..1** |
| `extra.passive_usage_7d_utilization` | number | **近 7 日利用率，0..1** |
| `extra.passive_usage_7d_reset` | number | 7 日窗口重置时间（unix 秒） |
| `session_window_start` / `_end` | string | 会话窗口起止（ISO，带时区，如 14:00–19:00） |
| `session_window_status` | string | 会话窗口状态（如 `allowed`） |
| `rate_limited_at` / `rate_limit_reset_at` / `overload_until` | string\|null | 限流/过载信息 |
| `groups` | object[] | **所属分组数组**（`groups[].name`，非顶层 `group` 字符串） |
| `concurrency` / `current_concurrency` | number | 并发上限 / 当前并发 |

### ⚠️ 平台差异：用量字段不同（OpenAI/Codex）

`extra` 里的用量字段**因平台而异**，建模/取用务必注意：

| 平台 | 会话窗口（~5h）利用率 | 近 7 日利用率 | 量纲 |
|------|----------------------|---------------|------|
| **Anthropic** | `extra.session_window_utilization` | `extra.passive_usage_7d_utilization` | **0..1 小数** |
| **OpenAI/Codex** | `extra.codex_5h_used_percent` | `extra.codex_7d_used_percent` | **0..100 百分数** |

> OpenAI/Codex 账户**没有** `session_window_utilization`；其 `extra` 还含
> `codex_5h_reset_at`/`codex_7d_reset_at`（ISO）、`codex_primary/secondary_used_percent` 等。
> 统一取用见 `src/shared/usage.ts` 的 `sessionUtilization`/`weeklyUtilization`（归一化为 0..1）。

> ⚠️ 单账户用量为**利用率**，列表接口**不含**单账户绝对 token 数；
> 如需单账户今日 token，用 `POST /admin/accounts/today-stats/batch`。
> 字段已建模于 `src/shared/types.ts`，格式化在 `src/shared/format.ts`。

## 用户字段（`GET /admin/users` → `data.items[]`）

桌面端与 iOS 端的“用户监控”只做当天使用过的用户摘要：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number\|string | 用户 ID |
| `username` / `name` / `email` | string | 展示名按此顺序 fallback |
| `last_used_at` / `last_used` / `last_used_time` | string\|null | 最近使用时间；按设备本地日期筛“今日” |

请求分页形态同其它列表端点；助手会从第 1 页开始按 `pages` 或 `total/page_size` 继续读取后续页。

## 联调提示

当前 Chrome 已登录该站点，可在 DevTools → Network 查看 XHR 实际请求/响应。

> ⚠️ **token 存储已变更**：站点当前 **不再** 把 JWT 存在 `localStorage.auth_token`
> （localStorage 仅见 `auth_user` 资料对象）。鉴权为 `Authorization: Bearer`，
> token 在前端某存储键中（扫描 localStorage/sessionStorage 可见 `eyJ...`）。
> 因此 `src/main/windows/login.ts` 已改为扫描任意 JWT，而不是依赖固定键名。
