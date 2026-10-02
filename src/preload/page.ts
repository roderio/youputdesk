/**
 * Talks to YouTube's own player object (#movie_player), which lives in the page's main world.
 * Functions passed to executeInMainWorld are serialised, so they must be self-contained.
 */
import { contextBridge } from 'electron'
import type { PlayerState } from '../shared/ipc'
import { SEL } from '../shared/selectors'

const inPage = <A extends unknown[], R>(func: (...args: A) => R, ...args: A): R =>
  contextBridge.executeInMainWorld({ func, args }) as R

interface RawPlayer {
  videoId: string
  title: string
  author: string
  mdArtist: string
  album: string
  art: { src: string; sizes: string }[]
  duration: number
  position: number
  state: number
  volume: number
  muted: boolean
  ad: boolean
}

function readPlayerInPage(): RawPlayer | null {
  type YtPlayer = HTMLElement & Record<string, (...a: unknown[]) => any>
  const p = document.getElementById('movie_player') as YtPlayer | null
  if (!p || typeof p.getVideoData !== 'function') return null
  const d = p.getVideoData() || {}
  const md = navigator.mediaSession && navigator.mediaSession.metadata
  // During ads mediaSession describes the ad, so only trust it when it matches the song.
  const mdMatches = !!md && md.title === d.title
  return {
    videoId: d.video_id || '',
    title: d.title || '',
    author: d.author || '',
    mdArtist: mdMatches ? md.artist : '',
    album: mdMatches ? md.album : '',
    art: mdMatches ? Array.from(md.artwork || []).map((a) => ({ src: a.src, sizes: a.sizes || '' })) : [],
    duration: Number(p.getDuration()) || 0,
    position: Number(p.getCurrentTime()) || 0,
    state: Number(p.getPlayerState()),
    volume: Number(p.getVolume()) || 0,
    muted: !!p.isMuted(),
    ad: p.classList.contains('ad-showing'),
  }
}

function bestArt(raw: RawPlayer): string {
  const area = (s: string) => s.split('x').reduce((a, b) => a * (Number(b) || 0), 1)
  const best = [...raw.art].sort((a, b) => area(b.sizes) - area(a.sizes))[0]?.src
  // Googleusercontent art URLs carry their size; ask for a crisp large one.
  if (best) return best.replace(/=w\d+-h\d+/, '=w544-h544')
  return raw.videoId ? `https://i.ytimg.com/vi/${raw.videoId}/hqdefault.jpg` : ''
}

function likeStatus(): PlayerState['liked'] {
  if (document.querySelector(SEL.likeButton)?.getAttribute('aria-pressed') === 'true') return 'like'
  if (document.querySelector(SEL.dislikeButton)?.getAttribute('aria-pressed') === 'true') return 'dislike'
  return 'none'
}

const visible = (el: Element | null | undefined): el is HTMLElement => !!el && (el as HTMLElement).offsetParent !== null

/** YTM's shuffle or repeat button, in whichever player layout this session has. */
function toggleButton(kind: 'shuffle' | 'repeat'): HTMLElement | null {
  const classic = [...document.querySelectorAll(kind === 'shuffle' ? SEL.shuffleButton : SEL.repeatButton)].find(visible)
  if (classic) return classic.querySelector<HTMLElement>('button') ?? (classic as HTMLElement)
  const toggles = [...document.querySelectorAll<HTMLElement>(SEL.toggleButtons)]
  if (toggles.length < 2) return null
  return kind === 'shuffle' ? toggles[0] : toggles[toggles.length - 1]
}

function shuffleState(): boolean | null {
  // The classic layout's shuffle just reshuffles the queue once; it has no on/off state.
  if (document.querySelector(SEL.shuffleButton)) return null
  const button = toggleButton('shuffle')
  return button ? button.getAttribute('aria-pressed') === 'true' : null
}

function repeatState(): PlayerState['repeat'] {
  const mode = document.querySelector(SEL.playerBar)?.getAttribute('repeat-mode')
  if (mode) return mode === 'ONE' ? 'one' : mode === 'ALL' ? 'all' : 'none'
  const button = toggleButton('repeat')
  if (button?.getAttribute('aria-pressed') !== 'true') return 'none'
  // The newer layout only says "pressed"; its label tells "repeat one" apart (in English, or with a 1).
  return /one|1/i.test(button.getAttribute('aria-label') ?? '') ? 'one' : 'all'
}

/** Press YTM's own shuffle / repeat button. Returns false if this layout doesn't have one. */
export function clickToggle(kind: 'shuffle' | 'repeat'): boolean {
  const button = toggleButton(kind)
  button?.click()
  return !!button
}

