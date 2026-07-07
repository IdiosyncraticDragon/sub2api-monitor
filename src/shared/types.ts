// 跨进程共享类型定义
// 字段以 Sub2API 实际响应为准（已联调核对，见 docs/API.md）。

import type { UiPrefs } from './theme'

/** Sub2API 统一响应包 */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages?: number
}

/** 账户所属分组（仅取展示需要的字段） */
export interface AccountGroup {
  id: number
  name: string
  platform?: string
  subscription_type?: string
}

/**
 * 账户用量相关的派生信息（后端置于 account.extra 内）。
 * 注意不同平台字段不同：
 * - Anthropic：`session_window_utilization` / `passive_usage_7d_utilization` 为 **0..1** 小数。
 * - OpenAI/Codex：`codex_5h_used_percent` / `codex_7d_used_percent` 为 **0..100** 百分数。
 * 统一取用见 `shared/usage.ts` 的 `sessionUtilization` / `weeklyUtilization`（归一化为 0..1）。
 */
export interface AccountExtra {
  /** [Anthropic] 当前会话窗口（如 5h）利用率，0..1 */
  session_window_utilization?: number
  /** [Anthropic] 近 7 日被动用量利用率，0..1 */
  passive_usage_7d_utilization?: number
  /** [Anthropic] 近 7 日用量窗口重置时间（unix 秒） */
  passive_usage_7d_reset?: number
  /** [Anthropic] 用量采样时间（ISO） */
  passive_usage_sampled_at?: string
  /** [OpenAI/Codex] 5h 窗口已用百分比，0..100 */
  codex_5h_used_percent?: number
  /** [OpenAI/Codex] 5h 窗口重置时间（ISO） */
  codex_5h_reset_at?: string
  /** [OpenAI/Codex] 7 日窗口已用百分比，0..100 */
  codex_7d_used_percent?: number
  /** [OpenAI/Codex] 7 日窗口重置时间（ISO） */
  codex_7d_reset_at?: string
  /** 后端可能透传的订阅档位/计划名（如 free / plus） */
  subscription_type?: string
  plan?: string
  account_type?: string
}

/** 账户（字段为真实 API 子集，未列出的字段按需再补） */
export interface Account {
  id: number
  name: string
  status: 'active' | 'inactive' | string
  platform?: string
  /** 接入类型，如 oauth */
  type?: string
  /** 订阅档位/计划名（如 free / plus），部分后端版本可能放在顶层 */
  subscription_type?: string
  plan?: string
  account_type?: string
  notes?: string
  /** 最近使用时间（ISO，带时区） */
  last_used_at?: string | null
  /** 用量利用率等派生信息 */
  extra?: AccountExtra
  /** 当前会话窗口起止（ISO，带时区）与状态 */
  session_window_start?: string | null
  session_window_end?: string | null
  session_window_status?: string
  /** 限流信息（被限流时存在） */
  rate_limited_at?: string | null
  rate_limit_reset_at?: string | null
  overload_until?: string | null
  /** 所属分组（可能多个，展示取首个） */
  groups?: AccountGroup[]
  /** 并发 */
  concurrency?: number
  current_concurrency?: number
}

/** 悬浮窗展示用的分组视图 */
export interface GroupView {
  group: string
  accounts: Account[]
}

/** 仪表盘统计原始响应（GET /admin/dashboard/stats 的 data） */
export interface DashboardStats {
  today_tokens: number
  today_requests: number
  today_cost: number
  today_input_tokens?: number
  today_output_tokens?: number
  normal_accounts: number
  total_accounts?: number
  ratelimit_accounts?: number
  tpm?: number
  rpm?: number
  stats_updated_at?: string
}

/** 悬浮窗汇总条展示用的精简视图 */
export interface DashboardSummary {
  todayTokens: number
  todayRequests: number
  todayCost: number
  normalAccounts: number
  /** 账户总数（用于「正常/总数」展示）；后端未提供时缺省 */
  totalAccounts?: number
}

/** /admin/users 页面中与今日使用监控有关的用户字段 */
export interface AdminUser {
  id: number | string
  username?: string
  name?: string
  email?: string
  last_used_at?: string | null
  last_used?: string | null
  last_used_time?: string | null
}

/** 展示用：当天使用过的用户 */
export interface TodayUser {
  id: number | string
  username: string
  lastUsedAt: string
}

/** 用户使用监控汇总 */
export interface UserUsageSummary {
  count: number
  users: TodayUser[]
}

/** 渲染进程通过 preload 暴露的 API 契约 */
export interface ExposedApi {
  /** 获取正常账户的分组视图 */
  getAccounts: () => Promise<GroupView[]>
  /** 手动触发刷新 */
  refresh: () => Promise<GroupView[]>
  /** 订阅数据更新（轮询推送），返回取消订阅函数 */
  onAccountsUpdate: (cb: (groups: GroupView[]) => void) => () => void
  /** 获取今日汇总（无数据返回 null） */
  getDashboard: () => Promise<DashboardSummary | null>
  /** 订阅今日汇总更新，返回取消订阅函数 */
  onDashboardUpdate: (cb: (summary: DashboardSummary) => void) => () => void
  /** 获取当天使用过的用户 */
  getUserUsage: () => Promise<UserUsageSummary | null>
  /** 订阅当天用户使用更新，返回取消订阅函数 */
  onUserUsageUpdate: (cb: (summary: UserUsageSummary) => void) => () => void
  /** 是否已登录（有有效凭证） */
  isAuthenticated: () => Promise<boolean>
  /** 打开登录窗口 */
  openLogin: () => Promise<void>
  /** 隐藏悬浮窗 */
  hideWindow: () => Promise<void>
  /** 当前是否折叠态（迷你进度环条） */
  getCollapsed: () => Promise<boolean>
  /** 设置折叠态：主进程据此缩放/还原悬浮窗并持久化 */
  setCollapsed: (collapsed: boolean) => Promise<void>
  /** 折叠态下把窗口收紧到内容自适应尺寸（渲染层测量后上报） */
  setCollapsedSize: (width: number, height: number) => Promise<void>
  /** 读取外观配置（主题 / 明暗 / 折叠样式） */
  getUiPrefs: () => Promise<UiPrefs>
  /** 写入外观配置（部分更新），返回合并后的完整配置 */
  setUiPrefs: (patch: Partial<UiPrefs>) => Promise<UiPrefs>
}
