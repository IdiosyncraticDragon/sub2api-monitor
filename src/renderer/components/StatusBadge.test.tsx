import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('active → 显示“正常”且带 active 标记', () => {
    render(<StatusBadge status="active" />)
    const el = screen.getByText('正常')
    expect(el).toBeInTheDocument()
    expect(el.closest('[data-status]')).toHaveAttribute('data-status', 'active')
  })

  it('inactive → 显示“停用”', () => {
    render(<StatusBadge status="inactive" />)
    expect(screen.getByText('停用')).toBeInTheDocument()
  })

  it('未知状态 → 原样显示状态文本', () => {
    render(<StatusBadge status="rate_limited" />)
    const el = screen.getByText('rate_limited')
    expect(el.closest('[data-status]')).toHaveAttribute('data-status', 'rate_limited')
  })
})
