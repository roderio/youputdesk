import { describe, expect, it } from 'vitest'
import { volumeMatches } from '../src/preload/volume'

describe('volumeMatches', () => {
  it('maps the ends of the slider exactly', () => {
    expect(volumeMatches(0, 0)).toBe(true)
    expect(volumeMatches(100, 100)).toBe(true)
    expect(volumeMatches(100, 74)).toBe(false)
  })
  it("catches YTM's reset to full volume", () => {
    // Slider redrawn at 40, but the player was reset to 100 when the song loaded.
    expect(volumeMatches(40, 100)).toBe(false)
    expect(volumeMatches(40, 13)).toBe(true)
  })
  it('treats a muted player as not restored', () => {
    expect(volumeMatches(40, 0)).toBe(false)
  })
})
