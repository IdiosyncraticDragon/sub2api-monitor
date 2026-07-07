import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserUsageList } from './UserUsageList'
import type { UserUsageSummary } from '../../shared/types'

const summary: UserUsageSummary = {
  count: 2,
  users: [
    { id: 1, username: 'alice', lastUsedAt: '2026-07-02T09:00:00+08:00' },
    { id: 2, username: 'bob', lastUsedAt: '2026-07-02T07:30:00+08:00' }
  ]
}

describe('UserUsageList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T10:00:00+08:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('展示当天使用用户数、用户名与最后使用时间', () => {
    render(<UserUsageList summary={summary} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('今日使用用户')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText('1小时前')).toBeInTheDocument()
    expect(screen.getByText('2小时前')).toBeInTheDocument()
  })

  it('空数据时展示空态', () => {
    render(<UserUsageList summary={{ count: 0, users: [] }} />)
    expect(screen.getByText('今日暂无用户使用')).toBeInTheDocument()
  })

  it('无数据时按 0 用户处理', () => {
    render(<UserUsageList summary={null} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
