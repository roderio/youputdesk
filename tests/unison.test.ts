import { describe, expect, it } from 'vitest'
import { creditName, creditUrl } from '../src/shared/unison'

describe('creditUrl', () => {
  it('builds Unison links only from valid ids', () => {
    expect(creditUrl('song', 'Ugr4KKK_SqY')).toBe('https://unison.betterlyrics.org/song/Ugr4KKK_SqY')
    expect(creditUrl('curator', 'a'.repeat(64))).toBe(`https://unison.betterlyrics.org/curator/${'a'.repeat(64)}`)
    for (const [kind, id] of [
      ['song', 'https://evil.example'],
      ['song', '../x'],
      ['curator', 'A'.repeat(64)],
      ['curator', 'a'.repeat(63)],
      ['other', 'Ugr4KKK_SqY'],
      ['song', 42],
      [undefined, 'Ugr4KKK_SqY'],
    ] as [unknown, unknown][]) {
      expect(creditUrl(kind, id)).toBeNull()
    }
  })
})

describe('creditName', () => {
  it('caps and trims', () => {
    expect(creditName('  boidu  ')).toBe('boidu')
    expect(creditName('two\n  words')).toBe('two words')
    expect(creditName('x'.repeat(60))).toBe('x'.repeat(39) + '…')
    expect(creditName('x'.repeat(40))).toBe('x'.repeat(40))
    // Stays text: rendering escapes it.
    expect(creditName('<b>hi</b>')).toBe('<b>hi</b>')
  })
})
