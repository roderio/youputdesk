import { describe, expect, it } from 'vitest'
import { defaultBindings, eventToAccelerator, findConflicts, isSafeGlobal, normalize } from '../src/shared/shortcuts'

const key = (code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods })

describe('normalize', () => {
  it('orders modifiers and capitalises keys', () => {
    expect(normalize('alt+ctrl+l')).toBe('Ctrl+Alt+L')
    expect(normalize('CommandOrControl+Shift+space')).toBe('Ctrl+Shift+Space')
  })
})

describe('eventToAccelerator', () => {
  it('maps physical keys', () => {
    expect(eventToAccelerator(key('KeyE', { ctrlKey: true }))).toBe('Ctrl+E')
    expect(eventToAccelerator(key('ArrowRight', { ctrlKey: true, altKey: true }))).toBe('Ctrl+Alt+Right')
    expect(eventToAccelerator(key('Slash', { ctrlKey: true }))).toBe('Ctrl+/')
  })
  it('ignores lone modifiers', () => expect(eventToAccelerator(key('ControlLeft', { ctrlKey: true }))).toBeNull())
})

describe('findConflicts', () => {
  it('has none in the defaults', () => expect(findConflicts(defaultBindings())).toEqual([]))
  it('reports actions sharing a combo, regardless of spelling', () => {
    const b = defaultBindings()
    b.like = { accelerator: 'alt+ctrl+space', global: true }
    expect(findConflicts(b)).toEqual([['playPause', 'like']])
  })
})

describe('isSafeGlobal', () => {
  it('requires Ctrl/Alt/Win (or an F-key) for global shortcuts', () => {
    expect(isSafeGlobal('Ctrl+Alt+Space')).toBe(true)
    expect(isSafeGlobal('F9')).toBe(true)
    expect(isSafeGlobal('Shift+S')).toBe(false)
    expect(isSafeGlobal('K')).toBe(false)
  })
})
