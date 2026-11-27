/**
 * Linux: when the system blocks what Chromium's sandbox needs (Ubuntu 24.04+ by default), the AppImage
 * launcher starts YouputDesk with --no-sandbox. Tell the user once, and point them at the .deb, which
 * installs an AppArmor profile and keeps the sandbox.
 */
import { app, dialog, type BrowserWindow } from 'electron'
import { shouldWarnNoSandbox } from '../shared/platform'
import { openExternal } from './external'
import { store } from './store'

const RELEASES_URL = 'https://github.com/roderio/youputdesk/releases/latest'

const runningWithoutSandbox = (): boolean => app.commandLine.hasSwitch('no-sandbox') || process.argv.includes('--no-sandbox')

/** Shows the notice the first time the main window appears, if it applies. */
export function setupSandboxNotice(win: BrowserWindow): void {
  if (!shouldWarnNoSandbox(process.platform, runningWithoutSandbox(), store.get('notices.noSandbox'))) return
  win.once('show', async () => {
    store.set('notices.noSandbox', true)
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'YouputDesk',
      message: "YouputDesk is running without Chromium's sandbox",
      detail:
        "Your system blocks what the sandbox needs, so the AppImage started YouputDesk without it. Web pages then " +
        'run with fewer protections. On Ubuntu, Debian and Mint, install the .deb package instead: it keeps the sandbox.',
      buttons: ['Get the .deb', 'OK'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) openExternal(RELEASES_URL)
  })
}
