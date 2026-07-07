import type { UserUsageSummary } from '../../shared/types'
import { formatLastUsed } from '../../shared/format'

interface Props {
  summary: UserUsageSummary | null
}

// 展示当天使用过的用户：用户名 + 最后使用时间。
export function UserUsageList({ summary }: Props): JSX.Element {
  const count = summary?.count ?? 0
  const users = summary?.users ?? []
  const now = new Date()

  return (
    <div className="no-drag flex flex-1 flex-col overflow-hidden px-3 pb-3">
      <div
        className="mb-3 flex items-center justify-between rounded-[14px] px-3.5 py-2.5"
        style={{ background: 'var(--s2a-summary-bg)' }}
      >
        <div className="flex flex-col">
          <span className="text-[20px] font-extrabold leading-none tabular-nums">{count}</span>
          <span className="mt-0.5 text-[10.5px]" style={{ color: 'var(--s2a-muted)' }}>
            今日使用用户
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
          style={{ background: 'var(--s2a-chip-bg)', color: 'var(--s2a-muted)' }}
        >
          /admin/users
        </span>
      </div>

      {users.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-4 text-center text-sm"
          style={{ color: 'var(--s2a-muted)' }}
        >
          今日暂无用户使用
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {users.map((u) => (
            <div
              key={`${u.id}:${u.lastUsedAt}`}
              className="flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5"
              style={{
                background: 'var(--s2a-card)',
                borderColor: 'var(--s2a-card-border)'
              }}
            >
              <span className="min-w-0 truncate text-[13px] font-extrabold">{u.username}</span>
              <span
                className="shrink-0 text-[11px] font-semibold tabular-nums"
                style={{ color: 'var(--s2a-muted)' }}
              >
                {formatLastUsed(u.lastUsedAt, now)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
