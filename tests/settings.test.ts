import { describe, expect, it } from 'vitest'
import { matchPreset, PRESETS } from '../src/shared/eq'
import { allows, DEFAULT_SETTINGS, withDefaults } from '../src/shared/settings'

describe('withDefaults', () => {
  it('fills keys added in newer versions without touching stored values', () => {
    const stored = { eq: { enabled: true }, theme: { id: 'midnight' } }
    const merged = withDefaults(DEFAULT_SETTINGS, stored)
    expect(merged.eq.enabled).toBe(true)
    expect(merged.eq.bands).toHaveLength(10)
    expect(merged.theme.id).toBe('midnight')
    expect(merged.shortcuts.playPause.accelerator).toBe('Ctrl+Alt+Space')
  })
  it('fills accessibility and mini player settings for older stored settings', () => {
    const merged = withDefaults(DEFAULT_SETTINGS, { notifications: { ads: false } })
    expect(merged.accessibility).toEqual(DEFAULT_SETTINGS.accessibility)
    expect(merged.accessibility.adChime).toBe(false)
    expect(merged.mini.pinned).toBe(false)
    expect(merged.notifications.ads).toBe(false)
  })
  it('asks existing users for privacy consent, and keeps Discord off until they give it', () => {
    const merged = withDefaults(DEFAULT_SETTINGS, { discord: { enabled: true }, onboarding: { done: true } })
    expect(merged.privacy.consented).toBe(false)
    expect(allows(merged, 'onlineLyrics')).toBe(false)
    expect(allows(merged, 'updateChecks')).toBe(false)
    // Their choice is kept, but main only connects once consented is true.
    expect(merged.discord.enabled).toBe(true)
  })
  it('shares nothing by default', () => {
    expect(DEFAULT_SETTINGS.discord.enabled).toBe(false)
    expect(allows(DEFAULT_SETTINGS, 'onlineLyrics')).toBe(false)
    expect(allows(DEFAULT_SETTINGS, 'updateChecks')).toBe(false)
    const consented = withDefaults(DEFAULT_SETTINGS, { privacy: { consented: true, onlineLyrics: false } })
    expect(allows(consented, 'onlineLyrics')).toBe(false)
    expect(allows(consented, 'updateChecks')).toBe(true)
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
