import { describe, expect, it } from 'vitest'
import { lineAt, parseLrc } from '../src/shared/lrc'

describe('parseLrc', () => {
  it('parses timestamps and sorts lines', () => {
    const lines = parseLrc('[00:52.73] second\n[00:35.99] first\n[01:01.3] third')
    expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third'])
    expect(lines[0].time).toBeCloseTo(35.99)
    expect(lines[2].time).toBeCloseTo(61.3)
  })

  it('expands a line with several timestamps (repeated chorus)', () => {
    const lines = parseLrc('[00:10.00][00:30.00] chorus')
    expect(lines).toEqual([{ time: 10, text: 'chorus' }, { time: 30, text: 'chorus' }])
  })

  it('applies the [offset] tag (positive = earlier)', () => {
    expect(parseLrc('[offset:+500]\n[00:10.00] hi')[0].time).toBeCloseTo(9.5)
  })

  it('ignores metadata and blank lines', () => {
    expect(parseLrc('[ar:Someone]\n\n[00:01.00] a')).toHaveLength(1)
  })
})

describe('lineAt', () => {
  const lines = parseLrc('[00:10.00] a\n[00:20.00] b\n[00:30.00] c')
  it('is -1 before the first line', () => expect(lineAt(lines, 5)).toBe(-1))
  it('finds the current line', () => {
    expect(lineAt(lines, 10)).toBe(0)
    expect(lineAt(lines, 25)).toBe(1)
    expect(lineAt(lines, 999)).toBe(2)
  })
})
