interface Props {
  platform?: string
  size?: number
}

export type PlatformKind = 'claude' | 'codex' | 'gemini' | 'other'

/** 由 platform 字段归类（纯函数）：anthropic→claude，openai/gpt→codex，google→gemini，其余→other */
export function platformKind(platform?: string): PlatformKind {
  const p = (platform ?? '').toLowerCase()
  if (p.includes('anthropic') || p.includes('claude')) return 'claude'
  if (p.includes('openai') || p.includes('codex') || p.includes('gpt')) return 'codex'
  if (p.includes('gemini') || p.includes('google')) return 'gemini'
  return 'other'
}

/** 平台图标芯片的配色（CSS 变量，随主题切换）：背景 + 描边/填充色。 */
export function platformColors(platform?: string): { bg: string; color: string } {
  switch (platformKind(platform)) {
    case 'claude':
      return { bg: 'var(--s2a-claude-bg)', color: 'var(--s2a-claude-ic)' }
    case 'codex':
      return { bg: 'var(--s2a-codex-bg)', color: 'var(--s2a-codex-ic)' }
    case 'gemini':
      return { bg: 'var(--s2a-gem-bg)', color: 'var(--s2a-gem-ic)' }
    default:
      return { bg: 'var(--s2a-chip-bg)', color: 'var(--s2a-muted)' }
  }
}

// 平台图标：简化品牌标记，使用 currentColor（由外层芯片以平台色驱动），明暗主题通用。
export function PlatformIcon({ platform, size = 15 }: Props): JSX.Element {
  const kind = platformKind(platform)
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    'data-platform': kind,
    role: 'img' as const,
    'aria-label': platform ?? kind
  }

  if (kind === 'claude') {
    // Claude/Anthropic：星芒（spark）
    return (
      <svg {...common}>
        <path
          d="M8 1.5V14.5M1.5 8H14.5M3.4 3.4L12.6 12.6M12.6 3.4L3.4 12.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (kind === 'codex') {
    // Codex/OpenAI：代码尖括号 </>
    return (
      <svg
        {...common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9.2 3.5L6.8 12.5" />
      </svg>
    )
  }

  if (kind === 'gemini') {
    // Gemini/Google：四角星 sparkle
    return (
      <svg {...common}>
        <path
          d="M8 1c.5 4 2.9 6.5 7 7-4.1.5-6.5 3-7 7-.5-4-2.9-6.5-7-7 4.1-.5 6.5-3 7-7Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  // 其它平台：首字母
  const ch = (platform ?? '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <svg {...common}>
      <text
        x="8"
        y="8"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="700"
        fill="currentColor"
      >
        {ch}
      </text>
    </svg>
  )
}

/** 平台图标芯片：圆角方块 + 平台色背景/前景，内嵌 PlatformIcon。 */
export function PlatformChip({
  platform,
  size = 28,
  glyph = 15,
  radius = 9
}: {
  platform?: string
  /** 芯片边长 */
  size?: number
  /** 内部图标尺寸 */
  glyph?: number
  /** 圆角 */
  radius?: number
}): JSX.Element {
  const { bg, color } = platformColors(platform)
  return (
    <span
      className="flex flex-none items-center justify-center"
      style={{ width: size, height: size, borderRadius: radius, background: bg, color }}
    >
      <PlatformIcon platform={platform} size={glyph} />
    </span>
  )
}
