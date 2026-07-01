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
}): ApiService {
  return new ApiService({
    baseUrl: () => BASE,
    fetchFn: opts.fetchImpl,
    getToken: () => opts.token ?? null
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
})
