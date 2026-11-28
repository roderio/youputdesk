import { describe, expect, it } from 'vitest'
import type { LrclibLyrics, UnisonLyrics } from '../src/shared/ipc'
import { hasLineTiming, hasWordTiming, rankLyrics } from '../src/shared/lyrics-rank'

const credit = { videoId: 'abcdefghijk', submitterName: 'someone', submitterKeyId: 'a'.repeat(64) }
const uni = (format: UnisonLyrics['format'], text: string): UnisonLyrics => ({ source: 'unison', format, text, credit })
const lrc = (synced: string | null, plain: string | null, otherVersion = false, instrumental = false): LrclibLyrics =>
  ({ source: 'lrclib', synced, plain, instrumental, otherVersion })

const WORD_TTML = '<tt><body><div><p begin="1" end="2"><span begin="1" end="2">word</span></p></div></body></tt>'
const LINE_TTML = '<tt><body><div><p begin="1" end="2">line only</p></div></body></tt>'

// Every rung, best first. Each must beat everything after it.
const rungs: [string, { lrclib?: LrclibLyrics; unison?: UnisonLyrics }][] = [
  ['Unison word timing', { unison: uni('ttml', WORD_TTML) }],
  ['LRCLIB synced lines', { lrclib: lrc('[00:01.00] a', 'a') }],
  ['Unison line timing (LRC)', { unison: uni('lrc', '[00:01.00] b') }],
  ['LRCLIB unsynced text', { lrclib: lrc(null, 'a', true) }],
  ['Unison plain', { unison: uni('plain', 'just words') }],
]

describe('rankLyrics', () => {
  rungs.forEach(([name, slot], i) => {
    it(`${name} beats everything below it`, () => {
      for (const [, lower] of rungs.slice(i + 1)) {
        const both = { lrclib: slot.lrclib ?? lower.lrclib, unison: slot.unison ?? lower.unison }
        expect(rankLyrics(both)).toBe(slot.lrclib ?? slot.unison)
      }
      expect(rankLyrics(slot)).toBe(slot.lrclib ?? slot.unison)
    })
  })

  it('gives null when there is nothing', () => {
    expect(rankLyrics({})).toBeNull()
    expect(rankLyrics({ unison: null })).toBeNull()
  })

  it('treats line-timed TTML as line timing', () => {
    const u = uni('ttml', LINE_TTML)
    expect(rankLyrics({ lrclib: lrc('[00:01.00] a', 'a'), unison: u })?.source).toBe('lrclib')
    expect(rankLyrics({ lrclib: lrc(null, 'a', true), unison: u })).toBe(u)
  })

  it('counts LRCLIB instrumental as LRCLIB text', () => {
    const inst = lrc(null, null, false, true)
    expect(rankLyrics({ lrclib: inst, unison: uni('plain', 'words') })).toBe(inst)
  })

  it('treats Unison LRC without timestamps as plain', () => {
    const u = uni('lrc', 'no timestamps here')
    expect(rankLyrics({ lrclib: lrc(null, 'a', true), unison: u })?.source).toBe('lrclib')
    expect(rankLyrics({ unison: u })).toBe(u)
  })

  it('prefers LRCLIB synced lines over Unison line timing', () => {
    expect(rankLyrics({ lrclib: lrc('[00:01.00] a', 'a'), unison: uni('lrc', '[00:01.00] b') })?.source).toBe('lrclib')
  })

  it('prefers Unison line timing over LRCLIB text from another version', () => {
    expect(rankLyrics({ lrclib: lrc(null, 'a', true), unison: uni('lrc', '[00:01.00] b') })?.source).toBe('unison')
  })
})

describe('timing checks', () => {
  it('decides word timing from the content, not the label', () => {
    expect(hasWordTiming(uni('ttml', WORD_TTML))).toBe(true)
    expect(hasWordTiming(uni('ttml', LINE_TTML))).toBe(false)
    expect(hasWordTiming(uni('lrc', '[00:01.00] <00:01.00> word'))).toBe(false)
  })
  it('finds line timing in TTML and LRC', () => {
    expect(hasLineTiming(uni('ttml', LINE_TTML))).toBe(true)
    expect(hasLineTiming(uni('lrc', '[00:01.00] b'))).toBe(true)
    expect(hasLineTiming(uni('lrc', 'no stamps'))).toBe(false)
    expect(hasLineTiming(uni('plain', '[00:01.00] looks timed'))).toBe(false)
  })
})
