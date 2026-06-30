import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountList } from './AccountList'
import type { GroupView } from '../../shared/types'

const groups: GroupView[] = [
  {
    group: 'G1',
    accounts: [
      { id: 1, name: 'A', status: 'active' },
      { id: 2, name: 'B', status: 'active' }
    ]
  },
  { group: 'G2', accounts: [{ id: 3, name: 'C', status: 'active' }] }
]

describe('AccountList', () => {
  it('渲染分组标题与组内账户', () => {
    render(<AccountList groups={groups} />)
    expect(screen.getByText('G1')).toBeInTheDocument()
    expect(screen.getByText('G2')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('分组标题显示账户数量', () => {
    render(<AccountList groups={groups} />)
    // G1 有 2 个账户
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('空数据 → 显示空态', () => {
    render(<AccountList groups={[]} />)
    expect(screen.getByText('暂无正常账户')).toBeInTheDocument()
  })
})
