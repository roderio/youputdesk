import { describe, expect, it } from 'vitest'
import { cleanArtist, cleanTitle, pickBest, stripTimestamps, type LrcLibTrack } from '../src/shared/lyrics-match'

const track = (duration: number, synced: boolean, extra: Partial<LrcLibTrack> = {}): LrcLibTrack => ({
  trackName: 'Song', artistName: 'Artist', duration, instrumental: false,
  plainLyrics: 'words', syncedLyrics: synced ? '[00:01.00] words' : null, ...extra,
})

describe('cleanTitle', () => {
  it.each([
    ['Starboy ft. Daft Punk (Official Video)', 'Starboy'],
    ['Blinding Lights (Official Audio)', 'Blinding Lights'],
    ['Bad Habits [Official Lyric Video]', 'Bad Habits'],
    ['Señorita (with Camila Cabello)', 'Señorita'],
    ['Here Comes the Sun - Remastered 2009', 'Here Comes the Sun'],
    ['Under Pressure (feat. David Bowie)', 'Under Pressure'],
    ['Bohemian Rhapsody', 'Bohemian Rhapsody'],
  ])('%s → %s', (input, expected) => expect(cleanTitle(input)).toBe(expected))
})

describe('cleanTitle with artist', () => {
  it('drops an "Artist - " prefix matching the channel', () => {
    expect(cleanTitle('Alan Walker x AVA - Somewhere Past Goodbye (Official Music Video)', 'Alan Walker')).toBe('Somewhere Past Goodbye')
  })
  it('keeps dashes that are part of the title', () => {
    expect(cleanTitle('Blue (Da Ba Dee) - Gabry Ponte Ice Pop Mix', 'Eiffel 65')).toBe('Blue (Da Ba Dee) - Gabry Ponte Ice Pop Mix')
  })
})

describe('cleanArtist', () => {
  it('drops the Topic suffix and extra artists', () => {
    expect(cleanArtist('The Weeknd - Topic')).toBe('The Weeknd')
    expect(cleanArtist('Shawn Mendes & Camila Cabello')).toBe('Shawn Mendes')
    expect(cleanArtist('Calvin Harris, Dua Lipa')).toBe('Calvin Harris')
  })
})

describe('pickBest', () => {
  it('prefers same-length synced lyrics', () => {
    const best = pickBest([track(200, false), track(231, true), track(230, true)], 230)
    expect(best?.inSync).toBe(true)
    expect(best?.track.duration).toBe(230)
  })
  it('falls back to a different version, unsynced, rather than "not found"', () => {
    // Music video (263s) vs album track (200s): the words are right, the timings aren't.
    const best = pickBest([track(200, true), track(433, true)], 263)
    expect(best?.inSync).toBe(false)
    expect(best?.track.duration).toBe(200)
  })
  it('ignores snippets', () => {
    expect(pickBest([track(5, true)], 5)).toBeNull()
  })
  it('returns null when nothing has lyrics', () => {
    expect(pickBest([track(200, false, { plainLyrics: null })], 200)).toBeNull()
  })
})

describe('stripTimestamps', () => {
  it('turns synced lyrics into plain text', () => {
    expect(stripTimestamps('[00:01.00] one\n[00:02.50][00:09.00] two')).toBe('one\ntwo')
  })
})
