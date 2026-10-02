/**
 * Mounts our UI into YouTube Music. Everything lives in closed shadow roots so YTM's CSS
 * can't touch it and ours can't leak into YTM. Two roots: the toolbar (inside YTM's top bar)
 * and the overlay (drawer, modals, banners) floating above the page.
 */
import { render } from 'preact'
import { SEL } from '../../shared/selectors'
import { registerClickThrough } from '../ads'
import { getState, setState, subscribe, useUi } from '../store'
import { accentOf } from '../theme'
import { AdBanner, Announcer, Toasts } from './Ambient'
import { EqPanel } from './EqPanel'
import { Icon } from './icons'
import { FullLyrics, LyricsPanel } from './Lyrics'
import { CheatSheet, Privacy, Welcome } from './Modals'
import { SettingsPanel } from './SettingsPanel'
import { ShortcutsPanel } from './ShortcutsPanel'
import { ThemesPanel } from './ThemesPanel'
import { PANELS, Toolbar } from './Toolbar'
import { STYLES } from './styles'

function Drawer() {
  const panel = useUi((s) => s.panel)
  // Keep the last panel rendered while the drawer slides out.
  const shown = panel ?? lastPanel
  if (panel) lastPanel = panel
  return (
    <aside class={`drawer ${panel ? 'open' : ''}`} aria-hidden={!panel} inert={!panel}>
      <nav class="tabs" role="tablist">
        {PANELS.map((p) => (
          <button type="button" role="tab" key={p.id} aria-selected={shown === p.id} class={`tab ${shown === p.id ? 'active' : ''}`}
            onClick={() => setState({ panel: p.id, draftTheme: null })}>
            <Icon name={p.icon} size={18} />
            <span>{p.label}</span>
          </button>
        ))}
        <button type="button" class="tab close" aria-label="Close (Esc)" data-tip="Close · Esc" onClick={() => setState({ panel: null, draftTheme: null })}>
          <Icon name="close" size={18} />
        </button>
      </nav>
      <div class="drawer-content">
        {shown === 'eq' && <EqPanel />}
        {shown === 'lyrics' && <LyricsPanel />}
        {shown === 'themes' && <ThemesPanel />}
        {shown === 'shortcuts' && <ShortcutsPanel />}
        {shown === 'settings' && <SettingsPanel />}
      </div>
    </aside>
  )
}
let lastPanel: ReturnType<typeof getState>['panel'] = null

function Overlay() {
  const fullLyrics = useUi((s) => s.fullLyrics)
  const cheatSheet = useUi((s) => s.cheatSheet)
  const welcome = useUi((s) => s.welcome)
  const consented = useUi((s) => s.settings.privacy.consented)
  return (
    <>
      <AdBanner />
      <Drawer />
      {fullLyrics && <FullLyrics />}
      {cheatSheet && <CheatSheet />}
      {consented ? welcome && <Welcome /> : <Privacy />}
      <Toasts />
      <Announcer />
    </>
  )
}

/** Floating launcher used only if YTM's top bar can't be found (e.g. after a YTM redesign). */
function FallbackLauncher() {
  return (
    <div class="fallback-launcher">
      <Toolbar />
    </div>
  )
}

/** Our shadow roots, for the isolated-world debug handle (closed to YouTube's page scripts). */
export const shadowRoots: ShadowRoot[] = []

function makeRoot(tag: string, hostStyle: string): ShadowRoot {
  const host = document.createElement(tag)
  host.setAttribute('style', hostStyle)
  const shadow = host.attachShadow({ mode: 'closed' })
  shadowRoots.push(shadow)
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(STYLES)
  shadow.adoptedStyleSheets = [sheet]
  // Theme accent, performance mode and accessibility options reach the shadow DOM through the host element.
  const sync = () => {
    const s = getState()
    host.style.setProperty('--accent', accentOf(s))
    host.classList.toggle('perf', s.settings.ui.performanceMode)
    host.classList.toggle('hc', s.settings.accessibility.highContrast)
    host.classList.toggle('rm', s.settings.accessibility.reduceMotion)
  }
  sync()
  subscribe(sync)
  return shadow
}

export function mountOverlay(): void {
  const overlay = makeRoot('youputdesk-overlay', 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;display:block')
  document.documentElement.append(overlay.host)
  render(<Overlay />, overlay)

  registerClickThrough((on) => overlay.host.classList.toggle('click-through', on))

  const toolbar = makeRoot('youputdesk-toolbar', 'display:flex;align-items:center;margin-right:8px')
  render(<Toolbar />, toolbar)

  const fallback = makeRoot('youputdesk-fallback', 'position:fixed;top:12px;right:180px;z-index:2147483001;display:none')
  document.documentElement.append(fallback.host)
  render(<FallbackLauncher />, fallback)

  // YTM re-renders its top bar on navigation; put the toolbar back whenever it disappears.
  const started = Date.now()
  const place = () => {
    const nav = document.querySelector(SEL.navRight)
    if (nav && toolbar.host.parentElement !== nav) nav.prepend(toolbar.host)
    // Give YTM a few seconds to build its top bar before falling back to a floating toolbar.
    const useFallback = !nav && Date.now() - started > 6000
    ;(fallback.host as HTMLElement).style.display = useFallback ? 'block' : 'none'
  }
  place()
  setInterval(place, 1500)
}
