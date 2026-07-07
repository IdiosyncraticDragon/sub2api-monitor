import { app, BrowserWindow, ipcMain, shell, Tray } from 'electron'
import { join } from 'path'
import { CredentialStore } from './services/credentialStore'
import { AuthService } from './services/auth'
import { ApiService, HttpError } from './services/api'
import { PollService } from './services/poll'
import { electronKv, safeStorageCipher } from './services/electronAdapters'
import { openLoginWindow } from './windows/login'
import { openSetupWindow } from './windows/setup'
import { createTray, setTrayUsage } from './tray'
import { groupByGroup, latestActiveAccount } from './core/transform'
import { apiBaseFrom, loginUrlFrom, normalizeOrigin } from './core/config'
import { formatLastUsed, formatPercent } from '../shared/format'
import { primaryUsage, sessionWindowRange } from '../shared/usage'
import type {
  Account,
  DashboardStats,
  DashboardSummary,
  GroupView,
  UserUsageSummary
} from '../shared/types'

const POLL_INTERVAL_MS = 30_000
const POLL_MAX_BACKOFF_MS = 120_000
// 折叠态迷你条尺寸（横排 ≤5 进度环 + 展开按钮）
const COLLAPSED_SIZE = { width: 300, height: 84 }
const EXPANDED_DEFAULT = { width: 320, height: 480 }

// ---- 服务装配（DI）----
const credentialStore = new CredentialStore(electronKv, safeStorageCipher)
// 服务器地址：环境变量优先（dev/CI），否则取设置窗保存的配置。
const envOrigin = normalizeOrigin(process.env['SUB2API_ORIGIN'])
const resolveOrigin = (): string | null => envOrigin ?? credentialStore.getServerOrigin()
const auth = new AuthService(credentialStore)
const api = new ApiService({
  // 动态 base：服务器地址可在运行时通过设置窗变更
  baseUrl: () => {
    const o = resolveOrigin()
    return o ? apiBaseFrom(o) : ''
  },
  fetchFn: (...args) => fetch(...args), // Electron(Node20) 内置 fetch
  getToken: () => auth.getToken()
})

let floatWindow: BrowserWindow | null = null
let loginWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let isCollapsed = credentialStore.getCollapsed()
let latestGroups: GroupView[] = []
let latestDashboard: DashboardSummary | null = null
let latestUserUsage: UserUsageSummary | null = null

// 一轮轮询的快照：分组视图 + 今日汇总 + 用户监控 + 最近使用账户（后者仅供托盘）。
interface Snapshot {
  groups: GroupView[]
  dashboard: DashboardSummary | null
  userUsage: UserUsageSummary | null
  latest: Account | null
}

const toSummary = (s: DashboardStats): DashboardSummary => ({
  todayTokens: s.today_tokens,
  todayRequests: s.today_requests,
  todayCost: s.today_cost,
  normalAccounts: s.normal_accounts,
  totalAccounts: s.total_accounts
})

// 由最近使用账户生成托盘显示：菜单栏显会话利用率%，tooltip 显账户/会话/时段/最近使用。
const trayUsageFromAccount = (a: Account | null): { title: string; tooltip: string } => {
  if (!a) return { title: '', tooltip: 'Sub2API Monitor' }
  const usage = primaryUsage(a)
  const pct = formatPercent(usage.frac)
  const range = sessionWindowRange(a)
  const group = a.groups?.[0]?.name
  const last = formatLastUsed(a.last_used_at, new Date())
  const label = usage.kind === 'weekly' ? '7日' : '会话'
  const tooltip =
    `${group ? group + ' · ' : ''}${a.name}\n` +
    `${label} ${pct}${usage.kind === 'session' && range !== '—' ? ` (${range})` : ''}\n` +
    `最近 ${last}`
  return { title: pct === '—' ? '' : pct, tooltip }
}

// 拉取一轮快照：账户与今日汇总并行；汇总失败不影响账户展示（账户的 401 仍会触发重登）。
const fetchSnapshot = async (): Promise<Snapshot> => {
  const optional = async <T,>(work: Promise<T>): Promise<T | null> => {
    try {
      return await work
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) throw err
      return null
    }
  }
  const [accounts, stats, userUsage] = await Promise.all([
    api.getActiveAccounts(),
    optional(api.getDashboardStats()),
    optional(api.getTodayUserUsage())
  ])
  return {
    groups: groupByGroup(accounts),
    dashboard: stats ? toSummary(stats) : null,
    userUsage,
    latest: latestActiveAccount(accounts)
  }
}

