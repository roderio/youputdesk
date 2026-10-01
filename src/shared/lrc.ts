/** Parser for synced lyrics in LRC format ("[mm:ss.xx] text"). */

export interface LyricLine {
  /** Seconds from the start of the track. */
  time: number
  text: string
}

const STAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g

export function parseLrc(lrc: string): LyricLine[] {
  let offset = 0
  const lines: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const offsetTag = raw.match(/^\[offset:\s*([+-]?\d+)\s*\]/i)
    if (offsetTag) {
      // Positive offset means lyrics should appear earlier.
      offset = Number(offsetTag[1]) / 1000
      continue
    }
    const stamps = [...raw.matchAll(STAMP)]
    if (stamps.length === 0) continue
    const text = raw.replace(STAMP, '').trim()
    for (const [, min, sec] of stamps) {
      lines.push({ time: Number(min) * 60 + Number(sec.replace(':', '.')), text })
    }
  }
  return lines
    .map((l) => ({ ...l, time: Math.max(0, l.time - offset) }))
    .sort((a, b) => a.time - b.time)
}

/** Index of the line being sung at `time`, or -1 before the first line. */
export function lineAt(lines: LyricLine[], time: number): number {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}
