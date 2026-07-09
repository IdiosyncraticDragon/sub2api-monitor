import { describe, it, expect, vi } from 'vitest'
import { ApiService, HttpError } from './api'
import { ApiError } from '../core/apiParse'
import type { Account } from '../../shared/types'

const BASE = 'https://example.test/api/v1'

// 构造一个最小 Response 替身
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body
  } as unknown as Response
}

function makeService(opts: {
  fetchImpl: typeof fetch
  token?: string | null
  getToken?: () => string | null
  refreshAccessToken?: () => Promise<string>
}): ApiService {
  return new ApiService({
    baseUrl: () => BASE,
    fetchFn: opts.fetchImpl,
    getToken: opts.getToken ?? (() => opts.token ?? null),
    refreshAccessToken: opts.refreshAccessToken
  })
}

const account = (over: Partial<Account>): Account => ({
  id: 1,
  name: 'a',
  status: 'active',
  ...over
})

describe('ApiService.getActiveAccounts', () => {
  it('请求正确的 URL 与查询参数（status=active）', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0 } })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })
    await svc.getActiveAccounts()

    const url = new URL(fetchFn.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://example.test/api/v1/admin/accounts')
    expect(url.searchParams.get('status')).toBe('active')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('page_size')).toBe('100')
  })

  it('携带 Authorization: Bearer <token>', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0 } })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: 'jwt.abc' })
    await svc.getActiveAccounts()

    const init = fetchFn.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt.abc')
  })

  it('无 token 时不带 Authorization 头', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0 } })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: null })
    await svc.getActiveAccounts()

    const init = fetchFn.mock.calls[0][1] as RequestInit
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('解包分页响应并返回账户列表', async () => {
    const items = [account({ id: 1 }), account({ id: 2 })]
    const fetchFn = vi.fn(async () =>
      jsonResponse({ code: 0, message: 'ok', data: { items, total: 2 } })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })
    const result = await svc.getActiveAccounts()
    expect(result.map((a) => a.id)).toEqual([1, 2])
  })

  it('防御性过滤：即便后端混入非 active 也只留 active', async () => {
    const items = [account({ id: 1, status: 'active' }), account({ id: 2, status: 'inactive' })]
    const fetchFn = vi.fn(async () =>
      jsonResponse({ code: 0, message: 'ok', data: { items, total: 2 } })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })
    const result = await svc.getActiveAccounts()
    expect(result.map((a) => a.id)).toEqual([1])
  })

  it('OpenAI 账号会强制刷新 active/passive usage 并覆盖列表里的旧 codex 用量', async () => {
    const items = [
      account({
        id: 7,
        platform: 'openai',
        extra: { codex_5h_used_percent: 61, codex_7d_used_percent: 33 }
      })
    ]
    const fetchFn = vi.fn(async (urlLike: string | URL | Request) => {
      const url = new URL(urlLike as string)
      if (url.pathname.endsWith('/admin/accounts')) {
        if (url.searchParams.get('type') === 'free') {
          return jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0 } })
        }
        if (url.searchParams.get('type') === 'plus') {
          return jsonResponse({ code: 0, message: 'ok', data: { items, total: 1 } })
        }
        return jsonResponse({ code: 0, message: 'ok', data: { items, total: 1 } })
      }
      if (url.pathname.endsWith('/admin/accounts/7/usage') && url.searchParams.get('source') === 'active') {
        expect(url.searchParams.get('force')).toBe('true')
        return jsonResponse({
          code: 0,
          message: 'ok',
          data: { codex_5h_used_percent: 0, codex_5h_reset_at: '2026-07-02T10:00:00+08:00' }
        })
      }
      if (url.pathname.endsWith('/admin/accounts/7/usage') && url.searchParams.get('source') === 'passive') {
        expect(url.searchParams.get('force')).toBe('true')
        return jsonResponse({
          code: 0,
          message: 'ok',
          data: { usage: { used_percent: 18, reset_at: '2026-07-09T10:00:00+08:00' } }
        })
      }
      throw new Error(`unexpected URL ${url.toString()}`)
    })
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })

    const result = await svc.getActiveAccounts()

    expect(result[0].extra).toMatchObject({
      codex_5h_used_percent: 0,
      codex_5h_reset_at: '2026-07-02T10:00:00+08:00',
      codex_7d_used_percent: 18,
      codex_7d_reset_at: '2026-07-09T10:00:00+08:00'
    })
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('OpenAI usage 刷新非 401 失败时保留账户列表数据', async () => {
    const items = [account({ id: 8, platform: 'openai', extra: { codex_5h_used_percent: 61 } })]
    const fetchFn = vi.fn(async (urlLike: string | URL | Request) => {
      const url = new URL(urlLike as string)
      if (url.pathname.endsWith('/admin/accounts')) {
        if (url.searchParams.get('type')) {
          return jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0 } })
        }
        return jsonResponse({ code: 0, message: 'ok', data: { items, total: 1 } })
      }
      return jsonResponse({ message: 'boom' }, { ok: false, status: 500 })
    })
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })

    const result = await svc.getActiveAccounts()

    expect(result[0].extra?.codex_5h_used_percent).toBe(61)
  })

  it('OpenAI active usage 成功但无 5h 字段时清掉列表里的旧 5h 用量', async () => {
    const items = [
      account({
        id: 9,
        platform: 'openai',
        extra: { codex_5h_used_percent: 61, codex_7d_used_percent: 33 }
      })
    ]
    const fetchFn = vi.fn(async (urlLike: string | URL | Request) => {
      const url = new URL(urlLike as string)
      if (url.pathname.endsWith('/admin/accounts')) {
        if (url.searchParams.get('type')) {
          return jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0 } })
        }
        return jsonResponse({ code: 0, message: 'ok', data: { items, total: 1 } })
      }
      if (url.searchParams.get('source') === 'active') {
        return jsonResponse({ code: 0, message: 'ok', data: { available: false } })
      }
      return jsonResponse({ code: 0, message: 'ok', data: { used_percent: 18 } })
    })
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })

    const result = await svc.getActiveAccounts()

    expect(result[0].extra?.codex_5h_used_percent).toBeUndefined()
    expect(result[0].extra?.codex_7d_used_percent).toBe(18)
  })

  it('业务错误码（code!==0）抛 ApiError', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ code: 500, message: '服务异常', data: null }))
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })
    await expect(svc.getActiveAccounts()).rejects.toBeInstanceOf(ApiError)
  })

  it('business code 401 throws HttpError(status=401)', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ code: 401, message: 'unauthorized', data: null }))
    const svc = makeService({ fetchImpl: fetchFn, token: 'expired' })
    await expect(svc.getActiveAccounts()).rejects.toMatchObject({ status: 401 })
    await expect(svc.getActiveAccounts()).rejects.toBeInstanceOf(HttpError)
  })

  it('HTTP 401 抛 HttpError(status=401)', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: 'unauthorized' }, { ok: false, status: 401 }))
    const svc = makeService({ fetchImpl: fetchFn, token: 'expired' })
    await expect(svc.getActiveAccounts()).rejects.toMatchObject({ status: 401 })
    await expect(svc.getActiveAccounts()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('ApiService.getDashboardStats', () => {
  it('请求 /admin/dashboard/stats 并解包返回 data', async () => {
    const data = { today_tokens: 26871174, today_requests: 169, today_cost: 32.87, normal_accounts: 61 }
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ code: 0, message: 'ok', data })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })
    const result = await svc.getDashboardStats()

    const url = new URL(fetchFn.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://example.test/api/v1/admin/dashboard/stats')
    expect(result.today_tokens).toBe(26871174)
    expect(result.today_requests).toBe(169)
  })

  it('HTTP 401 抛 HttpError', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, { ok: false, status: 401 }))
    const svc = makeService({ fetchImpl: fetchFn, token: 'expired' })
    await expect(svc.getDashboardStats()).rejects.toBeInstanceOf(HttpError)
  })

  it('business code 401 throws HttpError', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ code: 401, message: 'unauthorized', data: null }))
    const svc = makeService({ fetchImpl: fetchFn, token: 'expired' })
    await expect(svc.getDashboardStats()).rejects.toBeInstanceOf(HttpError)
  })

  it('HTTP 401 后 refresh 成功则用新 token 重试原请求', async () => {
    let token = 'expired'
    const refreshAccessToken = vi.fn(async () => {
      token = 'fresh'
      return token
    })
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      if (headers.Authorization === 'Bearer expired') {
        return jsonResponse({}, { ok: false, status: 401 })
      }
      return jsonResponse({
        code: 0,
        message: 'ok',
        data: { today_tokens: 1, today_requests: 2, today_cost: 3, normal_accounts: 4 }
      })
    })
    const svc = makeService({
      fetchImpl: fetchFn,
      getToken: () => token,
      refreshAccessToken
    })

    const result = await svc.getDashboardStats()

    expect(result.today_tokens).toBe(1)
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect((fetchFn.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer fresh'
    })
  })

  it('business code 401 后 refresh 成功则重试原请求', async () => {
    let token = 'expired'
    const refreshAccessToken = vi.fn(async () => {
      token = 'fresh'
      return token
    })
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 401, message: 'unauthorized', data: null }))
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          message: 'ok',
          data: { today_tokens: 1, today_requests: 2, today_cost: 3, normal_accounts: 4 }
        })
      )
    const svc = makeService({
      fetchImpl: fetchFn,
      getToken: () => token,
      refreshAccessToken
    })

    await expect(svc.getDashboardStats()).resolves.toMatchObject({ today_tokens: 1 })
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('refresh 失败时最终抛 401', async () => {
    const refreshAccessToken = vi.fn(async () => {
      throw new Error('refresh failed')
    })
    const fetchFn = vi.fn(async () => jsonResponse({}, { ok: false, status: 401 }))
    const svc = makeService({ fetchImpl: fetchFn, token: 'expired', refreshAccessToken })

    await expect(svc.getDashboardStats()).rejects.toMatchObject({ status: 401 })
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
  })

  it('重试后仍 401 不无限循环', async () => {
    let token = 'expired'
    const refreshAccessToken = vi.fn(async () => {
      token = 'fresh'
      return token
    })
    const fetchFn = vi.fn(async () => jsonResponse({}, { ok: false, status: 401 }))
    const svc = makeService({
      fetchImpl: fetchFn,
      getToken: () => token,
      refreshAccessToken
    })

    await expect(svc.getDashboardStats()).rejects.toMatchObject({ status: 401 })
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})