const poll = new PollService<Snapshot>({
  intervalMs: POLL_INTERVAL_MS,
  maxBackoffMs: POLL_MAX_BACKOFF_MS,
  fetcher: fetchSnapshot,
  onData: (snap) => {
    latestGroups = snap.groups
    if (snap.dashboard) latestDashboard = snap.dashboard
    if (snap.userUsage) latestUserUsage = snap.userUsage
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.webContents.send('accounts:update', snap.groups)
      if (snap.dashboard) floatWindow.webContents.send('dashboard:update', snap.dashboard)
      if (snap.userUsage) floatWindow.webContents.send('users:update', snap.userUsage)
    }
    if (tray) setTrayUsage(tray, trayUsageFromAccount(snap.latest))
  },
  onError: (err) => {
    // 401：凭证失效，清除并重新登录
    if (err instanceof HttpError && err.status === 401) {
      poll.stop()
      auth.clear()
      clearSnapshotCache()
      showLogin({ clearStaleCredentials: true })
    }
  }
})

function createFloatWindow(): void {
  const expanded = credentialStore.getWindowBounds()
  const collapsedB = credentialStore.getCollapsedBounds()
  // 初始尺寸/位置按持久化的折叠态决定（折叠态与展开态各记一套）
  const initial = isCollapsed
    ? {
        // 折叠态尺寸自适应内容：优先用上次测量并持久化的尺寸，避免首帧按固定值闪一下
        width: collapsedB?.width ?? COLLAPSED_SIZE.width,
        height: collapsedB?.height ?? COLLAPSED_SIZE.height,
        x: collapsedB?.x ?? expanded?.x,
        y: collapsedB?.y ?? expanded?.y
      }
    : {
        width: expanded?.width ?? EXPANDED_DEFAULT.width,
        height: expanded?.height ?? EXPANDED_DEFAULT.height,
        x: expanded?.x,
        y: expanded?.y
      }
  floatWindow = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    x: initial.x,
    y: initial.y,
    show: false,
    frame: false,
    transparent: true,
    resizable: !isCollapsed,
    alwaysOnTop: true,
    skipTaskbar: true,
    // macOS 启用毛玻璃（vibrancy）；Windows 忽略此项，仍用 transparent 背景。
    ...(process.platform === 'darwin'
      ? { vibrancy: 'under-window' as const, visualEffectState: 'active' as const }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // 折叠态窗口很小/常被遮挡，默认的后台节流会推迟渲染器对 accounts:update /
      // dashboard:update 的重绘，导致折叠迷你条停在旧值（展开唤醒后才 flush）。关闭节流。
      backgroundThrottling: false
    }
  })

  floatWindow.on('ready-to-show', () => floatWindow?.show())

  // 关闭按钮/Cmd+W 不退出，隐藏到托盘；真正退出走托盘菜单或 before-quit。
  floatWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      floatWindow?.hide()
    }
  })

  // 折叠态与展开态各自记忆 bounds，互不覆盖
  const persistBounds = (): void => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      const b = floatWindow.getBounds()
      if (isCollapsed) credentialStore.setCollapsedBounds(b)
      else credentialStore.setWindowBounds(b)
    }
  }
  floatWindow.on('moved', persistBounds)
  floatWindow.on('resized', persistBounds)

  floatWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    floatWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    floatWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startPolling(): void {
  if (auth.isAuthenticated()) poll.start()
}

function clearSnapshotCache(): void {
  latestGroups = []
  latestDashboard = null
  latestUserUsage = null
  if (tray) setTrayUsage(tray, { title: '', tooltip: 'Sub2API Monitor' })
}

function showSetup(): void {
  poll.stop()
  openSetupWindow(resolveOrigin(), (origin) => {
    credentialStore.setServerOrigin(origin)
    auth.clear()
    clearSnapshotCache()
    showLogin()
  })
}

function showLogin(options: { clearStaleCredentials?: boolean } = {}): void {
  const origin = resolveOrigin()
  if (!origin) {
    showSetup()
    return
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    if (options.clearStaleCredentials) {
      loginWindow.close()
      loginWindow = null
    } else {
      if (loginWindow.isMinimized()) loginWindow.restore()
      loginWindow.show()
      loginWindow.focus()
      return
    }
  }

  const win = openLoginWindow(loginUrlFrom(origin), (result) => {
    auth.setTokens(result.token, result.refreshToken ?? undefined)
    if (loginWindow === win) loginWindow = null
    if (!floatWindow || floatWindow.isDestroyed()) createFloatWindow()
    else floatWindow.show()
    poll.start() // 登录成功后开始轮询
  }, options)
  loginWindow = win
  win.on('closed', () => {
    if (loginWindow === win) loginWindow = null
  })
}

function toggleWindow(): void {
  if (!floatWindow || floatWindow.isDestroyed()) {
    createFloatWindow()
    return
  }
  if (floatWindow.isVisible()) floatWindow.hide()
  else floatWindow.show()
}

