import { describe, expect, it } from 'vitest'
import { matchPreset, PRESETS } from '../src/shared/eq'
import { DEFAULT_SETTINGS, withDefaults } from '../src/shared/settings'

describe('withDefaults', () => {
  it('fills keys added in newer versions without touching stored values', () => {
    const stored = { eq: { enabled: true }, theme: { id: 'midnight' } }
    const merged = withDefaults(DEFAULT_SETTINGS, stored)
    expect(merged.eq.enabled).toBe(true)
    expect(merged.eq.bands).toHaveLength(10)
    expect(merged.theme.id).toBe('midnight')
    expect(merged.shortcuts.playPause.accelerator).toBe('Ctrl+Alt+Space')
  })
  it('keeps stored arrays as-is', () => {
    const merged = withDefaults(DEFAULT_SETTINGS, { eq: { bands: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } })
    expect(merged.eq.bands[9]).toBe(10)
  })
})

describe('matchPreset', () => {
  it('recognises built-in and custom presets', () => {
    expect(matchPreset([...PRESETS.Rock], {})).toBe('Rock')
    expect(matchPreset([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], { Mine: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] })).toBe('Mine')
    expect(matchPreset([9, 0, 0, 0, 0, 0, 0, 0, 0, 0], {})).toBeNull()
  })
})
