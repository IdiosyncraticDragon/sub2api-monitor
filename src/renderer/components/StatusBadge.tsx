interface Props {
  status: string
}

const LABELS: Record<string, string> = {
  active: '正常',
  inactive: '停用'
}

// 非 active 状态的徽章（active 由 AccountCard 内联为分级色圆点）。
// inactive=中性灰，其它状态原样显示并用「中」色（蜂蜜）提示异常。
const DOT_VAR: Record<string, string> = {
  active: 'var(--s2a-low)',
  inactive: 'var(--s2a-muted)'
}

export function StatusBadge({ status }: Props): JSX.Element {
  const label = LABELS[status] ?? status
  const dot = DOT_VAR[status] ?? 'var(--s2a-mid)'
  return (
    <span
      data-status={status}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
      style={{ background: 'var(--s2a-chip-bg)', color: 'var(--s2a-subhead)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  )
}
