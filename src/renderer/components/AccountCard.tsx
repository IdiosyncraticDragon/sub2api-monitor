import type { Account } from '../../shared/types'
import { formatLastUsed, formatPercent } from '../../shared/format'
import { primaryUsage, sessionWindowRange, weeklyUtilization } from '../../shared/usage'
import { utilizationLevel, levelColorVar } from '../../shared/theme'
import { PlatformChip } from './PlatformIcon'
import { StatusBadge } from './StatusBadge'
import { UsageRing } from './UsageRing'

interface Props {
  account: Account
}

// 账户卡片（暖色设计）：平台芯片 + 名称 + 状态点；会话窗口利用率做主角的圆角进度条；
// 底部展示最近使用（主）与 7 日利用率（次）。用量经 shared/usage 跨平台归一化为 0..1。
export function AccountCard({ account }: Props): JSX.Element {
  const primary = primaryUsage(account)
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
          title={`${account.name} · 7日 ${weekly}`}
          ariaLabel={`${account.name} 7日用量 ${weekly}`}
          progressDataAttr="data-account-weekly-ring"
        >
          <PlatformChip platform={account.platform} size={28} glyph={14} radius={9} />
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
