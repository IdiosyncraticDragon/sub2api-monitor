import { describe, it, expect, beforeEach } from 'vitest'
import { CredentialStore, type KeyValueStore, type Cipher } from './credentialStore'

// 内存版 KV 替身
function fakeKv(): KeyValueStore & { _data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    _data: data,
    get<T>(key: string): T | undefined {
      return data.get(key) as T | undefined
    },
    set(key: string, value: unknown): void {
      data.set(key, value)
    },
    delete(key: string): void {
      data.delete(key)
    }
  }
}

// 可控的加密替身：encrypt 加前缀模拟密文，decrypt 去前缀
function fakeCipher(available = true): Cipher {
  return {
    isAvailable: () => available,
    encrypt: (plain: string) => `enc(${plain})`,
    decrypt: (b64: string) => {
      const m = /^enc\((.*)\)$/.exec(b64)
      if (!m) throw new Error('decrypt failed')
      return m[1]
    }
  }
}

describe('CredentialStore', () => {
  let kv: ReturnType<typeof fakeKv>
  beforeEach(() => {
    kv = fakeKv()
  })

  it('saveToken 经 cipher.encrypt 后再落盘（不直接写原始 token）', () => {
    const store = new CredentialStore(kv, fakeCipher())
    store.saveToken('jwt.abc.sig')
    const stored = kv._data.get('auth.token')
    // 存储值是 cipher 输出，而非原始明文本身
    expect(stored).toBe('enc(jwt.abc.sig)')
    expect(stored).not.toBe('jwt.abc.sig')
  })

  it('loadToken 解密还原', () => {
    const store = new CredentialStore(kv, fakeCipher())
    store.saveToken('jwt.abc.sig')
    expect(store.loadToken()).toBe('jwt.abc.sig')
  })

  it('未存储时 loadToken 返回 null', () => {
    const store = new CredentialStore(kv, fakeCipher())
    expect(store.loadToken()).toBeNull()
  })

  it('密文损坏时 loadToken 返回 null（容错）', () => {
    const store = new CredentialStore(kv, fakeCipher())
    kv.set('auth.token', 'corrupted-not-enc')
    expect(store.loadToken()).toBeNull()
  })

  it('加密不可用时 saveToken 抛错（拒绝明文落盘）', () => {
    const store = new CredentialStore(kv, fakeCipher(false))
    expect(() => store.saveToken('x')).toThrow(/加密不可用/)
  })

  it('refresh token 独立存取', () => {
    const store = new CredentialStore(kv, fakeCipher())
    store.saveRefreshToken('refresh.xyz')
    expect(store.loadRefreshToken()).toBe('refresh.xyz')
  })

  it('clear 清除全部凭证', () => {
    const store = new CredentialStore(kv, fakeCipher())
    store.saveToken('a')
    store.saveRefreshToken('b')
    store.clear()
    expect(store.loadToken()).toBeNull()
    expect(store.loadRefreshToken()).toBeNull()
  })

  it('窗口 bounds 明文存取（非敏感）', () => {
    const store = new CredentialStore(kv, fakeCipher())
    expect(store.getWindowBounds()).toBeNull()
    store.setWindowBounds({ x: 10, y: 20, width: 320, height: 480 })
    expect(store.getWindowBounds()).toEqual({ x: 10, y: 20, width: 320, height: 480 })
  })

  it('UI 外观配置：未存储时返回默认', () => {
    const store = new CredentialStore(kv, fakeCipher())
    expect(store.getUiPrefs()).toEqual({
      theme: 'clay',
      appearance: 'light',
      collapseStyle: 'rings'
    })
  })

  it('UI 外观配置：部分更新与默认合并，返回完整配置', () => {
    const store = new CredentialStore(kv, fakeCipher())
    const next = store.setUiPrefs({ theme: 'latte', appearance: 'dark' })
    expect(next).toEqual({ theme: 'latte', appearance: 'dark', collapseStyle: 'rings' })
    // 再次部分更新不丢失已存字段
    store.setUiPrefs({ collapseStyle: 'spotlight' })
    expect(store.getUiPrefs()).toEqual({
      theme: 'latte',
      appearance: 'dark',
      collapseStyle: 'spotlight'
    })
  })
})
