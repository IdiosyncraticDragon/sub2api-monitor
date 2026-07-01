import { describe, it, expect } from 'vitest'
import {
  compactNumber,
  formatTokens,
  formatCost,
  formatPercent,
  formatWindowRange,
  formatWindowRangeFromEnd,
  formatLastUsed
} from './format'

describe('compactNumber', () => {
  it('千/百万/十亿后缀', () => {
    expect(compactNumber(800)).toBe('800')
    expect(compactNumber(1200)).toBe('1.2k')
    expect(compactNumber(5000)).toBe('5k')
    expect(compactNumber(26871174)).toBe('26.9M')
    expect(compactNumber(2000000000)).toBe('2B')
  })
})

describe('formatTokens', () => {
  it('紧凑展示，缺失占位', () => {
    expect(formatTokens(26871174)).toBe('26.9M')
    expect(formatTokens(undefined)).toBe('—')
    expect(formatTokens(null)).toBe('—')
  })
})

describe('formatCost', () => {
  it('两位小数美元，缺失占位', () => {
    expect(formatCost(32.86987)).toBe('$32.87')
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(undefined)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('0..1 → 百分比整数', () => {
    expect(formatPercent(0.3)).toBe('30%')
    expect(formatPercent(0.11)).toBe('11%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(undefined)).toBe('—')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('formatWindowRange', () => {
  it('取 ISO 中的钟点拼接', () => {
    expect(
      formatWindowRange('2026-06-29T14:00:00+08:00', '2026-06-29T19:00:00+08:00')
    ).toBe('14:00–19:00')
  })

  it('任一缺失返回占位', () => {
    expect(formatWindowRange(null, '2026-06-29T19:00:00+08:00')).toBe('—')
    expect(formatWindowRange('2026-06-29T14:00:00+08:00', undefined)).toBe('—')
  })
})

describe('formatWindowRangeFromEnd', () => {
  it('按结束时间反推固定小时窗口', () => {
    expect(formatWindowRangeFromEnd('2026-06-29T19:00:00+08:00', 5)).toBe('14:00–19:00')
  })

  it('跨日时按墙上时钟回绕', () => {
    expect(formatWindowRangeFromEnd('2026-06-29T02:30:00+08:00', 5)).toBe('21:30–02:30')
  })

  it('无效输入返回占位', () => {
    expect(formatWindowRangeFromEnd(undefined, 5)).toBe('—')
    expect(formatWindowRangeFromEnd('bad', 5)).toBe('—')
  })
})

describe('formatLastUsed', () => {
  const now = new Date('2026-06-28T12:00:00Z')
  it('相对时间与空值', () => {
    expect(formatLastUsed('2026-06-28T11:59:30Z', now)).toBe('刚刚')
    expect(formatLastUsed('2026-06-28T11:57:00Z', now)).toBe('3分钟前')
    expect(formatLastUsed('2026-06-28T09:00:00Z', now)).toBe('3小时前')
    expect(formatLastUsed('2026-06-26T12:00:00Z', now)).toBe('2天前')
    expect(formatLastUsed(null, now)).toBe('从未使用')
  })
})
