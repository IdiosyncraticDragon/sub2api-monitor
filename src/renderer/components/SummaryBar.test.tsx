import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryBar } from './SummaryBar'
import type { DashboardSummary } from '../../shared/types'

const summary: DashboardSummary = {
  todayTokens: 26871174,
  todayRequests: 169,
  todayCost: 32.86987,
  normalAccounts: 61
}

describe('SummaryBar', () => {
  it('三栏展示今日 Token / 请求 / 正常账户，花费作为脚注', () => {
    render(<SummaryBar summary={summary} />)
    expect(screen.getByText('26.9M')).toBeInTheDocument()
    expect(screen.getByText('今日 Token')).toBeInTheDocument()
    expect(screen.getByText('169')).toBeInTheDocument()
    expect(screen.getByText('61')).toBeInTheDocument()
    expect(screen.getByText('正常账户')).toBeInTheDocument()
    expect(screen.getByText(/今日花费/)).toBeInTheDocument()
    expect(screen.getByText(/\$32\.87/)).toBeInTheDocument()
  })

  it('提供账户总数时展示「正常/总数」', () => {
    render(<SummaryBar summary={{ ...summary, totalAccounts: 80 }} />)
    expect(screen.getByText('61')).toBeInTheDocument()
    expect(screen.getByText('/80')).toBeInTheDocument()
  })

  it('无汇总数据时不渲染', () => {
    const { container } = render(<SummaryBar summary={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
