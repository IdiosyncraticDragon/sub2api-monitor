import type { Account, AccountExtra } from './types'
import { formatWindowRange, formatWindowRangeFromEnd } from './format'

// 跨平台用量访问器（纯函数）：把不同平台的用量字段统一归一化为 0..1 利用率。
// - Anthropic：session_window_utilization / passive_usage_7d_utilization 本就是 0..1。
// - OpenAI/Codex：codex_5h_used_percent / codex_7d_used_percent 是 0..100，需 /100。
// 无可用字段时返回 undefined（上层 formatPercent 显示占位「—」）。

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && !Number.isNaN(v) ? v : undefined

function isAccount(input: Account | AccountExtra | undefined): input is Account {
  return !!input && typeof (input as Account).status === 'string'
}

export function isOpenAiAccount(account: Account): boolean {
  const p = (account.platform ?? '').toLowerCase()
  return p.includes('openai') || p.includes('codex') || p.includes('gpt')
}

function extraFrom(input: Account | AccountExtra | undefined): AccountExtra | undefined {
  return isAccount(input) ? input.extra : input
}

/** 会话窗口（约 5h）利用率，0..1；兼容 Anthropic 与 OpenAI/Codex。 */
export function sessionUtilization(input: Account | AccountExtra | undefined): number | undefined {
  const extra = extraFrom(input)
  if (!extra) return undefined

  if (isAccount(input) && isOpenAiAccount(input)) {
    const codex = num(extra.codex_5h_used_percent)
    return codex === undefined ? undefined : codex / 100
  }

  const anthropic = num(extra.session_window_utilization)
  if (anthropic !== undefined) return anthropic
  const codex = num(extra.codex_5h_used_percent)
  if (codex !== undefined) return codex / 100
  return undefined
}

/** 近 7 日利用率，0..1；兼容 Anthropic 与 OpenAI/Codex。 */
export function weeklyUtilization(input: Account | AccountExtra | undefined): number | undefined {
  const extra = extraFrom(input)
  if (!extra) return undefined

  if (isAccount(input) && isOpenAiAccount(input)) {
    const codex = num(extra.codex_7d_used_percent)
    return codex === undefined ? undefined : codex / 100
  }

  const anthropic = num(extra.passive_usage_7d_utilization)
  if (anthropic !== undefined) return anthropic
  const codex = num(extra.codex_7d_used_percent)
  if (codex !== undefined) return codex / 100
  return undefined
}

export type PrimaryUsage = {
  kind: 'session' | 'weekly'
  frac: number | undefined
}

/** 卡片/折叠态的主额度：统一优先展示会话窗口（约 5h）。 */
export function primaryUsage(account: Account): PrimaryUsage {
  return { kind: 'session', frac: sessionUtilization(account) }
}

/** 会话窗口时段展示；OpenAI/Codex 只有 reset_at 时按 5h 反推开始时间。 */
export function sessionWindowRange(account: Account): string {
  const explicit = formatWindowRange(account.session_window_start, account.session_window_end)
  if (explicit !== '—') return explicit
  return formatWindowRangeFromEnd(account.extra?.codex_5h_reset_at, 5)
}
