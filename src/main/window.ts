import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { PARTITION, YTM_URL } from '../shared/config'
import { openSignIn } from './auth'
import { ctx } from './context'
import { isGoogleSignIn, isMainAllowed } from './navigation'
import { store } from './store'
import { setupTaskbar } from './taskbar'
import { showTrayBalloon } from './tray'

/** Saved bounds, or undefined if they no longer fit on any connected display. */
function restoredBounds() {
  const bounds = store.get('window.bounds')
  if (!bounds) return undefined
  const visible = screen.getAllDisplays().some(({ workArea: a }) =>
    bounds.x < a.x + a.width && bounds.x + bounds.width > a.x && bounds.y < a.y + a.height && bounds.y + bounds.height > a.y,
  )
  return visible ? bounds : undefined
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    ...restoredBounds(),
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#030303',
    title: 'YouputDesk',
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Music keeps playing (and the EQ keeps running) while the window is hidden or minimised.
      backgroundThrottling: false,
      // The EQ's AudioContext must start without waiting for a click.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  if (store.get('window.maximized')) win.maximize()
  win.once('ready-to-show', () => win.show())

  let saveTimer: NodeJS.Timeout | undefined
  const saveBounds = () => {
    clearTimeout(saveTimer)
    store.set('window.maximized', win.isMaximized())
    if (!win.isMaximized() && !win.isMinimized()) store.set('window.bounds', win.getBounds())
  }
  const saveBoundsSoon = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveBounds, 500)
  }
  win.on('resize', saveBoundsSoon)
  win.on('move', saveBoundsSoon)

  // Closing hides to the tray so music keeps playing; Quit lives in the tray menu.
  win.on('close', (e) => {
    saveBounds()
    if (ctx.quitting || !store.get('tray.closeToTray')) return
    e.preventDefault()
    win.hide()
    if (!store.get('tray.trayHintShown')) {
      store.set('tray.trayHintShown', true)
      showTrayBalloon('Still playing', 'YouputDesk keeps playing in the tray. Right-click the tray icon to quit.')
    }
  })

  setupTaskbar(win)

  // Sign-in goes to the preload-free auth window; anything outside YouTube goes to the default browser.
  const route = (url: string): boolean => {
    if (isGoogleSignIn(url)) {
      openSignIn(url, win)
      return false
    }
    if (isMainAllowed(url)) return true
    shell.openExternal(url)
    return false
  }

  win.webContents.on('will-navigate', (event, url) => {
    if (!route(url)) event.preventDefault()
  })
  win.webContents.on('will-redirect', (event, url) => {
    if (!route(url)) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    route(url)
    return { action: 'deny' }
  })

  win.loadURL(YTM_URL)
  return win
}
