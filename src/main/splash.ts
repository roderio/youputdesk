/**
 * Updater window: a small card shown at launch while we check for, download and install an update,
 * Discord-style. It only exists for a moment; the main window loads hidden behind it.
 */
import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { IPC, type UpdateStatus } from '../shared/ipc'
import { asset, ctx } from './context'
import { store } from './store'

const WIDTH = 300
const HEIGHT = 320
const FADE_MS = 150

let splash: BrowserWindow | null = null
let last: UpdateStatus | null = null
let onSkip: (() => void) | null = null

const reduceMotion = (): boolean => store.get('accessibility.reduceMotion') || store.get('ui.performanceMode')

/** Opens the card centred on the display under the cursor. Calling it again just brings it forward. */
export function openSplash(skip: () => void): void {
  onSkip = skip
  if (splash) {
    focusSplash()
    return
  }
  const { workArea: a } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: Math.round(a.x + (a.width - WIDTH) / 2),
    y: Math.round(a.y + (a.height - HEIGHT) / 2),
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'YouputDesk',
    icon: asset('icon.ico'),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/updater.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  splash = win
  // Alt+F4 while checking or downloading: same as "Skip for now".
  win.on('close', () => {
    if (splash === win && !ctx.quitting) onSkip?.()
  })
  win.on('closed', () => {
    if (splash === win) splash = null
  })
  // A local page: it never navigates anywhere.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.on('did-finish-load', () => {
    if (last) win.webContents.send(IPC.updaterStatus, last)
  })
  win.once('ready-to-show', () => {
    if (splash === win) win.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/updater/index.html`)
  else win.loadFile(join(import.meta.dirname, '../renderer/updater/index.html'))
}

export function sendSplash(status: Omit<UpdateStatus, 'reduceMotion'>): void {
  last = { ...status, reduceMotion: reduceMotion() }
  if (splash && !splash.webContents.isLoading()) splash.webContents.send(IPC.updaterStatus, last)
}

/** Fades the card out, then closes it. */
export function closeSplash(): void {
  const win = splash
  splash = null
  onSkip = null
  last = null
  if (!win || win.isDestroyed()) return
  if (!win.isVisible()) {
    win.destroy()
    return
  }
  win.webContents.send(IPC.updaterStatus, { phase: 'done', reduceMotion: reduceMotion() } satisfies UpdateStatus)
  setTimeout(() => {
    if (!win.isDestroyed()) win.destroy()
  }, FADE_MS)
}

export const isSplashOpen = (): boolean => !!splash

export function focusSplash(): void {
  if (!splash) return
  if (splash.isMinimized()) splash.restore()
  splash.show()
  splash.focus()
}

export function setupSplash(): void {
  ipcMain.on(IPC.updaterCommand, (e, cmd: unknown) => {
    if (!splash || e.sender !== splash.webContents || cmd !== 'skip') return
    onSkip?.()
  })
}
