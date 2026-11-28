import { ipcRenderer } from 'electron'
import { Fragment } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { IPC, type LyricsQuery, type LyricsResult, type PlayerState, type UnisonLyrics } from '../../shared/ipc'
import { parseLrc } from '../../shared/lrc'
import { stripTimestamps } from '../../shared/lyrics-match'
import { lineIndexAt, lrcToRich, wordIndexAt, type RichLine, type RichLyrics, type RichWord } from '../../shared/rich'
import { SEL } from '../../shared/selectors'
import { parseTtml, xmlParser } from '../../shared/ttml'
import { creditName } from '../../shared/unison'
import { runAction } from '../actions'
import { videoElement } from '../page'
import { setState, updateSettings, useUi } from '../store'
import { Icon } from './icons'
import { Button, IconButton } from './ui'

type Status = 'idle' | 'loading' | 'rich' | 'plain' | 'instrumental' | 'none' | 'error'
type Credit = UnisonLyrics['credit'] | 'lrclib' | null

interface Loaded {
  status: Status
  /** Synced lyrics, line- or word-timed. */
  rich: RichLyrics | null
  plain: string
  /** Lyrics are from another version of the song, so they're shown unsynced. */
  otherVersion: boolean
  credit: Credit
}

const EMPTY: Loaded = { status: 'idle', rich: null, plain: '', otherVersion: false, credit: null }

let parser: DOMParser | null = null
/** One parser (and one Trusted Types policy) per page. */
const ttmlParser = (): DOMParser =>
  (parser ??= xmlParser((window as unknown as { trustedTypes?: Parameters<typeof xmlParser>[0] }).trustedTypes))

/** What to draw for a result, or null when Unison's TTML can't be read (then LRCLIB's lyrics are asked for). */
function toLoaded(r: LyricsResult | null): Loaded | null {
  if (!r) return { ...EMPTY, status: 'none' }
  if (r.source === 'lrclib') {
    const base = { ...EMPTY, credit: 'lrclib' as const, otherVersion: !!r.otherVersion }
    if (r.instrumental) return { ...base, status: 'instrumental' }
    const lines = r.synced ? parseLrc(r.synced) : []
    if (lines.length) return { ...base, status: 'rich', rich: lrcToRich(lines), plain: r.plain ?? '' }
    if (r.plain) return { ...base, status: 'plain', plain: r.plain }
    return { ...EMPTY, status: 'none' }
  }
  const base = { ...EMPTY, credit: r.credit }
  if (r.format === 'ttml') {
    const rich = parseTtml(r.text, ttmlParser())
    return rich ? { ...base, status: 'rich', rich } : null
  }
  if (r.format === 'lrc') {
    const lines = parseLrc(r.text)
    if (lines.length) return { ...base, status: 'rich', rich: lrcToRich(lines) }
    return { ...base, status: 'plain', plain: stripTimestamps(r.text) }
  }
  return { ...base, status: 'plain', plain: r.text }
}

/**
 * Lyrics for the current song, fetched once per track (main saves them on disk). Waits until
 * YTM reports the song's title, artist and length: looking up with half-loaded details finds
 * nothing, or worse, a different song with the same name.
 */
