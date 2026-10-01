/** System-wide shortcuts. In-app ones are matched in the page (preload/keys.ts). */
import { globalShortcut } from 'electron'
import { IPC } from '../shared/ipc'
import { ACTION_IDS, isSafeGlobal, type ActionId, type Bindings } from '../shared/shortcuts'
import { broadcast, sendAction, toggleMainWindow } from './context'
import { toggleMiniPlayer } from './mini'
import { store } from './store'

/** Global bindings that couldn't be registered (usually another app owns the combo). */
let failed: ActionId[] = []

export const shortcutStatus = (): { failed: ActionId[] } => ({ failed })

function run(id: ActionId): void {
  if (id === 'toggleWindow') toggleMainWindow()
  else if (id === 'miniPlayer') toggleMiniPlayer()
  else sendAction(id)
}

function register(bindings: Bindings): void {
  globalShortcut.unregisterAll()
  failed = []
  for (const id of ACTION_IDS) {
    const b = bindings[id]
    if (!b?.global || !b.accelerator || !isSafeGlobal(b.accelerator)) continue
    try {
      if (!globalShortcut.register(b.accelerator, () => run(id))) failed.push(id)
    } catch {
      failed.push(id)
    }
  }
  broadcast(IPC.shortcutStatus, shortcutStatus())
}

export function setupShortcuts(): void {
  register(store.get('shortcuts'))
  store.onDidChange('shortcuts', (next) => next && register(next))
}

export const teardownShortcuts = (): void => globalShortcut.unregisterAll()
