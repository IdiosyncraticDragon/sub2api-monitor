import type { GroupView } from '../../shared/types'
import { AccountCard } from './AccountCard'

interface Props {
  groups: GroupView[]
}

// 按分组展示账户卡片；无数据时显示空态。
export function AccountList({ groups }: Props): JSX.Element {
  const total = groups.reduce((n, g) => n + g.accounts.length, 0)
  if (total === 0) {
    return (
      <div
        className="no-drag flex flex-1 items-center justify-center px-4 text-center text-sm"
        style={{ color: 'var(--s2a-muted)' }}
      >
        暂无正常账户
      </div>
    )
  }

  return (
    <div className="no-drag flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
      {groups.map((g) => (
        <section key={g.group} className="flex flex-col gap-2">
          <header className="flex items-center justify-between px-0.5">
            <span
              className="truncate text-[12px] font-extrabold"
              style={{ color: 'var(--s2a-subhead)' }}
            >
              {g.group}
            </span>
            <span
              className="rounded-full px-2 text-[10.5px] font-bold"
              style={{ background: 'var(--s2a-chip-bg)', color: 'var(--s2a-muted)' }}
            >
              {g.accounts.length}
            </span>
          </header>
          {g.accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </section>
      ))}
    </div>
  )
}
