import { formatLastUsed, formatPercent } from '../../shared/format'
import type { Account } from '../../shared/types'
import type { UsageWindow } from '../../shared/theme'
import { primaryUsage, sessionWindowRange, weeklyUtilization } from '../../shared/usage'

export interface TrayUsageView {
  title: string
  tooltip: string
}

/** 按当前主进度窗口生成菜单栏数值与悬停详情。 */
export function trayUsageFromAccount(
  account: Account | null,
  usageWindow: UsageWindow,
  now = new Date()
): TrayUsageView {
  if (!account) return { title: '', tooltip: 'Sub2API Monitor' }

  const usage =
    usageWindow === 'weekly'
      ? { kind: 'weekly' as const, frac: weeklyUtilization(account) }
      : primaryUsage(account)
  const pct = formatPercent(usage.frac)
  const range = sessionWindowRange(account)
  const group = account.groups?.[0]?.name
  const last = formatLastUsed(account.last_used_at, now)
  const label = usage.kind === 'weekly' ? '7日' : '会话'
  const tooltip =
    `${group ? group + ' · ' : ''}${account.name}\n` +
    `${label} ${pct}${usage.kind === 'session' && range !== '—' ? ` (${range})` : ''}\n` +
    `最近 ${last}`

  return { title: pct === '—' ? '' : pct, tooltip }
}
