/** Latest player state reported by the page, and the hub every feature listens to. */
import { EventEmitter } from 'node:events'
import type { AdState, PlayerState } from '../shared/ipc'

interface PlayerEvents {
  /** Any state update (about once a second while playing, immediately on changes). */
  state: [PlayerState]
  /** A different song started. Not fired for ads. */
  track: [PlayerState]
  /** Play/pause flipped. */
  playback: [PlayerState]
  ad: [AdState]
}

class Player extends EventEmitter<PlayerEvents> {
  state: PlayerState | null = null
  ad: AdState = { active: false, skippable: false }

  update(next: PlayerState): void {
    const prev = this.state
    this.state = next
    this.emit('state', next)
    if (next.videoId && next.videoId !== prev?.videoId && !next.ad) this.emit('track', next)
    if (prev && prev.playing !== next.playing) this.emit('playback', next)
  }

  updateAd(next: AdState): void {
    if (next.active === this.ad.active && next.skippable === this.ad.skippable) return
    this.ad = next
    this.emit('ad', next)
  }
}

export const player = new Player()

/** Validate a page-reported state. The page is YouTube's, so treat it as untrusted input. */
export function parseState(value: unknown): PlayerState | null {
  const v = value as Record<string, unknown>
  if (!v || typeof v !== 'object') return null
  const str = (x: unknown, max = 500) => (typeof x === 'string' ? x.slice(0, max) : '')
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const artwork = str(v.artwork, 2000)
  return {
    videoId: str(v.videoId, 32),
    title: str(v.title),
    artist: str(v.artist),
    album: str(v.album),
    artwork: /^https:\/\//.test(artwork) ? artwork : '',
    duration: num(v.duration),
    position: num(v.position),
    playing: v.playing === true,
    volume: Math.min(100, Math.max(0, num(v.volume))),
    liked: v.liked === 'like' || v.liked === 'dislike' ? v.liked : 'none',
    shuffle: typeof v.shuffle === 'boolean' ? v.shuffle : null,
    repeat: v.repeat === 'all' || v.repeat === 'one' ? v.repeat : 'none',
    ad: v.ad === true,
  }
}
