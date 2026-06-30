import type { ReactNode } from 'react'
import type { DashboardSummary } from '../../shared/types'
import { formatTokens, formatCost } from '../../shared/format'

interface Props {
  summary: DashboardSummary | null
}

// 顶部汇总条（暖色设计）：今日 Token / 请求 / 正常账户（X/总数）三栏，竖分隔。
// 「今日花费」作为次要信息以小字脚注呈现（设计稿未画，按需求保留）。无数据时不渲染。
export function SummaryBar({ summary }: Props): JSX.Element | null {
  if (!summary) return null
  const normal = String(summary.normalAccounts)
  const total = typeof summary.totalAccounts === 'number' ? summary.totalAccounts : null

  return (
    <div className="no-drag mx-3 mb-3">
      <div
        className="flex items-center justify-between rounded-[14px] px-3.5 py-2.5"
        style={{ background: 'var(--s2a-summary-bg)' }}
      >
        <Stat value={formatTokens(summary.todayTokens)} label="今日 Token" />
        <Divider />
        <Stat value={String(summary.todayRequests)} label="请求" />
        <Divider />
        <Stat
          label="正常账户"
          valueColor="var(--s2a-low)"
          value={
            <>
              {normal}
              {total !== null ? (
                <span className="text-[12px]" style={{ color: 'var(--s2a-muted)' }}>
                  /{total}
                </span>
              ) : null}
            </>
          }
        />
      </div>
      <div
        className="mt-1 text-center text-[10.5px] font-semibold tabular-nums"
        style={{ color: 'var(--s2a-muted)' }}
      >
        今日花费 {formatCost(summary.todayCost)}
      </div>
    </div>
  )
}

function Stat({
  value,
  label,
  valueColor
}: {
  value: ReactNode
  label: string
  valueColor?: string
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <span
        className="text-[18px] font-extrabold leading-none tabular-nums"
        style={{ color: valueColor ?? 'var(--s2a-text)' }}
      >
        {value}
      </span>
      <span className="mt-0.5 text-[10.5px]" style={{ color: 'var(--s2a-muted)' }}>
        {label}
      </span>
    </div>
  )
}

function Divider(): JSX.Element {
  return <div className="h-[26px] w-px" style={{ background: 'var(--s2a-divider)' }} />
}
