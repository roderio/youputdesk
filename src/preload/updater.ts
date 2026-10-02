// Updater-window preload: our own page, so a tiny API on window is fine here.
// Type-only imports from shared code (see the note in mini.ts).
import { contextBridge, ipcRenderer } from 'electron'
import type { IPC as Channels, UpdateStatus } from '../shared/ipc'

const STATUS: (typeof Channels)['updaterStatus'] = 'updater:status'
const COMMAND: (typeof Channels)['updaterCommand'] = 'updater:command'

const api = {
  onStatus: (cb: (s: UpdateStatus) => void) => ipcRenderer.on(STATUS, (_e, s: UpdateStatus) => cb(s)),
  /** Stop waiting for the download and open the app; it keeps downloading in the background. */
  skip: () => ipcRenderer.send(COMMAND, 'skip'),
}

export type UpdaterApi = typeof api

contextBridge.exposeInMainWorld('updater', api)
