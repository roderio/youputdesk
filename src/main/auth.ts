/**
 * Google sign-in runs in its own window with no app preload, so the login page sees
 * an ordinary browser. It shares the YTM partition, so the cookies it sets are what
 * the main window uses afterwards.
 */
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { PARTITION } from '../shared/config'
import { openExternal } from './external'
import { isAuthAllowed, isYtm } from './navigation'
import { store } from './store'
import { firefoxUA, markFirefox, unmarkFirefox } from './ua'

let authWin: BrowserWindow | null = null

export function openSignIn(url: string, parent: BrowserWindow): void {
  if (authWin && !authWin.isDestroyed()) {
    authWin.loadURL(url)
    authWin.focus()
    return
  }

  const compat = store.get('auth.identity') === 'firefox'
  authWin = new BrowserWindow({
    parent,
    width: 520,
    height: 720,
    title: 'Sign in with Google',
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Firefox identity only: hide Chromium's navigator.userAgentData, which a real Firefox lacks.
      preload: compat ? join(import.meta.dirname, '../preload/auth-compat.cjs') : undefined,
    },
  })

  const win = authWin
  const contentsId = win.webContents.id
  if (compat) {
    win.webContents.setUserAgent(firefoxUA())
    markFirefox(contentsId)
  }

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isAuthAllowed(target)) return { action: 'allow' }
    openExternal(target)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, target) => {
    if (!isAuthAllowed(target)) {
      event.preventDefault()
      openExternal(target)
    }
  })

  // Back on YTM means Google has finished setting session cookies.
  win.webContents.on('did-navigate', (_event, target) => {
    if (!isYtm(target)) return
    win.close()
    if (!parent.isDestroyed()) parent.webContents.loadURL(target)
  })

  win.on('closed', () => {
    unmarkFirefox(contentsId)
    authWin = null
  })

  win.loadURL(url)
}
