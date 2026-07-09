import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthRefreshError, AuthService } from './auth'
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

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body
  } as unknown as Response
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

  it('refreshAccessToken 使用 refresh token 换新 token 并保存新 token pair', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        code: 0,
        message: 'ok',
        data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }
      })
    )
    const auth = new AuthService(store, clock, {
      baseUrl: () => 'https://example.test/api/v1',
      fetchFn
    })
    auth.setTokens(jwtWithExp(1782648000 - 100), 'old-refresh')

    await expect(auth.refreshAccessToken()).resolves.toBe('new-access')

    expect(auth.getToken()).toBe('new-access')
    expect(auth.getRefreshToken()).toBe('new-refresh')
    expect(fetchFn).toHaveBeenCalledWith('https://example.test/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'old-refresh' })
    })
  })

  it('refresh 响应没有新 refresh token 时保留旧 refresh token', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ code: 0, message: 'ok', data: { access_token: 'new-access', expires_in: 3600 } })
    )
    const auth = new AuthService(store, clock, {
      baseUrl: () => 'https://example.test/api/v1',
      fetchFn
    })
    auth.setTokens(jwtWithExp(1782648000 - 100), 'old-refresh')

    await auth.refreshAccessToken()

    expect(auth.getToken()).toBe('new-access')
    expect(auth.getRefreshToken()).toBe('old-refresh')
  })

  it('无 refresh token 时 refreshAccessToken 失败', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ code: 0, message: 'ok', data: {} }))
    const auth = new AuthService(store, clock, {
      baseUrl: () => 'https://example.test/api/v1',
      fetchFn
    })

    await expect(auth.refreshAccessToken()).rejects.toBeInstanceOf(AuthRefreshError)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('HTTP 401 时 refreshAccessToken 失败', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: 'unauthorized' }, { ok: false, status: 401 }))
    const auth = new AuthService(store, clock, {
      baseUrl: () => 'https://example.test/api/v1',
      fetchFn
    })
    auth.setTokens(jwtWithExp(1782648000 - 100), 'old-refresh')

    await expect(auth.refreshAccessToken()).rejects.toBeInstanceOf(AuthRefreshError)
    expect(auth.getToken()).not.toBe('new-access')
  })

  it('业务 code=401 时 refreshAccessToken 失败', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ code: 401, message: 'unauthorized', data: null })
    )
    const auth = new AuthService(store, clock, {
      baseUrl: () => 'https://example.test/api/v1',
      fetchFn
    })
    auth.setTokens(jwtWithExp(1782648000 - 100), 'old-refresh')

    await expect(auth.refreshAccessToken()).rejects.toBeInstanceOf(AuthRefreshError)
  })

  it('并发 refreshAccessToken 只发起一次请求', async () => {
    let resolveResponse!: (value: Response) => void
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        })
    )
    const auth = new AuthService(store, clock, {
      baseUrl: () => 'https://example.test/api/v1',
      fetchFn
    })
    auth.setTokens(jwtWithExp(1782648000 - 100), 'old-refresh')

    const first = auth.refreshAccessToken()
    const second = auth.refreshAccessToken()
    resolveResponse(
      jsonResponse({
        code: 0,
        message: 'ok',
        data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }
      })
    )

    await expect(Promise.all([first, second])).resolves.toEqual(['new-access', 'new-access'])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
