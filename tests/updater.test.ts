import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The updater talks to Electron, electron-updater and the splash window; replace them so the install
// flow can run here. quitAndInstall fails the way a cancelled .deb password prompt does: it emits 'error'.
const h = vi.hoisted(() => ({
  updater: null as unknown as EventEmitter & Record<string, unknown>,
  ctx: { main: null as unknown, quitting: false },
  closeSplash: vi.fn(),
  openSplash: vi.fn(),
  sendSplash: vi.fn(),
  showMainWindow: vi.fn(),
}))

vi.mock('electron', () => ({ app: { isPackaged: true, getVersion: () => '0.3.0' }, dialog: { showMessageBox: vi.fn() } }))
vi.mock('electron-updater', async () => {
  const { EventEmitter } = await import('node:events')
  const u = new EventEmitter() as EventEmitter & Record<string, unknown>
  u.checkForUpdates = vi.fn(async () => ({ isUpdateAvailable: true, updateInfo: { version: '0.3.1' } }))
  u.quitAndInstall = vi.fn(() => u.emit('error', new Error('pkexec: Request dismissed')))
  h.updater = u
  return { default: { autoUpdater: u } }
})
vi.mock('../src/main/context', () => ({ ctx: h.ctx, showMainWindow: h.showMainWindow }))
vi.mock('../src/main/splash', () => ({ closeSplash: h.closeSplash, openSplash: h.openSplash, sendSplash: h.sendSplash }))
vi.mock('../src/main/notifications', () => ({ showUpdateDownloading: vi.fn(), showUpdateReady: vi.fn() }))
vi.mock('../src/main/store', () => ({
  store: { store: { privacy: { consented: true, updateChecks: true } }, get: vi.fn(), onDidChange: vi.fn() },
}))

const { restartToUpdate, runLaunchUpdate, setupUpdater } = await import('../src/main/updater')
setupUpdater()

describe('a failed install', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.ctx.quitting = false
    h.ctx.main = { hide: vi.fn() }
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('from Restart to update brings the app back instead of leaving "Installing…" up', () => {
    h.updater.emit('update-downloaded', { version: '0.3.1' })
    restartToUpdate()
    vi.advanceTimersByTime(1000)
    expect(h.updater.quitAndInstall).toHaveBeenCalled()
    expect(h.closeSplash).toHaveBeenCalled()
    expect(h.ctx.quitting).toBe(false)
    expect(h.showMainWindow).toHaveBeenCalled()
  })

  it('at launch opens the app instead of leaving "Installing…" up', () => {
    const onDone = vi.fn()
    runLaunchUpdate(onDone)
    h.updater.emit('update-available', { version: '0.3.1' })
    h.updater.emit('update-downloaded', { version: '0.3.1' })
    vi.advanceTimersByTime(1000)
    expect(h.updater.quitAndInstall).toHaveBeenCalled()
    expect(h.closeSplash).toHaveBeenCalled()
    expect(h.ctx.quitting).toBe(false)
    expect(onDone).toHaveBeenCalled()
  })
})
