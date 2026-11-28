# Word-synced Lyrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show word-by-word lyrics from Unison in YouputDesk's "Lift" style, keep LRCLIB as the fallback, and give
line-synced lyrics the same Lift look.

**Architecture:**
- **Main** (`src/main/lyrics.ts`) fetches from Unison (by video ID) and LRCLIB. It keeps two slots per video in
  `lyrics-cache-v3`, and returns the best result by a pure ranking in `src/shared/lyrics-rank.ts`.
- **The overlay** reads Unison's TTML with the browser's `DOMParser` (`src/shared/ttml.ts`). It converts every kind
  of lyrics into one model (`src/shared/rich.ts`) and draws them with one renderer in
  `src/preload/overlay/Lyrics.tsx`.
- **Consent** lives in two new `privacy` settings fields.

**Tech Stack:** Electron 45, TypeScript, Preact 11 (overlay in a shadow root), Vitest. `jsdom` is added as a
devDependency for the TTML tests only.

**Spec:** `docs/superpowers/specs/2026-11-28-word-synced-lyrics-design.md`

## Global Constraints

- **Dependencies:** no new runtime dependency. `jsdom` is a devDependency only.
- **Rendering lyrics:**
  - Lyric text and submitter names reach the DOM only as text nodes through Preact. No `innerHTML` and no
    `dangerouslySetInnerHTML` anywhere in this feature.
  - Before parsing, reject TTML that contains `<!DOCTYPE` or `<!ENTITY`.
- **Unison requests:**
  - Only `GET https://unison.betterlyrics.org/lyrics?v=<videoId>`. Never send title, artist, album or duration to
    Unison.
  - User-Agent: `YouputDesk/<version> (desktop music player)`, the same string LRCLIB gets.
  - Accept a 200 only if `success === true`, `data.videoId === requested id`, `data.format` is `ttml`, `lrc` or
    `plain`, `typeof data.lyrics === 'string'`, and `data.lyrics.length <= 512 * 1024`.
  - 404 means Unison has nothing. 429, 5xx, 503 and network errors mean Unison is unavailable: no slot written,
    nothing thrown to the overlay.
- **Re-checking:** a saved Unison slot is re-checked after 7 days (`UNISON_RECHECK_MS = 7 * 24 * 3600 * 1000`), with
  `If-None-Match: <etag>`.
- **IDs:** a video ID matches `^[\w-]{6,20}$`, and a Unison key ID matches `^[0-9a-f]{64}$`.
- **Credit:**
  - Unison: "Lyrics from Unison · submitted by \<name\> · click a line to jump to it". "Unison" links to
    `https://unison.betterlyrics.org/song/<videoId>`, and \<name\> links to
    `https://unison.betterlyrics.org/curator/<keyId>`.
  - The name is trimmed and capped at 40 characters (`…` when cut).
  - LRCLIB: "Lyrics from LRCLIB · click a line to jump to it" (unchanged).
- **Consent:** Unison is used only when `privacy.consented && privacy.onlineLyrics && privacy.unison`.
- **Copy, verbatim from the spec:**
  - First-launch hint: "Looks up lyrics on lrclib.net and unison.betterlyrics.org. They receive the song's title,
    artist and YouTube video ID, nothing about you."
  - One-time card title: "Word-by-word lyrics".
  - One-time card text: "Unison has lyrics timed word by word for many songs. To look them up, YouputDesk sends the
    song's YouTube video ID to unison.betterlyrics.org. Nothing about you."
  - One-time card buttons: "Turn on" and "Not now".
  - Settings row title: "Word-by-word lyrics (Unison)".
- **Lift look:**
  - Upcoming text: `rgba(255,255,255,.32)`. Past lines: `rgba(255,255,255,.5)`.
  - A sung word: `#fff` and `translateY(-2px)`. The current word: `text-shadow: 0 0 18px color-mix(in srgb,
    var(--accent) 80%, transparent)`.
  - A line-timed current line: `#fff`, `translateY(-2px) scale(1.03)` and `text-shadow: 0 0 22px color-mix(in srgb,
    var(--accent) 45%, transparent)`.
  - Lines more than 2 from the current one: `filter: blur(1.2px)`.
  - Background lines: `font-size: 0.75em; font-style: italic`.
  - Transitions: 180 to 260ms, `var(--ease)`.
- **Performance mode and Reduce motion** (`:host(.perf)`, `:host(.rm)`): no transform, no text-shadow, no filter,
  instant scroll. Only colour changes.
- **Look-ahead:** 0.25s, as today. A word stays "current" until `end + 0.15`.

## Review Focus

1. **Seeking backwards mid-song.** Words after the playhead must go back to unsung. Pinned by the
   `wordIndexAt after seeking back` test in Task 2.
