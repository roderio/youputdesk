/** The toolbar in YouTube Music's top bar: one button per feature, always visible. */
import { ACTIONS, prettyAccelerator, type ActionId } from '../../shared/shortcuts'
import { openPanel, useUi, type Panel } from '../store'
import { Icon, type IconName } from './icons'

export const PANELS: { id: Panel; icon: IconName; label: string; action: ActionId }[] = [
  { id: 'eq', icon: 'eq', label: 'Equalizer', action: 'openEqualizer' },
  { id: 'lyrics', icon: 'lyrics', label: 'Lyrics', action: 'openLyrics' },
  { id: 'themes', icon: 'palette', label: 'Themes', action: 'openThemes' },
  { id: 'shortcuts', icon: 'keyboard', label: 'Shortcuts', action: 'openShortcuts' },
  { id: 'settings', icon: 'settings', label: 'Settings', action: 'openSettings' },
]

export function Toolbar() {
  const panel = useUi((s) => s.panel)
  const eqOn = useUi((s) => s.settings.eq.enabled)
  const bindings = useUi((s) => s.settings.shortcuts)
  return (
    <div class="toolbar" role="toolbar" aria-label="YouputDesk">
      {PANELS.map((p) => {
        const keys = prettyAccelerator(bindings[p.action]?.accelerator ?? ACTIONS[p.action].accelerator).join('+')
        return (
          <button type="button" key={p.id} class={`tb-btn ${panel === p.id ? 'active' : ''}`} aria-label={p.label}
            data-tip={keys ? `${p.label} · ${keys}` : p.label} onClick={() => openPanel(p.id)}>
            <Icon name={p.icon} size={22} />
            {p.id === 'eq' && eqOn && <span class="tb-dot" aria-label="Equalizer is on" />}
          </button>
        )
      })}
    </div>
  )
}
