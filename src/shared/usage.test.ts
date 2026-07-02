import { describe, it, expect } from 'vitest'
import {
  primaryUsage,
  sessionUtilization,
  weeklyUtilization,
  sessionWindowRange
} from './usage'
import type { Account } from './types'

const acc = (over: Partial<Account>): Account => ({
  id: 1,
  name: 'a',
  status: 'active',
  ...over
})

describe('sessionUtilization', () => {
  it('Anthropic：直接取 session_window_utilization(0..1)', () => {
    expect(sessionUtilization({ session_window_utilization: 0.56 })).toBeCloseTo(0.56)
  })

  it('OpenAI/Codex：codex_5h_used_percent(0..100) 归一化为 0..1', () => {
    expect(sessionUtilization({ codex_5h_used_percent: 39 })).toBeCloseTo(0.39)
  })

  it('Anthropic 字段优先于 codex 字段', () => {
    expect(
      sessionUtilization({ session_window_utilization: 0.5, codex_5h_used_percent: 90 })
    ).toBeCloseTo(0.5)
  })

  it('OpenAI 账号按平台只取 codex_5h，忽略误带的 Anthropic 字段', () => {
    expect(
      sessionUtilization(
        acc({
          platform: 'openai',
          type: 'oauth',
          extra: { session_window_utilization: 0.61, codex_5h_used_percent: 0 }
        })
      )
    ).toBeCloseTo(0)
  })

  it('OpenAI 账号不再区分 free/plus，统一展示 codex_5h', () => {
    expect(
      sessionUtilization(
        acc({
          platform: 'openai',
          type: 'oauth',
          extra: { codex_5h_used_percent: 61, codex_7d_used_percent: 18 }
        })
      )
    ).toBeCloseTo(0.61)
  })

  it('无字段 / undefined → undefined', () => {
    expect(sessionUtilization(undefined)).toBeUndefined()
    expect(sessionUtilization({})).toBeUndefined()
  })
})

describe('weeklyUtilization', () => {
  it('Anthropic：passive_usage_7d_utilization(0..1)', () => {
    expect(weeklyUtilization({ passive_usage_7d_utilization: 0.24 })).toBeCloseTo(0.24)
  })

  it('OpenAI/Codex：codex_7d_used_percent(0..100) 归一化', () => {
    expect(weeklyUtilization({ codex_7d_used_percent: 22 })).toBeCloseTo(0.22)
  })

  it('OpenAI 账号按平台只取 codex_7d，忽略误带的 Anthropic 字段', () => {
    expect(
      weeklyUtilization(
        acc({
          platform: 'openai',
          extra: { passive_usage_7d_utilization: 0.88, codex_7d_used_percent: 12 }
        })
      )
    ).toBeCloseTo(0.12)
  })

  it('无字段 → undefined', () => {
    expect(weeklyUtilization(undefined)).toBeUndefined()
    expect(weeklyUtilization({})).toBeUndefined()
  })
})

describe('primaryUsage', () => {
  it('OpenAI 不区分 free/plus，主额度统一使用 5h', () => {
    expect(
      primaryUsage(
        acc({
          platform: 'openai',
          type: 'oauth',
          extra: { codex_5h_used_percent: 61, codex_7d_used_percent: 18 }
        })
      )
    ).toEqual({ kind: 'session', frac: 0.61 })

    expect(
      primaryUsage(
        acc({
          platform: 'openai',
          type: 'oauth',
          extra: { codex_5h_used_percent: 0, codex_7d_used_percent: 18 }
        })
      )
    ).toEqual({ kind: 'session', frac: 0 })
  })

  it('OpenAI 只有 7d 可用时主额度仍保持会话占位', () => {
    expect(
      primaryUsage(
        acc({
          platform: 'openai',
          extra: { codex_5h_used_percent: undefined, codex_7d_used_percent: 18 }
        })
      )
    ).toEqual({ kind: 'session', frac: undefined })
  })
})

describe('sessionWindowRange', () => {
  it('Claude/Anthropic：优先展示顶层 session_window_start/end', () => {
    expect(
      sessionWindowRange(
        acc({
          session_window_start: '2026-06-29T14:00:00+08:00',
          session_window_end: '2026-06-29T19:00:00+08:00',
          extra: { codex_5h_reset_at: '2026-06-29T20:00:00+08:00' }
        })
      )
    ).toBe('14:00–19:00')
  })

  it('OpenAI activate：只有 codex_5h_reset_at 时展示 5h 开始--结束窗口', () => {
    expect(
      sessionWindowRange(
        acc({
          platform: 'openai',
          extra: { codex_5h_reset_at: '2026-06-29T19:00:00+08:00' }
        })
      )
    ).toBe('14:00–19:00')
  })

  it('无窗口字段返回占位', () => {
    expect(sessionWindowRange(acc({ platform: 'openai', extra: {} }))).toBe('—')
  })

})
