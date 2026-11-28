/**
 * Lyrics for the song playing, from Unison (https://unison.betterlyrics.org, word timing, looked up by video ID)
 * and LRCLIB (https://lrclib.net, line timing, looked up by title, artist and length). Both answers are saved on
 * disk side by side per video, and rankLyrics picks the one to show.
 */
import { app, net } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LrclibLyrics, LyricsQuery, LyricsResult, UnisonLyrics } from '../shared/ipc'
import { cleanArtist, cleanTitle, pickBest, stripTimestamps, type LrcLibTrack, type Pick } from '../shared/lyrics-match'
import { hasWordTiming, rankLyrics } from '../shared/lyrics-rank'
import { allows } from '../shared/settings'
import { UNISON_ORIGIN } from '../shared/unison'
import { store } from './store'

const API = 'https://lrclib.net/api'
const userAgent = () => `YouputDesk/${app.getVersion()} (desktop music player)`
/** Unison's licence asks us to drop lyrics it removes, so saved ones are re-checked this often. */
export const UNISON_RECHECK_MS = 7 * 24 * 3600 * 1000
const UNISON_MAX_CHARS = 512 * 1024
const UNISON_TIMEOUT_MS = 10_000

/** One saved file per video: LRCLIB's and Unison's answers, kept apart so switching Unison off loses neither. */
interface CacheEntry {
  /** Only found results; LRCLIB "not found" is remembered for this session only (it's community-filled). */
  lrclib?: LrclibLyrics
  /** result null: Unison had nothing (or something we couldn't use) when last asked. */
  unison?: { result: UnisonLyrics | null; etag?: string; checkedAt: number }
}

const cacheDir = () => join(app.getPath('userData'), 'lyrics-cache-v3')
/** Lyrics saved by versions before Unison: read as the LRCLIB answer, never written or deleted. */
const oldCacheDir = () => join(app.getPath('userData'), 'lyrics-cache-v2')
const memory = new Map<string, CacheEntry>()
const lrclibMisses = new Set<string>()
let background: Promise<unknown> = Promise.resolve()

async function request(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${API}/${path}?${new URLSearchParams(params)}`
  const res = await net.fetch(url, { headers: { 'User-Agent': userAgent() } })
  // 4xx means "no such track" (or a query LRCLIB won't take): that's "not found", not an outage.
  // Rate limits and server errors throw, so the user sees "Try again" and nothing gets cached.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) return null
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`)
  return res.json()
}

