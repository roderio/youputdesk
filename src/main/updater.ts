/**
 * Automatic updates from GitHub Releases, Discord-style: at launch a small window checks for an
 * update and, if there is one, downloads and installs it before the app opens. While the app runs,
 * updates download quietly in the background, so the next launch only has to install them.
 * Only in the installed app (not dev or portable), and only once the user has allowed it on the
 * privacy screen: until then YouputDesk never contacts GitHub.
 */
import { app, dialog } from 'electron'
import updater from 'electron-updater'
import { allows } from '../shared/settings'
import { ctx } from './context'
import { showUpdateDownloading, showUpdateReady } from './notifications'
import { closeSplash, openSplash, sendSplash } from './splash'
import { store } from './store'

const { autoUpdater } = updater
/** After turning updates on mid-session. */
const FIRST_CHECK_MS = 10_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
/** A check that answers within this never shows the window at all, so fast networks get no flash. */
const SPLASH_DELAY_MS = 250
/** Offline or GitHub being slow: open the app anyway; a late answer still downloads in the background. */
const LAUNCH_CHECK_TIMEOUT_MS = 3_000
/** Long enough for "Installing…" to register before the app closes for the installer. */
const INSTALL_DELAY_MS = 500

let timer: NodeJS.Timeout | undefined
let notified = ''
/** A downloaded update waiting to be installed. */
let downloadedVersion: string | null = null
/** The user asked for this check, so tell them when the download is ready. */
let manualCheck = false

/** The launch window's reactions to updater events, while it's up. */
let launch: {
  available(version: string): void
  progress(p: { percent: number; transferred: number; total: number; bytesPerSecond: number }): void
  downloaded(version: string): void
  failed(): void
} | null = null

/** Installed builds only: the portable exe can't replace itself, and dev builds have nothing to update. */
export const canUpdate = (): boolean => app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR

const enabled = (): boolean => canUpdate() && allows(store.store, 'updateChecks')

/** Dev only: walk the updater window through every phase without a real update. */
const fakeUpdate = (): boolean => !app.isPackaged && process.env.YOUPUTDESK_FAKE_UPDATE === '1'

/** Whether launch should go through the updater window. */
export const updatesEnabled = (): boolean => enabled() || fakeUpdate()

/** Version of a downloaded update waiting for a restart, for the tray menu. */
export const pendingUpdate = (): string | null => downloadedVersion

async function check(): Promise<string | null> {
  if (!enabled()) return null
  try {
    const result = await autoUpdater.checkForUpdates()
    return result?.isUpdateAvailable ? result.updateInfo.version : null
  } catch (err) {
    // Offline, GitHub rate limits…: try again next time, without bothering the user.
    console.warn('[YouputDesk] Update check failed:', err instanceof Error ? err.message : err)
    return null
  }
}

function schedule(firstIn = FIRST_CHECK_MS): void {
  clearTimeout(timer)
  if (!enabled()) return
  timer = setTimeout(async function loop() {
    await check()
    timer = setTimeout(loop, CHECK_EVERY_MS)
  }, firstIn)
}

/** Closes the app and runs the installer, which reopens the new version. */
export function restartToUpdate(): void {
  if (!downloadedVersion) return
  ctx.quitting = true
  ctx.main?.hide()
  openSplash(() => {})
  sendSplash({ phase: 'installing', version: downloadedVersion })
  // Silent: the window above is the progress UI. Then start the new version.
  setTimeout(() => autoUpdater.quitAndInstall(true, true), INSTALL_DELAY_MS)
}

async function promptRestart(version: string): Promise<void> {
  const options: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'YouputDesk',
    message: `YouputDesk ${version} is ready`,
    detail: 'Restart now to update, or it installs next time you open YouputDesk.',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }
  const { response } = ctx.main?.isVisible() ? await dialog.showMessageBox(ctx.main, options) : await dialog.showMessageBox(options)
  if (response === 0) restartToUpdate()
}

/**
 * Launch: check for an update behind a small window and install it before the app opens.
 * Calls onDone when the app should appear instead (no update, offline, error or skipped).
 */
