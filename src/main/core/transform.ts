import type { Account, GroupView } from '../../shared/types'

const UNGROUPED = '未分组'

/** 取账户的首个分组名（真实 API 中分组在 groups[].name），无则返回空串 */
function primaryGroupName(a: Account): string {
  const name = a.groups && a.groups.length > 0 ? a.groups[0]?.name : undefined
  return name && name.trim() !== '' ? name : ''
}

/** 仅保留状态为 active 的账户（纯函数，不改原数组） */
export function filterActive(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.status === 'active')
}

/** 按首个分组聚合，分组顺序按首次出现顺序稳定；缺失分组归入“未分组” */
export function groupByGroup(accounts: Account[]): GroupView[] {
  const order: string[] = []
  const map = new Map<string, Account[]>()
  for (const a of accounts) {
    const key = primaryGroupName(a) || UNGROUPED
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(a)
  }
  return order.map((group) => ({ group, accounts: map.get(group)! }))
}

/** 取最近使用（last_used_at 最大）的 active 账户；无则返回 null。纯函数。 */
export function latestActiveAccount(accounts: Account[]): Account | null {
  let best: Account | null = null
  let bestTs = -Infinity
  for (const a of accounts) {
    if (a.status !== 'active' || !a.last_used_at) continue
    const ts = new Date(a.last_used_at).getTime()
    if (Number.isNaN(ts)) continue
    if (ts > bestTs) {
      bestTs = ts
      best = a
    }
  }
  return best
}
