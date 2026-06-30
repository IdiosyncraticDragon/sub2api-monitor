import { describe, it, expect } from 'vitest'
import { sessionUtilization, weeklyUtilization } from './usage'

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

  it('无字段 → undefined', () => {
    expect(weeklyUtilization(undefined)).toBeUndefined()
    expect(weeklyUtilization({})).toBeUndefined()
  })
})
