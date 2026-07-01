import type { AccountExtra } from './types'
import type { Account } from './types'
import { formatWindowRange, formatWindowRangeFromEnd } from './format'

// 跨平台用量访问器（纯函数）：把不同平台的用量字段统一归一化为 0..1 利用率。
// - Anthropic：session_window_utilization / passive_usage_7d_utilization 本就是 0..1。
// - OpenAI/Codex：codex_5h_used_percent / codex_7d_used_percent 是 0..100，需 /100。
// 无可用字段时返回 undefined（上层 formatPercent 显示占位「—」）。

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && !Number.isNaN(v) ? v : undefined

/** 会话窗口（约 5h）利用率，0..1；兼容 Anthropic 与 OpenAI/Codex。 */
export function sessionUtilization(extra: AccountExtra | undefined): number | undefined {
  if (!extra) return undefined
  const anthropic = num(extra.session_window_utilization)
  if (anthropic !== undefined) return anthropic
  const codex = num(extra.codex_5h_used_percent)
  if (codex !== undefined) return codex / 100
  return undefined
}

/** 近 7 日利用率，0..1；兼容 Anthropic 与 OpenAI/Codex。 */
export function weeklyUtilization(extra: AccountExtra | undefined): number | undefined {
  if (!extra) return undefined
  const anthropic = num(extra.passive_usage_7d_utilization)
  if (anthropic !== undefined) return anthropic
  const codex = num(extra.codex_7d_used_percent)
  if (codex !== undefined) return codex / 100
  return undefined
}

/** 会话窗口时段展示；OpenAI/Codex 只有 reset_at 时按 5h 反推开始时间。 */
export function sessionWindowRange(account: Account): string {
  const explicit = formatWindowRange(account.session_window_start, account.session_window_end)
  if (explicit !== '—') return explicit
  return formatWindowRangeFromEnd(account.extra?.codex_5h_reset_at, 5)
}
