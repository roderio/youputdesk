/**
 * Main-window preload. Runs in an isolated world: YouTube's page scripts can't see or call
 * anything here. It must stay inert outside YTM, since the main window also briefly shows
 * consent and sign-out pages.
 */
import { ipcRenderer, webFrame } from 'electron'
import { IPC, type DiscordStatus, type PlayerState } from '../shared/ipc'
import type { Settings } from '../shared/settings'
import type { ActionId } from '../shared/shortcuts'
import type { Palette } from '../shared/themes'
import { runAction, type Command } from './actions'
import { skipLog, watchAds } from './ads'
import { audio, AudioEngine } from './audio'
import { setupChime } from './chime'
import { setupKeys } from './keys'
import { mountOverlay, shadowRoots } from './overlay/mount'
import { readPlayer, videoElement } from './page'
import { getState, initState, receiveSettings, setState, subscribe, updateSettings } from './store'
import { setupTheme } from './theme'
import { syncVolume } from './volume'

const POLL_MS = 1000

function samePlayer(a: PlayerState | null, b: PlayerState | null): boolean {
  return !!a && !!b && a.videoId === b.videoId && a.playing === b.playing && a.liked === b.liked && a.ad === b.ad &&
    a.volume === b.volume && a.title === b.title && a.artwork === b.artwork && Math.abs(a.position - b.position) < 0.5 && a.duration === b.duration
}

/** Reads the player once a second (and right away on media events), feeds the overlay, main, and the audio engine. */
function startPlayerLoop(): void {
  let queued = false
  const tick = () => {
    queued = false
    const video = videoElement()
    if (video) {
      try {
        audio.engine ??= new AudioEngine()
        audio.engine.attach(video)
        audio.engine.apply(getState().settings.eq)
      } catch (err) {
        console.warn('[YouputDesk] audio engine unavailable', err)
      }
    }
    const player = readPlayer()
    syncVolume(player)
    if (!player) return
    if (!samePlayer(getState().player, player)) setState({ player })
    ipcRenderer.send(IPC.playerState, player)
  }
  const soon = () => {
    if (queued) return
    queued = true
    setTimeout(tick, 60)
  }
  setInterval(tick, POLL_MS)
  // Media events don't bubble, but they do pass through a capturing listener on document.
  for (const ev of ['play', 'pause', 'seeked', 'loadedmetadata', 'volumechange', 'ended']) {
    document.addEventListener(ev, soon, true)
  }
  // Like/dislike only shows up in the DOM.
  document.addEventListener('click', soon, true)
  tick()

  // Re-apply EQ settings the moment they change.
  let lastEq = getState().settings.eq
  subscribe(() => {
    const eq = getState().settings.eq
    if (eq !== lastEq) {
      lastEq = eq
      audio.engine?.apply(eq)
    }
  })
}

/** Text and UI size from Accessibility settings, applied as page zoom (YTM and our overlay alike). */
function setupZoom(): void {
  let last = 0
  const apply = () => {
    const scale = getState().settings.accessibility.uiScale
    if (scale === last || !(scale >= 0.5 && scale <= 3)) return
    last = scale
    webFrame.setZoomFactor(scale)
  }
  apply()
  subscribe(apply)
}

async function start(): Promise<void> {
  const [settings, palette, shortcutStatus, discord, info] = await Promise.all([
    ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
    ipcRenderer.invoke(IPC.palette) as Promise<Palette | null>,
    ipcRenderer.invoke(IPC.shortcutStatus) as Promise<{ failed: ActionId[] }>,
    ipcRenderer.invoke(IPC.discordStatus) as Promise<DiscordStatus>,
    ipcRenderer.invoke(IPC.appInfo) as Promise<{ version: string }>,
  ])
  initState({
    settings,
    player: null,
    ad: { active: false, skippable: false },
    panel: null,
    fullLyrics: false,
    cheatSheet: false,
    welcome: false,
    toasts: [],
    failedShortcuts: shortcutStatus.failed,
    discord,
    palette,
    draftTheme: null,
    recording: false,
    version: info.version,
  })

  ipcRenderer.on(IPC.settingsChanged, (_e, s: Settings) => receiveSettings(s))
  ipcRenderer.on(IPC.action, (_e, id: Command, arg?: number) => runAction(id, arg))
  ipcRenderer.on(IPC.palette, (_e, p: Palette) => setState({ palette: p }))
  ipcRenderer.on(IPC.shortcutStatus, (_e, s: { failed: ActionId[] }) => setState({ failedShortcuts: s.failed }))
  ipcRenderer.on(IPC.discordStatus, (_e, d: DiscordStatus) => setState({ discord: d }))
  setupKeys()
  setupZoom()

  const onDom = () => {
    setupTheme()
    mountOverlay()
    const chime = setupChime()
    watchAds((ad) => {
      setState({ ad })
      ipcRenderer.send(IPC.adState, ad)
      chime(ad)
    })
    startPlayerLoop()
    // Before consent the privacy screen shows instead, and opens the tour when it's answered.
    if (settings.privacy.consented && !settings.onboarding.done) setTimeout(() => setState({ welcome: true }), 1500)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onDom, { once: true })
  else onDom()
}

if (location.hostname === 'music.youtube.com') {
  start()
  // Debug handle for DevTools (select the "Electron Isolated Context"). Lives only in this
  // isolated world, so YouTube's page scripts can't see it.
  Object.assign(window, { __youputdesk: { getState, setState, updateSettings, runAction, audio, shadowRoots, skipLog } })
}
