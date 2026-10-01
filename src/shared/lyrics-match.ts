/** Choosing the right LRCLIB entry for what YouTube Music is playing. Pure, so it's unit-tested. */

export interface LrcLibTrack {
  trackName: string
  artistName: string
  albumName?: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

/** Synced lyrics are only trustworthy if the recording is the same length (LRCLIB itself uses ±2s). */
export const SYNC_TOLERANCE_S = 3
/** Shorter "tracks" on LRCLIB are snippets/intros, never the song. */
const MIN_TRACK_S = 30

const NOISE = /\s*[([](?:[^)\]]*\b(?:official|lyrics?|audio|video|visuali[sz]er|explicit|clean|remaster(?:ed)?|mv|hd|4k|live|feat\.?|ft\.?|with)\b[^)\]]*)[)\]]/gi

/**
 * YTM titles carry noise LRCLIB doesn't index: "Starboy ft. Daft Punk (Official Video)" → "Starboy".
 * Channel uploads often read "Artist - Title"; pass the artist to drop that prefix.
 */
export function cleanTitle(title: string, artist = ''): string {
  const main = cleanArtist(artist).toLowerCase()
  const dash = title.indexOf(' - ')
  if (main && dash > 0 && title.slice(0, dash).toLowerCase().includes(main)) title = title.slice(dash + 3)
  return title
    .replace(NOISE, '')
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First credited artist, without YouTube's " - Topic" channel suffix. */
export function cleanArtist(artist: string): string {
  return artist.replace(/\s+-\s+Topic$/i, '').split(/\s*[,&]\s*|\s+(?:feat\.?|ft\.?|x|with)\s+/i)[0].trim()
}

/** LRC text without its timestamps, for showing synced lyrics unsynced. */
export const stripTimestamps = (lrc: string): string =>
  lrc.split(/\r?\n/).map((l) => l.replace(/\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g, '').trim()).join('\n').trim()

export interface Pick {
  track: LrcLibTrack
  /** Same recording length, so the timestamps line up with what's playing. */
  inSync: boolean
}

/** Best entry: same-length synced > same-length plain > closest-length other version (shown unsynced). */
export function pickBest(results: LrcLibTrack[], duration: number): Pick | null {
  const usable = results.filter((t) => (t.syncedLyrics || t.plainLyrics || t.instrumental) && t.duration >= MIN_TRACK_S)
  if (usable.length === 0) return null
  if (duration > 0) {
    const gap = (t: LrcLibTrack) => Math.abs(t.duration - duration)
    const close = usable.filter((t) => gap(t) <= SYNC_TOLERANCE_S).sort((a, b) => gap(a) - gap(b))
    const best = close.find((t) => t.syncedLyrics) ?? close.find((t) => t.plainLyrics) ?? close.find((t) => t.instrumental)
    if (best) return { track: best, inSync: true }
  }
  // A different version (often the music video vs the album track): words are right, timings aren't.
  const withWords = usable.filter((t) => t.syncedLyrics || t.plainLyrics)
  if (withWords.length === 0) return null
  const closest = duration > 0 ? [...withWords].sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0] : withWords[0]
  return { track: closest, inSync: false }
}
