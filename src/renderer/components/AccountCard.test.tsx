import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountCard } from './AccountCard'
import type { Account } from '../../shared/types'

const base: Account = {
  id: 1,
  name: '账号A',
  status: 'active',
  platform: 'anthropic',
  groups: [{ id: 5, name: 'claude顶配订阅' }],
  extra: { session_window_utilization: 0.3, passive_usage_7d_utilization: 0.11 },
  session_window_start: '2026-06-29T14:00:00+08:00',
  session_window_end: '2026-06-29T19:00:00+08:00',
  last_used_at: null
}

describe('AccountCard', () => {
  it('展示账户名与平台芯片', () => {
    const { container } = render(<AccountCard account={base} />)
    expect(screen.getByText('账号A')).toBeInTheDocument()
    expect(container.querySelector('[data-platform="claude"]')).toBeTruthy()
  })

  it('会话窗口利用率为主角：百分比 + 时段标签', () => {
    render(<AccountCard account={base} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText(/14:00–19:00/)).toBeInTheDocument()
  })

  it('OpenAI activate 账户用 codex_5h_reset_at 推导 5h 窗口时段', () => {
    render(
      <AccountCard
        account={{
          ...base,
          platform: 'openai',
          extra: { codex_5h_used_percent: 42, codex_5h_reset_at: '2026-06-29T19:00:00+08:00' },
          session_window_start: null,
          session_window_end: null
        }}
      />
    )
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText(/14:00–19:00/)).toBeInTheDocument()
  })

  it('展示 7 日利用率（次要信息）', () => {
    render(<AccountCard account={base} />)
    expect(screen.getByText('7日 11%')).toBeInTheDocument()
  })

  it('active 账户展示“正常”', () => {
    render(<AccountCard account={base} />)
    expect(screen.getByText('正常')).toBeInTheDocument()
  })

  it('last_used_at 为空 → 显示“从未使用”', () => {
    render(<AccountCard account={base} />)
    expect(screen.getByText('从未使用')).toBeInTheDocument()
  })

  it('有使用记录 → 拼接“…使用”', () => {
    render(<AccountCard account={{ ...base, last_used_at: '2000-01-01T00:00:00+08:00' }} />)
    expect(screen.getByText(/天前使用$/)).toBeInTheDocument()
  })

  it('利用率缺失 → 会话占位符 —', () => {
    render(<AccountCard account={{ ...base, extra: undefined }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
