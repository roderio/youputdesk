/**
 * Automatic updates from GitHub Releases. Downloads in the background and installs when the app
 * quits. Only in the installed app (not dev or portable), and only once the user has allowed it
 * on the privacy screen: until then YouputDesk never contacts GitHub.
 */
import { app, dialog } from 'electron'
import updater from 'electron-updater'
import { allows } from '../shared/settings'
import { ctx } from './context'
import { showUpdateReady } from './notifications'
import { store } from './store'

const { autoUpdater } = updater
const FIRST_CHECK_MS = 10_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

let timer: NodeJS.Timeout | undefined
let notified = ''

/** Installed builds only: the portable exe can't replace itself, and dev builds have nothing to update. */
export const canUpdate = (): boolean => app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR

const enabled = (): boolean => canUpdate() && allows(store.store, 'updateChecks')

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

function schedule(): void {
  clearTimeout(timer)
  if (!enabled()) return
  timer = setTimeout(async function loop() {
    await check()
    timer = setTimeout(loop, CHECK_EVERY_MS)
  }, FIRST_CHECK_MS)
}

/** App menu → Check for updates. */
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
  const version = await check()
  await show(version ? `Downloading YouputDesk ${version}…` : `You're up to date (${app.getVersion()}).`,
    version ? 'It installs when you quit YouputDesk.' : undefined)
}

export function setupUpdater(): void {
  if (!canUpdate()) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('update-downloaded', (info) => {
    if (notified === info.version) return
    notified = info.version
    showUpdateReady(info.version)
  })
  autoUpdater.on('error', (err) => console.warn('[YouputDesk] Update failed:', err?.message ?? err))
  store.onDidChange('privacy', schedule)
  schedule()
}
