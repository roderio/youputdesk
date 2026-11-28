import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricsQuery } from '../src/shared/ipc'

// Main's lyrics lookups, with Electron's network and paths replaced: every request goes through `route`.
const h = vi.hoisted(() => ({
  dir: '',
  settings: { privacy: { consented: true, onlineLyrics: true, updateChecks: false, unison: true, unisonAsked: true } },
  route: (_url: URL, _init?: RequestInit): Response | Promise<Response> => new Response(null, { status: 404 }),
  calls: [] as { url: URL; init?: RequestInit }[],
}))

vi.mock('electron', () => ({
  app: { getPath: () => h.dir, getVersion: () => '0.4.0' },
  net: {
    fetch: async (url: string, init?: RequestInit) => {
      const u = new URL(url)
      h.calls.push({ url: u, init })
      return h.route(u, init)
    },
  },
}))
vi.mock('../src/main/store', () => ({ store: { get store() { return h.settings } } }))

const ID = 'Ugr4KKK_SqY'
const KEY = 'a'.repeat(64)
const WORD_TTML = '<tt><body><div><p begin="1" end="2"><span begin="1" end="2">word</span></p></div></body></tt>'
const DAY = 24 * 3600 * 1000

const q = (extra: Partial<LyricsQuery> = {}): LyricsQuery =>
  ({ videoId: ID, title: 'Song', artist: 'Artist', album: '', duration: 200, ...extra })

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }, ...init })

const unison = (format: string, lyrics: string, videoId = ID, etag = 'W/"1"') =>
  json({ success: true, data: { videoId, format, syncType: 'richsync', lyrics, submitter: { displayName: 'someone', keyId: KEY } } }, { headers: { etag } })

const lrclibTrack = (synced: string | null, name = 'Song') =>
  json({ trackName: name, artistName: 'Artist', duration: 200, instrumental: false, plainLyrics: 'plain words', syncedLyrics: synced })

/** Routes Unison and LRCLIB to the given answers. */
function serve(answers: { unison?: (init?: RequestInit) => Response; lrclib?: (url: URL) => Response }): void {
  h.route = (url, init) => {
    if (url.hostname === 'unison.betterlyrics.org') return answers.unison?.(init) ?? new Response(null, { status: 404 })
    if (url.hostname === 'lrclib.net') {
      if (url.pathname.endsWith('/get')) return answers.lrclib?.(url) ?? new Response(null, { status: 404 })
      return json([])
    }
    throw new Error(`unexpected request ${url}`)
  }
}

const unisonCalls = () => h.calls.filter((c) => c.url.hostname === 'unison.betterlyrics.org')
const lrclibCalls = () => h.calls.filter((c) => c.url.hostname === 'lrclib.net')
const cacheFile = () => join(h.dir, 'lyrics-cache-v3', `${ID}.json`)

let lyrics: typeof import('../src/main/lyrics')

beforeEach(async () => {
  h.dir = mkdtempSync(join(tmpdir(), 'ypd-lyrics-'))
  h.calls = []
  h.settings.privacy = { consented: true, onlineLyrics: true, updateChecks: false, unison: true, unisonAsked: true }
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-01T00:00:00Z'))
  vi.resetModules()
  lyrics = await import('../src/main/lyrics')
})
afterEach(() => vi.useRealTimers())

