/** Synced lyrics from LRCLIB (https://lrclib.net), cached on disk per video. */
import { app, net } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LyricsQuery, LyricsResult } from '../shared/ipc'
import { cleanArtist, cleanTitle, pickBest, stripTimestamps, type LrcLibTrack, type Pick } from '../shared/lyrics-match'
import { allows } from '../shared/settings'
import { store } from './store'

const API = 'https://lrclib.net/api'
const cacheDir = () => join(app.getPath('userData'), 'lyrics-cache-v2')
const memory = new Map<string, LyricsResult | null>()

async function request(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${API}/${path}?${new URLSearchParams(params)}`
  const res = await net.fetch(url, { headers: { 'User-Agent': `YouputDesk/${app.getVersion()} (desktop music player)` } })
  // 4xx means "no such track" (or a query LRCLIB won't take): that's "not found", not an outage.
  // Rate limits and server errors throw, so the user sees "Try again" and nothing gets cached.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) return null
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`)
  return res.json()
}

function toResult({ track, inSync }: Pick): LyricsResult {
  const plain = track.plainLyrics || (track.syncedLyrics ? stripTimestamps(track.syncedLyrics) : null)
  return {
    // Timestamps from a different-length recording would highlight the wrong lines, so drop them.
    synced: inSync ? track.syncedLyrics || null : null,
    plain,
    instrumental: track.instrumental && !plain,
    otherVersion: !inSync,
    source: 'lrclib',
  }
}

async function fetchLyrics(q: LyricsQuery): Promise<LyricsResult | null> {
  const track_name = cleanTitle(q.title, q.artist) || q.title
  const artist_name = cleanArtist(q.artist)
  const found: LrcLibTrack[] = []

  const exact = (await request('get', {
    track_name,
    artist_name,
    ...(q.album ? { album_name: q.album } : {}),
    duration: String(Math.round(q.duration)),
  })) as LrcLibTrack | null
  if (exact) found.push(exact)
  let best = pickBest(found, q.duration)
  if (best?.inSync && best.track.syncedLyrics) return toResult(best)

  // Fuzzy searches: first by fields, then free text (catches artist/title spelled differently).
  found.push(...(((await request('search', { track_name, artist_name })) as LrcLibTrack[] | null) ?? []))
  best = pickBest(found, q.duration)
  if (!best?.inSync) {
    found.push(...(((await request('search', { q: `${artist_name} ${track_name}` })) as LrcLibTrack[] | null) ?? []))
    best = pickBest(found, q.duration)
  }
  return best ? toResult(best) : null
}

export async function getLyrics(q: LyricsQuery): Promise<LyricsResult | null> {
  // Without title, artist and duration we'd match the wrong song (and cache it), so refuse.
  if (!q?.videoId || !/^[\w-]{6,20}$/.test(q.videoId) || !q.title || !cleanArtist(q.artist ?? '') || !(q.duration > 0)) return null
  const file = join(cacheDir(), `${q.videoId}.json`)
  if (!q.refresh) {
    if (memory.has(q.videoId)) return memory.get(q.videoId)!
    try {
      const cached = JSON.parse(await readFile(file, 'utf8')) as LyricsResult | null
      memory.set(q.videoId, cached)
      return cached
    } catch {
      // Not cached yet.
    }
  }
  // Song details only leave the PC once the user has allowed online lyrics.
  if (!allows(store.store, 'onlineLyrics')) return null
  // Network errors throw and aren't cached, so the next play retries. "Not found" is only
  // remembered for this session, since LRCLIB is community-filled and may have it later.
  const result = await fetchLyrics(q)
  memory.set(q.videoId, result)
  if (result) {
    await mkdir(cacheDir(), { recursive: true })
    await writeFile(file, JSON.stringify(result))
  }
  return result
}
