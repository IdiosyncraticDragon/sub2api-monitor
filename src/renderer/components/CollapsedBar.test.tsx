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
  acc({ id: 1, name: '账号A', platform: 'anthropic', extra: { session_window_utilization: 0.3 } }),
  acc({ id: 2, name: '账号B', platform: 'openai', extra: { session_window_utilization: 0.7 } })
]

describe('CollapsedBar', () => {
  it('rings：每账户一个进度环，环内显示百分数', () => {
    render(<CollapsedBar accounts={two} style="rings" onExpand={() => {}} />)
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('segments：默认提示显示账户数', () => {
    const { container } = render(<CollapsedBar accounts={two} style="segments" onExpand={() => {}} />)
    expect(screen.getByText(/2 个账户/)).toBeInTheDocument()
    // 分段条：每账户一段
    expect(container.querySelectorAll('[data-seg]').length).toBe(2)
  })

  it('spotlight：展示聚焦账户 + 平台芯片，点圆点切换', () => {
    const { container } = render(<CollapsedBar accounts={two} style="spotlight" onExpand={() => {}} />)
    // 默认聚焦最近使用（首个）
    expect(screen.getByText('账号A')).toBeInTheDocument()
    expect(container.querySelector('[data-platform="claude"]')).toBeTruthy()
    // 点第二个圆点 → 切到账号B
    fireEvent.click(screen.getByLabelText('聚焦 账号B'))
    expect(screen.getByText('账号B')).toBeInTheDocument()
  })

  it('无账户 → 空态文案', () => {
    render(<CollapsedBar accounts={[]} style="rings" onExpand={() => {}} />)
    expect(screen.getByText('暂无最近使用')).toBeInTheDocument()
  })

  it('点击展开按钮触发 onExpand', () => {
    const onExpand = vi.fn()
    render(<CollapsedBar accounts={[]} style="rings" onExpand={onExpand} />)
    fireEvent.click(screen.getByLabelText('展开'))
    expect(onExpand).toHaveBeenCalledOnce()
  })
})
