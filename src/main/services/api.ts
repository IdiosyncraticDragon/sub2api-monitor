import type { Account, ApiEnvelope, DashboardStats, PaginatedResponse } from '../../shared/types'
import { unwrap, extractItems } from '../core/apiParse'
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
    return unwrap(envelope)
  }

  /** 获取状态正常（active）的账户列表 */
  async getActiveAccounts(): Promise<Account[]> {
    const data = await this.getJson<PaginatedResponse<Account> | Account[]>('/admin/accounts', {
      status: 'active',
      page: '1',
      page_size: '100'
    })
    // 防御性再过滤：即使后端忽略 status 过滤也只保留 active
    return filterActive(extractItems(data))
  }

  /** 获取今日仪表盘统计（今日 Token / 请求 / 花费 等） */
  async getDashboardStats(): Promise<DashboardStats> {
    return this.getJson<DashboardStats>('/admin/dashboard/stats')
  }
}
