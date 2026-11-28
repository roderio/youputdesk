/**
 * One model for every kind of synced lyrics: lines from LRC (LRCLIB, or Unison's line timing) and words from
 * Unison's TTML. The lyrics view draws only this, so line- and word-timed songs share one renderer.
 */
import type { LyricLine } from './lrc'

export interface RichWord {
  text: string
  /** Seconds from the start of the track. */
  begin: number
  end: number
  /** A syllable: the next word continues it with no space, so keep them on one line. */
  joinNext: boolean
}

export interface RichLine {
  begin: number
  end: number
  /** Duets: the first singer's lines sit on the left, everyone else's on the right. */
  side: 'left' | 'right'
  /** Empty for a line-timed line. */
  words: RichWord[]
  /** The whole line, for line-timed lyrics and screen readers. */
  text: string
  /** Background vocals sung with this line, shown smaller under it. */
  background?: RichLine
}

export interface RichLyrics {
  lines: RichLine[]
  /** At least one line has word timing. */
  wordTimed: boolean
}

/** How long the last LRC line stays current, since LRC has no end times. */
const LAST_LINE_S = 5

export function lrcToRich(lines: LyricLine[]): RichLyrics {
  return {
    wordTimed: false,
    lines: lines.map((l, i) => ({
      begin: l.time,
      end: lines[i + 1]?.time ?? l.time + LAST_LINE_S,
      side: 'left',
      words: [],
      text: l.text,
    })),
  }
}

/** Index of the last item whose begin is at or before `time`, or -1. Items must be sorted by begin. */
function lastStarted(items: { begin: number }[], time: number): number {
  let lo = 0
  let hi = items.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].begin <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/** The line being sung at `time`, or -1 before the first one. */
export const lineIndexAt = (lines: RichLine[], time: number): number => lastStarted(lines, time)

/** The word of `line` being sung at `time`, or -1 before its first word. */
export const wordIndexAt = (line: RichLine, time: number): number => lastStarted(line.words, time)
