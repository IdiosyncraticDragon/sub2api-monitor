import type { Account } from './types'

// 展示用的账户选择逻辑（纯函数，无 Node/Electron 依赖），主进程与渲染进程共用。

/**
 * 最近使用的 active 账户：按 last_used_at 降序，最多 limit 个。
 * 忽略非 active、无 last_used_at、时间无法解析的账户。不改原数组。
 */
export function recentActiveAccounts(accounts: Account[], limit: number): Account[] {
  if (limit <= 0) return []
  const ts = (a: Account): number => new Date(a.last_used_at as string).getTime()
  return accounts
    .filter((a) => a.status === 'active' && !!a.last_used_at && !Number.isNaN(ts(a)))
    .sort((a, b) => ts(b) - ts(a))
    .slice(0, limit)
}
