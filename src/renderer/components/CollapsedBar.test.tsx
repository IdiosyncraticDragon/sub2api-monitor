import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollapsedBar } from './CollapsedBar'
import type { Account } from '../../shared/types'

const acc = (over: Partial<Account>): Account => ({
  id: 1,
  name: 'a',
  status: 'active',
  ...over
})

const two = [
  acc({
    id: 1,
    name: '账号A',
    platform: 'anthropic',
    extra: { session_window_utilization: 0.3, passive_usage_7d_utilization: 0.12 }
  }),
  acc({
    id: 2,
    name: '账号B',
    platform: 'openai',
    type: 'oauth',
    extra: { codex_5h_used_percent: 70, codex_7d_used_percent: 42 }
  })
]

describe('CollapsedBar', () => {
  it('rings：每账户显示双层同心环，外环 7d、内环 5h', () => {
    const { container } = render(<CollapsedBar accounts={two} style="rings" onExpand={() => {}} />)
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-weekly-ring]').length).toBe(2)
    expect(container.querySelectorAll('[data-session-ring]').length).toBe(2)
    expect(screen.getByTitle('账号A · 5h 30% · 7日 12%')).toBeInTheDocument()
  })

  it('segments：每账户显示双层条，上面 5h、下面 7d', () => {
    const { container } = render(<CollapsedBar accounts={two} style="segments" onExpand={() => {}} />)
    expect(screen.getByText('当前2个active帐户')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-seg]').length).toBe(2)
    expect(container.querySelectorAll('[data-session-bar]').length).toBe(2)
    expect(container.querySelectorAll('[data-weekly-bar]').length).toBe(2)
    expect(container.querySelector('[data-session-bar]')).toHaveStyle({ width: '30%' })
    expect(container.querySelector('[data-weekly-bar]')).toHaveStyle({ width: '12%' })
  })

  it('默认计数可独立于折叠态展示账户数', () => {
    render(<CollapsedBar accounts={two} activeCount={8} style="rings" onExpand={() => {}} />)
    expect(screen.getByText('当前8个active帐户')).toBeInTheDocument()
  })

  it('spotlight：展示聚焦账户 + 平台芯片，并在名前显示 7d 进度环', () => {
    const { container } = render(<CollapsedBar accounts={two} style="spotlight" onExpand={() => {}} />)
    // 默认聚焦最近使用（首个）
    expect(screen.getByText('账号A')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(container.querySelector('[data-platform="claude"]')).toBeTruthy()
    expect(container.querySelector('[data-spot-weekly-ring]')).toBeTruthy()
    // 点第二个圆点 → 切到账号B
    fireEvent.click(screen.getByLabelText('聚焦 账号B'))
    expect(screen.getByText('账号B')).toBeInTheDocument()
  })

  it('无账户 → 空态文案', () => {
    render(<CollapsedBar accounts={[]} style="rings" onExpand={() => {}} />)
    expect(screen.getByText('暂无最近使用')).toBeInTheDocument()
  })

  it('OpenAI 在折叠态统一使用 5h 会话额度', () => {
    render(
      <CollapsedBar
        accounts={[
          acc({
            id: 3,
            name: 'free',
            platform: 'openai',
            type: 'openai_free',
            extra: { codex_5h_used_percent: 61, codex_7d_used_percent: 18 }
          })
        ]}
        style="rings"
        onExpand={() => {}}
      />
    )
    expect(screen.getByText('61')).toBeInTheDocument()
  })

  it('点击展开按钮触发 onExpand', () => {
    const onExpand = vi.fn()
    render(<CollapsedBar accounts={[]} style="rings" onExpand={onExpand} />)
    fireEvent.click(screen.getByLabelText('展开'))
    expect(onExpand).toHaveBeenCalledOnce()
  })
})
