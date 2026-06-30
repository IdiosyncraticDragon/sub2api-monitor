import { describe, it, expect } from 'vitest'
import { filterActive, groupByGroup, latestActiveAccount } from './transform'
import type { Account, AccountGroup } from '../../shared/types'

const grp = (name: string): AccountGroup => ({ id: name.length, name })

const acc = (over: Partial<Account>): Account => ({
  id: 1,
  name: 'a',
  status: 'active',
  ...over
})

describe('filterActive', () => {
  it('只保留 status 为 active 的账户', () => {
    const list = [
      acc({ id: 1, status: 'active' }),
      acc({ id: 2, status: 'inactive' }),
      acc({ id: 3, status: 'active' })
    ]
    expect(filterActive(list).map((a) => a.id)).toEqual([1, 3])
  })

  it('空数组返回空数组', () => {
    expect(filterActive([])).toEqual([])
  })

  it('不修改原数组（纯函数）', () => {
    const list = [acc({ id: 1, status: 'inactive' })]
    filterActive(list)
    expect(list).toHaveLength(1)
  })
})

describe('groupByGroup', () => {
  it('按首个分组名聚合，组内保持顺序', () => {
    const list = [
      acc({ id: 1, groups: [grp('A')] }),
      acc({ id: 2, groups: [grp('B')] }),
      acc({ id: 3, groups: [grp('A')] })
    ]
    const result = groupByGroup(list)
    expect(result).toEqual([
      { group: 'A', accounts: [list[0], list[2]] },
      { group: 'B', accounts: [list[1]] }
    ])
  })

  it('缺失分组归入“未分组”', () => {
    expect(groupByGroup([acc({ id: 1, groups: undefined })])[0].group).toBe('未分组')
    expect(groupByGroup([acc({ id: 2, groups: [] })])[0].group).toBe('未分组')
  })

  it('分组顺序按首次出现顺序稳定', () => {
    const list = [acc({ id: 1, groups: [grp('B')] }), acc({ id: 2, groups: [grp('A')] })]
    expect(groupByGroup(list).map((g) => g.group)).toEqual(['B', 'A'])
  })
})

describe('latestActiveAccount', () => {
  it('返回 last_used_at 最大的 active 账户', () => {
    const list = [
      acc({ id: 1, last_used_at: '2026-06-29T10:00:00+08:00' }),
      acc({ id: 2, last_used_at: '2026-06-29T14:00:00+08:00' }),
      acc({ id: 3, last_used_at: '2026-06-29T12:00:00+08:00' })
    ]
    expect(latestActiveAccount(list)?.id).toBe(2)
  })

  it('忽略非 active 与无 last_used_at 的账户', () => {
    const list = [
      acc({ id: 1, status: 'inactive', last_used_at: '2026-06-29T23:00:00+08:00' }),
      acc({ id: 2, last_used_at: null }),
      acc({ id: 3, last_used_at: '2026-06-29T08:00:00+08:00' })
    ]
    expect(latestActiveAccount(list)?.id).toBe(3)
  })

  it('无可用账户返回 null', () => {
    expect(latestActiveAccount([])).toBeNull()
    expect(latestActiveAccount([acc({ last_used_at: null })])).toBeNull()
  })
})
