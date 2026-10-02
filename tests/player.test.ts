import { describe, expect, it } from 'vitest'
import type { PlayerState } from '../src/shared/ipc'
import { Player } from '../src/main/player'

const state = (patch: Partial<PlayerState>): PlayerState => ({
  videoId: 'a', title: 'Song', artist: 'Artist', album: '', artwork: '', duration: 200, position: 0,
  playing: true, volume: 50, liked: 'none', shuffle: null, repeat: 'none', ad: false, ...patch,
})

function tracks(p: Player): string[] {
  const seen: string[] = []
  p.on('track', (s) => seen.push(s.videoId))
  return seen
}

describe('Player track events', () => {
  it('fires once per new song', () => {
    const p = new Player()
    const seen = tracks(p)
    p.update(state({ videoId: 'a' }))
    p.update(state({ videoId: 'a', position: 1 }))
    p.update(state({ videoId: 'b' }))
    expect(seen).toEqual(['a', 'b'])
  })

  it('fires for a song that starts after an ad reported under the same video id', () => {
    const p = new Player()
    const seen = tracks(p)
    p.update(state({ videoId: 'a' }))
    p.update(state({ videoId: 'b', ad: true }))
    p.update(state({ videoId: 'b', ad: false }))
    expect(seen).toEqual(['a', 'b'])
  })

  it('does not repeat a song after a mid-song ad', () => {
    const p = new Player()
    const seen = tracks(p)
    p.update(state({ videoId: 'a' }))
    p.update(state({ videoId: 'a', ad: true }))
    p.update(state({ videoId: 'a', ad: false }))
    expect(seen).toEqual(['a'])
  })
})
