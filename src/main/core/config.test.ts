import { describe, it, expect } from 'vitest'
import { normalizeOrigin, apiBaseFrom, loginUrlFrom } from './config'

describe('normalizeOrigin', () => {
  it('补 https、丢路径与尾斜杠，取 origin', () => {
    expect(normalizeOrigin('example.com')).toBe('https://example.com')
    expect(normalizeOrigin('https://example.com/')).toBe('https://example.com')
    expect(normalizeOrigin('https://example.com/admin/accounts')).toBe('https://example.com')
    expect(normalizeOrigin('http://localhost:8080')).toBe('http://localhost:8080')
  })

  it('空白/无效返回 null', () => {
    expect(normalizeOrigin('')).toBeNull()
    expect(normalizeOrigin('   ')).toBeNull()
    expect(normalizeOrigin(null)).toBeNull()
    expect(normalizeOrigin('http://')).toBeNull()
  })
})

describe('apiBaseFrom / loginUrlFrom', () => {
  it('派生 API base 与登录页', () => {
    expect(apiBaseFrom('https://example.com')).toBe('https://example.com/api/v1')
    expect(loginUrlFrom('https://example.com')).toBe('https://example.com/admin/')
  })
})
