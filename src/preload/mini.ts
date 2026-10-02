// Mini-player preload: our own page, so a tiny API on window is fine here.
// Type-only imports from shared code: a runtime import would be split into a chunk file
// that sandboxed preloads can't load (see electron.vite.config.ts).
import { contextBridge, ipcRenderer } from 'electron'
import type { IPC as Channels, MiniPrefs, PlayerState } from '../shared/ipc'

const MINI_STATE: (typeof Channels)['miniState'] = 'mini:state'
const MINI_COMMAND: (typeof Channels)['miniCommand'] = 'mini:command'
const MINI_PREFS: (typeof Channels)['miniPrefs'] = 'mini:prefs'

export type MiniCommand = 'playPause' | 'next' | 'previous' | 'shuffle' | 'repeat' | 'volumeUp' | 'volumeDown' | 'open' | 'close' | 'pin' | { seek: number }

const api = {
  onState: (cb: (s: PlayerState | null) => void) => ipcRenderer.on(MINI_STATE, (_e, s: PlayerState | null) => cb(s)),
  onPrefs: (cb: (p: MiniPrefs) => void) => ipcRenderer.on(MINI_PREFS, (_e, p: MiniPrefs) => cb(p)),
  command: (cmd: MiniCommand) => ipcRenderer.send(MINI_COMMAND, cmd),
}

export type MiniApi = typeof api

contextBridge.exposeInMainWorld('mini', api)
