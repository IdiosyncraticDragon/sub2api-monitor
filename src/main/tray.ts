import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'

export interface TrayDeps {
  onToggleWindow: () => void
  onRefresh: () => void
  onSetupServer: () => void
  isAutoLaunch: () => boolean
  setAutoLaunch: (enabled: boolean) => void
  onQuit: () => void
}

const isMac = process.platform === 'darwin'

function resolveIconPath(): string {
  // macOS 用黑白 Template 图（随明暗菜单栏反色）；其余平台用彩色图。
  // @2x 变体（trayTemplate@2x.png）与主文件同目录，nativeImage 会按文件名自动加载。
  const file = isMac ? 'trayTemplate.png' : 'tray.png'
  // 打包后图标经 extraResources 落到 resourcesPath；开发期取项目 build/ 下生成的图标。
  return app.isPackaged
    ? join(process.resourcesPath, file)
    : join(app.getAppPath(), 'build', file)
}

// 系统托盘：右键菜单含显示/隐藏、刷新、开机自启、退出。
// Windows 单击切换窗口；macOS 单击直接弹出菜单（系统默认行为）。
export function createTray(deps: TrayDeps): Tray {
  const icon = nativeImage.createFromPath(resolveIconPath())
  if (isMac) icon.setTemplateImage(true) // 启用 macOS 模板图自动反色
  const tray = new Tray(icon)
  tray.setToolTip('Sub2API Monitor')

  const rebuildMenu = (): void => {
    const menu = Menu.buildFromTemplate([
      { label: '显示/隐藏', click: deps.onToggleWindow },
      { label: '刷新', click: deps.onRefresh },
      { label: '设置服务器', click: deps.onSetupServer },
      { type: 'separator' },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: deps.isAutoLaunch(),
        click: (item) => {
          deps.setAutoLaunch(item.checked)
          rebuildMenu()
        }
      },
      { type: 'separator' },
      { label: '退出', click: deps.onQuit }
    ])
    tray.setContextMenu(menu)
  }

  rebuildMenu()
  // macOS 设了 context menu 后单击即弹菜单，无需再绑 click；Windows 单击切换窗口。
  if (!isMac) tray.on('click', deps.onToggleWindow)
  return tray
}

/** 托盘用量展示：title 为菜单栏文字（仅 macOS 生效，如 "30%"），tooltip 为悬停详情。 */
export interface TrayUsage {
  title: string
  tooltip: string
}

/** 更新托盘的用量显示（最近使用账户的会话窗口利用率等）。 */
export function setTrayUsage(tray: Tray, usage: TrayUsage): void {
  // setTitle 仅 macOS 在菜单栏图标旁显示文字；Windows 无此 API，仅用 tooltip。
  if (isMac) tray.setTitle(usage.title ? ` ${usage.title}` : '')
  tray.setToolTip(usage.tooltip || 'Sub2API Monitor')
}