describe('getLyrics with Unison', () => {
  it('never calls Unison unless allowed', async () => {
    h.settings.privacy.unison = false
    serve({ unison: () => unison('ttml', WORD_TTML), lrclib: () => lrclibTrack('[00:01.00] a') })
    expect((await lyrics.getLyrics(q()))?.source).toBe('lrclib')
    await lyrics.settledForTests()
    expect(unisonCalls()).toHaveLength(0)
  })

  it('sends only the video id to Unison', async () => {
    serve({ unison: () => unison('ttml', WORD_TTML) })
    await lyrics.getLyrics(q())
    const [call] = unisonCalls()
    expect(call.url.pathname).toBe('/lyrics')
    expect([...call.url.searchParams]).toEqual([['v', ID]])
  })

  it('word-timed Unison skips LRCLIB', async () => {
    serve({ unison: () => unison('ttml', WORD_TTML), lrclib: () => lrclibTrack('[00:01.00] a') })
    const r = await lyrics.getLyrics(q())
    expect(r).toMatchObject({ source: 'unison', format: 'ttml', credit: { videoId: ID, submitterName: 'someone', submitterKeyId: KEY } })
    expect(lrclibCalls()).toHaveLength(0)
  })

  it('line-timed Unison loses to LRCLIB synced lines', async () => {
    serve({ unison: () => unison('lrc', '[00:01.00] u'), lrclib: () => lrclibTrack('[00:01.00] a') })
    expect((await lyrics.getLyrics(q()))?.source).toBe('lrclib')
    const saved = JSON.parse(readFileSync(cacheFile(), 'utf8'))
    expect(saved.lrclib.source).toBe('lrclib')
    expect(saved.unison.result.source).toBe('unison')
  })

  it('LRCLIB down but Unison has lyrics', async () => {
    serve({ unison: () => unison('lrc', '[00:01.00] u'), lrclib: () => new Response(null, { status: 500 }) })
    expect((await lyrics.getLyrics(q()))?.source).toBe('unison')
    expect(JSON.parse(readFileSync(cacheFile(), 'utf8')).lrclib).toBeUndefined()
  })

  it('rejects a Unison answer for another video', async () => {
    serve({ unison: () => unison('ttml', WORD_TTML, 'someOtherId'), lrclib: () => lrclibTrack('[00:01.00] a') })
    expect((await lyrics.getLyrics(q()))?.source).toBe('lrclib')
    expect(JSON.parse(readFileSync(cacheFile(), 'utf8')).unison.result).toBeNull()
  })

  it('re-checks after 7 days with the etag', async () => {
    serve({ unison: () => unison('ttml', WORD_TTML, ID, 'W/"v1"') })
    await lyrics.getLyrics(q())
    expect(unisonCalls()).toHaveLength(1)

    vi.setSystemTime(Date.now() + 6 * DAY)
    await lyrics.getLyrics(q())
    await lyrics.settledForTests()
    expect(unisonCalls()).toHaveLength(1)

    vi.setSystemTime(Date.now() + 2 * DAY)
    serve({ unison: () => new Response(null, { status: 304 }) })
    expect((await lyrics.getLyrics(q()))?.source).toBe('unison')
    await lyrics.settledForTests()
    expect(unisonCalls()).toHaveLength(2)
    expect(new Headers(unisonCalls()[1].init?.headers).get('if-none-match')).toBe('W/"v1"')
    const saved = JSON.parse(readFileSync(cacheFile(), 'utf8'))
    expect(saved.unison.result.format).toBe('ttml')
    expect(saved.unison.checkedAt).toBe(Date.now())
  })

  it('a 404 on re-check removes the saved Unison lyrics', async () => {
    serve({ unison: () => unison('ttml', WORD_TTML), lrclib: () => lrclibTrack('[00:01.00] a') })
    await lyrics.getLyrics(q())
    vi.setSystemTime(Date.now() + 8 * DAY)
    serve({ unison: () => new Response(null, { status: 404 }), lrclib: () => lrclibTrack('[00:01.00] a') })
    await lyrics.getLyrics(q())
    await lyrics.settledForTests()
    expect((await lyrics.getLyrics(q()))?.source).toBe('lrclib')
  })

  it('ignores the saved Unison slot when Unison is off', async () => {
    mkdirSync(join(h.dir, 'lyrics-cache-v3'), { recursive: true })
    writeFileSync(cacheFile(), JSON.stringify({
      unison: { checkedAt: Date.now(), result: { source: 'unison', format: 'ttml', text: WORD_TTML, credit: { videoId: ID, submitterName: 'x', submitterKeyId: KEY } } },
    }))
    h.settings.privacy.unison = false
    serve({ lrclib: () => lrclibTrack('[00:01.00] a') })
    expect((await lyrics.getLyrics(q()))?.source).toBe('lrclib')
    await lyrics.settledForTests()
    expect(unisonCalls()).toHaveLength(0)
    expect(JSON.parse(readFileSync(cacheFile(), 'utf8')).unison.result.format).toBe('ttml')
  })

  it('exclude: unison falls back to LRCLIB', async () => {
    serve({ unison: () => unison('ttml', WORD_TTML), lrclib: () => lrclibTrack('[00:01.00] a') })
    expect((await lyrics.getLyrics(q()))?.source).toBe('unison')
    expect((await lyrics.getLyrics(q({ exclude: 'unison' })))?.source).toBe('lrclib')
    expect(JSON.parse(readFileSync(cacheFile(), 'utf8')).unison.result.format).toBe('ttml')
  })

  it('reads an old v2 cache file as the LRCLIB slot', async () => {
    h.settings.privacy.unison = false
    mkdirSync(join(h.dir, 'lyrics-cache-v2'), { recursive: true })
    writeFileSync(join(h.dir, 'lyrics-cache-v2', `${ID}.json`), JSON.stringify({ source: 'lrclib', synced: '[00:01.00] old', plain: 'old', instrumental: false }))
    serve({})
    expect(await lyrics.getLyrics(q())).toMatchObject({ source: 'lrclib', synced: '[00:01.00] old' })
    expect(h.calls).toHaveLength(0)
    expect(existsSync(join(h.dir, 'lyrics-cache-v2', `${ID}.json`))).toBe(true)
  })

  it("concurrent lookups for different videos don't mix", async () => {
    h.settings.privacy.unison = false
    serve({ lrclib: (url) => lrclibTrack(`[00:01.00] ${url.searchParams.get('track_name')}`, url.searchParams.get('track_name')!) })
    const [a, b] = await Promise.all([
      lyrics.getLyrics(q({ videoId: 'aaaaaaaaaaa', title: 'Song A' })),
      lyrics.getLyrics(q({ videoId: 'bbbbbbbbbbb', title: 'Song B' })),
    ])
    expect(a).toMatchObject({ synced: '[00:01.00] Song A' })
    expect(b).toMatchObject({ synced: '[00:01.00] Song B' })
  })
})
