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
  accessibility: {
    /** Chime when an ad becomes skippable, repeated a few times until it's skipped. */
    adChime: boolean
    /** 0–1 */
    chimeVolume: number
    /** Page zoom for YouTube Music and our overlay. */
    uiScale: number
    highContrast: boolean
    /** Turns off animations and transitions, but unlike performance mode keeps blur and the visualizer. */
    reduceMotion: boolean
    /** Screen-reader announcements for song changes and skippable ads. */
    announce: boolean
  }
  /** Mini player position (once dragged) and whether it stays open when clicking elsewhere. */
  mini: { position?: { x: number; y: number }; pinned: boolean }
  onboarding: { done: boolean }
  /**
   * Features that send data to a third party. None of them run until the user has seen the
   * first-run privacy screen (consented), and each can be switched off on its own.
   */
  privacy: {
    consented: boolean
    /** Look up lyrics on lrclib.net (sends the song title and artist). */
    onlineLyrics: boolean
    /** Check GitHub for new versions and install them on quit. */
    updateChecks: boolean
  }
}

export const DEFAULT_SETTINGS: Settings = {
  window: { maximized: false },
  auth: { identity: 'native' },
  eq: { enabled: false, preamp: 0, bands: BANDS.map(() => 0), bass: 0, normalize: false, custom: {} },
  theme: { id: 'original', custom: [], artBackground: false },
  ui: { performanceMode: false },
  shortcuts: defaultBindings(),
  notifications: { ads: true, trackChange: false },
  discord: { enabled: false, showWhenPaused: false },
  tray: { closeToTray: true, trayHintShown: false },
  lyrics: { fontScale: 1 },
  accessibility: { adChime: false, chimeVolume: 0.6, uiScale: 1, highContrast: false, reduceMotion: false, announce: true },
  mini: { pinned: false },
  onboarding: { done: false },
  privacy: { consented: false, onlineLyrics: true, updateChecks: true },
}

/** Settings the page overlay may change. Window, mini player and auth state stay main-process only. */
export const PAGE_WRITABLE = ['eq', 'theme', 'ui', 'shortcuts', 'notifications', 'discord', 'tray', 'lyrics', 'accessibility', 'onboarding', 'privacy'] as const

/** True once the user has agreed to a feature that talks to a third party. */
export const allows = (s: Settings, feature: 'onlineLyrics' | 'updateChecks'): boolean => s.privacy.consented && s.privacy[feature]

export const UI_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const
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
