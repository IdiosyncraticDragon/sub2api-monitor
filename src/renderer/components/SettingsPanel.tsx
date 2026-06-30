import type { ReactNode } from 'react'
import {
  THEMES,
  APPEARANCES,
  COLLAPSE_STYLES,
  type UiPrefs,
  type Appearance,
  type CollapseStyle
} from '../../shared/theme'

interface Props {
  prefs: UiPrefs
  onChange: (patch: Partial<UiPrefs>) => void
}

// 外观设置面板：主题（色块预览） / 明暗 / 折叠态样式。改动即时生效并持久化。
export function SettingsPanel({ prefs, onChange }: Props): JSX.Element {
  return (
    <div className="no-drag flex flex-1 flex-col gap-4 overflow-y-auto px-3.5 pb-4">
      <Section label="主题">
        <div className="flex flex-wrap gap-2.5">
          {THEMES.map((t) => {
            const on = prefs.theme === t.key
            return (
              <button
                key={t.key}
                onClick={() => onChange({ theme: t.key })}
                className="flex items-center gap-2.5 rounded-[13px] px-2.5 py-2"
                style={{
                  background: on ? 'var(--s2a-summary-bg)' : 'var(--s2a-chip-bg)',
                  border: `2px solid ${on ? 'var(--s2a-accent)' : 'transparent'}`
                }}
              >
                <span className="flex gap-[3px]">
                  {t.swatch.map((c, i) => (
                    <span key={i} className="h-[13px] w-[13px] rounded" style={{ background: c }} />
                  ))}
                </span>
                <span className="text-[12.5px] font-extrabold" style={{ color: 'var(--s2a-text)' }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section label="外观">
        <Segmented
          options={APPEARANCES}
          value={prefs.appearance}
          onPick={(v) => onChange({ appearance: v as Appearance })}
        />
      </Section>

      <Section label="折叠态样式">
        <Segmented
          options={COLLAPSE_STYLES}
          value={prefs.collapseStyle}
          onPick={(v) => onChange({ collapseStyle: v as CollapseStyle })}
        />
      </Section>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className="text-[11px] font-extrabold uppercase tracking-wider"
        style={{ color: 'var(--s2a-muted)' }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function Segmented({
  options,
  value,
  onPick
}: {
  options: { key: string; label: string }[]
  value: string
  onPick: (key: string) => void
}): JSX.Element {
  return (
    <div
      className="inline-flex w-max gap-[3px] rounded-[11px] p-[3px]"
      style={{ background: 'var(--s2a-track)' }}
    >
      {options.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            className="rounded-lg px-3.5 py-1.5 text-[12px] font-extrabold"
            style={{
              background: on ? 'var(--s2a-bg)' : 'transparent',
              color: on ? 'var(--s2a-text)' : 'var(--s2a-muted)'
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
