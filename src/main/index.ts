// Must be first: picks the profile folder before anything reads userData.
import './profile'
import { app, Menu } from 'electron'
import { isLinux } from '../shared/platform'
import { ctx, showMainWindow } from './context'
import { confirmDeleteAllData } from './data'
import { setupDiscord } from './discord'
import { setupIpc } from './ipc'
import { setupMiniPlayer } from './mini'
import { setupNotifications } from './notifications'
import { setupPalette } from './palette'
import { setupSecurity } from './security'
import { setupShortcuts, teardownShortcuts } from './shortcuts'
import { focusSplash, isSplashOpen, setupSplash } from './splash'
import { store, type Identity } from './store'
import { setupTray } from './tray'
import { applyIdentity, setupIdentity } from './ua'
import { checkForUpdatesNow, runLaunchUpdate, setupUpdater, updatesEnabled } from './updater'
import { createMainWindow, revealMainWindow } from './window'

if (isLinux()) {
  // On Wayland, global shortcuts go through the desktop's GlobalShortcuts portal. Where the desktop
  // doesn't offer it, registering fails and the Shortcuts panel says so.
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
} else {
  // Toasts need an app identity on Windows. The installer registers this one; in development
  // Windows only shows toasts for the running executable's path.
  app.setAppUserModelId(app.isPackaged ? 'com.youputdesk.app' : process.execPath)
}

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
        { label: 'Delete all my data…', click: confirmDeleteAllData },
        { type: 'separator' },
        { label: 'Check for updates', click: checkForUpdatesNow },
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

setupSecurity()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // While the updater window is up, the app isn't ready to show yet.
  app.on('second-instance', () => (isSplashOpen() ? focusSplash() : showMainWindow()))

  app.whenReady().then(() => {
    setupIdentity()
    buildMenu()
    setupIpc()
    setupSplash()
    setupUpdater()
    // With updates on, check behind the updater window while YouTube Music loads hidden.
    const launchUpdate = updatesEnabled()
    ctx.main = createMainWindow({ deferShow: launchUpdate })
    // Without the main window there's nothing to play or show. Quit, or a hidden mini player would keep a
    // windowless app alive that relaunching can't bring back (it holds the single-instance lock).
    ctx.main.on('closed', () => {
      ctx.main = null
      ctx.quitting = true
      app.quit()
    })
    if (launchUpdate) runLaunchUpdate(revealMainWindow)
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
