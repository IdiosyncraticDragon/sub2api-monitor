import { describe, expect, it } from 'vitest'
import type { Account } from '../../shared/types'
import { trayUsageFromAccount } from './trayUsage'

const account: Account = {
  id: 1,
  name: 'Codex A',
  status: 'active',
  platform: 'openai',
  groups: [{ id: 2, name: '生产组' }],
  last_used_at: '2026-07-20T10:00:00+08:00',
  extra: {
    codex_5h_used_percent: 42,
    codex_7d_used_percent: 18,
    codex_5h_reset_at: '2026-07-20T15:00:00+08:00'
  }
}

describe('trayUsageFromAccount', () => {
  it('5h 模式显示会话窗口数值和时段', () => {
    const usage = trayUsageFromAccount(account, 'session', new Date('2026-07-20T11:00:00+08:00'))
    expect(usage.title).toBe('42%')
    expect(usage.tooltip).toContain('会话 42% (10:00–15:00)')
  })

  it('7d 模式同步显示 7 日数值', () => {
    const usage = trayUsageFromAccount(account, 'weekly', new Date('2026-07-20T11:00:00+08:00'))
    expect(usage.title).toBe('18%')
    expect(usage.tooltip).toContain('7日 18%')
    expect(usage.tooltip).not.toContain('10:00–15:00')
  })
})