export function runLaunchUpdate(onDone: () => void): void {
  if (fakeUpdate()) return runFakeUpdate(onDone)
  let finished = false
  let splashTimer: NodeJS.Timeout | undefined
  let timeout: NodeJS.Timeout | undefined
  let version: string | undefined
  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(splashTimer)
    clearTimeout(timeout)
    launch = null
    closeSplash()
    onDone()
    schedule(CHECK_EVERY_MS)
  }
  const showSplash = () => {
    clearTimeout(splashTimer)
    openSplash(finish)
  }

  sendSplash({ phase: 'checking' })
  splashTimer = setTimeout(showSplash, SPLASH_DELAY_MS)
  timeout = setTimeout(finish, LAUNCH_CHECK_TIMEOUT_MS)
  launch = {
    available(v) {
      version = v
      clearTimeout(timeout)
      showSplash()
      sendSplash({ phase: 'downloading', version, percent: 0 })
    },
    progress(p) {
      sendSplash({ phase: 'downloading', version, ...p })
    },
    downloaded(version) {
      finished = true
      clearTimeout(timeout)
      launch = null
      showSplash()
      sendSplash({ phase: 'installing', version })
      ctx.quitting = true
      setTimeout(() => autoUpdater.quitAndInstall(true, true), INSTALL_DELAY_MS)
    },
    failed: finish,
  }

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      // Available: 'update-available' already moved the window on to downloading.
      if (!result?.isUpdateAvailable) finish()
    })
    .catch((err) => {
      console.warn('[YouputDesk] Update check failed:', err instanceof Error ? err.message : err)
      finish()
    })
}

/** YOUPUTDESK_FAKE_UPDATE=1 in dev: checking → downloading → installing, then opens the app. */
function runFakeUpdate(onDone: () => void): void {
  const timers: NodeJS.Timeout[] = []
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    timers.forEach(clearTimeout)
    closeSplash()
    onDone()
  }
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
  const version = '9.9.9'
  const total = 38 * 1_048_576
  sendSplash({ phase: 'checking' })
  at(SPLASH_DELAY_MS, () => openSplash(finish))
  for (let i = 0; i <= 40; i++) {
    const percent = (i / 40) * 100
    at(900 + i * 100, () => sendSplash({ phase: 'downloading', version, percent, transferred: (total * percent) / 100, total, bytesPerSecond: 9.5 * 1_048_576 }))
  }
  at(5_100, () => sendSplash({ phase: 'installing', version }))
  at(6_600, finish)
}

/** Tray menu / App menu → Check for updates. */
export async function checkForUpdatesNow(): Promise<void> {
  const show = (message: string, detail?: string) =>
    ctx.main ? dialog.showMessageBox(ctx.main, { type: 'info', title: 'YouputDesk', message, detail }) : dialog.showMessageBox({ type: 'info', message, detail })
  if (!canUpdate()) {
    await show('Updates are automatic only in the installed app.', 'Get the latest version from github.com/roderio/youputdesk/releases.')
    return
  }
  if (!allows(store.store, 'updateChecks')) {
    await show('Automatic updates are off.', 'Turn them on in Settings → Privacy.')
    return
  }
  if (downloadedVersion) {
    await promptRestart(downloadedVersion)
    return
  }
  manualCheck = true
  const version = await check()
  if (!version) {
    manualCheck = false
    await show(`You're up to date (${app.getVersion()}).`)
  } else if (downloadedVersion !== version) {
    // We'll ask about restarting once it has downloaded.
    showUpdateDownloading(version)
  }
}

export function setupUpdater(): void {
  if (!canUpdate()) return
  autoUpdater.autoDownload = true
  // Updates install at launch (or on "Restart now"), never on quit.
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null
  autoUpdater.on('update-available', (info) => launch?.available(info.version))
  autoUpdater.on('download-progress', (p) => launch?.progress(p))
  autoUpdater.on('update-downloaded', (info) => {
    downloadedVersion = info.version
    if (launch) {
      launch.downloaded(info.version)
    } else if (manualCheck) {
      manualCheck = false
      void promptRestart(info.version)
    } else if (notified !== info.version) {
      notified = info.version
      showUpdateReady(info.version, () => void promptRestart(info.version))
    }
  })
  autoUpdater.on('error', (err) => {
    console.warn('[YouputDesk] Update failed:', err?.message ?? err)
    manualCheck = false
    launch?.failed()
  })
  store.onDidChange('privacy', () => schedule())
}
