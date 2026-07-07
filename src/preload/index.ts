import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardSummary, ExposedApi, GroupView, UserUsageSummary } from '../shared/types'
import type { UiPrefs } from '../shared/theme'

// 通过 contextBridge 安全暴露受限 API 给渲染进程（contextIsolation 开启）。
const api: ExposedApi = {
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  refresh: () => ipcRenderer.invoke('accounts:refresh'),
  onAccountsUpdate: (cb: (groups: GroupView[]) => void) => {
    const listener = (_e: unknown, groups: GroupView[]): void => cb(groups)
    ipcRenderer.on('accounts:update', listener)
    return () => ipcRenderer.removeListener('accounts:update', listener)
  },
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  onDashboardUpdate: (cb: (summary: DashboardSummary) => void) => {
    const listener = (_e: unknown, summary: DashboardSummary): void => cb(summary)
    ipcRenderer.on('dashboard:update', listener)
    return () => ipcRenderer.removeListener('dashboard:update', listener)
  },
  getUserUsage: () => ipcRenderer.invoke('users:get'),
  onUserUsageUpdate: (cb: (summary: UserUsageSummary) => void) => {
    const listener = (_e: unknown, summary: UserUsageSummary): void => cb(summary)
    ipcRenderer.on('users:update', listener)
    return () => ipcRenderer.removeListener('users:update', listener)
  },
  isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
  openLogin: () => ipcRenderer.invoke('auth:openLogin'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  getCollapsed: () => ipcRenderer.invoke('window:getCollapsed'),
  setCollapsed: (collapsed: boolean) => ipcRenderer.invoke('window:setCollapsed', collapsed),
  setCollapsedSize: (width: number, height: number) =>
    ipcRenderer.invoke('window:setCollapsedSize', width, height),
  getUiPrefs: () => ipcRenderer.invoke('ui:getPrefs'),
  setUiPrefs: (patch: Partial<UiPrefs>) => ipcRenderer.invoke('ui:setPrefs', patch)
}

contextBridge.exposeInMainWorld('api', api)
