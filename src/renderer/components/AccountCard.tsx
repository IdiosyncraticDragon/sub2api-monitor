import type { Account } from '../../shared/types'
import { formatBalance, formatLastUsed, formatPercent } from '../../shared/format'
import { accountBalance, primaryUsage, sessionWindowRange, weeklyUtilization } from '../../shared/usage'
import { utilizationLevel, levelColorVar } from '../../shared/theme'
import { PlatformChip } from './PlatformIcon'
import { StatusBadge } from './StatusBadge'
import { UsageRing } from './UsageRing'
import type { UsageWindow } from '../../shared/theme'

interface Props {
  account: Account
  usageWindow?: UsageWindow
  onToggleUsageWindow?: () => void
}

// 账户卡片（暖色设计）：平台芯片 + 名称 + 状态点；可切换 5h/7d 主进度；
// 底部展示最近使用与另一窗口的利用率。用量经 shared/usage 跨平台归一化为 0..1。
export function AccountCard({ account, usageWindow = 'session', onToggleUsageWindow }: Props): JSX.Element {
  const balance = accountBalance(account)
  const primary = usageWindow === 'weekly' ? { kind: 'weekly' as const, frac: weeklyUtilization(account) } : primaryUsage(account)
  const sessionFrac = primary.frac
  const level = utilizationLevel(sessionFrac)
  const levelColor = levelColorVar(level)
  const sessionPct = formatPercent(sessionFrac)
  const barWidth = typeof sessionFrac === 'number' ? Math.min(100, Math.max(0, sessionFrac * 100)) : 0

  const window = sessionWindowRange(account)
  const sessionLabel =
    primary.kind === 'weekly' ? '7 日额度' : window !== '—' ? `会话 · ${window}` : '会话 · 5h 窗口'
  const weeklyFrac = weeklyUtilization(account)
  const weekly = formatPercent(weeklyFrac)
  const isActive = account.status === 'active'
  const lastUsed = formatLastUsed(account.last_used_at, new Date())
  // 有使用记录时拼「…使用」（如「3分钟前使用」）；从未使用则原样展示
  const lastUsedText = account.last_used_at ? `${lastUsed}使用` : lastUsed

  if (balance) {
    const balanceText = formatBalance(balance.balance, balance.currency)
    const details = balance.balances
      .filter((entry) => entry.currency !== balance.currency || entry.balance !== balance.balance)
      .map((entry) => formatBalance(entry.balance, entry.currency))
    return (
      <div
        className="no-drag flex flex-col gap-2 rounded-[14px] px-3 py-2.5"
        style={{ background: 'var(--s2a-card)', border: '1px solid var(--s2a-card-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <PlatformChip platform={account.platform} size={28} glyph={14} radius={9} />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold" style={{ color: 'var(--s2a-text)' }}>
            {account.name}
          </span>
          {isActive ? <span className="text-[11px] font-bold" style={{ color: 'var(--s2a-low)' }}>正常</span> : <StatusBadge status={account.status} />}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--s2a-muted)' }}>按量付费余额</span>
          <span className="text-[16px] font-extrabold tabular-nums" style={{ color: 'var(--s2a-text)' }}>{balanceText}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: 'var(--s2a-muted)' }}>
          <span>{lastUsedText}</span>
          {details.length > 0 ? <span className="tabular-nums">{details.join(' · ')}</span> : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className="no-drag flex flex-col gap-2 rounded-[14px] px-3 py-2.5"
      style={{
        background: 'var(--s2a-card)',
        border: '1px solid var(--s2a-card-border)'
      }}
    >
      <div className="flex items-center gap-2.5">
        <UsageRing
          frac={weeklyFrac}
          title={`${account.name} · 7日环 · 点击图标切换主进度（${usageWindow === 'session' ? '5h' : '7d'}）`}
          ariaLabel={`${account.name} · 7日用量 ${weekly} · 点击图标切换主进度`}
          progressDataAttr="data-account-weekly-ring"
        >
          <button
            type="button"
            onClick={onToggleUsageWindow}
            aria-label={`切换${usageWindow === 'session' ? '7d' : '5h'}主进度`}
            aria-pressed={usageWindow === 'weekly'}
            className="no-drag flex cursor-pointer items-center justify-center rounded-[9px]"
          >
            <PlatformChip platform={account.platform} size={28} glyph={14} radius={9} />
          </button>
        </UsageRing>
        <span
          className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold"
          style={{ color: 'var(--s2a-text)' }}
        >
          {account.name}
        </span>
        {isActive ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: levelColor }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: levelColor }} />
            正常
          </span>
        ) : (
          <StatusBadge status={account.status} />
        )}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--s2a-muted)' }}>
            {sessionLabel}
          </span>
          <span className="text-[12.5px] font-extrabold tabular-nums" style={{ color: levelColor }}>
            {sessionPct}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ background: 'var(--s2a-track)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${barWidth}%`, background: levelColor }}
          />
        </div>
      </div>

      <div
        className="flex items-center justify-between text-[11px] font-semibold"
        style={{ color: 'var(--s2a-muted)' }}
      >
        <span>{lastUsedText}</span>
        <span className="tabular-nums">7日 {weekly}</span>
      </div>
    </div>
  )
}
