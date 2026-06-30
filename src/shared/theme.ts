// 外观主题模型（纯数据/纯函数，跨进程共用，无 Electron/DOM 依赖）。
// 三套暖色主题 × 明暗两态，配色实体（CSS 变量）落在 renderer/styles/globals.css；
// 这里只保留「选择器需要的元数据」（标签、色样）与「用量分级」逻辑。

/** 主题键：陶土 / 拿铁 / 沙砾鼠尾草 */
export type ThemeKey = 'clay' | 'latte' | 'sandSage'
/** 外观：浅色 / 深色（按产品决定，不提供「跟随系统」） */
export type Appearance = 'light' | 'dark'
/** 折叠迷你条样式：进度环 / 分段条 / 聚光泡 */
export type CollapseStyle = 'rings' | 'segments' | 'spotlight'

/** 外观配置（持久化于 electron-store，键 ui.prefs） */
export interface UiPrefs {
  theme: ThemeKey
  appearance: Appearance
  collapseStyle: CollapseStyle
}

/** 默认外观：陶土 + 浅色 + 进度环 */
export const DEFAULT_UI_PREFS: UiPrefs = {
  theme: 'clay',
  appearance: 'light',
  collapseStyle: 'rings'
}

/** 主题选择器用的元数据：标签 + 三色样（用于设置面板的色块预览） */
export interface ThemeMeta {
  key: ThemeKey
  label: string
  /** 强调/低/中三色样，仅供色块预览（实际配色在 CSS 变量里） */
  swatch: [string, string, string]
}

export const THEMES: ThemeMeta[] = [
  { key: 'clay', label: '陶土 Clay', swatch: ['#C26B4A', '#7C9A5E', '#D9A441'] },
  { key: 'latte', label: '拿铁 Latte', swatch: ['#B5713F', '#7C8A4E', '#C98A3C'] },
  { key: 'sandSage', label: '沙砾 Sage', swatch: ['#5C7A4E', '#C26B4A', '#D9A441'] }
]

export const APPEARANCES: { key: Appearance; label: string }[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' }
]

export const COLLAPSE_STYLES: { key: CollapseStyle; label: string }[] = [
  { key: 'rings', label: '进度环' },
  { key: 'segments', label: '分段条' },
  { key: 'spotlight', label: '聚光泡' }
]

/** 用量分级（暖色交通灯）：低=橄榄 / 中=蜂蜜 / 高=陶土红。 */
export type Level = 'low' | 'mid' | 'high'

/**
 * 把 0..1 利用率映射为分级；无效（非数字）返回 null（上层用中性灰）。
 * 阈值与设计稿一致：≥0.8 高、≥0.65 中、其余低。
 */
export function utilizationLevel(frac: number | null | undefined): Level | null {
  if (typeof frac !== 'number' || Number.isNaN(frac)) return null
  if (frac >= 0.8) return 'high'
  if (frac >= 0.65) return 'mid'
  return 'low'
}

/** 分级对应的 CSS 变量颜色；无效分级用中性 muted。 */
export function levelColorVar(level: Level | null): string {
  if (level === null) return 'var(--s2a-muted)'
  return `var(--s2a-${level})`
}
