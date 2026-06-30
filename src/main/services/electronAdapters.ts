import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { KeyValueStore, Cipher } from './credentialStore'

// 将 Electron 原生能力适配到 CredentialStore 的注入接口。
// 这一层不写单测（依赖 Electron 运行时），逻辑保持极薄。

const store = new Store({ name: 'sub2api-monitor' })

export const electronKv: KeyValueStore = {
  get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
  set: (key: string, value: unknown): void => store.set(key, value),
  delete: (key: string): void => store.delete(key)
}

export const safeStorageCipher: Cipher = {
  // Windows=DPAPI，macOS=Keychain，Linux=libsecret
  // TODO(macOS): 验证 Keychain 路径下加解密一致
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain: string): string => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (b64: string): string => safeStorage.decryptString(Buffer.from(b64, 'base64'))
}
