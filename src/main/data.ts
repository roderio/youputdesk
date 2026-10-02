/** "Delete all my data": everything YouputDesk keeps on this PC, gone in one step. */
import { app, dialog, session } from 'electron'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PARTITION } from '../shared/config'
import { ctx } from './context'
import { store } from './store'

export async function deleteAllData(): Promise<void> {
  for (const s of [session.fromPartition(PARTITION), session.defaultSession]) {
    // Cookies (the Google sign-in), local storage, IndexedDB, service workers, cache.
    await s.clearStorageData().catch(() => {})
    await s.clearCache().catch(() => {})
    await s.clearAuthCache().catch(() => {})
  }
  await rm(join(app.getPath('userData'), 'lyrics-cache-v2'), { recursive: true, force: true }).catch(() => {})
  store.clear()
  ctx.quitting = true
  app.relaunch()
  app.exit(0)
}

/** From the App menu, which has no in-page confirmation of its own. */
export async function confirmDeleteAllData(): Promise<void> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    title: 'Delete all my data',
    message: 'Delete all your YouputDesk data?',
    detail: 'This signs you out of Google and erases your settings, themes, presets and lyrics cache. YouputDesk then restarts.',
    buttons: ['Delete everything', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  }
  const { response } = ctx.main ? await dialog.showMessageBox(ctx.main, options) : await dialog.showMessageBox(options)
  if (response === 0) await deleteAllData()
}