function useLyrics(player: PlayerState | null): Loaded & { retry: () => void } {
  const [loaded, setLoaded] = useState<Loaded>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const ready = !!player && !player.ad && !!player.title && !!player.artist && player.duration > 0
  const key = ready ? player.videoId : ''

  useEffect(() => {
    if (!key || !player) {
      setLoaded(EMPTY)
      return
    }
    let cancelled = false
    setLoaded({ ...EMPTY, status: 'loading' })
    const query: LyricsQuery = {
      videoId: player.videoId, title: player.title, artist: player.artist, album: player.album, duration: player.duration,
      refresh: attempt > 0,
    }
    const get = (q: LyricsQuery): Promise<LyricsResult | null> => ipcRenderer.invoke(IPC.lyricsGet, q)
    get(query)
      // Unison lyrics we can't read: fall back to LRCLIB's for this song.
      .then((r) => (cancelled ? null : toLoaded(r) ?? get({ ...query, exclude: 'unison' }).then((again) => toLoaded(again) ?? { ...EMPTY, status: 'none' as const })))
      .then((l) => !cancelled && l && setLoaded(l))
      .catch(() => !cancelled && setLoaded({ ...EMPTY, status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  return { ...loaded, retry: () => setAttempt((a) => a + 1) }
}

interface Active {
  line: number
  /** Last word of the current line that has started, -1 before the first. */
  word: number
  /** The word being sung right now, or -1 between words. */
  cur: number
  bgWord: number
  bgCur: number
}
const NONE: Active = { line: -1, word: -1, cur: -1, bgWord: -1, bgCur: -1 }

/** Show each line a touch early so it's on screen as it's sung. */
const LOOK_AHEAD_S = 0.25
/** A word keeps its glow a moment after it ends. */
const LINGER_S = 0.15

function wordState(line: RichLine | undefined, t: number): [number, number] {
  if (!line || line.words.length === 0) return [-1, -1]
  const w = wordIndexAt(line, t)
  return [w, w >= 0 && t < line.words[w].end + LINGER_S ? w : -1]
}

/** The current line and word, following the <video> clock every frame (only while lyrics are on screen). */
function useActive(rich: RichLyrics | null): Active {
  const [active, setActive] = useState<Active>(NONE)
  useEffect(() => {
    setActive(NONE)
    if (!rich || rich.lines.length === 0) return
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const video = videoElement()
      if (!video || document.hidden) return
      const t = video.currentTime + LOOK_AHEAD_S
      const line = lineIndexAt(rich.lines, t)
      const [word, cur] = wordState(rich.lines[line], t)
      const [bgWord, bgCur] = wordState(rich.lines[line]?.background, t)
      const key = `${line}|${word}|${cur}|${bgWord}|${bgCur}`
      if (key !== last) {
        last = key
        setActive({ line, word, cur, bgWord, bgCur })
      }
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [rich])
  return active
}

function openYtmLyrics(): void {
  // YTM's player page has its own (unsynced) lyrics tab: Up next, Lyrics, Related…
  const tab = document.querySelectorAll<HTMLElement>(SEL.playerPageTabs)[1]
  tab?.click()
  setState({ panel: null, fullLyrics: false })
}

/** A line's words, with the syllables of one word kept together so a word never breaks across lines. */
function Words({ words, sung, cur }: { words: RichWord[]; sung: number; cur: number }) {
  const groups: [RichWord, number][][] = []
  let group: [RichWord, number][] = []
  words.forEach((w, j) => {
    group.push([w, j])
    if (!w.joinNext) {
      groups.push(group)
      group = []
    }
  })
  if (group.length) groups.push(group)
  return (
    <>
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {gi > 0 && ' '}
          <span class="wg">
            {g.map(([w, j]) => <span key={j} class={`w${j <= sung ? ' sung' : ''}${j === cur ? ' cur' : ''}`}>{w.text}</span>)}
          </span>
        </Fragment>
      ))}
    </>
  )
}

function Line({ line, i, active, bg }: { line: RichLine; i: number; active: Active; bg?: boolean }) {
  const now = i === active.line
  const cls = [
    line.words.length ? 'wt' : 'lt',
    now ? 'now' : i < active.line ? 'past' : '',
    Math.abs(i - Math.max(active.line, 0)) > 2 ? 'far' : '',
    line.side === 'right' ? 'right' : '',
    bg ? 'bg' : '',
  ].filter(Boolean).join(' ')
  return (
    <p data-i={bg ? undefined : i} class={cls} onClick={() => runAction('seekTo', line.begin)} title="Jump here">
      {line.words.length
        ? <Words words={line.words} sung={now ? (bg ? active.bgWord : active.word) : -1} cur={now ? (bg ? active.bgCur : active.cur) : -1} />
        : line.text || '♪'}
    </p>
  )
}

/** The credit Unison's licence asks for: Unison and the person who submitted the lyrics, both linked. */
function CreditLine({ credit }: { credit: Credit }) {
  if (!credit) return null
  if (credit === 'lrclib') return <p class="credit">Lyrics from LRCLIB · click a line to jump to it</p>
  const name = creditName(credit.submitterName)
  const open = (kind: 'song' | 'curator', id: string) => ipcRenderer.send(IPC.openLyricsCredit, { kind, id })
  return (
    <p class="credit">
      Lyrics from <button type="button" class="link" onClick={() => open('song', credit.videoId)}>Unison</button>
      {name && (
        <>
          {' · submitted by '}
          {credit.submitterKeyId
            ? <button type="button" class="link" onClick={() => open('curator', credit.submitterKeyId)}>{name}</button>
            : name}
        </>
      )}
      {' · click a line to jump to it'}
    </p>
  )
}

function LyricsBody({ big }: { big?: boolean }) {
  const online = useUi((s) => s.settings.privacy.consented && s.settings.privacy.onlineLyrics)
  const player = useUi((s) => s.player)
  const scale = useUi((s) => s.settings.lyrics.fontScale)
  const still = useUi((s) => s.settings.ui.performanceMode || s.settings.accessibility.reduceMotion)
  const { status, rich, plain, otherVersion, credit, retry } = useLyrics(player)
  const active = useActive(status === 'rich' ? rich : null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = scroller.current
    const el = box?.querySelector<HTMLElement>(`[data-i="${active.line}"]`)
    if (!box || !el) return
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: still ? 'auto' : 'smooth' })
  }, [active.line])

  if (player?.ad) return <div class="lyrics-empty"><Icon name="info" size={28} /><p>Lyrics will appear after the ad.</p></div>
  if (!player) return <div class="lyrics-empty"><Icon name="note" size={28} /><p>Play a song to see its lyrics.</p></div>
  if (status === 'idle' || status === 'loading') {
    return (
      <div class="lyrics-skeleton" aria-label="Loading lyrics">
        {[72, 55, 80, 64, 48, 70].map((w, i) => <span key={i} style={{ width: `${w}%` }} />)}
      </div>
    )
  }
  if (status === 'instrumental') return <div class="lyrics-empty"><Icon name="note" size={28} /><p>This one's instrumental. Enjoy!</p></div>
  if (status === 'none' && !online) {
    return (
      <div class="lyrics-empty">
        <Icon name="lyrics" size={28} />
        <p>Online lyrics are off. Turning them on sends the song title and artist to lrclib.net.</p>
        <div class="actions">
          <Button onClick={() => {
            updateSettings('privacy', { onlineLyrics: true })
            retry()
          }}>Turn on</Button>
          <Button onClick={openYtmLyrics}>YouTube Music lyrics</Button>
        </div>
      </div>
    )
  }
  if (status === 'none' || status === 'error' || (status === 'rich' && !rich)) {
    return (
      <div class="lyrics-empty">
        <Icon name="lyrics" size={28} />
        <p>{status === 'error' ? "Couldn't reach the lyrics service." : 'No lyrics found for this song.'}</p>
        <div class="actions">
          <Button icon="reset" onClick={retry}>Try again</Button>
          <Button onClick={openYtmLyrics}>YouTube Music lyrics</Button>
        </div>
      </div>
    )
  }

  // px, not rem: YTM shrinks the root font size, which would make rem text tiny.
  const fontSize = `${Math.round((big ? 34 : 19) * scale)}px`
  // Full screen has no footer, so the credit sits under the last line.
  const footer = big ? null : <CreditLine credit={credit} />
  if (status === 'plain') {
    return (
      <>
        <div class="lyrics plain" style={{ fontSize }} ref={scroller}>
          <p class="lyrics-note">
            {otherVersion ? 'Not time-synced: these lyrics match another version of this song' : 'Not time-synced'}
          </p>
          {plain.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}
          {big && <CreditLine credit={credit} />}
        </div>
        {footer}
      </>
    )
  }
  return (
    <>
      <div class={`lyrics synced ${big ? 'big' : ''}`} style={{ fontSize }} ref={scroller}>
        <div class="lyrics-pad" />
        {rich!.lines.map((l, i) => (
          <Fragment key={i}>
            <Line line={l} i={i} active={active} />
            {l.background && <Line line={l.background} i={i} active={active} bg />}
          </Fragment>
        ))}
        <div class="lyrics-pad" />
        {big && <CreditLine credit={credit} />}
      </div>
      {footer}
    </>
  )
}

