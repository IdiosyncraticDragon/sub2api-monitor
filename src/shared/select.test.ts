import { describe, it, expect } from 'vitest'
import { recentActiveAccounts } from './select'
import type { Account } from './types'

const acc = (over: Partial<Account>): Account => ({
  id: 1,
  name: 'a',
  status: 'active',
  ...over
})

describe('recentActiveAccounts', () => {
  it('按 last_used_at 降序取前 N', () => {
    const list = [
      acc({ id: 1, last_used_at: '2026-06-29T10:00:00+08:00' }),
      acc({ id: 2, last_used_at: '2026-06-29T14:00:00+08:00' }),
      acc({ id: 3, last_used_at: '2026-06-29T12:00:00+08:00' })
    ]
    expect(recentActiveAccounts(list, 2).map((a) => a.id)).toEqual([2, 3])
  })

  it('忽略非 active 与无 last_used_at', () => {
    const list = [
      acc({ id: 1, status: 'inactive', last_used_at: '2026-06-29T23:00:00+08:00' }),
      acc({ id: 2, last_used_at: null }),
      acc({ id: 3, last_used_at: '2026-06-29T08:00:00+08:00' })
    ]
    expect(recentActiveAccounts(list, 5).map((a) => a.id)).toEqual([3])
  })

  it('limit 截断、limit<=0 返回空、且不改原数组', () => {
    const list = [
      acc({ id: 1, last_used_at: '2026-06-29T01:00:00Z' }),
      acc({ id: 2, last_used_at: '2026-06-29T02:00:00Z' })
    ]
    const copy = [...list]
    expect(recentActiveAccounts(list, 1).map((a) => a.id)).toEqual([2])
    expect(recentActiveAccounts(list, 0)).toEqual([])
    expect(list).toEqual(copy)
  })
})
