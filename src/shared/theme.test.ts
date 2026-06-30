import { describe, it, expect } from 'vitest'
import {
  DEFAULT_UI_PREFS,
  THEMES,
  COLLAPSE_STYLES,
  utilizationLevel,
  levelColorVar
} from './theme'

describe('utilizationLevel', () => {
  it('按阈值分级：≥0.8 高 / ≥0.65 中 / 其余低', () => {
    expect(utilizationLevel(0.2)).toBe('low')
    expect(utilizationLevel(0.64)).toBe('low')
    expect(utilizationLevel(0.65)).toBe('mid')
    expect(utilizationLevel(0.79)).toBe('mid')
    expect(utilizationLevel(0.8)).toBe('high')
    expect(utilizationLevel(1)).toBe('high')
  })

  it('无效值 → null', () => {
    expect(utilizationLevel(undefined)).toBeNull()
    expect(utilizationLevel(null)).toBeNull()
    expect(utilizationLevel(Number.NaN)).toBeNull()
  })
})

describe('levelColorVar', () => {
  it('分级映射到 CSS 变量；null → muted', () => {
    expect(levelColorVar('low')).toBe('var(--s2a-low)')
    expect(levelColorVar('mid')).toBe('var(--s2a-mid)')
    expect(levelColorVar('high')).toBe('var(--s2a-high)')
    expect(levelColorVar(null)).toBe('var(--s2a-muted)')
  })
})

describe('元数据', () => {
  it('默认配置在可选项集合内', () => {
    expect(THEMES.map((t) => t.key)).toContain(DEFAULT_UI_PREFS.theme)
    expect(COLLAPSE_STYLES.map((s) => s.key)).toContain(DEFAULT_UI_PREFS.collapseStyle)
  })

  it('每套主题有三色样', () => {
    for (const t of THEMES) expect(t.swatch).toHaveLength(3)
  })
})