function toResult({ track, inSync }: Pick): LrclibLyrics {
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

async function fetchLyrics(q: LyricsQuery): Promise<LrclibLyrics | null> {
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

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

async function loadEntry(videoId: string): Promise<CacheEntry> {
  const known = memory.get(videoId)
  if (known) return known
  const saved = (await readJson(join(cacheDir(), `${videoId}.json`))) as CacheEntry | undefined
  let entry: CacheEntry = saved && typeof saved === 'object' ? saved : {}
  if (!saved) {
    const old = (await readJson(join(oldCacheDir(), `${videoId}.json`))) as LrclibLyrics | null | undefined
    if (old && typeof old === 'object') entry = { lrclib: { ...old, source: 'lrclib' } }
  }
  memory.set(videoId, entry)
  return entry
}

async function saveEntry(videoId: string, entry: CacheEntry): Promise<void> {
  memory.set(videoId, entry)
  await mkdir(cacheDir(), { recursive: true })
  await writeFile(join(cacheDir(), `${videoId}.json`), JSON.stringify(entry))
}

/** A Unison answer we can show: for this exact video, in a format we read, and not absurdly large. */
function toUnison(body: unknown, videoId: string): UnisonLyrics | null {
  const data = (body as { success?: unknown; data?: Record<string, unknown> } | null)?.success === true
    ? (body as { data?: Record<string, unknown> }).data
    : undefined
  if (!data || data.videoId !== videoId) return null
  const { format, lyrics } = data
  if (format !== 'ttml' && format !== 'lrc' && format !== 'plain') return null
  if (typeof lyrics !== 'string' || !lyrics.trim() || lyrics.length > UNISON_MAX_CHARS) return null
  const submitter = (data.submitter ?? {}) as { displayName?: unknown; keyId?: unknown }
  return {
    source: 'unison',
    format,
    text: lyrics,
    credit: {
      videoId,
      submitterName: typeof submitter.displayName === 'string' ? submitter.displayName : '',
      submitterKeyId: typeof submitter.keyId === 'string' ? submitter.keyId : '',
    },
  }
}

/**
 * Ask Unison about one video (only its ID leaves the PC). Returns the new slot, or undefined when Unison
 * couldn't be reached: then whatever was saved stays as it is.
 */
async function askUnison(videoId: string, slot: CacheEntry['unison']): Promise<CacheEntry['unison'] | undefined> {
  const headers: Record<string, string> = { 'User-Agent': userAgent() }
  if (slot?.etag && slot.result) headers['If-None-Match'] = slot.etag
  let res: Response
  try {
    res = await net.fetch(`${UNISON_ORIGIN}/lyrics?${new URLSearchParams({ v: videoId })}`, {
      headers,
      signal: AbortSignal.timeout(UNISON_TIMEOUT_MS),
    })
  } catch {
    return undefined
  }
  const checkedAt = Date.now()
  if (res.status === 304 && slot) return { ...slot, checkedAt }
  if (res.status === 404) return { result: null, checkedAt }
  if (!res.ok) return undefined
  const result = toUnison(await res.json().catch(() => null), videoId)
  const etag = res.headers.get('etag') ?? undefined
  return result ? { result, etag, checkedAt } : { result: null, checkedAt }
}

/** The weekly re-check, after the saved lyrics were already shown. Errors are ignored: the next open retries. */
function recheckUnison(videoId: string): void {
  background = background.then(async () => {
    // Re-checks queue up, so by now the user may have switched Unison off, or an earlier one refreshed this song.
    if (!allows(store.store, 'unison')) return
    const entry = await loadEntry(videoId)
    if (Date.now() - (entry.unison?.checkedAt ?? 0) <= UNISON_RECHECK_MS) return
    const slot = await askUnison(videoId, entry.unison)
    if (slot) await saveEntry(videoId, { ...(memory.get(videoId) ?? entry), unison: slot })
  }).catch(() => {})
}

/** Resolves once background re-checks are done. For tests. */
export const settledForTests = (): Promise<void> => background.then(() => {})

export async function getLyrics(q: LyricsQuery): Promise<LyricsResult | null> {
  // Without title, artist and duration we'd match the wrong song (and cache it), so refuse.
  if (!q?.videoId || !/^[\w-]{6,20}$/.test(q.videoId) || !q.title || !cleanArtist(q.artist ?? '') || !(q.duration > 0)) return null
  const id = q.videoId
  const entry = { ...(await loadEntry(id)) }
  /** The slots this call fetched. Only these are saved, so a re-check that finished meanwhile isn't undone. */
  const changed: CacheEntry = {}
  // Song details only leave the PC once the user has allowed online lyrics (and, for Unison, word-by-word lyrics).
  const useUnison = allows(store.store, 'unison') && q.exclude !== 'unison'
  const hadUnison = !!entry.unison

  if (useUnison && (!entry.unison || q.refresh)) {
    const slot = await askUnison(id, entry.unison)
    if (slot) entry.unison = changed.unison = slot
  }
  const unison = useUnison ? entry.unison?.result : undefined

  // Word timing from Unison beats anything LRCLIB has, so don't ask LRCLIB at all.
  if (!(unison && hasWordTiming(unison))) {
    const needLrclib = (!entry.lrclib || q.refresh) && (q.refresh || !lrclibMisses.has(id))
    if (needLrclib && allows(store.store, 'onlineLyrics')) {
      try {
        const found = await fetchLyrics(q)
        if (found) {
          entry.lrclib = changed.lrclib = found
          lrclibMisses.delete(id)
        } else {
          lrclibMisses.add(id)
        }
      } catch (err) {
        // Network errors aren't saved, so the next play retries. Show Unison's lyrics meanwhile, if any.
        if (!rankLyrics({ lrclib: entry.lrclib, unison })) throw err
      }
    }
  }

  if (changed.lrclib || changed.unison) await saveEntry(id, { ...memory.get(id), ...changed })
  if (useUnison && hadUnison && !q.refresh && Date.now() - (entry.unison?.checkedAt ?? 0) > UNISON_RECHECK_MS) recheckUnison(id)
  return rankLyrics({ lrclib: entry.lrclib, unison })
}
