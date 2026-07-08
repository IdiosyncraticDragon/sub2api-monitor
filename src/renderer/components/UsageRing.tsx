import type { ReactNode } from 'react'
import { levelColorVar, utilizationLevel } from '../../shared/theme'

interface Props {
  frac: number | undefined
  size?: number
  radius?: number
  stroke?: number
  title?: string
  ariaLabel?: string
  className?: string
  progressDataAttr?: string
  children?: ReactNode
}

function pctNum(frac: number | undefined): number | null {
  const valid = typeof frac === 'number' && !Number.isNaN(frac)
  return valid ? Math.round(Math.min(1, Math.max(0, frac)) * 100) : null
}

export function UsageRing({
  frac,
  size = 38,
  radius = 17,
  stroke = 3,
  title,
  ariaLabel,
  className,
  progressDataAttr = 'data-usage-ring',
  children
}: Props): JSX.Element {
  const pct = pctNum(frac)
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const color = levelColorVar(utilizationLevel(frac))
  const progressData = { [progressDataAttr]: true }

  return (
    <span
      title={title}
      aria-label={ariaLabel}
      className={['relative flex flex-none items-center justify-center', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    >
      <svg className="absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--s2a-track)" strokeWidth={stroke} />
        <circle
          {...progressData}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${((pct ?? 0) / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {children ? <span className="absolute inset-0 flex items-center justify-center">{children}</span> : null}
    </span>
  )
}
