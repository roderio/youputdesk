import { ACTION_IDS, ACTIONS } from '../../shared/shortcuts'
import { openPanel, setState, updateSettings, useUi, type Panel } from '../store'
import { Icon, type IconName } from './icons'
import { Button, IconButton, Keys } from './ui'

const FEATURES: { icon: IconName; title: string; text: string; panel?: Panel; action: keyof typeof ACTIONS }[] = [
  { icon: 'eq', title: 'Equalizer', text: '10 bands, presets, bass boost and a limiter so boosts never distort.', panel: 'eq', action: 'openEqualizer' },
  { icon: 'lyrics', title: 'Synced lyrics', text: 'Lines light up as they’re sung. Click one to jump there.', panel: 'lyrics', action: 'openLyrics' },
  { icon: 'palette', title: 'Themes', text: 'Recolour the app, or let the album art pick the colours.', panel: 'themes', action: 'openThemes' },
  { icon: 'keyboard', title: 'Shortcuts', text: 'Control music from any app with global hotkeys.', panel: 'shortcuts', action: 'openShortcuts' },
  { icon: 'bell', title: 'Ad alerts', text: 'Get told when an ad can be skipped, and skip it with one key.', action: 'skipAd' },
  { icon: 'mini', title: 'Tray & mini player', text: 'Closing keeps the music going. Click the tray icon for controls.', action: 'miniPlayer' },
]

export function Welcome() {
  const bindings = useUi((s) => s.settings.shortcuts)
  const finish = (panel?: Panel) => {
    updateSettings('onboarding', { done: true })
    setState({ welcome: false })
    if (panel) openPanel(panel)
  }
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && finish()}>
      <div class="modal welcome" role="dialog" aria-label="Welcome to YouputDesk">
        <div class="welcome-head">
          <span class="welcome-badge"><Icon name="sparkle" size={22} /></span>
          <div>
            <h2>Welcome to YouputDesk</h2>
            <p>Everything YouTube Music does, plus these. Find them anytime in the toolbar at the top right.</p>
          </div>
        </div>
        <div class="feature-grid">
          {FEATURES.map((f) => (
            <button type="button" key={f.title} class="feature" onClick={() => finish(f.panel)} disabled={!f.panel}>
              <span class="feature-icon"><Icon name={f.icon} size={22} /></span>
              <span class="feature-title">{f.title}</span>
              <span class="feature-text">{f.text}</span>
              <Keys accelerator={bindings[f.action].accelerator} muted />
            </button>
          ))}
        </div>
        <div class="modal-foot">
          <span class="hint">Press <Keys accelerator={bindings.cheatSheet.accelerator} muted /> anytime to see every shortcut.</span>
          <Button primary onClick={() => finish()}>Start listening</Button>
        </div>
      </div>
    </div>
  )
}

export function CheatSheet() {
  const bindings = useUi((s) => s.settings.shortcuts)
  const groups = [...new Set(ACTION_IDS.map((id) => ACTIONS[id].group))]
  const close = () => setState({ cheatSheet: false })
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal cheat" role="dialog" aria-label="Keyboard shortcuts">
        <div class="modal-head">
          <h2>Keyboard shortcuts</h2>
          <IconButton icon="close" label="Close (Esc)" onClick={close} />
        </div>
        <div class="cheat-grid">
          {groups.map((g) => (
            <div key={g}>
              <h3>{g}</h3>
              {ACTION_IDS.filter((id) => ACTIONS[id].group === g).map((id) => (
                <div class="cheat-row" key={id}>
                  <span>{ACTIONS[id].label}{bindings[id].global && <span class="global-pill" title="Works from any app"><Icon name="globe" size={12} /></span>}</span>
                  <Keys accelerator={bindings[id].accelerator} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div class="modal-foot">
          <span class="hint"><Icon name="globe" size={14} /> = works even when YouputDesk is in the background</span>
          <Button icon="edit" onClick={() => { close(); openPanel('shortcuts') }}>Edit shortcuts</Button>
        </div>
      </div>
    </div>
  )
}