function FontControls() {
  const scale = useUi((s) => s.settings.lyrics.fontScale)
  const set = (v: number) => updateSettings('lyrics', { fontScale: Math.round(Math.min(1.6, Math.max(0.8, v)) * 10) / 10 })
  return (
    <span class="font-controls">
      <IconButton icon="textSize" size={14} label="Smaller text" onClick={() => set(scale - 0.1)} />
      <IconButton icon="textSize" size={20} label="Bigger text" onClick={() => set(scale + 0.1)} />
    </span>
  )
}

export function LyricsPanel() {
  const player = useUi((s) => s.player)
  return (
    <div class="panel-body lyrics-panel">
      <div class="now-playing">
        {player?.artwork && !player.ad ? <img src={player.artwork} alt="" /> : <div class="art-placeholder"><Icon name="note" /></div>}
        <div class="np-text">
          <div class="np-title">{player && !player.ad ? player.title : 'Nothing playing'}</div>
          <div class="np-artist">{player && !player.ad ? player.artist : ''}</div>
        </div>
        <FontControls />
        <IconButton icon="fullscreen" label="Full-screen lyrics" onClick={() => setState({ fullLyrics: true, panel: null })} />
      </div>
      <LyricsBody key={player?.videoId} />
    </div>
  )
}

export function FullLyrics() {
  const player = useUi((s) => s.player)
  const perf = useUi((s) => s.settings.ui.performanceMode)
  return (
    <div class="full-lyrics" role="dialog" aria-label="Full-screen lyrics">
      {!perf && player?.artwork && <div class="full-bg" style={{ backgroundImage: `url("${player.artwork}")` }} />}
      <div class="full-top">
        <div class="now-playing">
          {player?.artwork && !player.ad && <img src={player.artwork} alt="" />}
          <div class="np-text">
            <div class="np-title">{player?.title}</div>
            <div class="np-artist">{player?.artist}</div>
          </div>
        </div>
        <span class="spacer" />
        <FontControls />
        <IconButton icon={player?.playing ? 'pause' : 'play'} label="Play / pause" onClick={() => runAction('playPause')} />
        <IconButton icon="next" label="Next" onClick={() => runAction('next')} />
        <IconButton icon="close" label="Close (Esc)" onClick={() => setState({ fullLyrics: false })} />
      </div>
      <LyricsBody big key={player?.videoId} />
    </div>
  )
}
