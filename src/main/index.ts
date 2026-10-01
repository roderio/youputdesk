// Must be first: picks the profile folder before anything reads userData.
import './profile'
import { app, Menu, session } from 'electron'
import { PARTITION, YTM_URL } from '../shared/config'
import { ctx, showMainWindow } from './context'
import { setupDiscord } from './discord'
import { setupIpc } from './ipc'
import { setupMiniPlayer } from './mini'
import { setupNotifications } from './notifications'
import { setupPalette } from './palette'
import { setupShortcuts, teardownShortcuts } from './shortcuts'
import { store, type Identity } from './store'
import { setupTray } from './tray'
import { applyIdentity, setupIdentity } from './ua'
import { createMainWindow } from './window'

// Toasts need an app identity on Windows. The installer registers this one; in development
// Electron's default identity is the one that can actually show toasts.
if (app.isPackaged) app.setAppUserModelId('com.youputdesk.app')

const identities: { id: Identity; label: string }[] = [
  { id: 'native', label: 'Electron default (recommended)' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'firefox', label: 'Firefox (sign-in window only)' },
]

function buildMenu(): void {
  // Hidden by default (autoHideMenuBar); press Alt to show it. Everyday features live in the in-page toolbar.
  const menu = Menu.buildFromTemplate([
    {
      label: 'App',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Sign-in identity',
          submenu: identities.map(({ id, label }) => ({
            label,
            type: 'radio' as const,
            checked: store.get('auth.identity') === id,
            click: () => {
              store.set('auth.identity', id)
              applyIdentity(id)
            },
          })),
        },
        {
          label: 'Sign out and clear data',
          click: async () => {
            await session.fromPartition(PARTITION).clearStorageData()
            ctx.main?.loadURL(YTM_URL)
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Ctrl+Q',
          click: () => {
            ctx.quitting = true
            app.quit()
          },
        },
      ],
    },
    { role: 'editMenu' },
  ])
  Menu.setApplicationMenu(menu)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(() => {
    setupIdentity()
    buildMenu()
    setupIpc()
    ctx.main = createMainWindow()
    ctx.main.on('closed', () => (ctx.main = null))
    setupTray()
    setupMiniPlayer()
    setupShortcuts()
    setupNotifications()
    setupPalette()
    setupDiscord()
  })

  app.on('before-quit', () => (ctx.quitting = true))
  app.on('will-quit', teardownShortcuts)
  app.on('window-all-closed', () => app.quit())
}
