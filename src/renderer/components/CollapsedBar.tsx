import { forwardRef, useState, type ReactNode } from 'react'
import type { Account } from '../../shared/types'
import { sessionUtilization } from '../../shared/usage'
import { utilizationLevel, levelColorVar, type CollapseStyle } from '../../shared/theme'
import { PlatformChip } from './PlatformIcon'

interface Props {
  /** 已是最近使用的 active 账户（≤5），由 recentActiveAccounts 选出 */
  accounts: Account[]
  /** 折叠迷你条样式：进度环 / 分段条 / 聚光泡 */
  style?: CollapseStyle
  /** 点击展开按钮回调 */
  onExpand: () => void
}

// 派生展示项：会话窗口利用率 0..1 → 分级色 + 百分比
interface Item {
  id: number
  name: string
  platform?: string
  frac: number | undefined
  color: string
  pctNum: number | null
  pctText: string
}

function toItems(accounts: Account[]): Item[] {
  return accounts.map((a) => {
    const frac = sessionUtilization(a.extra)
    const valid = typeof frac === 'number' && !Number.isNaN(frac)
    const pctNum = valid ? Math.round(Math.min(1, Math.max(0, frac)) * 100) : null
    return {
      id: a.id,
      name: a.name,
      platform: a.platform,
      frac,
      color: levelColorVar(utilizationLevel(frac)),
      pctNum,
      pctText: pctNum === null ? '—' : `${pctNum}%`
    }
  })
}

// 折叠态迷你条：三种可切换样式（进度环 / 分段条 / 聚光泡）。
// 拖动：整条背景即拖拽区（无固定手柄），仅交互元素（环/段/圆点/展开钮）为 no-drag。
// 尺寸：按内容自适应（w-max），由 App 测量后通知主进程。
// 提示气泡（tip）为「绝对定位 + 截断」——不进入正常流，悬停切换文案不会改变窗口尺寸，
// 因而不会触发「悬停→尺寸变化→鼠标错位→反复刷新」的抖动回环。
export const CollapsedBar = forwardRef<HTMLDivElement, Props>(function CollapsedBar(
  { accounts, style = 'rings', onExpand },
  ref
) {
  const items = toItems(accounts)
  const [hover, setHover] = useState<number | null>(null)
  const [spotIdx, setSpotIdx] = useState(0)

  const bar = (children: ReactNode): JSX.Element => (
    <div
      className="flex w-max items-center gap-2 rounded-[18px] px-2.5 py-2.5"
      style={{
        background: 'var(--s2a-bg)',
        border: '1px solid var(--s2a-border)',
        // 收敛的阴影（负扩散），配合测量容器的内边距，使窗口贴合内容时阴影不被裁切
        boxShadow: '0 6px 16px -8px var(--s2a-shadow)',
        color: 'var(--s2a-text)'
      }}
    >
      {children}
    </div>
  )

  const expandBtn = (
    <button
      onClick={onExpand}
      title="展开"
      aria-label="展开"
      className="no-drag flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-[13px]"
      style={{ background: 'var(--s2a-logo-bg)', color: 'var(--s2a-accent)' }}
    >
      ⤢
    </button>
  )

  // 外壳：整块 drag-region（任意空白处可拖动窗口）；tip 绝对定位、pointer-events-none、截断。
  const frame = (barChildren: ReactNode, tipText?: string): JSX.Element => (
    <div
      ref={ref}
      className={`drag-region relative inline-flex select-none flex-col items-center p-2 ${
        tipText ? 'pb-7' : ''
      }`}
    >
      {bar(barChildren)}
      {tipText ? (
        <div
          className="pointer-events-none absolute inset-x-2 bottom-1 truncate rounded-full px-3 py-1 text-center text-[11px] font-bold"
          style={{ background: 'var(--s2a-chip-bg)', color: 'var(--s2a-muted)' }}
        >
          {tipText}
        </div>
      ) : null}
    </div>
  )

  // 空态
  if (items.length === 0) {
    return frame(
      <>
        <span className="px-1 text-[11px]" style={{ color: 'var(--s2a-muted)' }}>
          暂无最近使用
        </span>
        {expandBtn}
      </>
    )
  }

  // —— 进度环 ——
  if (style === 'rings') {
    const C = 2 * Math.PI * 13
    const hovered = hover != null ? items[hover] : null
    return frame(
      <>
        <div className="flex items-center gap-[7px]">
          {items.map((it, i) => (
            <div
              key={it.id}
              title={`${it.name} · ${it.pctText}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="no-drag relative h-[30px] w-[30px] cursor-pointer"
            >
              <svg width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="13" fill="none" stroke="var(--s2a-track)" strokeWidth="3.5" />
                <circle
                  cx="15"
                  cy="15"
                  r="13"
                  fill="none"
                  stroke={it.color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${((it.pctNum ?? 0) / 100) * C} ${C}`}
                  transform="rotate(-90 15 15)"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold"
                style={{ color: it.color }}
              >
                {it.pctText === '—' ? '—' : it.pctNum}
              </span>
            </div>
          ))}
        </div>
        {expandBtn}
      </>,
      hovered ? `${hovered.name} · ${hovered.pctText}` : `${items.length} 个账户`
    )
  }

  // —— 分段条 ——
  if (style === 'segments') {
    const hovered = hover != null ? items[hover] : null
    return frame(
      <>
        <div
          className="flex h-3 gap-[3px] overflow-hidden rounded-full"
          style={{ background: 'var(--s2a-track)' }}
        >
          {items.map((it, i) => (
            <div
              key={it.id}
              data-seg
              title={`${it.name} · 会话 ${it.pctText}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="no-drag h-full w-9 cursor-pointer rounded-full"
              style={{ background: it.color }}
            />
          ))}
        </div>
        {expandBtn}
      </>,
      hovered ? `${hovered.name} · 会话 ${hovered.pctText}` : `${items.length} 个账户`
    )
  }

  // —— 聚光泡 ——
  const spot = items[Math.min(spotIdx, items.length - 1)]
  return frame(
    <>
      {/* 图标 + 信息区：展示用（可拖动），不再承担展开点击 */}
      <div className="flex items-center gap-2.5">
        <PlatformChip platform={spot.platform} size={34} glyph={16} radius={11} />
        <span className="block w-[150px]">
          <span className="mb-1 flex items-baseline justify-between">
            <span className="truncate text-[12px] font-extrabold" style={{ color: 'var(--s2a-text)' }}>
              {spot.name}
            </span>
            <span className="text-[12px] font-extrabold" style={{ color: spot.color }}>
              {spot.pctText}
            </span>
          </span>
          <span className="block h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--s2a-track)' }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${spot.pctNum ?? 0}%`, background: spot.color }}
            />
          </span>
        </span>
      </div>
      {/* 圆点切换聚焦账户 */}
      <div className="no-drag flex flex-none flex-col gap-1">
        {items.map((it, i) => (
          <button
            key={it.id}
            onClick={() => setSpotIdx(i)}
            aria-label={`聚焦 ${it.name}`}
            className="h-[9px] w-[9px] rounded-full"
            style={{
              background: it.color,
              outline: i === Math.min(spotIdx, items.length - 1) ? '2px solid var(--s2a-text)' : 'none'
            }}
          />
        ))}
      </div>
      {expandBtn}
    </>,
    '点圆点切换 · ⤢ 展开'
  )
})
