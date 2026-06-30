import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_UI_PREFS, type UiPrefs } from '../../shared/theme'

// 读取/应用/写回外观配置（主题 / 明暗 / 折叠样式）。
// 配色实体在 globals.css 的 CSS 变量里，这里只切换 <html> 上的 data-theme / data-mode，
// 并把变更写回主进程持久化（electron-store）。

function applyPrefs(prefs: UiPrefs): void {
  const el = document.documentElement
  el.dataset.theme = prefs.theme
  el.dataset.mode = prefs.appearance
  // 让原生滚动条/控件跟随「显式」选择的明暗（而非系统），与主题一致
  el.style.colorScheme = prefs.appearance
}

export interface UseTheme {
  prefs: UiPrefs
  /** 部分更新：即时应用 + 持久化（乐观更新，失败忽略） */
  update: (patch: Partial<UiPrefs>) => void
}

export function useTheme(): UseTheme {
  const [prefs, setPrefs] = useState<UiPrefs>(DEFAULT_UI_PREFS)

  useEffect(() => {
    let mounted = true
    window.api
      .getUiPrefs()
      .then((p) => {
        if (!mounted) return
        setPrefs(p)
        applyPrefs(p)
      })
      .catch(() => {
        /* 读取失败保持默认（index.html 已设默认属性，首帧不闪） */
      })
    return () => {
      mounted = false
    }
  }, [])

  const update = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      applyPrefs(next) // 立即生效，无需等 IPC 往返
      return next
    })
    void window.api.setUiPrefs(patch).catch(() => {})
  }, [])

  return { prefs, update }
}
