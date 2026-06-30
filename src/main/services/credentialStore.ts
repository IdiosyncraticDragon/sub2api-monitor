// 凭证与配置持久化层。
// 通过依赖注入隔离 electron-store（KeyValueStore）与 safeStorage（Cipher），便于单测。
// 敏感凭证（JWT / refresh token）加密落盘；窗口位置等非敏感配置明文存。

import { DEFAULT_UI_PREFS, type UiPrefs } from '../../shared/theme'

export interface KeyValueStore {
  get<T>(key: string): T | undefined
  set(key: string, value: unknown): void
  delete(key: string): void
}

export interface Cipher {
  isAvailable(): boolean
  /** 加密明文，返回可持久化的字符串（如 base64） */
  encrypt(plain: string): string
  /** 解密；失败应抛错 */
  decrypt(stored: string): string
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

const KEY_TOKEN = 'auth.token'
const KEY_REFRESH = 'auth.refreshToken'
const KEY_BOUNDS = 'window.bounds'
const KEY_COLLAPSED = 'window.collapsed'
const KEY_COLLAPSED_BOUNDS = 'window.collapsedBounds'
const KEY_SERVER_ORIGIN = 'server.origin'
const KEY_UI_PREFS = 'ui.prefs'

export class CredentialStore {
  constructor(
    private kv: KeyValueStore,
    private cipher: Cipher
  ) {}

  private encryptInto(key: string, value: string): void {
    if (!this.cipher.isAvailable()) {
      throw new Error('加密不可用（safeStorage 未就绪），拒绝明文存储凭证')
    }
    this.kv.set(key, this.cipher.encrypt(value))
  }

  private decryptFrom(key: string): string | null {
    const raw = this.kv.get<string>(key)
    if (!raw) return null
    try {
      return this.cipher.decrypt(raw)
    } catch {
      return null // 密文损坏 / 密钥变更，视为无凭证
    }
  }

  saveToken(token: string): void {
    this.encryptInto(KEY_TOKEN, token)
  }

  loadToken(): string | null {
    return this.decryptFrom(KEY_TOKEN)
  }

  saveRefreshToken(token: string): void {
    this.encryptInto(KEY_REFRESH, token)
  }

  loadRefreshToken(): string | null {
    return this.decryptFrom(KEY_REFRESH)
  }

  clear(): void {
    this.kv.delete(KEY_TOKEN)
    this.kv.delete(KEY_REFRESH)
  }

  getWindowBounds(): WindowBounds | null {
    return this.kv.get<WindowBounds>(KEY_BOUNDS) ?? null
  }

  setWindowBounds(bounds: WindowBounds): void {
    this.kv.set(KEY_BOUNDS, bounds)
  }

  /** 折叠态（迷你进度环条）标志；默认 false */
  getCollapsed(): boolean {
    return this.kv.get<boolean>(KEY_COLLAPSED) ?? false
  }

  setCollapsed(collapsed: boolean): void {
    this.kv.set(KEY_COLLAPSED, collapsed)
  }

  /** 折叠态窗口位置/尺寸（与展开态分开记忆）；未记忆返回 null */
  getCollapsedBounds(): WindowBounds | null {
    return this.kv.get<WindowBounds>(KEY_COLLAPSED_BOUNDS) ?? null
  }

  setCollapsedBounds(bounds: WindowBounds): void {
    this.kv.set(KEY_COLLAPSED_BOUNDS, bounds)
  }

  /** 已配置的服务器 origin（非敏感，明文存）；未配置返回 null */
  getServerOrigin(): string | null {
    return this.kv.get<string>(KEY_SERVER_ORIGIN) ?? null
  }

  setServerOrigin(origin: string): void {
    this.kv.set(KEY_SERVER_ORIGIN, origin)
  }

  /** 外观配置（非敏感，明文存）；与默认值合并以兼容旧版本/缺字段 */
  getUiPrefs(): UiPrefs {
    const saved = this.kv.get<Partial<UiPrefs>>(KEY_UI_PREFS)
    return { ...DEFAULT_UI_PREFS, ...(saved ?? {}) }
  }

  /** 部分更新外观配置，返回合并后的完整配置 */
  setUiPrefs(patch: Partial<UiPrefs>): UiPrefs {
    const next = { ...this.getUiPrefs(), ...patch }
    this.kv.set(KEY_UI_PREFS, next)
    return next
  }
}
