import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccounts } from './hooks/useAccounts'
import { useDashboard } from './hooks/useDashboard'
import { useTheme } from './hooks/useTheme'
import { AccountList } from './components/AccountList'
import { SummaryBar } from './components/SummaryBar'
import { CollapsedBar } from './components/CollapsedBar'
import { SettingsPanel } from './components/SettingsPanel'
import { recentActiveAccounts } from '../shared/select'
import sheepUrl from './assets/sheep.svg'

const MAX_RINGS = 5

// 悬浮窗主界面：展开态=标题栏+汇总条+分组列表（或设置面板）；折叠态=可选样式的迷你条。
export default function App(): JSX.Element {
  const { groups, loading, error, refresh } = useAccounts()
  const summary = useDashboard()
  const { prefs, update } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // 初始折叠态由主进程（持久化）决定，与窗口初始尺寸保持一致
  useEffect(() => {
    window.api.getCollapsed().then(setCollapsed).catch(() => {})
  }, [])

  // 最近使用的 active 账户（≤5），跨分组取
  const recent = useMemo(
    () => recentActiveAccounts(groups.flatMap((g) => g.accounts), MAX_RINGS),
    [groups]
  )
  const recentKey = useMemo(
    () =>
      recent
        .map((a) =>
          [
            a.id,
            a.name,
            a.platform ?? '',
            a.type ?? '',
            a.last_used_at ?? '',
            a.extra?.session_window_utilization ?? '',
            a.extra?.passive_usage_7d_utilization ?? '',
            a.extra?.codex_5h_used_percent ?? '',
            a.extra?.codex_7d_used_percent ?? ''
          ].join(':')
        )
        .join('|'),
    [recent]
  )

  // 折叠态：测量迷你条内容尺寸，通知主进程把窗口收紧到自适应大小
  // 依赖折叠样式：切换样式会改变迷你条尺寸，需重新测量
  useLayoutEffect(() => {
    if (!collapsed) return
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    void window.api.setCollapsedSize(Math.ceil(rect.width), Math.ceil(rect.height))
  }, [collapsed, recentKey, prefs.collapseStyle])

  const toggleCollapsed = (next: boolean): void => {
    setCollapsed(next)
    void window.api.setCollapsed(next)
  }

  if (collapsed) {
    return (
      <CollapsedBar
        key={recentKey}
        ref={barRef}
        accounts={recent}
        style={prefs.collapseStyle}
        onExpand={() => toggleCollapsed(false)}
      />
    )
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[20px]"
      style={{
        background: 'var(--s2a-bg)',
        border: '1px solid var(--s2a-border)',
        boxShadow: '0 16px 36px -12px var(--s2a-shadow)',
        color: 'var(--s2a-text)'
      }}
    >
      <header className="drag-region flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-[9px]"
            style={{ background: 'var(--s2a-logo-bg)' }}
          >
            <img src={sheepUrl} alt="" className="h-5 w-5" />
          </span>
          <span className="text-[14px] font-extrabold">
            Sub2API <span className="text-[11px] font-semibold" style={{ color: 'var(--s2a-muted)' }}>Monitor</span>
          </span>
        </div>
        <div className="no-drag flex items-center gap-1">
          <IconButton
            title="外观设置"
            active={showSettings}
            onClick={() => setShowSettings((s) => !s)}
          >
            ⚙
          </IconButton>
          <IconButton title="刷新" onClick={refresh}>
            {loading ? '…' : '⟳'}
          </IconButton>
          <IconButton title="折叠" onClick={() => toggleCollapsed(true)}>
            ⊟
          </IconButton>
          <IconButton title="隐藏" onClick={() => window.api.hideWindow()}>
            ✕
          </IconButton>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel prefs={prefs} onChange={update} />
      ) : (
        <>
          <SummaryBar summary={summary} />
          {error ? (
            <div
              className="no-drag flex flex-1 items-center justify-center px-4 text-center text-xs"
              style={{ color: 'var(--s2a-high)' }}
            >
              {error}
            </div>
          ) : loading && groups.length === 0 ? (
            <div
              className="no-drag flex flex-1 items-center justify-center text-sm"
              style={{ color: 'var(--s2a-muted)' }}
            >
              加载中…
            </div>
          ) : (
            <AccountList groups={groups} />
          )}
        </>
      )}
    </div>
  )
}

function IconButton({
  title,
  active,
  onClick,
  children
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-[27px] w-[27px] items-center justify-center rounded-[9px] text-[13px]"
      style={{
        background: active ? 'var(--s2a-chip-bg)' : 'transparent',
        color: active ? 'var(--s2a-accent)' : 'var(--s2a-muted)'
      }}
    >
      {children}
    </button>
  )
}
