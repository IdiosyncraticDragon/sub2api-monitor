import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PlatformIcon, platformKind } from './PlatformIcon'

describe('platformKind', () => {
  it('归类各平台', () => {
    expect(platformKind('anthropic')).toBe('claude')
    expect(platformKind('openai')).toBe('codex')
    expect(platformKind('Codex')).toBe('codex')
    expect(platformKind('gemini')).toBe('gemini')
    expect(platformKind('xyz')).toBe('other')
    expect(platformKind(undefined)).toBe('other')
  })
})

describe('PlatformIcon', () => {
  it('按平台渲染带 data-platform 的图标', () => {
    const { container, rerender } = render(<PlatformIcon platform="anthropic" />)
    expect(container.querySelector('[data-platform="claude"]')).toBeTruthy()
    rerender(<PlatformIcon platform="openai" />)
    expect(container.querySelector('[data-platform="codex"]')).toBeTruthy()
  })
})
