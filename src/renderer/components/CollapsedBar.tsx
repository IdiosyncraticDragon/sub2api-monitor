import { forwardRef, useState, type ReactNode } from 'react'
import type { Account } from '../../shared/types'
import { sessionUtilization, weeklyUtilization } from '../../shared/usage'
import { utilizationLevel, levelColorVar, type CollapseStyle } from '../../shared/theme'
import { PlatformChip } from './PlatformIcon'

interface Props {
  /** 已是最近使用的 active 账户（≤5），由 recentActiveAccounts 选出 */
  accounts: Account[]
  /** 当前完整 active 账户数；折叠态只展示最多 5 个，但默认计数需与展开态一致 */
  activeCount?: number
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
  session: UsageMetric
  weekly: UsageMetric
}

interface UsageMetric {
  frac: number | undefined
  color: string
  pctNum: number | null
  pctText: string
}

function metric(frac: number | undefined): UsageMetric {
  const valid = typeof frac === 'number' && !Number.isNaN(frac)
  const pctNum = valid ? Math.round(Math.min(1, Math.max(0, frac)) * 100) : null
  return {
    frac,
    color: levelColorVar(utilizationLevel(frac)),
    pctNum,
    pctText: pctNum === null ? '—' : `${pctNum}%`
  }
}

function toItems(accounts: Account[]): Item[] {
  return accounts.map((a) => {
    return {
      id: a.id,
      name: a.name,
      platform: a.platform,
      session: metric(sessionUtilization(a)),
      weekly: metric(weeklyUtilization(a))
    }
  })
}

const itemTitle = (it: Item): string =>
  `${it.name} · 5h ${it.session.pctText} · 7日 ${it.weekly.pctText}`

const dash = (pctNum: number | null, circumference: number): string =>
  `${((pctNum ?? 0) / 100) * circumference} ${circumference}`

// 折叠态迷你条：三种可切换样式（进度环 / 分段条 / 聚光泡）。
// 拖动：整条背景即拖拽区（无固定手柄），仅交互元素（环/段/圆点/展开钮）为 no-drag。
// 尺寸：按内容自适应（w-max），由 App 测量后通知主进程。
// 提示气泡（tip）为「绝对定位 + 截断」——不进入正常流，悬停切换文案不会改变窗口尺寸，
// 因而不会触发「悬停→尺寸变化→鼠标错位→反复刷新」的抖动回环。
export const CollapsedBar = forwardRef<HTMLDivElement, Props>(function CollapsedBar(
  { accounts, activeCount, style = 'rings', onExpand },
  ref
) {
  const items = toItems(accounts)
  const countText = `当前${activeCount ?? items.length}个active帐户`
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
    const OUTER_C = 2 * Math.PI * 14
    const INNER_C = 2 * Math.PI * 9.5
    const hovered = hover != null ? items[hover] : null
    return frame(
      <>
        <div className="flex items-center gap-[7px]">
          {items.map((it, i) => (
            <div
              key={it.id}
              title={itemTitle(it)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="no-drag relative h-[34px] w-[34px] cursor-pointer"
            >
              <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
                <circle cx="17" cy="17" r="14" fill="none" stroke="var(--s2a-track)" strokeWidth="3" />
                <circle
                  data-weekly-ring
                  cx="17"
                  cy="17"
                  r="14"
                  fill="none"
                  stroke={it.weekly.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={dash(it.weekly.pctNum, OUTER_C)}
                  transform="rotate(-90 17 17)"
                />
                <circle cx="17" cy="17" r="9.5" fill="none" stroke="var(--s2a-track)" strokeWidth="3" />
                <circle
                  data-session-ring
                  cx="17"
                  cy="17"
                  r="9.5"
                  fill="none"
                  stroke={it.session.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={dash(it.session.pctNum, INNER_C)}
                  transform="rotate(-90 17 17)"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold"
                style={{ color: it.session.color }}
              >
                {it.session.pctText === '—' ? '—' : it.session.pctNum}
              </span>
            </div>
          ))}
        </div>
        {expandBtn}
      </>,
      hovered ? itemTitle(hovered) : countText
    )
  }

  // —— 分段条 ——
  if (style === 'segments') {
    const hovered = hover != null ? items[hover] : null
    return frame(
      <>
        <div className="flex items-center gap-[4px]">
          {items.map((it, i) => (
            <div
              key={it.id}
              data-seg
              title={itemTitle(it)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="no-drag flex h-[17px] w-10 cursor-pointer flex-col justify-end gap-[3px]"
            >
              <span className="block h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--s2a-track)' }}>
                <span
                  data-session-bar
                  className="block h-full rounded-full"
                  style={{ width: `${it.session.pctNum ?? 0}%`, background: it.session.color }}
                />
              </span>
              <span className="block h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--s2a-track)' }}>
                <span
                  data-weekly-bar
                  className="block h-full rounded-full"
                  style={{ width: `${it.weekly.pctNum ?? 0}%`, background: it.weekly.color }}
                />
              </span>
            </div>
          ))}
        </div>
        {expandBtn}
      </>,
      hovered ? itemTitle(hovered) : countText
    )
  }

  // —— 聚光泡 ——
  const spot = items[Math.min(spotIdx, items.length - 1)]
  return frame(
    <>
      {/* 图标 + 信息区：展示用（可拖动），不再承担展开点击 */}
      <div className="flex items-center gap-2.5">
        <div className="relative h-[38px] w-[38px] flex-none">
          <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
            <circle cx="19" cy="19" r="17" fill="none" stroke="var(--s2a-track)" strokeWidth="3" />
            <circle
              data-spot-weekly-ring
              cx="19"
              cy="19"
              r="17"
              fill="none"
              stroke={spot.weekly.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={dash(spot.weekly.pctNum, 2 * Math.PI * 17)}
              transform="rotate(-90 19 19)"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center">
            <PlatformChip platform={spot.platform} size={28} glyph={14} radius={9} />
          </span>
        </div>
        <span className="block w-[150px]">
          <span className="mb-1 flex items-baseline justify-between">
            <span className="truncate text-[12px] font-extrabold" style={{ color: 'var(--s2a-text)' }}>
              {spot.name}
            </span>
            <span className="text-[12px] font-extrabold" style={{ color: spot.session.color }}>
              {spot.session.pctText}
            </span>
          </span>
          <span className="block h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--s2a-track)' }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${spot.session.pctNum ?? 0}%`, background: spot.session.color }}
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
              background: it.session.color,
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
