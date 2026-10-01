/** Overlay state: one small store shared by the toolbar, panels and background features. */
import { ipcRenderer } from 'electron'
import { useEffect, useState } from 'preact/hooks'
import { IPC, type AdState, type DiscordStatus, type PlayerState } from '../shared/ipc'
import type { PageWritableKey, Settings } from '../shared/settings'
import type { ActionId } from '../shared/shortcuts'
import type { Palette, Theme } from '../shared/themes'

export type Panel = 'eq' | 'lyrics' | 'themes' | 'shortcuts' | 'settings'

export interface Toast {
  id: number
  text: string
  icon?: string
}

export interface UiState {
  settings: Settings
  player: PlayerState | null
  ad: AdState
  panel: Panel | null
  fullLyrics: boolean
  cheatSheet: boolean
  welcome: boolean
  toasts: Toast[]
  failedShortcuts: ActionId[]
  discord: DiscordStatus
  palette: Palette | null
  /** Theme being edited; previewed live without saving. */
  draftTheme: Theme | null
  /** A shortcut field is capturing keys, so in-app shortcuts must not fire. */
  recording: boolean
  version: string
}

let state: UiState
const listeners = new Set<() => void>()

export const getState = (): UiState => state

export function initState(initial: UiState): void {
  state = initial
}

export function setState(patch: Partial<UiState>): void {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Subscribe a component to part of the state; re-renders only when that part changes. */
export function useUi<T>(select: (s: UiState) => T): T {
  const [value, setValue] = useState(() => select(state))
  useEffect(() => {
    const check = () => setValue(() => select(state))
    check()
    return subscribe(check)
  }, [])
  return value
}

/** Writes in flight per section. While a slider is dragged, main's echoes of older values must not snap it back. */
const pending = new Map<string, number>()

/** Change a settings section. Applied locally at once, then persisted by main (which echoes it back). */
export function updateSettings<K extends PageWritableKey>(key: K, patch: Partial<Settings[K]>): void {
  const next = { ...state.settings[key], ...patch } as Settings[K]
  setState({ settings: { ...state.settings, [key]: next } })
  pending.set(key, (pending.get(key) ?? 0) + 1)
  ipcRenderer.invoke(IPC.settingsSet, key, next).finally(() => pending.set(key, (pending.get(key) ?? 1) - 1))
}

/** Settings pushed by main: take them, except sections this page is still writing. */
export function receiveSettings(incoming: Settings): void {
  const merged = { ...incoming }
  for (const [key, count] of pending) {
    if (count > 0) (merged as Record<string, unknown>)[key] = state.settings[key as keyof Settings]
  }
  setState({ settings: merged })
}

let toastId = 0
export function toast(text: string, icon?: string): void {
  const t = { id: ++toastId, text, icon }
  setState({ toasts: [...state.toasts.slice(-2), t] })
  setTimeout(() => setState({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 2200)
}

export function openPanel(panel: Panel | null): void {
  setState({ panel: state.panel === panel ? null : panel })
}
