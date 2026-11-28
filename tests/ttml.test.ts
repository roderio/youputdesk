// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { parseTtml, parseTtmlTime, xmlParser } from '../src/shared/ttml'

const parse = (s: string) => parseTtml(s, new DOMParser())
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8')
const doc = (body: string) => `<tt xmlns="http://www.w3.org/ns/ttml"><body><div>${body}</div></body></tt>`

describe('parseTtml', () => {
  it('reads word timing, syllables and sides', () => {
    const r = parse(fixture('word.ttml'))!
    expect(r.wordTimed).toBe(true)
    const [first, second] = r.lines
    expect(first.words.map((w) => [w.text, w.joinNext])).toEqual([['No', true], ['thing', false], ['here', false]])
    expect(first.words[0]).toMatchObject({ begin: 1, end: 1.2 })
    expect(first.text).toBe('Nothing here')
    expect([first.side, second.side]).toEqual(['left', 'right'])
  })

  it('keeps background vocals out of the main line', () => {
    const line = parse(fixture('word.ttml'))!.lines[1]
    expect(line.text).toBe('Moving on')
    expect(line.words.map((w) => w.text)).toEqual(['Moving', 'on'])
    expect(line.background?.text).toBe('and on')
    expect(line.background).toMatchObject({ begin: 4, end: 5, side: 'right' })
  })

  it('sorts lines and drops bad spans', () => {
    const r = parse(doc(
      '<p begin="5" end="6"><span begin="5" end="6">later</span></p>' +
      '<p begin="1" end="3"><span begin="1" end="1.5">ok</span> <span begin="2" end="1.8">backwards</span> <span end="2.5">untimed</span></p>',
    ))!
    expect(r.lines.map((l) => l.begin)).toEqual([1, 5])
    expect(r.lines[0].words.map((w) => w.text)).toEqual(['ok'])
  })

  it('reads line-timed TTML', () => {
    const r = parse(fixture('line.ttml'))!
    expect(r.wordTimed).toBe(false)
    expect(r.lines[0].words).toEqual([])
    expect(r.lines.map((l) => [l.begin, l.end, l.text])).toEqual([[1, 3, 'First line here'], [3, 5, 'Second line']])
  })

  it('rejects DOCTYPE and entity declarations', () => {
    expect(parse('<!DOCTYPE tt [<!ENTITY a "x">]>' + doc('<p begin="1" end="2">&a;</p>'))).toBeNull()
  })

  it('returns null for broken XML and for documents with no timed lines', () => {
    expect(parse('<tt><body>')).toBeNull()
    expect(parse(doc('<p>untimed</p>'))).toBeNull()
  })

  it('keeps HTML-looking text as text', () => {
    const r = parse(doc('<p begin="1" end="2">&lt;img src=x onerror=alert(1)&gt;</p>'))!
    expect(r.lines[0].text).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('parseTtmlTime', () => {
  it.each([
    ['5.5', 5.5],
    ['1:02.250', 62.25],
    ['1:00:00.000', 3600],
    ['abc', null],
    ['', null],
  ])('%s → %s', (s, v) => expect(parseTtmlTime(s)).toBe(v))
})

describe('xmlParser', () => {
  // YouTube Music requires Trusted Types, so DOMParser refuses plain strings there.
  it('passes the text through a Trusted Types policy when the page has them', () => {
    const createHTML = vi.fn((s: string) => s)
    const createPolicy = vi.fn(() => ({ createHTML }))
    const r = parseTtml(doc('<p begin="1" end="2">hello</p>'), xmlParser({ createPolicy }))
    expect(r?.lines[0].text).toBe('hello')
    expect(createPolicy).toHaveBeenCalledWith('youputdesk-lyrics', expect.anything())
    expect(createHTML).toHaveBeenCalledTimes(1)
  })
  it('works without Trusted Types', () => {
    expect(parseTtml(doc('<p begin="1" end="2">hi</p>'), xmlParser(undefined))?.lines[0].text).toBe('hi')
  })
})
