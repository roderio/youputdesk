import { ipcRenderer } from 'electron'
import { useEffect, useRef, useState } from 'preact/hooks'
import { IPC, type LyricsResult, type PlayerState } from '../../shared/ipc'
import { lineAt, parseLrc, type LyricLine } from '../../shared/lrc'
import { SEL } from '../../shared/selectors'
import { runAction } from '../actions'
import { videoElement } from '../page'
import { setState, updateSettings, useUi } from '../store'
import { Icon } from './icons'
import { Button, IconButton } from './ui'

type Status = 'idle' | 'loading' | 'synced' | 'plain' | 'instrumental' | 'none' | 'error'

interface Loaded {
  status: Status
  lines: LyricLine[]
  plain: string
  /** Lyrics are from another version of the song, so they're shown unsynced. */
  otherVersion: boolean
}

const EMPTY: Loaded = { status: 'idle', lines: [], plain: '', otherVersion: false }

/**
 * Lyrics for the current song, fetched once per track (main caches them on disk). Waits until
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
    const query = {
      videoId: player.videoId, title: player.title, artist: player.artist, album: player.album, duration: player.duration,
      refresh: attempt > 0,
    }
    ipcRenderer
      .invoke(IPC.lyricsGet, query)
      .then((r: LyricsResult | null) => {
        if (cancelled) return
        const otherVersion = !!r?.otherVersion
        if (!r) setLoaded({ ...EMPTY, status: 'none' })
        else if (r.instrumental) setLoaded({ ...EMPTY, status: 'instrumental' })
        else if (r.synced) setLoaded({ status: 'synced', lines: parseLrc(r.synced), plain: r.plain ?? '', otherVersion })
        else if (r.plain) setLoaded({ status: 'plain', lines: [], plain: r.plain, otherVersion })
        else setLoaded({ ...EMPTY, status: 'none' })
      })
      .catch(() => !cancelled && setLoaded({ ...EMPTY, status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  return { ...loaded, retry: () => setAttempt((a) => a + 1) }
}

/** Index of the current line, following the <video> clock every frame (only while lyrics are on screen). */
function useActiveLine(lines: LyricLine[]): number {
  const [active, setActive] = useState(-1)
  useEffect(() => {
    if (lines.length === 0) return
    let frame = 0
    let last = -2
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const video = videoElement()
      if (!video || document.hidden) return
      // Show each line a touch early so it's on screen as it's sung.
      const i = lineAt(lines, video.currentTime + 0.25)
      if (i !== last) setActive((last = i))
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [lines])
  return active
}

function openYtmLyrics(): void {
  // YTM's player page has its own (unsynced) lyrics tab: Up next, Lyrics, Related…
  const tab = document.querySelectorAll<HTMLElement>(SEL.playerPageTabs)[1]
  tab?.click()
  setState({ panel: null, fullLyrics: false })
}

function LyricsBody({ big }: { big?: boolean }) {
  const player = useUi((s) => s.player)
  const scale = useUi((s) => s.settings.lyrics.fontScale)
  const perf = useUi((s) => s.settings.ui.performanceMode)
  const { status, lines, plain, otherVersion, retry } = useLyrics(player)
  const active = useActiveLine(status === 'synced' ? lines : [])
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = scroller.current
    const el = box?.querySelector<HTMLElement>(`[data-i="${active}"]`)
    if (!box || !el) return
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: perf ? 'auto' : 'smooth' })
  }, [active])

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
  if (status === 'none' || status === 'error') {
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
  if (status === 'plain') {
    return (
      <div class="lyrics plain" style={{ fontSize }} ref={scroller}>
        <p class="lyrics-note">
          {otherVersion ? 'Not time-synced: these lyrics match another version of this song' : 'Not time-synced'}
        </p>
        {plain.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}
      </div>
    )
  }
  return (
    <div class={`lyrics synced ${big ? 'big' : ''}`} style={{ fontSize }} ref={scroller}>
      <div class="lyrics-pad" />
      {lines.map((l, i) => (
        <p key={i} data-i={i} class={i === active ? 'now' : i < active ? 'past' : ''}
          onClick={() => runAction('seekTo', l.time)} title="Jump here">
          {l.text || '♪'}
        </p>
      ))}
      <div class="lyrics-pad" />
    </div>
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
      <p class="credit">Lyrics from LRCLIB · click a line to jump to it</p>
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
