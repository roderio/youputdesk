/** IPC channel names and payloads shared by main and preloads. */

export interface PlayerState {
  videoId: string
  title: string
  artist: string
  album: string
  /** Large album art URL. */
  artwork: string
  duration: number
  position: number
  playing: boolean
  /** 0–100 */
  volume: number
  liked: 'like' | 'dislike' | 'none'
  /** null when YTM's shuffle is a one-shot "shuffle the queue" button rather than a toggle. */
  shuffle: boolean | null
  repeat: 'none' | 'all' | 'one'
  /** An ad is playing; track fields still describe the song that follows. */
  ad: boolean
}

export interface AdState {
  active: boolean
  skippable: boolean
}

export interface LyricsResult {
  synced: string | null
  plain: string | null
  instrumental: boolean
  /** Lyrics come from a different-length version (e.g. album track vs music video), so they're shown unsynced. */
  otherVersion?: boolean
  source: 'lrclib'
}

export interface LyricsQuery {
  videoId: string
  title: string
  artist: string
  album: string
  duration: number
  /** Skip the cache (user pressed "Try again"). */
  refresh?: boolean
}

export interface DiscordStatus {
  enabled: boolean
  connected: boolean
}

/** Mini player display preferences, pushed by main. */
export interface MiniPrefs {
  pinned: boolean
  reduceMotion: boolean
}

/** Updater window state, pushed by main. */
export interface UpdateStatus {
  phase: 'checking' | 'downloading' | 'installing' | 'done'
  version?: string
  /** 0–100 */
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  reduceMotion: boolean
}

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsChanged: 'settings:changed',
  playerState: 'player:state',
  adState: 'ad:state',
  /** page → main: press YTM's Skip button with a real mouse click at these page coordinates. */
  skipAdClick: 'ad:skip-click',
  /** main → page: run an action (from a global shortcut, tray, toast, thumbar…). */
  action: 'action',
  /** page → main: actions only main can perform (window, mini player). */
  appAction: 'app:action',
  lyricsGet: 'lyrics:get',
  palette: 'theme:palette',
  shortcutStatus: 'shortcuts:status',
  discordStatus: 'discord:status',
  appInfo: 'app:info',
  /** mini player ↔ main */
  miniState: 'mini:state',
  miniCommand: 'mini:command',
  miniPrefs: 'mini:prefs',
  /** updater window ↔ main */
  updaterStatus: 'updater:status',
  updaterCommand: 'updater:command',
} as const