// 折叠/展开：缩放悬浮窗并持久化，锚定左上角；折叠态与展开态尺寸各自记忆。
// 注意：必须在 setBounds 前翻转 isCollapsed，否则 setBounds 触发的 resized 事件
// 会把新尺寸写到错误的 bounds 键（persistBounds 按 isCollapsed 路由）。
function applyCollapsed(collapsed: boolean): void {
  const win = floatWindow
  if (win && !win.isDestroyed()) {
    const cur = win.getBounds()
    if (collapsed) {
      credentialStore.setWindowBounds(cur) // 先记住当前展开态
      const cb = credentialStore.getCollapsedBounds()
      isCollapsed = true
      win.setResizable(false)
      // 优先用上次测量持久化的折叠尺寸；渲染层随后会按当前内容再测量收紧
      win.setBounds({
        x: cb?.x ?? cur.x,
        y: cb?.y ?? cur.y,
        width: cb?.width ?? COLLAPSED_SIZE.width,
        height: cb?.height ?? COLLAPSED_SIZE.height
      })
    } else {
      credentialStore.setCollapsedBounds(cur) // 先记住当前折叠态位置
      isCollapsed = false
      win.setResizable(true)
      win.setBounds(credentialStore.getWindowBounds() ?? { x: cur.x, y: cur.y, ...EXPANDED_DEFAULT })
    }
  } else {
    isCollapsed = collapsed
  }
  credentialStore.setCollapsed(collapsed)
}

function setupTray(): void {
  if (tray) return
  tray = createTray({
    onToggleWindow: toggleWindow,
    onRefresh: () => void poll.refreshNow(),
    onSetupServer: showSetup,
    isAutoLaunch: () => app.getLoginItemSettings().openAtLogin,
    setAutoLaunch: (enabled) => {
      // openAsHidden 让 macOS 开机后台静默启动（不抢焦点）；Windows 忽略该项。
      app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled })
    },
    onQuit: () => {
      isQuitting = true
      app.quit()
    }
  })
}

function boot(): void {
  createFloatWindow()
  setupTray()
  if (!resolveOrigin()) showSetup()
  else if (auth.isAuthenticated()) startPolling()
  else showLogin({ clearStaleCredentials: !!auth.getToken() })
}

// ---- IPC ----
ipcMain.handle('auth:isAuthenticated', () => auth.isAuthenticated())
ipcMain.handle('auth:openLogin', () => showLogin())
ipcMain.handle('window:hide', () => floatWindow?.hide())
ipcMain.handle('window:getCollapsed', () => isCollapsed)
ipcMain.handle('window:setCollapsed', (_e, collapsed: boolean) => applyCollapsed(!!collapsed))
ipcMain.handle('window:setCollapsedSize', (_e, width: number, height: number) => {
  if (!isCollapsed) return
  const win = floatWindow
  if (!win || win.isDestroyed()) return
  const cur = win.getBounds()
  win.setBounds({
    x: cur.x,
    y: cur.y,
    width: Math.max(80, Math.round(width)),
    height: Math.max(44, Math.round(height))
  })
})
ipcMain.handle('accounts:get', async () => {
  // 有缓存先返回缓存；否则即时拉取一轮快照（同时填充汇总缓存）
  if (latestGroups.length > 0) return latestGroups
  if (!auth.isAuthenticated()) return []
  const snap = await fetchSnapshot()
  latestGroups = snap.groups
  if (snap.dashboard) latestDashboard = snap.dashboard
  if (snap.userUsage) latestUserUsage = snap.userUsage
  return latestGroups
})
ipcMain.handle('accounts:refresh', async () => {
  await poll.refreshNow()
  return latestGroups
})
ipcMain.handle('dashboard:get', async () => {
  if (latestDashboard) return latestDashboard
  if (!auth.isAuthenticated()) return null
  const snap = await fetchSnapshot()
  latestGroups = snap.groups
  latestDashboard = snap.dashboard
  latestUserUsage = snap.userUsage
  return latestDashboard
})
ipcMain.handle('users:get', async () => {
  if (latestUserUsage) return latestUserUsage
  if (!auth.isAuthenticated()) return null
  const snap = await fetchSnapshot()
  latestGroups = snap.groups
  if (snap.dashboard) latestDashboard = snap.dashboard
  latestUserUsage = snap.userUsage
  return latestUserUsage
})
ipcMain.handle('ui:getPrefs', () => credentialStore.getUiPrefs())
ipcMain.handle('ui:setPrefs', (_e, patch) => credentialStore.setUiPrefs(patch))

app.whenReady().then(() => {
  // macOS：纯菜单栏应用，隐藏 dock 图标（对应 Windows 的 skipTaskbar）。
  if (process.platform === 'darwin') app.dock?.hide()
  boot()
  // dock 隐藏后 activate 基本不会触发；保留以兼容显式重新激活的场景。
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) boot()
    else floatWindow?.show()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

// 常驻托盘：窗口全部隐藏/关闭时不退出（退出走托盘菜单）。
app.on('window-all-closed', () => {
  // 保持托盘常驻，不在此退出。
})
