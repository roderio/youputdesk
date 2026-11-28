import { describe, expect, it } from 'vitest'
import { parseLrc } from '../src/shared/lrc'
import { lineIndexAt, lrcToRich, wordIndexAt, type RichLine } from '../src/shared/rich'

const line = (begin: number, words: [string, number, number][]): RichLine => ({
  begin, end: words.at(-1)![2], side: 'left', text: words.map((w) => w[0]).join(' '),
  words: words.map(([text, b, e]) => ({ text, begin: b, end: e, joinNext: false })),
})
const L = [line(1, [['a', 1, 1.5], ['b', 1.5, 2]]), line(3, [['c', 3, 3.5], ['d', 3.5, 4]])]

describe('lineIndexAt', () => {
  it('finds the line being sung', () => {
    expect(lineIndexAt(L, 0.5)).toBe(-1)
    expect(lineIndexAt(L, 1)).toBe(0)
    expect(lineIndexAt(L, 2.9)).toBe(0)
    expect(lineIndexAt(L, 3.6)).toBe(1)
    expect(lineIndexAt(L, 99)).toBe(1)
  })
})

describe('wordIndexAt', () => {
  it('finds the word being sung', () => {
    expect(wordIndexAt(L[1], 2.9)).toBe(-1)
    expect(wordIndexAt(L[1], 3.2)).toBe(0)
    expect(wordIndexAt(L[1], 3.7)).toBe(1)
  })
  it('after seeking back un-sings later words', () => {
    expect(wordIndexAt(L[1], 3.7)).toBe(1)
    expect(wordIndexAt(L[1], 3.1)).toBe(0)
  })
})

describe('lrcToRich', () => {
  it('turns LRC lines into line-timed lines', () => {
    const r = lrcToRich(parseLrc('[00:01.00] one\n[00:04.00] two'))
    expect(r.wordTimed).toBe(false)
    expect(r.lines.map((l) => [l.begin, l.end, l.text, l.words.length, l.side])).toEqual([[1, 4, 'one', 0, 'left'], [4, 9, 'two', 0, 'left']])
  })
})
