import type {
  Account,
  AdminUser,
  ApiEnvelope,
  DashboardStats,
  PaginatedResponse,
  TodayUser,
  UserUsageSummary
} from '../../shared/types'
import type { AccountExtra } from '../../shared/types'
import { isOpenAiAccount } from '../../shared/usage'
import { unwrap, extractItems, ApiError } from '../core/apiParse'
import { filterActive } from '../core/transform'

/** HTTP 层错误（非 2xx）。401 用于触发重新登录/刷新。 */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export interface ApiDeps {
  /** API base 提供者（动态：服务器地址可在运行时通过设置窗变更） */
  baseUrl: () => string
  fetchFn: typeof fetch
  getToken: () => string | null
}

type UsageSource = 'active' | 'passive'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && !Number.isNaN(v) ? v : undefined

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const lastUsedOf = (u: AdminUser): string | null =>
  u.last_used_at ?? u.last_used ?? u.last_used_time ?? null

const usernameOf = (u: AdminUser): string =>
  u.username?.trim() || u.name?.trim() || u.email?.trim() || String(u.id)

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`

const isSameLocalDay = (iso: string, now: Date): boolean => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return dayKey(d) === dayKey(now)
}

function findNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = num(obj[key])
    if (value !== undefined) return value
  }
  for (const value of Object.values(obj)) {
    if (isRecord(value)) {
      const found = findNumber(value, keys)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function findString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = str(obj[key])
    if (value !== undefined) return value
  }
  for (const value of Object.values(obj)) {
    if (isRecord(value)) {
      const found = findString(value, keys)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function usageToExtra(payload: unknown, source: UsageSource): AccountExtra {
  const root = isRecord(payload) ? payload : {}
  if (source === 'active') {
    const pct = findNumber(root, [
      'codex_5h_used_percent',
      'used_percent',
      'usage_percent',
      'utilization_percent',
      'percent'
    ])
    const reset = findString(root, ['codex_5h_reset_at', 'reset_at', 'resets_at', 'reset_time'])
    return {
      codex_5h_used_percent: pct,
      codex_5h_reset_at: reset
    }
  }

  const pct = findNumber(root, [
    'codex_7d_used_percent',
    'used_percent',
    'usage_percent',
    'utilization_percent',
    'percent'
  ])
  const reset = findString(root, ['codex_7d_reset_at', 'reset_at', 'resets_at', 'reset_time'])
  return {
    codex_7d_used_percent: pct,
    codex_7d_reset_at: reset
  }
}

// 与后台交互的 HTTP 服务。依赖注入 fetch 与 token provider，便于单测。
export class ApiService {
  constructor(private deps: ApiDeps) {}

  private async getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.deps.baseUrl() + path)
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = this.deps.getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    const resp = await this.deps.fetchFn(url.toString(), { method: 'GET', headers })
    if (!resp.ok) {
      throw new HttpError(resp.status, `HTTP ${resp.status}`)
    }
    const envelope = (await resp.json()) as ApiEnvelope<T>
    try {
      return unwrap(envelope)
    } catch (err) {
      if (err instanceof ApiError && err.code === 401) {
        throw new HttpError(401, err.message)
      }
      throw err
    }
  }

  /** 获取状态正常（active）的账户列表 */
  async getActiveAccounts(): Promise<Account[]> {
    const data = await this.getAccountsPage({
      status: 'active',
      page: '1',
      page_size: '100'
    })
    // 防御性再过滤：即使后端忽略 status 过滤也只保留 active
    const accounts = filterActive(extractItems(data))
    return this.refreshOpenAiUsage(accounts)
  }

  private async getAccountsPage(params: Record<string, string>): Promise<PaginatedResponse<Account> | Account[]> {
    return this.getJson<PaginatedResponse<Account> | Account[]>('/admin/accounts', params)
  }

  private async getAccountUsage(id: number, source: UsageSource): Promise<unknown> {
    return this.getJson<unknown>(`/admin/accounts/${id}/usage`, { source, force: 'true' })
  }

  private async refreshOpenAiUsage(accounts: Account[]): Promise<Account[]> {
    const refreshed = await Promise.all(
      accounts.map(async (account) => {
        if (!isOpenAiAccount(account)) return account
        try {
          const [active, passive] = await Promise.all([
            this.getAccountUsage(account.id, 'active'),
            this.getAccountUsage(account.id, 'passive')
          ])
          return {
            ...account,
            extra: {
              ...account.extra,
              ...usageToExtra(active, 'active'),
              ...usageToExtra(passive, 'passive')
            }
          }
        } catch (err) {
          if (err instanceof HttpError && err.status === 401) throw err
          return account
        }
      })
    )
    return refreshed
  }

  /** 获取今日仪表盘统计（今日 Token / 请求 / 花费 等） */
  async getDashboardStats(): Promise<DashboardStats> {
    return this.getJson<DashboardStats>('/admin/dashboard/stats')
  }

  /** 获取当天使用过的用户（来自 /admin/users 页面数据） */
  async getTodayUserUsage(now = new Date()): Promise<UserUsageSummary> {
    const users = await this.getAllUsers()
    const today = users
      .map<TodayUser | null>((u) => {
        const lastUsedAt = lastUsedOf(u)
        if (!lastUsedAt || !isSameLocalDay(lastUsedAt, now)) return null
        return {
          id: u.id,
          username: usernameOf(u),
          lastUsedAt
        }
      })
      .filter((u): u is TodayUser => !!u)
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())

    return { count: today.length, users: today }
  }

  private async getAllUsers(): Promise<AdminUser[]> {
    const first = await this.getUsersPage('1')
    const items = extractItems(first)
    const pages = !Array.isArray(first) && typeof first.pages === 'number' ? first.pages : 1
    const total = !Array.isArray(first) && typeof first.total === 'number' ? first.total : items.length
    const pageSize =
      !Array.isArray(first) && typeof first.page_size === 'number' ? first.page_size : Math.max(items.length, 1)
    const expectedPages = pages > 1 ? pages : Math.ceil(total / pageSize)

    if (expectedPages <= 1) return items

    const rest = await Promise.all(
      Array.from({ length: expectedPages - 1 }, (_, i) => this.getUsersPage(String(i + 2)))
    )
    return items.concat(rest.flatMap((page) => extractItems(page)))
  }

  private async getUsersPage(page: string): Promise<PaginatedResponse<AdminUser> | AdminUser[]> {
    return this.getJson<PaginatedResponse<AdminUser> | AdminUser[]>('/admin/users', {
      page,
      page_size: '100'
    })
  }
}
