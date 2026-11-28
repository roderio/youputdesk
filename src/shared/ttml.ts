/**
 * Reads Unison's TTML lyrics (the format Apple Music uses: lines, words or syllables, background vocals,
 * duets) into the shared lyrics model. The XML comes from the internet, so this runs in the sandboxed
 * overlay with the browser's own parser, rejects DTDs outright, and only ever reads text content.
 * The parser is passed in so tests can use jsdom's.
 */
import type { RichLine, RichLyrics, RichWord } from './rich'

const TTM = 'http://www.w3.org/ns/ttml#metadata'
const XML = 'http://www.w3.org/XML/1998/namespace'

/** "5.5", "1:02.250", "1:00:00.000" (and "5.5s") → seconds, or null. */
export function parseTtmlTime(s: string | null | undefined): number | null {
  const m = /^(?:(?:(\d+):)?(\d{1,2}):)?(\d+(?:\.\d+)?)s?$/.exec((s ?? '').trim())
  if (!m) return null
  const value = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3])
  return Number.isFinite(value) ? value : null
}

/** Words being collected for one line (or its background part). */
class Collector {
  words: RichWord[] = []
  /** Whitespace since the last word, so the next one starts a new word rather than continuing a syllable. */
  private space = true
  /** Untimed text seen before any word: it joins the first word. */
  private prefix = ''
  /** Untimed text, for lines without word timing. */
  plain = ''

  word(text: string, begin: number, end: number): void {
    const prev = this.words.at(-1)
    if (prev) prev.joinNext = !this.space
    this.words.push({ text: this.prefix + text, begin, end, joinNext: false })
    this.prefix = ''
    this.space = false
  }

  text(raw: string): void {
    this.plain += raw
    if (/^\s/.test(raw)) this.space = true
    const t = raw.trim()
    if (t) {
      const prev = this.words.at(-1)
      if (prev && !/^\s/.test(raw)) prev.text += t
      else if (prev) prev.text += ' ' + t
      else this.prefix += t
      this.space = false
    }
    if (/\s$/.test(raw)) this.space = true
  }
}

const joinWords = (words: RichWord[]): string =>
  words.map((w, i) => w.text + (w.joinNext || i === words.length - 1 ? '' : ' ')).join('')

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim()

function walk(node: Node, main: Collector, bg: Collector): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3 /* text */) {
      main.text(child.nodeValue ?? '')
    } else if (child.nodeType === 1 /* element */ && (child as Element).localName === 'span') {
      const el = child as Element
      if (el.getAttributeNS(TTM, 'role') === 'x-bg') {
        walk(el, bg, bg)
        continue
      }
      const begin = parseTtmlTime(el.getAttribute('begin'))
      const end = parseTtmlTime(el.getAttribute('end'))
      const hasSpans = Array.from(el.children).some((c) => c.localName === 'span')
      if (hasSpans) walk(el, main, bg)
      else if (begin !== null && end !== null && end >= begin) main.word(el.textContent ?? '', begin, end)
      // A span without valid times is broken data: drop it rather than guess when it's sung.
    }
  }
}

/** A line without its side, which needs every line's singer to decide. */
type Unsided = Omit<RichLine, 'side' | 'background'>

function toLine(words: Collector, begin: number, end: number | null): Unsided | null {
  const text = words.words.length ? joinWords(words.words) : squash(words.plain)
  if (!text) return null
  const lastEnd = words.words.at(-1)?.end ?? begin
  return { begin, end: end ?? Math.max(lastEnd, begin), words: words.words, text }
}

export function parseTtml(text: string, parser: DOMParser): RichLyrics | null {
  // No DTDs: they're never needed for lyrics, and entity tricks are the classic XML attack.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return null
  let doc: Document
  try {
    doc = parser.parseFromString(text, 'application/xml')
  } catch {
    return null
  }
  if (doc.getElementsByTagNameNS('*', 'parsererror').length > 0) return null

  const agentOrder = Array.from(doc.getElementsByTagNameNS(TTM, 'agent'))
    .map((a) => a.getAttributeNS(XML, 'id'))
    .filter((id): id is string => !!id)

  const lines: { line: Unsided; background: Unsided | null; agent: string | null }[] = []
  for (const p of Array.from(doc.getElementsByTagNameNS('*', 'p'))) {
    const begin = parseTtmlTime(p.getAttribute('begin'))
    if (begin === null) continue
    const end = parseTtmlTime(p.getAttribute('end'))
    const agent = p.getAttributeNS(TTM, 'agent') || p.parentElement?.getAttributeNS(TTM, 'agent') || null
    const main = new Collector()
    const bg = new Collector()
    walk(p, main, bg)
    const line = toLine(main, begin, end !== null && end >= begin ? end : null)
    if (!line) continue
    const background = bg.words.length ? toLine(bg, bg.words[0].begin, bg.words.at(-1)!.end) : null
    lines.push({ line, background, agent })
  }
  if (lines.length === 0) return null

  lines.sort((a, b) => a.line.begin - b.line.begin)
  const first = agentOrder[0] ?? lines.find((l) => l.agent)?.agent ?? null
  const out: RichLine[] = lines.map(({ line, background, agent }) => {
    const side: RichLine['side'] = !agent || agent === first ? 'left' : 'right'
    return { ...line, side, ...(background ? { background: { ...background, side } } : {}) }
  })
  return { lines: out, wordTimed: out.some((l) => l.words.length > 0) }
}
