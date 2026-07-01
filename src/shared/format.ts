// 展示用纯格式化函数（无 Node/Electron 依赖），主进程与渲染进程共用。

/** 紧凑数字（1 位小数、去尾零）：1200→"1.2k"，5000→"5k"，26871174→"26.9M"，2e9→"2B"，800→"800" */
export function compactNumber(n: number): string {
  const abs = Math.abs(n)
  const fmt = (v: number, suffix: string): string => v.toFixed(1).replace(/\.0$/, '') + suffix
  if (abs >= 1e9) return fmt(n / 1e9, 'B')
  if (abs >= 1e6) return fmt(n / 1e6, 'M')
  if (abs >= 1e3) return fmt(n / 1e3, 'k')
  return String(n)
}

/** token 数紧凑展示（缺失/非数字 → "—"） */
export function formatTokens(n: number | undefined | null): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return compactNumber(n)
}

/** 金额："$32.87"；缺失 → "—" */
export function formatCost(n: number | undefined | null): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return '$' + n.toFixed(2)
}

/** 利用率：0..1 的小数 → "30%"；缺失/非数字 → "—"。四舍五入到整数百分比。 */
export function formatPercent(frac: number | undefined | null): string {
  if (typeof frac !== 'number' || Number.isNaN(frac)) return '—'
  return Math.round(frac * 100) + '%'
}

/** 从带时区的 ISO 串取 "HH:MM"（取字符串中的本地钟点，不做时区换算）。无效返回 null。 */
function hhmm(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : null
}

/** 会话窗口时段："14:00–19:00"；任一缺失 → "—" */
export function formatWindowRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string {
  const a = hhmm(startIso)
  const b = hhmm(endIso)
  if (!a || !b) return '—'
  return `${a}–${b}`
}

/** 从 ISO 字符串的墙上时钟时间回退指定小时数，不做本机时区换算。 */
function hhmmMinusHours(iso: string | null | undefined, hours: number): string | null {
  if (!iso || !Number.isFinite(hours)) return null
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (!m) return null
  const minutesInDay = 24 * 60
  const raw = Number(m[1]) * 60 + Number(m[2]) - Math.round(hours * 60)
  const minutes = ((raw % minutesInDay) + minutesInDay) % minutesInDay
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 只有结束时间时，按固定时长反推窗口："14:00–19:00"；无效 → "—" */
export function formatWindowRangeFromEnd(
  endIso: string | null | undefined,
  durationHours: number
): string {
  const a = hhmmMinusHours(endIso, durationHours)
  const b = hhmm(endIso)
  if (!a || !b) return '—'
  return `${a}–${b}`
}

/** 相对时间："刚刚" / "3分钟前" / "3小时前" / "2天前"；空值 "从未使用" */
export function formatLastUsed(iso: string | null | undefined, now: Date): string {
  if (!iso) return '从未使用'
  const then = new Date(iso).getTime()
  const diffMs = now.getTime() - then
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  const day = Math.floor(hr / 24)
  return `${day}天前`
}
