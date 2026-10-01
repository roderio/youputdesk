import { useState } from 'preact/hooks'
import { BUILT_IN_THEMES, FONTS, isTheme, safeColor, type Theme } from '../../shared/themes'
import { getState, setState, toast, updateSettings, useUi } from '../store'
import { activeTheme, allThemes } from '../theme'
import { Icon } from './icons'
import { Button, IconButton, Row, Section, Switch } from './ui'

const BUILTIN_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id))

function Swatch({ theme, palette }: { theme: Theme; palette?: { accent: string; background: string; surface: string } | null }) {
  const c = theme.dynamic && palette ? palette : theme
  return (
    <div class={`swatch ${theme.dynamic ? 'dynamic' : ''}`} style={{ background: c.background }}>
      <span class="sw-side" style={{ background: c.surface }} />
      <span class="sw-card" style={{ background: c.surface }} />
      <span class="sw-card" style={{ background: c.surface }} />
      <span class="sw-bar" style={{ background: c.surface }}>
        <span class="sw-progress" style={{ background: c.accent }} />
      </span>
      {theme.dynamic && <span class="sw-badge"><Icon name="sparkle" size={14} /></span>}
    </div>
  )
}

const COLOR_FIELDS: [keyof Pick<Theme, 'accent' | 'background' | 'surface' | 'text'>, string][] = [
  ['accent', 'Accent'],
  ['background', 'Background'],
  ['surface', 'Panels & player bar'],
  ['text', 'Text'],
]

