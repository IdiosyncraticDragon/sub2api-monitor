import { BrowserWindow } from 'electron'
import { extractToken, findRefreshToken, findUsableAccessToken, type StorageEntry } from '../core/jwt'

const POLL_INTERVAL_MS = 1500

export interface LoginResult {
  token: string
  refreshToken: string | null
}

export interface LoginWindowOptions {
  clearStaleCredentials?: boolean
  now?: () => Date
}

// 登录窗：加载（可配置的）站点让用户登录一次，轮询读取存储中的凭证。
// 用户在此窗口内完成登录（Electron 会话独立于系统 Chrome），成功后提取 JWT。
export function openLoginWindow(
  siteUrl: string,
  onSuccess: (result: LoginResult) => void,
  options: LoginWindowOptions = {}
): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    title: 'Sub2API 登录',
    autoHideMenuBar: true,
    webPreferences: {
      // 登录窗加载第三方站点，保持隔离、不暴露 preload API
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:sub2api' // 持久化会话，便于后续免重复登录
    }
  })

  let timer: NodeJS.Timeout | null = null
  let settled = false
  let staleCleared = false
  const now = options.now ?? (() => new Date())

  const stop = (): void => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const clearStorage = async (): Promise<void> => {
    if (staleCleared || !options.clearStaleCredentials || win.isDestroyed()) return
    staleCleared = true
    try {
      await win.webContents.executeJavaScript(
        `(function () {
           var jwtRe = /eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+/
           function removeJwtEntries(store) {
             try {
               var keys = []
               for (var i = 0; i < store.length; i++) {
                 var key = store.key(i)
                 var value = key ? store.getItem(key) : null
                 if (key && jwtRe.test(String(value || ''))) keys.push(key)
               }
               for (var j = 0; j < keys.length; j++) store.removeItem(keys[j])
             } catch (e) {}
           }
           removeJwtEntries(window.localStorage)
           removeJwtEntries(window.sessionStorage)
         })()`,
        true
      )
      if (!win.isDestroyed()) await win.loadURL(siteUrl)
    } catch {
      // Storage may be unavailable while the page is still navigating.
    }
  }

  // 站点改版后 JWT 不再固定存于 localStorage.auth_token，故全量 dump
  // localStorage + sessionStorage，交由 core 扫描出 eyJ… 形态的 JWT。
  const readCredentials = async (): Promise<void> => {
    if (settled || win.isDestroyed()) return
    try {
      const raw = (await win.webContents.executeJavaScript(
        `(function () {
           function dump(store) {
             var out = []
             try {
               for (var i = 0; i < store.length; i++) {
                 var k = store.key(i)
                 out.push({ key: k, value: store.getItem(k) })
               }
             } catch (e) { /* 存储不可用 */ }
             return out
           }
           // localStorage 优先于 sessionStorage
           return JSON.stringify(
             dump(window.localStorage).concat(dump(window.sessionStorage))
           )
         })()`,
        true
      )) as string
      const entries = JSON.parse(raw) as StorageEntry[]
      const token = extractToken(findUsableAccessToken(entries, now()))
      if (token) {
        settled = true
        stop()
        onSuccess({ token, refreshToken: extractToken(findRefreshToken(entries)) })
        if (!win.isDestroyed()) win.close()
        return
      }
      if (entries.some((entry) => entry.value?.includes('eyJ'))) await clearStorage()
    } catch {
      // 页面未就绪 / 跨域读取异常，下个周期重试
    }
  }

  win.loadURL(siteUrl)

  win.webContents.on('did-finish-load', () => {
    void readCredentials()
  })
  timer = setInterval(() => void readCredentials(), POLL_INTERVAL_MS)

  win.on('closed', stop)
  return win
}
