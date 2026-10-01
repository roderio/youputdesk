/** Mini player: a small always-on-top card that pops up above the tray icon. */
import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { sendAction, showMainWindow } from './context'
import { player } from './player'

const WIDTH = 360
const HEIGHT = 150
const COMMANDS = ['playPause', 'next', 'previous', 'shuffle', 'repeat', 'volumeUp', 'volumeDown'] as const

let mini: BrowserWindow | null = null
let anchor: Electron.Rectangle | null = null
let lastHidden = 0

/** Where the tray icon is, so the card can appear right above it. */
export function setMiniAnchor(bounds: Electron.Rectangle): void {
  anchor = bounds
}

function position(win: BrowserWindow): void {
  const point = anchor ? { x: anchor.x + anchor.width / 2, y: anchor.y } : screen.getCursorScreenPoint()
  const { workArea: a } = screen.getDisplayNearestPoint(point)
  const x = Math.round(Math.min(Math.max(point.x - WIDTH / 2, a.x + 8), a.x + a.width - WIDTH - 8))
  // Taskbar at the bottom (the usual case): sit above it. Otherwise hug the work-area edge nearest the tray.
  const y = point.y >= a.y + a.height / 2 ? a.y + a.height - HEIGHT - 8 : a.y + 8
  win.setPosition(x, y)
}

function create(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/mini.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.on('blur', () => {
    // Clicking the tray icon blurs then re-toggles; let that click close it instead of reopening.
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })
  win.on('hide', () => (lastHidden = Date.now()))
  win.on('closed', () => (mini = null))

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/mini/index.html`)
  else win.loadFile(join(import.meta.dirname, '../renderer/mini/index.html'))
  return win
}

export function toggleMiniPlayer(): void {
  mini ??= create()
  const win = mini
  if (win.isVisible()) {
    win.hide()
    return
  }
  // The blur caused by clicking the tray icon has just hidden it; don't reopen on the same click.
  if (Date.now() - lastHidden < 250) return
  position(win)
  const showIt = () => {
    win.show()
    win.focus()
    win.webContents.send(IPC.miniState, player.state)
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', showIt)
  else showIt()
}

export function setupMiniPlayer(): void {
  player.on('state', (s) => {
    if (mini?.isVisible()) mini.webContents.send(IPC.miniState, s)
  })
  ipcMain.on(IPC.miniCommand, (e, cmd: unknown) => {
    if (!mini || e.sender !== mini.webContents) return
    if (cmd === 'open') {
      mini.hide()
      showMainWindow()
    } else if (cmd === 'close') {
      mini.hide()
    } else if (typeof cmd === 'object' && cmd && 'seek' in cmd) {
      const fraction = Number((cmd as { seek: unknown }).seek)
      if (Number.isFinite(fraction) && player.state) sendAction('seekTo', fraction * player.state.duration)
    } else if (COMMANDS.includes(cmd as (typeof COMMANDS)[number])) {
      sendAction(cmd as (typeof COMMANDS)[number])
    }
  })
}