2. **Hostile or odd TTML.** A DOCTYPE or entity declaration, lines out of order, spans with `end < begin` or missing
   times. Pinned by the `rejects DOCTYPE` and `sorts lines and drops bad spans` tests in Task 3.
3. **Unison switched off while a Unison copy is saved.** The overlay must get LRCLIB's lyrics and Unison must not be
   called. Pinned by the `ignores the saved Unison slot when Unison is off` test in Task 5.
4. **A submitter name that is huge or looks like HTML.** It must show as capped plain text. Pinned by the
   `creditName caps and trims` test in Task 6; Task 7 renders it as a text node.
5. **A song change while a request or a parse-failure retry is in flight.** The next song must not show the previous
   song's lyrics. Pinned by the `concurrent lookups for different videos don't mix` test in Task 5, and the
   cancelled-guard check in Task 7's manual steps.

---

### Task 1: Consent settings

**Files:**
- Modify: `src/shared/settings.ts` (the `privacy` type, `DEFAULT_SETTINGS.privacy`, `allows`)
- Test: `tests/settings.test.ts`

**Interfaces:**
- Produces:
  - Settings fields `privacy.unison: boolean` (default `false`) and `privacy.unisonAsked: boolean` (default `false`).
  - `allows(s: Settings, feature: 'onlineLyrics' | 'updateChecks' | 'unison'): boolean`. For `'unison'`:
    `consented && onlineLyrics && unison`.
  - `needsUnisonQuestion(s: Settings): boolean`, which is `consented && onlineLyrics && !unisonAsked`.

- [ ] **Step 1: Write the failing tests** in `tests/settings.test.ts`:

```ts
describe('Unison consent', () => {
  const s = (privacy: Partial<Settings['privacy']>) => withDefaults(DEFAULT_SETTINGS, { privacy })
  it('defaults both new fields to false, also for settings saved by older versions', () => {
    expect(DEFAULT_SETTINGS.privacy).toMatchObject({ unison: false, unisonAsked: false })
    expect(s({ consented: true, onlineLyrics: true }).privacy).toMatchObject({ unison: false, unisonAsked: false })
  })
  it('allows Unison only with consent, online lyrics and unison all on', () => {
    expect(allows(s({ consented: true, onlineLyrics: true, unison: true }), 'unison')).toBe(true)
    expect(allows(s({ consented: true, onlineLyrics: false, unison: true }), 'unison')).toBe(false)
    expect(allows(s({ consented: false, onlineLyrics: true, unison: true }), 'unison')).toBe(false)
    expect(allows(s({ consented: true, onlineLyrics: true, unison: false }), 'unison')).toBe(false)
  })
  it('asks once: only when lyrics are on and the question was never answered', () => {
    expect(needsUnisonQuestion(s({ consented: true, onlineLyrics: true }))).toBe(true)
    expect(needsUnisonQuestion(s({ consented: true, onlineLyrics: true, unisonAsked: true }))).toBe(false)
    expect(needsUnisonQuestion(s({ consented: true, onlineLyrics: false }))).toBe(false)
    expect(needsUnisonQuestion(s({ consented: false, onlineLyrics: true }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/settings.test.ts`. Expected: FAIL (`needsUnisonQuestion` is not exported,
  and the defaults are missing).
- [ ] **Step 3: Implement** the fields, defaults, the widened `allows` and `needsUnisonQuestion` in
  `src/shared/settings.ts`. Give each new field a doc comment in the style of the existing ones.
- [ ] **Step 4: Run** `npx vitest run tests/settings.test.ts` and `npm run typecheck`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit:**
  `git add src/shared/settings.ts tests/settings.test.ts && git commit -m "Lyrics: settings for asking about Unison"`

### Task 2: One lyrics model, and finding the current line and word

**Files:**
- Create: `src/shared/rich.ts`
- Test: `tests/rich.test.ts`

**Interfaces:**
- Consumes: `LyricLine` and `parseLrc` from `src/shared/lrc.ts`.
- Produces (`src/shared/rich.ts`):

```ts
export interface RichWord { text: string; begin: number; end: number; joinNext: boolean }
export interface RichLine {
  begin: number; end: number
  side: 'left' | 'right'
  words: RichWord[]          // empty = line-timed
  text: string               // the whole line's text
  background?: RichLine
}
export interface RichLyrics { lines: RichLine[]; wordTimed: boolean }  // wordTimed: any line has words
export function lrcToRich(lines: LyricLine[]): RichLyrics           // end = next line's begin (last: begin + 5)
export function lineIndexAt(lines: RichLine[], time: number): number // last line with begin <= time, else -1
export function wordIndexAt(line: RichLine, time: number): number    // last word with begin <= time, else -1
```

- [ ] **Step 1: Write the failing tests** in `tests/rich.test.ts`:

```ts
const line = (begin: number, words: [string, number, number][]): RichLine => ({
  begin, end: words.at(-1)![2], side: 'left', text: words.map((w) => w[0]).join(' '),
  words: words.map(([text, b, e]) => ({ text, begin: b, end: e, joinNext: false })),
})
const L = [line(1, [['a', 1, 1.5], ['b', 1.5, 2]]), line(3, [['c', 3, 3.5], ['d', 3.5, 4]])]

it('lineIndexAt finds the line being sung', () => {
  expect(lineIndexAt(L, 0.5)).toBe(-1); expect(lineIndexAt(L, 1)).toBe(0)
  expect(lineIndexAt(L, 2.9)).toBe(0); expect(lineIndexAt(L, 3.6)).toBe(1); expect(lineIndexAt(L, 99)).toBe(1)
})
it('wordIndexAt finds the word being sung', () => {
  expect(wordIndexAt(L[1], 2.9)).toBe(-1); expect(wordIndexAt(L[1], 3.2)).toBe(0); expect(wordIndexAt(L[1], 3.7)).toBe(1)
})
it('wordIndexAt after seeking back un-sings later words', () => {
  expect(wordIndexAt(L[1], 3.7)).toBe(1)
  expect(wordIndexAt(L[1], 3.1)).toBe(0)
})
it('lrcToRich turns LRC lines into line-timed lines', () => {
  const r = lrcToRich(parseLrc('[00:01.00] one\n[00:04.00] two'))
  expect(r.wordTimed).toBe(false)
  expect(r.lines.map((l) => [l.begin, l.end, l.text, l.words.length])).toEqual([[1, 4, 'one', 0], [4, 9, 'two', 0]])
})
```

- [ ] **Step 2: Run** `npx vitest run tests/rich.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/shared/rich.ts`. Both searches are binary searches, like `lineAt` in `lrc.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/rich.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit:**
  `git add src/shared/rich.ts tests/rich.test.ts && git commit -m "Lyrics: one model for line- and word-timed lyrics"`

### Task 3: Reading TTML

**Files:**
- Create: `src/shared/ttml.ts`
- Create: `tests/fixtures/word.ttml` and `tests/fixtures/line.ttml`, with made-up lyrics we write ourselves. Never copy
  real song lyrics.
- Test: `tests/ttml.test.ts`, starting with `// @vitest-environment jsdom`
- Modify: `package.json` / `package-lock.json` (`npm install -D jsdom`)

**Interfaces:**
- Consumes: the `RichLyrics`, `RichLine` and `RichWord` types from Task 2.
- Produces:
  - `parseTtml(text: string, parser: DOMParser): RichLyrics | null`.
  - `parseTtmlTime(s: string): number | null` accepts `ss.mmm`, `m:ss.mmm` and `h:mm:ss.mmm`, and returns
    seconds or `null`.

**Reading rules (from the spec):**
- Elements are matched by `localName` (`p`, `span`) with namespace-aware attribute reads:
  - `ttm:agent` and `ttm:role` use namespace `http://www.w3.org/ns/ttml#metadata`.
  - `xml:id` uses `http://www.w3.org/XML/1998/namespace`.
- Each `<p>` with a valid `begin` is a line.
- `side`: the first agent id seen is `left`. Any other agent is `right`. No agent counts as the first one.
- Inside a `<p>`, each `<span>` with valid `begin` and `end` (and `end >= begin`) is a word.
- Whitespace text after a span sets `joinNext: false` on it. A span followed directly by another span gets
  `joinNext: true`.
- A `<span ttm:role="x-bg">` becomes `background`, a `RichLine` built from its inner spans. Its text never joins the
  main line.
- Untimed non-whitespace text is appended to the previous word's text, or to the next word's if there's none before.
- Lines are sorted by `begin`. A document with no valid lines returns `null`.
- So do a `parsererror` element, and input containing `<!DOCTYPE` or `<!ENTITY` (checked before parsing).

- [ ] **Step 1: Write the fixtures and the failing tests:**
  - `word.ttml`: two agents (v1, v2). One line has syllables `<span begin="0:01.000" end="0:01.200">No</span><span
    begin="0:01.200" end="0:01.500">thing</span> <span begin="0:01.500" end="0:02.000">here</span>`. One line has an
    `x-bg` span. Lines appear in the file out of order.
  - `line.ttml`: `itunes:timing="Line"` and `<p begin end>text</p>` only.

  The tests:

```ts
const parse = (s: string) => parseTtml(s, new DOMParser())
it('reads word timing, syllables and sides', () => {
  const r = parse(readFileSync('tests/fixtures/word.ttml', 'utf8'))!
  expect(r.wordTimed).toBe(true)
  const [first] = r.lines
  expect(first.words.map((w) => [w.text, w.joinNext])).toEqual([['No', true], ['thing', false], ['here', false]])
  expect(first.words[0]).toMatchObject({ begin: 1, end: 1.2 })
  expect(r.lines.map((l) => l.side)).toContain('right')
})
it('keeps background vocals out of the main line', () => { /* the x-bg line: background.text is the bg words; main text doesn't contain them */ })
it('sorts lines and drops bad spans', () => { /* inline TTML: lines out of order come back sorted; a span with end < begin and one without begin are dropped */ })
it('reads line-timed TTML', () => {
  const r = parse(readFileSync('tests/fixtures/line.ttml', 'utf8'))!
  expect(r.wordTimed).toBe(false); expect(r.lines[0].words).toEqual([]); expect(r.lines[0].text).toBe('<first line text>')
})
it.each([['5.5', 5.5], ['1:02.250', 62.25], ['1:00:00.000', 3600], ['abc', null], ['', null]])('parseTtmlTime(%s)', (s, v) => expect(parseTtmlTime(s)).toBe(v))
it('rejects DOCTYPE and entity declarations', () => {
  expect(parse('<!DOCTYPE tt [<!ENTITY a "x">]><tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1" end="2">&a;</p></div></body></tt>')).toBeNull()
})
it('returns null for broken XML and for documents with no timed lines', () => {
  expect(parse('<tt><body>')).toBeNull()
  expect(parse('<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p>untimed</p></div></body></tt>')).toBeNull()
})
it('keeps HTML-looking text as text', () => {
  const r = parse('<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1" end="2">&lt;img src=x onerror=alert(1)&gt;</p></div></body></tt>')!
  expect(r.lines[0].text).toBe('<img src=x onerror=alert(1)>')
})
```

  Fill in the two commented tests with concrete `expect`s on the fixture text.
- [ ] **Step 2: Run** `npm install -D jsdom`, then `npx vitest run tests/ttml.test.ts`. Expected: FAIL (module not
  found).
- [ ] **Step 3: Implement** `src/shared/ttml.ts`. Parse with `parser.parseFromString(text, 'application/xml')`. It
  must not import Electron or touch `document`; the parser is passed in.
- [ ] **Step 4: Run** `npx vitest run tests/ttml.test.ts`, then `npm test`. Expected: PASS, with the full suite green.
- [ ] **Step 5: Commit:**
  `git add src/shared/ttml.ts tests/ttml.test.ts tests/fixtures package.json package-lock.json && git commit -m "Lyrics: read Unison's TTML with the browser's XML parser"`

### Task 4: Result types and ranking

**Files:**
- Modify: `src/shared/ipc.ts` (`LyricsResult`, `LyricsQuery`)
- Create: `src/shared/lyrics-rank.ts`
- Test: `tests/lyrics-rank.test.ts`

**Interfaces:**
- Produces, in `src/shared/ipc.ts`. `LyricsResult` becomes a union; the existing LRCLIB fields are unchanged:

```ts
export interface LrclibLyrics { source: 'lrclib'; synced: string | null; plain: string | null; instrumental: boolean; otherVersion?: boolean }
export interface UnisonLyrics {
  source: 'unison'; format: 'ttml' | 'lrc' | 'plain'; text: string
  credit: { videoId: string; submitterName: string; submitterKeyId: string }
}
export type LyricsResult = LrclibLyrics | UnisonLyrics
// LyricsQuery gains: exclude?: 'unison'
```

- Produces, in `src/shared/lyrics-rank.ts`:
  - `hasWordTiming(u: UnisonLyrics): boolean`. True when `format === 'ttml'` and the text matches
    `/<span\b[^>]*\bbegin=/`. A cheap check, so main never parses TTML.
  - `hasLineTiming(u: UnisonLyrics): boolean`. True for `ttml` with `/<p\b[^>]*\bbegin=/`, or for `lrc` with a
    `[mm:ss` timestamp.
  - `rankLyrics(slots: { lrclib?: LrclibLyrics; unison?: UnisonLyrics | null }): LyricsResult | null`. It returns the
    first that exists of:
    1. Unison with word timing.
    2. LRCLIB with `synced`.
    3. Unison with line timing.
    4. LRCLIB with plain text or `instrumental`.
    5. Unison `plain`, or Unison `lrc` without timestamps.
    6. `null`.

- [ ] **Step 1: Write the failing tests** in `tests/lyrics-rank.test.ts`. One `it` per rung, built from helpers
  `uni(format, text)` and `lrc(synced, plain, otherVersion?)`. Each asserts that `rankLyrics` picks the expected
  object over every lower rung, and that `{}` gives `null`. Plus:

```ts
it('decides word timing from the content, not the label', () => {
  expect(hasWordTiming(uni('ttml', '<tt><body><div><p begin="1" end="2">line only</p></div></body></tt>'))).toBe(false)
  expect(hasWordTiming(uni('lrc', '[00:01.00] <00:01.00> word'))).toBe(false)
})
it('prefers LRCLIB synced lines over Unison line timing', () => {
  expect(rankLyrics({ lrclib: lrc('[00:01.00] a', 'a'), unison: uni('lrc', '[00:01.00] b') })?.source).toBe('lrclib')
})
it('prefers Unison line timing over LRCLIB text from another version', () => {
  expect(rankLyrics({ lrclib: lrc(null, 'a', true), unison: uni('lrc', '[00:01.00] b') })?.source).toBe('unison')
})
```

- [ ] **Step 2: Run** `npx vitest run tests/lyrics-rank.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the types and `src/shared/lyrics-rank.ts`. Fix the type errors this causes in
  `src/main/lyrics.ts` (`toResult` returns `LrclibLyrics`) and in `src/preload/overlay/Lyrics.tsx` (narrow with
  `r.source === 'lrclib'` for now; Task 7 rewrites it).
- [ ] **Step 4: Run** `npx vitest run tests/lyrics-rank.test.ts` and `npm run typecheck`. Expected: PASS, no type
  errors.
- [ ] **Step 5: Commit:**
  `git add src/shared src/main/lyrics.ts src/preload/overlay/Lyrics.tsx tests/lyrics-rank.test.ts && git commit -m "Lyrics: rank Unison and LRCLIB results"`

### Task 5: Main: Unison lookups, the two-slot cache and weekly re-checks

**Files:**
- Modify: `src/main/lyrics.ts`
- Modify: `src/main/data.ts`. "Delete all my data" removes `lyrics-cache-v3` as well as `lyrics-cache-v2` (the spec
  assumed no change was needed, but data.ts names the folder explicitly).
- Test: `tests/lyrics.test.ts`. Mock `electron`: `app.getPath` returns a fresh `mkdtemp` dir, `app.getVersion`
  returns `'0.4.0'`, and `net.fetch` is `vi.fn`. Mock `../src/main/store` with a mutable `store.store`.

**Interfaces:**
- Consumes: `allows` from Task 1, the types and `rankLyrics` from Task 4.
- Produces:
  - `getLyrics(q: LyricsQuery): Promise<LyricsResult | null>`. Same signature and validation as today.
  - `settledForTests(): Promise<void>`, which resolves when background re-checks are done.
  - The cache file `<userData>/lyrics-cache-v3/<videoId>.json` holds:

    ```ts
    interface CacheEntry {
      lrclib?: LrclibLyrics
      unison?: { result: UnisonLyrics | null; etag?: string; checkedAt: number }
    }
    ```

**Flow of `getLyrics`:**
1. **Validate** as today.
2. **Load the entry:** from memory, else the v3 file, else the v2 file read as `{ lrclib }`. The v2 file is never
   written or deleted.
3. **Is Unison on for this call?** `useUnison = allows(store.store, 'unison') && q.exclude !== 'unison'`.
4. **If `useUnison` and the `unison` slot is missing (or `q.refresh`):** ask Unison now. Use `If-None-Match` when the
   slot has an etag.
5. **If `rankLyrics` with the Unison slot already gives word timing:** return it.
6. **If the LRCLIB slot is missing** (or `q.refresh`), the video isn't in this session's LRCLIB miss set (unless
   refreshing), and `allows(store.store, 'onlineLyrics')`: run today's LRCLIB lookup.
   - Found: write it to the `lrclib` slot.
   - Not found: add the video to the session miss set.
   - Network error: rethrow only if the Unison slot has no usable result.
7. **Save and return:** write the entry if it changed, and return
   `rankLyrics({ lrclib, unison: useUnison ? unison?.result : undefined })`.
8. **Re-check in the background:** if `useUnison`, the slot existed before this call, and
   `Date.now() - checkedAt > UNISON_RECHECK_MS`, start a re-check. It is not awaited, its errors are swallowed, and
   it saves the entry. The overlay picks the change up on the next open, so there's no push message.

**Unison responses:**
- 200 valid: `result` with `credit` from `data.submitter`, a missing submitter giving `submitterName: ''` and
  `submitterKeyId: ''`. Also save the `etag` header, and `checkedAt = now`.
- 304: `checkedAt = now`, everything else kept.
- 404, or a 200 that fails validation: `result: null`, no etag, `checkedAt = now`.
- Unavailable: slot unchanged.

- [ ] **Step 1: Write the failing tests** in `tests/lyrics.test.ts`. Use a `respond(url => Response)` helper that
  routes `unison.betterlyrics.org` and `lrclib.net` requests to fixtures. Use `vi.setSystemTime` for the 7-day checks.
  - `never calls Unison unless allowed`: settings with `unison: false`. No fetch URL contains `unison`, and the result
    is LRCLIB's.
  - `sends only the video id to Unison`: the Unison URL's search params are exactly `{ v: <id> }`.
  - `word-timed Unison skips LRCLIB`: Unison returns TTML with spans. LRCLIB is never fetched, and `source` is
    `'unison'`.
  - `line-timed Unison loses to LRCLIB synced lines`: both slots get filled, and `source` is `'lrclib'`.
  - `LRCLIB down but Unison has lyrics`: LRCLIB returns 500 and Unison has `lrc`. The result is Unison's, and no
    `lrclib` slot is written.
  - `rejects a Unison answer for another video`: `data.videoId` differs, so the result is LRCLIB's and the slot has
    `result: null`.
  - `re-checks after 7 days with the etag`:
    - 6 days later: no Unison call.
    - 8 days later: a Unison call with `If-None-Match`.
    - On 304, the saved result is kept and `checkedAt` updated (await `settledForTests()`).
  - `a 404 on re-check removes the saved Unison lyrics`: the next `getLyrics` returns LRCLIB's.
  - `ignores the saved Unison slot when Unison is off`: a v3 file with a word-timed Unison slot, and settings with
    `unison: false`. The result is LRCLIB's, and Unison is never fetched.
  - `exclude: unison falls back to LRCLIB`: still allowed, a word-timed slot saved, and `exclude: 'unison'`. The result
    is LRCLIB's, and the slot is still on disk.
  - `reads an old v2 cache file as the LRCLIB slot`.
  - `concurrent lookups for different videos don't mix`: two `getLyrics` calls in flight return their own videos'
    results.
- [ ] **Step 2: Run** `npx vitest run tests/lyrics.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the flow in `src/main/lyrics.ts`, keeping today's LRCLIB search code (`fetchLyrics`)
  unchanged. Use an `AbortSignal.timeout(10_000)` for Unison requests.
- [ ] **Step 4: Run** `npx vitest run tests/lyrics.test.ts`, then `npm test` and `npm run typecheck`. Expected: PASS
  everywhere.
- [ ] **Step 5: Commit:**
  `git add src/main/lyrics.ts src/main/data.ts tests/lyrics.test.ts && git commit -m "Lyrics: look up Unison first, keep LRCLIB beside it, re-check weekly"`

### Task 6: Credit links

**Files:**
- Create: `src/shared/unison.ts`
- Modify: `src/shared/ipc.ts` (add `openLyricsCredit: 'lyrics:credit'` to `IPC`), and `src/main/ipc.ts` (an
  `ipcMain.on` handler)
- Test: `tests/unison.test.ts`

**Interfaces:**
- Produces:
  - `UNISON_ORIGIN = 'https://unison.betterlyrics.org'`.
  - `creditUrl(kind: unknown, id: unknown): string | null`:
    - `'song'` with a valid video ID gives `${UNISON_ORIGIN}/song/${id}`.
    - `'curator'` with a valid key ID gives `${UNISON_ORIGIN}/curator/${id}`.
    - Anything else gives `null`.
  - `creditName(name: string): string` trims, collapses whitespace, and caps at 40 characters (39 plus `…`).
  - The page sends `ipcRenderer.send(IPC.openLyricsCredit, { kind, id })`. Main runs `fromMain(e)`, then `creditUrl`,
    then `openExternal`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('builds Unison links only from valid ids', () => {
  expect(creditUrl('song', 'Ugr4KKK_SqY')).toBe('https://unison.betterlyrics.org/song/Ugr4KKK_SqY')
  expect(creditUrl('curator', 'a'.repeat(64))).toBe(`https://unison.betterlyrics.org/curator/${'a'.repeat(64)}`)
  for (const [k, id] of [['song', 'https://evil.example'], ['song', '../x'], ['curator', 'A'.repeat(64)], ['curator', 'a'.repeat(63)], ['other', 'Ugr4KKK_SqY'], ['song', 42]])
    expect(creditUrl(k, id)).toBeNull()
})
it('creditName caps and trims', () => {
  expect(creditName('  boidu  ')).toBe('boidu')
  expect(creditName('x'.repeat(60))).toBe('x'.repeat(39) + '…')
  expect(creditName('<b>hi</b>')).toBe('<b>hi</b>') // stays text; rendering escapes it
})
```

- [ ] **Step 2: Run** `npx vitest run tests/unison.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/shared/unison.ts`, the IPC name and the main handler next to the `appAction`
  handler.
- [ ] **Step 4: Run** `npx vitest run tests/unison.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:**
  `git add src/shared/unison.ts src/shared/ipc.ts src/main/ipc.ts tests/unison.test.ts && git commit -m "Lyrics: Unison credit links, built and checked in main"`

### Task 7: The Lift view

**Files:**
- Modify: `src/preload/overlay/Lyrics.tsx` and `src/preload/overlay/styles.ts` (the Lyrics section)

**Interfaces:**
- Consumes:
  - `RichLyrics`, `lrcToRich`, `lineIndexAt` and `wordIndexAt` (Task 2).
  - `parseTtml` (Task 3).
  - The `LyricsResult` union (Task 4).
  - `creditName` and `IPC.openLyricsCredit` (Task 6).
- Produces: a `useLyrics` status of `'rich' | 'plain' | 'instrumental' | 'none' | 'error' | 'idle' | 'loading'`, plus
  `rich: RichLyrics | null`, `plain: string`, `otherVersion: boolean`, and
  `credit: UnisonLyrics['credit'] | 'lrclib' | null`. Task 8 reads `credit` and `retry`.

**Behaviour:**
- **Turning a result into something to draw:**
  - LRCLIB `synced`: `lrcToRich(parseLrc(...))`.
  - LRCLIB plain or instrumental: as today.
  - Unison `ttml`: `parseTtml(text, new DOMParser())`. On `null`, invoke `lyricsGet` again with
    `exclude: 'unison'`, under the same `cancelled` guard.
  - Unison `lrc`: `lrcToRich(parseLrc(text))`, or plain text via `stripTimestamps` when it has no lines.
  - Unison `plain`: the plain view.
- **Timing:** replace `useActiveLine` with `useActive(rich)`. Each animation frame it reads
  `video.currentTime + 0.25`. It returns `{ line, word }` and calls `setState` only when either index changes. It also
  works out the word's "current" state, which lasts until `end + 0.15`.
- **Drawing:**
  - Every word is a `<span class="w">` holding its text as a child string.
  - Words whose syllables are joined by `joinNext` are wrapped in `<span class="wg">` with `white-space: nowrap`.
  - Spaces go between groups as text.
  - Line classes: `now`, `past`, `far`, `bg` and `right`. Word classes: `sung` and `cur`.
  - The background line renders right after its main line and lights up with it.
- **Styles:** the Lift values from Global Constraints. Everything new is cancelled under `:host(.perf)` and
  `:host(.rm)`: no transform, text-shadow or filter.
- **Scrolling:** follows the current line, as today (`behavior: perf ? 'auto' : 'smooth'`). It is also instant under
  Reduce motion.
- **Clicking:** a line calls `runAction('seekTo', line.begin)`.
- **Credit:**
  - Unison: `Lyrics from <a>Unison</a> · submitted by <a>{creditName(name)}</a> · click a line to jump to it`. The
    links are `<button class="link">` elements sending `IPC.openLyricsCredit`. With an empty name, drop the
    "submitted by" part.
  - LRCLIB: today's text.
  - The credit shows in the panel footer, and in full-screen under the last line, inside the scroller after the
    bottom padding.
  - While loading or empty, the panel footer shows nothing.

- [ ] **Step 1: Implement** the above. Delete `useActiveLine` once nothing uses it.
- [ ] **Step 2: Run** `npm run typecheck` and `npm test`. Expected: no type errors, suite green.
- [ ] **Step 3: Check in the real app** with `npm run dev`. If there's no saved consent, accept the privacy screen
  with Online lyrics on, then use Settings to switch Unison on (Task 8 adds the UI; until then, set it in the dev
  profile's `config.json`).
  - Play `https://music.youtube.com/watch?v=Ugr4KKK_SqY` (Unison's documented example, word-timed). Open lyrics and
    check:
    - The words lift one by one.
    - Seeking back un-lights them.
    - Pausing freezes them.
    - Full-screen lyrics look the same.
    - The credit shows "Lyrics from Unison · submitted by boidu", and both links open unison.betterlyrics.org pages.
  - Turn Performance mode on: only colours change, and nothing moves or blurs.
  - Play a song Unison doesn't have: line-level Lift, with the LRCLIB credit.
  - Skip tracks quickly while lyrics are loading: the lyrics never belong to the previous song.
- [ ] **Step 4: Commit:**
  `git add src/preload/overlay/Lyrics.tsx src/preload/overlay/styles.ts && git commit -m "Lyrics: Lift, word by word and line by line"`

### Task 8: Asking about Unison

**Files:**
- Modify: `src/preload/overlay/Modals.tsx` (`PRIVACY_TEXT` and `Privacy`), `src/preload/overlay/SettingsPanel.tsx`
  (Privacy section), `src/preload/overlay/Lyrics.tsx` (the card and the "Online lyrics are off" state),
  `src/preload/overlay/ui.tsx` (`Switch` gains `disabled?: boolean`), and `styles.ts` (card and disabled switch)

**Interfaces:**
- Consumes: `needsUnisonQuestion` (Task 1), and `retry` from `useLyrics` (Task 7).
- Produces: `PRIVACY_TEXT` gains:
  - `lyricsFirstRun: { title: 'Online lyrics', hint: <first-launch hint from Global Constraints> }`.
  - `unison: { title: 'Word-by-word lyrics (Unison)', hint: 'Looks up lyrics timed word by word on unison.betterlyrics.org, which receives the song’s YouTube video ID (nothing about you)' }`.
  - `lyrics` keeps today's LRCLIB-only hint.

**Behaviour (spec, Privacy and consent):**
- **First-launch screen:** the lyrics row uses `lyricsFirstRun`. On Continue:
  - Switch on: `updateSettings('privacy', { consented: true, onlineLyrics: true, unison: true, unisonAsked: true, updateChecks })`.
  - Switch off: `{ consented: true, onlineLyrics: false, updateChecks }`. The Unison fields are left alone.
- **Settings:** a row under Online lyrics with the `unison` text and a switch bound to `privacy.unison`.
  - The switch is disabled while `onlineLyrics` is off.
  - Changing it also sets `unisonAsked: true`.
- **"Online lyrics are off" state:** the text becomes "Online lyrics are off. Turning them on sends the song title and
  artist to lrclib.net, and its YouTube video ID to unison.betterlyrics.org." "Turn on" sets `onlineLyrics`,
  `unison` and `unisonAsked` to true, then `retry()`.
- **The card:** while `needsUnisonQuestion(settings)`, the panel and full-screen lyrics show the card over the lyrics
  (the copy from Global Constraints). The lyrics underneath keep loading from LRCLIB as usual.
  - "Turn on": `{ unison: true, unisonAsked: true }`, then `retry()`.
  - "Not now": `{ unisonAsked: true }`.
  - It's a dialog: `role="dialog"`, `aria-label="Word-by-word lyrics"`, with focus on "Turn on" when it appears.

- [ ] **Step 1: Write the failing test.** In `tests/settings.test.ts`, add an `it` for the first-launch rule. Extract
  the Continue logic into an exported pure function `privacyChoices(onlineLyrics: boolean, updateChecks: boolean):
  Partial<Settings['privacy']>` in `src/shared/settings.ts`, and assert both cases above.
- [ ] **Step 2: Run** `npx vitest run tests/settings.test.ts`. Expected: FAIL (`privacyChoices` is not exported).
- [ ] **Step 3: Implement** `privacyChoices` and the UI above.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: green. Then check in `npm run dev`, with a
  profile that has consented but no `unisonAsked`:
  - The card appears on first open.
  - "Not now" hides it for good, including after a restart.
  - The Settings switch then turns Unison on, and the word-timed example song lights up word by word.
  - Delete the dev profile and check the first-launch screen's hint text.
- [ ] **Step 5: Commit:**
  `git add src tests && git commit -m "Lyrics: ask once before using Unison"`

### Task 9: Wording outside the app

**Files:**
- Modify: `PRIVACY.md` (third-party table), `README.md` (feature line), `docs/site/index.html` (feature line), and
  `src/preload/overlay/Modals.tsx` (the onboarding tip)

- [ ] **Step 1:** In `PRIVACY.md`, add a row:
  - Service: **unison.betterlyrics.org**.
  - When: "Only if **Online lyrics** and **Word-by-word lyrics** are on, when you view lyrics for a song that isn't
    saved yet, and about once a week to check saved ones".
  - What's sent: "The song's YouTube video ID. Nothing about you".
  - The Lyrics cache row now mentions lyrics from both services.
- [ ] **Step 2:** README line 24 becomes "**Synced lyrics**: word by word where [Unison](https://unison.betterlyrics.org)
  has them, line by line from [LRCLIB](https://lrclib.net) otherwise. Click a line to jump there, full-screen mode".
  The website's feature `<li>` becomes "**Synced lyrics.** Words light up as they're sung. Click a line to jump
  there."
- [ ] **Step 3:** The onboarding tip text becomes "Lyrics light up as they’re sung. Click a line to jump there."
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: green.
- [ ] **Step 5: Commit:**
  `git add PRIVACY.md README.md docs/site/index.html src/preload/overlay/Modals.tsx && git commit -m "Docs: word-by-word lyrics from Unison"`