export const readToggles = (): Pick<PlayerState, 'shuffle' | 'repeat'> => ({ shuffle: shuffleState(), repeat: repeatState() })

export function readPlayer(): PlayerState | null {
  let raw: RawPlayer | null
  try {
    raw = inPage(readPlayerInPage)
  } catch {
    return null
  }
  // Right after a track change YTM briefly reports the new video id with no title and zero
  // duration. Skip that tick; it fills in within a fraction of a second.
  if (!raw || !raw.videoId || !raw.title) return null
  return {
    videoId: raw.videoId,
    title: raw.title,
    artist: (raw.mdArtist || raw.author).replace(/\s+-\s+Topic$/i, ''),
    album: raw.album,
    artwork: bestArt(raw),
    duration: raw.duration,
    position: raw.position,
    // 1 = playing, 3 = buffering (still "playing" from the user's point of view)
    playing: raw.state === 1 || raw.state === 3,
    volume: raw.muted ? 0 : raw.volume,
    liked: likeStatus(),
    ...readToggles(),
    ad: raw.ad,
  }
}

type Command = 'playPause' | 'play' | 'pause' | 'next' | 'previous' | 'seekBy' | 'seekTo' | 'volumeBy'

function commandInPage(cmd: Command, arg: number): number | null {
  type YtPlayer = HTMLElement & Record<string, (...a: unknown[]) => any>
  const p = document.getElementById('movie_player') as YtPlayer | null
  if (!p || typeof p.getPlayerState !== 'function') return null
  switch (cmd) {
    case 'playPause':
      if (p.getPlayerState() === 1) p.pauseVideo()
      else p.playVideo()
      return null
    case 'play':
      p.playVideo()
      return null
    case 'pause':
      p.pauseVideo()
      return null
    case 'next':
      p.nextVideo()
      return null
    case 'previous':
      p.previousVideo()
      return null
    case 'seekBy':
      p.seekTo(Math.max(0, p.getCurrentTime() + arg), true)
      return null
    case 'seekTo':
      p.seekTo(Math.max(0, arg), true)
      return null
    case 'volumeBy': {
      const volume = Math.max(0, Math.min(100, Math.round((p.isMuted() ? 0 : p.getVolume()) + arg)))
      p.setVolume(volume)
      if (volume > 0 && p.isMuted()) p.unMute()
      return volume
    }
  }
}

export function playerCommand(cmd: Command, arg = 0): number | null {
  try {
    return inPage(commandInPage, cmd, arg)
  } catch {
    return null
  }
}

/**
 * Read or move YTM's volume slider. Runs in the main world, because the player bar's slider is a
 * Polymer element whose value is only visible there. Returns the slider position, or null without one.
 */
function sliderInPage(selector: string, target: number | null, delta: number): number | null {
  const s = document.querySelector(selector) as (HTMLElement & { value?: unknown }) | null
  if (!s || s.value === undefined || s.value === null || s.value === '') return null
  const now = Number(s.value)
  if (!Number.isFinite(now)) return null
  if (target === null && delta === 0) return now
  const next = Math.max(0, Math.min(100, Math.round(target ?? now + delta)))
  const input = s.tagName === 'INPUT'
  s.value = input ? String(next) : next
  // YTM listens for these on its slider; it then sets the player volume to match.
  if (input) s.dispatchEvent(new Event('input', { bubbles: true }))
  s.dispatchEvent(new Event('change', { bubbles: true }))
  return next
}

const slider = (target: number | null, delta = 0): number | null => {
  try {
    return inPage(sliderInPage, SEL.volumeSlider, target, delta)
  } catch {
    return null
  }
}

/** The volume slider's position (0–100, what the user sees), or null if YTM hasn't drawn it. */
export const readVolumeSlider = (): number | null => slider(null)

/** Move the volume slider to `position` (0–100). Returns the new position, or null without a slider. */
export const setVolumeSlider = (position: number): number | null => slider(position)

/** Change volume by `delta` slider steps. Returns the new position, or null if there's no player. */
export function changeVolume(delta: number): number | null {
  return slider(null, delta) ?? playerCommand('volumeBy', delta)
}

/** Click YTM's like/dislike button. Returns false if the button couldn't be found. */
export function clickRating(kind: 'like' | 'dislike'): boolean {
  const button = document.querySelector<HTMLButtonElement>(kind === 'like' ? SEL.likeButton : SEL.dislikeButton)
  button?.click()
  return !!button
}

export const videoElement = (): HTMLVideoElement | null => document.querySelector<HTMLVideoElement>(SEL.video)
