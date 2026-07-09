import { CredentialStore } from './credentialStore'
import { isJwtExpired } from '../core/jwt'
import { unwrap, ApiError } from '../core/apiParse'
import type { ApiEnvelope } from '../../shared/types'

interface RefreshTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

export interface AuthRefreshDeps {
  baseUrl: () => string
  fetchFn: typeof fetch
}

export class AuthRefreshError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthRefreshError'
  }
}

// 认证状态管理：基于 CredentialStore 持久化，用 core/jwt 判断有效性。
// clock/fetch/baseUrl 注入以便测试。Access token 过期后用 refresh token 静默续期。
export class AuthService {
  private refreshInFlight: Promise<string> | null = null

  constructor(
    private store: CredentialStore,
    private clock: () => Date = () => new Date(),
    private refreshDeps?: AuthRefreshDeps
  ) {}

  /** 当前持久化的 access token（不判断是否过期） */
  getToken(): string | null {
    return this.store.loadToken()
  }

  getRefreshToken(): string | null {
    return this.store.loadRefreshToken()
  }

  /** 是否已认证：存在 token 且未过期（含 60s 安全边界） */
  isAuthenticated(): boolean {
    const token = this.store.loadToken()
    if (!token) return false
    return !isJwtExpired(token, this.clock())
  }

  /** 保存登录获得的凭证 */
  setTokens(accessToken: string, refreshToken?: string): void {
    this.store.saveToken(accessToken)
    if (refreshToken) this.store.saveRefreshToken(refreshToken)
  }

  /** 使用 refresh token 静默换取新的 access token；并发调用共享同一次请求。 */
  async refreshAccessToken(): Promise<string> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = this.doRefreshAccessToken().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  private async doRefreshAccessToken(): Promise<string> {
    if (!this.refreshDeps) throw new AuthRefreshError('未配置 token 刷新能力')
    const refreshToken = this.store.loadRefreshToken()
    if (!refreshToken) throw new AuthRefreshError('无 refresh token，无法自动续期')

    let resp: Response
    try {
      resp = await this.refreshDeps.fetchFn(`${this.refreshDeps.baseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })
    } catch (err) {
      throw new AuthRefreshError(err instanceof Error ? err.message : 'token 刷新请求失败')
    }

    if (!resp.ok) throw new AuthRefreshError(`token 刷新失败(HTTP ${resp.status})`)

    try {
      const data = unwrap((await resp.json()) as ApiEnvelope<RefreshTokenResponse>)
      if (!data.access_token) throw new AuthRefreshError('token 刷新响应缺少 access_token')
      this.setTokens(data.access_token, data.refresh_token || refreshToken)
      return data.access_token
    } catch (err) {
      if (err instanceof AuthRefreshError) throw err
      if (err instanceof ApiError) throw new AuthRefreshError(err.message)
      throw new AuthRefreshError('token 刷新响应解析失败')
    }
  }

  /** 登出/失效：清除全部凭证 */
  clear(): void {
    this.store.clear()
  }
}
