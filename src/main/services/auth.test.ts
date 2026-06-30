import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService } from './auth'
import { CredentialStore, type KeyValueStore, type Cipher } from './credentialStore'

function fakeKv(): KeyValueStore {
  const data = new Map<string, unknown>()
  return {
    get: <T>(k: string) => data.get(k) as T | undefined,
    set: (k, v) => void data.set(k, v),
    delete: (k) => void data.delete(k)
  }
}
const passthroughCipher: Cipher = {
  isAvailable: () => true,
  encrypt: (p) => p,
  decrypt: (s) => s
}

// 构造未签名 JWT（exp 为给定 epoch 秒）
function jwtWithExp(expSec: number): string {
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64({ exp: expSec })}.sig`
}

describe('AuthService', () => {
  let store: CredentialStore
  const now = new Date('2026-06-28T12:00:00Z') // epoch 秒 1782648000
  const clock = (): Date => now

  beforeEach(() => {
    store = new CredentialStore(fakeKv(), passthroughCipher)
  })

  it('无凭证时未认证', () => {
    const auth = new AuthService(store, clock)
    expect(auth.isAuthenticated()).toBe(false)
    expect(auth.getToken()).toBeNull()
  })

  it('存有未过期 token → 已认证', () => {
    const auth = new AuthService(store, clock)
    auth.setTokens(jwtWithExp(1782648000 + 3600))
    expect(auth.isAuthenticated()).toBe(true)
  })

  it('存有已过期 token → 未认证', () => {
    const auth = new AuthService(store, clock)
    auth.setTokens(jwtWithExp(1782648000 - 100))
    expect(auth.isAuthenticated()).toBe(false)
  })

  it('setTokens 同时保存 refresh token', () => {
    const auth = new AuthService(store, clock)
    auth.setTokens(jwtWithExp(1782648000 + 3600), 'refresh.abc')
    expect(store.loadRefreshToken()).toBe('refresh.abc')
  })

  it('clear 后未认证', () => {
    const auth = new AuthService(store, clock)
    auth.setTokens(jwtWithExp(1782648000 + 3600))
    auth.clear()
    expect(auth.isAuthenticated()).toBe(false)
    expect(auth.getToken()).toBeNull()
  })

  it('getToken 返回存储的原始 token', () => {
    const auth = new AuthService(store, clock)
    const t = jwtWithExp(1782648000 + 3600)
    auth.setTokens(t)
    expect(auth.getToken()).toBe(t)
  })
})
