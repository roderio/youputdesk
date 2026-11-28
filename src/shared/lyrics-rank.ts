/**
 * Which lyrics a song gets when both LRCLIB and Unison have something. Unison only moves ahead where it adds
 * word timing, or line timing LRCLIB lacks for this recording, so no song gets worse lyrics than before.
 * Main never parses TTML (the overlay does), so these checks only look for timing attributes.
 */
import type { LrclibLyrics, LyricsResult, UnisonLyrics } from './ipc'

/** Unison word timing: TTML with timed spans. The content decides, not Unison's syncType label. */
export const hasWordTiming = (u: UnisonLyrics): boolean => u.format === 'ttml' && /<span\b[^>]*\bbegin=/.test(u.text)

/** Unison line timing: TTML with timed lines, or LRC with timestamps. */
export const hasLineTiming = (u: UnisonLyrics): boolean =>
  (u.format === 'ttml' && /<p\b[^>]*\bbegin=/.test(u.text)) || (u.format === 'lrc' && /\[\d{1,3}:\d{1,2}/.test(u.text))

export function rankLyrics(slots: { lrclib?: LrclibLyrics; unison?: UnisonLyrics | null }): LyricsResult | null {
  const { lrclib, unison } = slots
  if (unison && hasWordTiming(unison)) return unison
  if (lrclib?.synced) return lrclib
  if (unison && hasLineTiming(unison)) return unison
  if (lrclib && (lrclib.plain || lrclib.instrumental)) return lrclib
  if (unison && unison.text.trim() && unison.format !== 'ttml') return unison
  return null
}
