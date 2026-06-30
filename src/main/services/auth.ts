import { CredentialStore } from './credentialStore'
import { isJwtExpired } from '../core/jwt'

// 认证状态管理：基于 CredentialStore 持久化，用 core/jwt 判断有效性。
// clock 注入以便测试。Token 刷新（refresh）在 M3 接入网络层后补全。
export class AuthService {
  constructor(
    private store: CredentialStore,
    private clock: () => Date = () => new Date()
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

  /** 登出/失效：清除全部凭证 */
  clear(): void {
    this.store.clear()
  }
}