describe('ApiService.getTodayUserUsage', () => {
  it('从 /admin/users 获取当天使用用户，按最后使用时间倒序返回', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({
        code: 0,
        message: 'ok',
        data: {
          items: [
            { id: 1, username: 'alice', last_used_at: '2026-07-02T09:00:00+08:00' },
            { id: 2, username: 'bob', last_used_at: '2026-07-01T23:59:00+08:00' },
            { id: 3, name: 'carol', last_used: '2026-07-02T11:30:00+08:00' },
            { id: 4, email: 'dave@example.test', last_used_time: null }
          ],
          total: 4,
          page: 1,
          page_size: 100
        }
      })
    )
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })

    const result = await svc.getTodayUserUsage(new Date('2026-07-02T12:00:00+08:00'))

    const url = new URL(fetchFn.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://example.test/api/v1/admin/users')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('page_size')).toBe('100')
    expect(result).toEqual({
      count: 2,
      users: [
        { id: 3, username: 'carol', lastUsedAt: '2026-07-02T11:30:00+08:00' },
        { id: 1, username: 'alice', lastUsedAt: '2026-07-02T09:00:00+08:00' }
      ]
    })
  })

  it('分页响应超过一页时继续读取后续页', async () => {
    const fetchFn = vi.fn(async (urlLike: string | URL | Request) => {
      const url = new URL(urlLike as string)
      if (url.searchParams.get('page') === '1') {
        return jsonResponse({
          code: 0,
          message: 'ok',
          data: {
            items: [{ id: 1, username: 'alice', last_used_at: '2026-07-02T09:00:00+08:00' }],
            total: 2,
            page: 1,
            page_size: 1,
            pages: 2
          }
        })
      }
      return jsonResponse({
        code: 0,
        message: 'ok',
        data: {
          items: [{ id: 2, username: 'bob', last_used_at: '2026-07-02T10:00:00+08:00' }],
          total: 2,
          page: 2,
          page_size: 1,
          pages: 2
        }
      })
    })
    const svc = makeService({ fetchImpl: fetchFn, token: 't' })

    const result = await svc.getTodayUserUsage(new Date('2026-07-02T12:00:00+08:00'))

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.count).toBe(2)
    expect(result.users.map((u) => u.username)).toEqual(['bob', 'alice'])
  })

  it('HTTP 401 抛 HttpError', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, { ok: false, status: 401 }))
    const svc = makeService({ fetchImpl: fetchFn, token: 'expired' })
    await expect(svc.getTodayUserUsage()).rejects.toBeInstanceOf(HttpError)
  })
})
