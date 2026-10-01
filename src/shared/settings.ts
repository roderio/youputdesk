import type { Rectangle } from 'electron'
import { BANDS } from './eq'
import { defaultBindings, type Bindings } from './shortcuts'
import type { Theme } from './themes'

/** How we present ourselves to Google during sign-in. See main/ua.ts. */
export type Identity = 'native' | 'chrome' | 'firefox'

export interface Settings {
  window: { bounds?: Rectangle; maximized: boolean }
  auth: { identity: Identity }
  eq: {
    enabled: boolean
    /** dB applied before the EQ; negative values give boosted bands headroom. */
    preamp: number
    bands: number[]
    /** Extra low-shelf boost, dB. */
    bass: number
    /** Evens out loud and quiet tracks. */
    normalize: boolean
    custom: Record<string, number[]>
  }
  theme: {
    id: string
    custom: Theme[]
    /** Blurred album art behind the app. */
    artBackground: boolean
  }
  ui: {
    /** Turns off blur, the visualizer and all transitions. */
    performanceMode: boolean
  }
  shortcuts: Bindings
  notifications: { ads: boolean; trackChange: boolean }
  discord: { enabled: boolean; showWhenPaused: boolean }
  tray: { closeToTray: boolean; trayHintShown: boolean }
  lyrics: { fontScale: number }
  onboarding: { done: boolean }
}

export const DEFAULT_SETTINGS: Settings = {
  window: { maximized: false },
  auth: { identity: 'native' },
  eq: { enabled: false, preamp: 0, bands: BANDS.map(() => 0), bass: 0, normalize: false, custom: {} },
  theme: { id: 'original', custom: [], artBackground: false },
  ui: { performanceMode: false },
  shortcuts: defaultBindings(),
  notifications: { ads: true, trackChange: false },
  discord: { enabled: true, showWhenPaused: false },
  tray: { closeToTray: true, trayHintShown: false },
  lyrics: { fontScale: 1 },
  onboarding: { done: false },
}

/** Settings the page overlay may change. Window and auth state stay main-process only. */
export const PAGE_WRITABLE = ['eq', 'theme', 'ui', 'shortcuts', 'notifications', 'discord', 'tray', 'lyrics', 'onboarding'] as const
export type PageWritableKey = (typeof PAGE_WRITABLE)[number]

/** Fill keys missing from stored settings (e.g. added in a newer version) from the defaults. */
export function withDefaults<T>(defaults: T, stored: unknown): T {
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) {
    return (stored ?? defaults) as T
  }
  const out: Record<string, unknown> = { ...(stored as object) }
  for (const [key, value] of Object.entries(defaults)) {
    out[key] = withDefaults(value, (stored as Record<string, unknown> | undefined)?.[key])
  }
  return out as T
}
