/** Shared handles: the main window and helpers to reach it. */
import { app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import type { ActionId } from '../shared/shortcuts'
import { IPC } from '../shared/ipc'

export const ctx = {
  main: null as BrowserWindow | null,
  /** Set once the user really quits, so close-to-tray lets the window go. */
  quitting: false,
}

/** Commands the page understands: every shortcut action, plus seeking to an absolute position (seconds). */
export type PageCommand = ActionId | 'seekTo'

/** Run an action in the page (playback, panels…). */
export function sendAction(id: PageCommand, arg?: number): void {
  ctx.main?.webContents.send(IPC.action, id, arg)
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function showMainWindow(): void {
  const win = ctx.main
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function toggleMainWindow(): void {
  const win = ctx.main
  if (!win) return
  if (win.isVisible() && win.isFocused() && !win.isMinimized()) win.hide()
  else showMainWindow()
}

/** True when the user is looking at the main window, so in-page UI is enough and toasts would be noise. */
export function isMainFocused(): boolean {
  const win = ctx.main
  return !!win && win.isVisible() && !win.isMinimized() && win.isFocused()
}

export const asset = (name: string): string => join(app.getAppPath(), 'resources', name)
export const assetImage = (name: string) => nativeImage.createFromPath(asset(name))