/** <input type=color> only takes #rrggbb. */
const toHex = (c: string): string => (/^#[0-9a-f]{6}$/i.test(c) ? c : /^#[0-9a-f]{3}$/i.test(c) ? `#${[...c.slice(1)].map((x) => x + x).join('')}` : '#000000')

function Editor({ draft }: { draft: Theme }) {
  const isNew = !getState().settings.theme.custom.some((t) => t.id === draft.id)
  const set = (patch: Partial<Theme>) => setState({ draftTheme: { ...draft, ...patch } })
  const save = () => {
    const theme: Theme = { ...draft, name: draft.name.trim().slice(0, 32) || 'My theme', dynamic: false, original: false }
    const custom = getState().settings.theme.custom.filter((t) => t.id !== theme.id)
    updateSettings('theme', { custom: [...custom, theme], id: theme.id })
    setState({ draftTheme: null })
    toast(`Theme “${theme.name}” saved`, 'check')
  }
  return (
    <div class="editor">
      <div class="editor-head">
        <input class="text title-input" value={draft.name} maxLength={32} aria-label="Theme name"
          onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
        <span class="live-badge">Live preview</span>
      </div>
      {COLOR_FIELDS.map(([key, label]) => (
        <label class="color-row" key={key}>
          <input type="color" value={toHex(draft[key])} onInput={(e) => set({ [key]: (e.target as HTMLInputElement).value })} />
          <span>{label}</span>
          <code>{toHex(draft[key])}</code>
        </label>
      ))}
      <Row title="Corner roundness" hint="Album art and cards">
        <span class="value">{draft.radius ?? 0}px</span>
        <input type="range" class="hslider" min={0} max={24} value={draft.radius ?? 0}
          onInput={(e) => set({ radius: Number((e.target as HTMLInputElement).value) })} />
      </Row>
      <Row title="Font">
        <select class="select" value={draft.font ?? ''} onChange={(e) => set({ font: (e.target as HTMLSelectElement).value || undefined })}>
          <option value="">YouTube Music default</option>
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Row>
      <div class="actions">
        <Button primary icon="check" onClick={save}>{isNew ? 'Save theme' : 'Save changes'}</Button>
        <Button onClick={() => setState({ draftTheme: null })}>Cancel</Button>
      </div>
    </div>
  )
}

export function ThemesPanel() {
  const s = useUi((x) => x)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const themes = allThemes(s)
  const selected = s.settings.theme.id
  const draft = s.draftTheme

  const newTheme = () => {
    const base = activeTheme(s)
    const colors = base.dynamic && s.palette ? s.palette : base
    setState({
      draftTheme: {
        id: `custom-${Date.now().toString(36)}`, name: 'My theme',
        accent: colors.accent.startsWith('#') ? colors.accent : '#ff4e45',
        background: colors.background.startsWith('#') ? colors.background : '#0b0b10',
        surface: colors.surface.startsWith('#') ? colors.surface : '#17171f',
        text: base.text, radius: base.radius ?? 8, font: base.font,
      },
    })
  }
  const remove = (t: Theme) => {
    updateSettings('theme', {
      custom: s.settings.theme.custom.filter((x) => x.id !== t.id),
      ...(selected === t.id ? { id: 'original' } : {}),
    })
    toast(`Deleted “${t.name}”`, 'delete')
  }
  const exportTheme = async () => {
    const t = activeTheme(s)
    await navigator.clipboard.writeText(JSON.stringify({ ...t, original: undefined }, null, 2))
    toast('Theme copied to clipboard', 'copy')
  }
  const importTheme = () => {
    try {
      const parsed: unknown = JSON.parse(importText)
      if (!isTheme(parsed)) throw new Error('not a theme')
      const theme: Theme = {
        id: `custom-${Date.now().toString(36)}`,
        name: String(parsed.name).slice(0, 32),
        accent: safeColor(parsed.accent, '#ff4e45'),
        background: safeColor(parsed.background, '#0b0b10'),
        surface: safeColor(parsed.surface, '#17171f'),
        text: safeColor(parsed.text, '#ffffff'),
        radius: typeof parsed.radius === 'number' ? parsed.radius : undefined,
        font: typeof parsed.font === 'string' ? parsed.font : undefined,
      }
      updateSettings('theme', { custom: [...s.settings.theme.custom, theme], id: theme.id })
      setImporting(false)
      setImportText('')
      toast(`Imported “${theme.name}”`, 'check')
    } catch {
      toast("That doesn't look like a YouputDesk theme", 'warning')
    }
  }

  return (
    <div class="panel-body themes">
      {draft ? (
        <Editor draft={draft} />
      ) : (
        <>
          <div class="theme-grid">
            {themes.map((t) => (
              <div key={t.id} class={`theme-card ${t.id === selected ? 'selected' : ''}`}>
                <button type="button" class="theme-pick" onClick={() => updateSettings('theme', { id: t.id })} aria-pressed={t.id === selected}>
                  <Swatch theme={t} palette={s.palette} />
                  <span class="theme-name">
                    {t.id === selected && <Icon name="check" size={16} />}
                    {t.name}
                  </span>
                </button>
                {!BUILTIN_IDS.has(t.id) && (
                  <span class="theme-tools">
                    <IconButton icon="edit" size={16} label="Edit" onClick={() => setState({ draftTheme: { ...t } })} />
                    <IconButton icon="delete" size={16} label="Delete" onClick={() => remove(t)} />
                  </span>
                )}
              </div>
            ))}
            <button type="button" class="theme-card new" onClick={newTheme}>
              <Icon name="add" size={28} />
              <span>Create theme</span>
            </button>
          </div>

          <Section title="Effects">
            <Row icon="sparkle" title="Album art background" hint="A soft, blurred cover behind everything">
              <Switch checked={s.settings.theme.artBackground} label="Album art background"
                onChange={(artBackground) => updateSettings('theme', { artBackground })} />
            </Row>
            <Row icon="bolt" title="Performance mode" hint="Turns off blur, animations and the visualizer">
              <Switch checked={s.settings.ui.performanceMode} label="Performance mode"
                onChange={(performanceMode) => updateSettings('ui', { performanceMode })} />
            </Row>
          </Section>

          <Section title="Share">
            {importing ? (
              <div class="import">
                <textarea class="text" rows={5} placeholder="Paste theme JSON here" value={importText}
                  onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)} />
                <div class="actions">
                  <Button primary icon="check" onClick={importTheme} disabled={!importText.trim()}>Import</Button>
                  <Button onClick={() => setImporting(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div class="actions">
                <Button icon="copy" onClick={exportTheme}>Copy current theme</Button>
                <Button icon="paste" onClick={() => setImporting(true)}>Import theme</Button>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
