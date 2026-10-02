import { app, ipcMain } from 'electron'
import { IPC, type AdState, type LyricsQuery } from '../shared/ipc'
import { PAGE_WRITABLE, type PageWritableKey, type Settings } from '../shared/settings'
import { broadcast, ctx, showMainWindow, toggleMainWindow } from './context'
import { deleteAllData } from './data'
import { openExternal } from './external'
import { discordStatus } from './discord'
import { getLyrics } from './lyrics'
import { resetMiniPosition, toggleMiniPlayer } from './mini'
import { showTestNotification } from './notifications'
import { currentPalette } from './palette'
import { parseState, player } from './player'
import { shortcutStatus } from './shortcuts'
import { store } from './store'

const APP_ACTIONS = {
  toggleWindow: toggleMainWindow,
  showWindow: showMainWindow,
  miniPlayer: toggleMiniPlayer,
  resetMiniPosition,
  testNotification: showTestNotification,
  deleteAllData,
  privacyPolicy: () => openExternal('https://github.com/roderio/youputdesk/blob/main/PRIVACY.md'),
} as const

/** Only accept messages from our own windows' top frames, never from subframes (ads, embeds). */
const fromMain = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean =>
  !!ctx.main && e.sender === ctx.main.webContents && e.senderFrame === ctx.main.webContents.mainFrame

export function setupIpc(): void {
  // Even read-only answers go only to our own page: settings and status are nobody else's business.
  ipcMain.handle(IPC.settingsGet, (e) => (fromMain(e) ? store.store : null))

  ipcMain.handle(IPC.settingsSet, (e, key: unknown, value: unknown) => {
    if (!fromMain(e) || !PAGE_WRITABLE.includes(key as PageWritableKey) || typeof value !== 'object' || value === null) return
    store.set(key as PageWritableKey, value as Settings[PageWritableKey])
  })

  ipcMain.on(IPC.playerState, (e, raw: unknown) => {
    if (!fromMain(e)) return
    const state = parseState(raw)
    if (state) player.update(state)
  })

  ipcMain.on(IPC.adState, (e, raw: AdState) => {
    if (!fromMain(e) || typeof raw !== 'object' || raw === null) return
    player.updateAd({ active: raw.active === true, skippable: raw.skippable === true })
  })

  // A real click on YouTube's Skip button, at the position the page reported. Only while an ad
  // is playing, and only inside the window, so this can't be used to click anything else.
  ipcMain.on(IPC.skipAdClick, (e, p: { x: unknown; y: unknown }) => {
    const win = ctx.main
    if (!fromMain(e) || !win || !player.ad.active) return
    const [w, h] = win.getContentSize()
    const zoom = win.webContents.getZoomFactor()
    const x = Math.round(Number(p?.x) * zoom)
    const y = Math.round(Number(p?.y) * zoom)
    if (!(x >= 0 && y >= 0 && x <= w && y <= h)) return
    win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
    win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  })

  ipcMain.on(IPC.appAction, (e, id: unknown) => {
    if (fromMain(e) && typeof id === 'string' && id in APP_ACTIONS) APP_ACTIONS[id as keyof typeof APP_ACTIONS]()
  })

  ipcMain.handle(IPC.lyricsGet, (e, q: LyricsQuery) => (fromMain(e) ? getLyrics(q) : null))
  ipcMain.handle(IPC.palette, (e) => (fromMain(e) ? currentPalette() : null))
  ipcMain.handle(IPC.shortcutStatus, (e) => (fromMain(e) ? shortcutStatus() : null))
  ipcMain.handle(IPC.discordStatus, (e) => (fromMain(e) ? discordStatus() : null))
  ipcMain.handle(IPC.appInfo, (e) => (fromMain(e) ? { version: app.getVersion(), identity: store.get('auth.identity') } : null))

  // Every window (page overlay, mini player) sees settings changes immediately. Window-bounds
  // saves happen on every move/resize and the page doesn't care about them, so skip those.
  store.onDidAnyChange((next, prev) => {
    if (PAGE_WRITABLE.some((k) => JSON.stringify(next?.[k]) !== JSON.stringify(prev?.[k]))) {
      broadcast(IPC.settingsChanged, next)
    }
  })
}
