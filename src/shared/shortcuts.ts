/**
 * Keyboard shortcuts. Accelerators use Electron's format ("Ctrl+Alt+Space") so global
 * bindings can go straight to globalShortcut; in-app bindings are matched in the page.
 */

export interface ActionInfo {
  label: string
  group: 'Playback' | 'Panels' | 'App'
  accelerator: string
  global: boolean
}

export const ACTIONS = {
  playPause: { label: 'Play / pause', group: 'Playback', accelerator: 'Ctrl+Alt+Space', global: true },
  next: { label: 'Next track', group: 'Playback', accelerator: 'Ctrl+Alt+Right', global: true },
  previous: { label: 'Previous track', group: 'Playback', accelerator: 'Ctrl+Alt+Left', global: true },
  volumeUp: { label: 'Volume up', group: 'Playback', accelerator: 'Ctrl+Alt+Up', global: true },
  volumeDown: { label: 'Volume down', group: 'Playback', accelerator: 'Ctrl+Alt+Down', global: true },
  seekForward: { label: 'Seek forward 10s', group: 'Playback', accelerator: 'Ctrl+Right', global: false },
  seekBack: { label: 'Seek back 10s', group: 'Playback', accelerator: 'Ctrl+Left', global: false },
  like: { label: 'Like', group: 'Playback', accelerator: 'Ctrl+Alt+L', global: true },
  dislike: { label: 'Dislike', group: 'Playback', accelerator: 'Ctrl+Alt+D', global: false },
  shuffle: { label: 'Shuffle', group: 'Playback', accelerator: 'Ctrl+Alt+S', global: false },
  repeat: { label: 'Repeat (off / all / one)', group: 'Playback', accelerator: 'Ctrl+Alt+R', global: false },
  skipAd: { label: 'Skip ad', group: 'Playback', accelerator: 'Ctrl+Shift+S', global: true },
  toggleEq: { label: 'Equalizer on / off', group: 'Playback', accelerator: 'Ctrl+Shift+E', global: false },
  openEqualizer: { label: 'Open equalizer', group: 'Panels', accelerator: 'Ctrl+E', global: false },
  openLyrics: { label: 'Open lyrics', group: 'Panels', accelerator: 'Ctrl+L', global: false },
  fullLyrics: { label: 'Full-screen lyrics', group: 'Panels', accelerator: 'Ctrl+Shift+L', global: false },
  openThemes: { label: 'Open themes', group: 'Panels', accelerator: 'Ctrl+T', global: false },
  openShortcuts: { label: 'Edit shortcuts', group: 'Panels', accelerator: 'Ctrl+K', global: false },
  openSettings: { label: 'Open settings', group: 'Panels', accelerator: 'Ctrl+,', global: false },
  cheatSheet: { label: 'Shortcut cheat sheet', group: 'App', accelerator: 'Ctrl+/', global: false },
  toggleWindow: { label: 'Show / hide window', group: 'App', accelerator: 'Ctrl+Alt+M', global: true },
  miniPlayer: { label: 'Mini player', group: 'App', accelerator: 'Ctrl+Alt+P', global: true },
} as const satisfies Record<string, ActionInfo>

export type ActionId = keyof typeof ACTIONS
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]

export interface Binding {
  accelerator: string
  global: boolean
}

export type Bindings = Record<ActionId, Binding>

export const defaultBindings = (): Bindings =>
  Object.fromEntries(ACTION_IDS.map((id) => [id, { accelerator: ACTIONS[id].accelerator, global: ACTIONS[id].global }])) as Bindings

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Super'] as const
const MOD_ALIASES: Record<string, (typeof MODIFIERS)[number]> = {
  ctrl: 'Ctrl', control: 'Ctrl', commandorcontrol: 'Ctrl', cmdorctrl: 'Ctrl',
  alt: 'Alt', option: 'Alt', shift: 'Shift', super: 'Super', meta: 'Super', win: 'Super',
}

/** Canonical form: modifiers in a fixed order, key last. "alt+ctrl+l" → "Ctrl+Alt+L". */
export function normalize(accelerator: string): string {
  const parts = accelerator.split('+').map((p) => p.trim())
  // "Ctrl++" means the plus key.
  if (accelerator.endsWith('++')) parts.splice(-2, 2, 'Plus')
  const mods = new Set<string>()
  let key = ''
  for (const part of parts) {
    const mod = MOD_ALIASES[part.toLowerCase()]
    if (mod) mods.add(mod)
    else if (part) key = part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)
  }
  return [...MODIFIERS.filter((m) => mods.has(m)), key].filter(Boolean).join('+')
}

const CODE_KEYS: Record<string, string> = {
  Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
  Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
}

/** Accelerator for a keydown event, or null for a lone modifier press. Uses physical keys so it works on any layout. */
export function eventToAccelerator(e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null {
  let key: string | undefined
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5)
  else if (/^Numpad\d$/.test(e.code)) key = `num${e.code.slice(6)}`
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code
  else key = CODE_KEYS[e.code]
  if (!key) return null
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean)
  return [...mods, key].join('+')
}

/** Groups of actions that share the same accelerator. */
export function findConflicts(bindings: Bindings): ActionId[][] {
  const byAccel = new Map<string, ActionId[]>()
  for (const id of ACTION_IDS) {
    const accel = bindings[id]?.accelerator
    if (!accel) continue
    const key = normalize(accel)
    byAccel.set(key, [...(byAccel.get(key) ?? []), id])
  }
  return [...byAccel.values()].filter((ids) => ids.length > 1)
}

/** Global shortcuts without Ctrl/Alt/Super would swallow ordinary typing in every other app. */
export function isSafeGlobal(accelerator: string): boolean {
  return /(^|\+)(Ctrl|Alt|Super)\+/.test(normalize(accelerator)) || /^F\d{1,2}$/.test(normalize(accelerator))
}

/** Display form for UI, e.g. "Ctrl + Alt + Space". */
export const prettyAccelerator = (accelerator: string): string[] => (accelerator ? normalize(accelerator).split('+') : [])
