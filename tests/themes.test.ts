import { describe, expect, it } from 'vitest'
import { artBackgroundCss, BUILT_IN_THEMES, isTheme, safeColor, themeCss } from '../src/shared/themes'

const midnight = BUILT_IN_THEMES.find((t) => t.id === 'midnight')!

describe('themeCss', () => {
  it('adds nothing for the original YouTube Music look', () => {
    expect(themeCss(BUILT_IN_THEMES[0])).toBe('')
  })
  it('maps theme colours onto YTM variables', () => {
    const css = themeCss(midnight)
    expect(css).toContain(`--ytmusic-general-background-c: ${midnight.background} !important`)
    expect(css).toContain(`--yt-sys-color-baseline--static-brand-red: ${midnight.accent} !important`)
  })
  it('uses the album-art palette for dynamic themes', () => {
    const dynamic = BUILT_IN_THEMES.find((t) => t.dynamic)!
    const css = themeCss(dynamic, { accent: 'hsl(11 68% 66%)', background: 'hsl(11 41% 6%)', surface: 'hsl(11 34% 12%)' })
    expect(css).toContain('--ypd-accent: hsl(11 68% 66%)')
  })
  it('refuses colours that could inject CSS', () => {
    const css = themeCss({ ...midnight, accent: 'red; } body { display: none' })
    expect(css).not.toContain('display: none')
    expect(css).toContain('--ypd-accent: #ff4e45')
  })
})

describe('safeColor / isTheme', () => {
  it('accepts hex, rgb and hsl', () => {
    expect(safeColor('#abc', 'x')).toBe('#abc')
    expect(safeColor('rgba(1, 2, 3, 0.5)', 'x')).toBe('rgba(1, 2, 3, 0.5)')
    expect(safeColor('hsl(11 68% 66%)', 'x')).toBe('hsl(11 68% 66%)')
    expect(safeColor('url(x)', 'x')).toBe('x')
  })
  it('validates imported theme JSON', () => {
    expect(isTheme(midnight)).toBe(true)
    expect(isTheme({ name: 'x' })).toBe(false)
  })
  it('strips quotes from the art URL', () => {
    expect(artBackgroundCss('https://a/b"); x: y; ("')).not.toContain('");')
  })
})
