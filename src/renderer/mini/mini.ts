import type { PlayerState } from '../../shared/ipc'
import type { MiniApi } from '../../preload/mini'

declare global {
  interface Window {
    mini: MiniApi
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const PLAY = 'M8 5v14l11-7z'
const PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'

const fmt = (s: number): string => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

let current: PlayerState | null = null
// Interpolate between the once-a-second updates so the progress bar glides.
let syncedAt = 0

function render(s: PlayerState | null): void {
  current = s
  syncedAt = performance.now()
  const show = s && s.videoId
  $('title').textContent = !show ? 'Nothing playing' : s.ad ? 'Ad playing' : s.title
  $('artist').textContent = !show ? 'Start a song in YouputDesk' : s.ad ? 'Your music continues after the ad' : s.artist
  const art = $<HTMLImageElement>('art')
  if (show && s.artwork && art.src !== s.artwork) {
    art.src = s.artwork
    $('card').style.setProperty('--art', `url("${s.artwork.replace(/"/g, '')}")`)
  }
  $('play-path').setAttribute('d', s?.playing ? PAUSE : PLAY)
  $('play').setAttribute('aria-label', s?.playing ? 'Pause' : 'Play')
  // Classic YTM layout: shuffle is a one-shot "shuffle the queue", so it never shows as on.
  $('shuffle').classList.toggle('on', s?.shuffle === true)
  const repeat = s?.repeat ?? 'none'
  const repeatLabel = `Repeat: ${repeat === 'none' ? 'off' : repeat}`
  $('repeat').classList.toggle('on', repeat !== 'none')
  $('repeat').title = repeatLabel
  $('repeat').setAttribute('aria-label', repeatLabel)
  $('repeat-one').hidden = repeat !== 'one'
  $('dur').textContent = fmt(s?.duration ?? 0)
}

function frame(): void {
  requestAnimationFrame(frame)
  const s = current
  if (!s || !s.duration || document.hidden) return
  const pos = Math.min(s.duration, s.position + (s.playing ? (performance.now() - syncedAt) / 1000 : 0))
  $('fill').style.transform = `scaleX(${pos / s.duration})`
  $('pos').textContent = fmt(pos)
}

window.mini.onState(render)
requestAnimationFrame(frame)

const bind = (id: string, cmd: Parameters<MiniApi['command']>[0]) => $(id).addEventListener('click', () => window.mini.command(cmd))
bind('play', 'playPause')
bind('next', 'next')
bind('prev', 'previous')
bind('shuffle', 'shuffle')
$('shuffle').addEventListener('click', () => {
  const el = $('shuffle')
  el.classList.remove('pulse')
  void el.offsetWidth // restart the animation
  el.classList.add('pulse')
})
bind('repeat', 'repeat')
bind('open', 'open')
bind('close', 'close')

$('progress').addEventListener('click', (e) => {
  const r = $('progress').getBoundingClientRect()
  window.mini.command({ seek: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) })
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.mini.command('close')
  else if (e.key === ' ') { e.preventDefault(); window.mini.command('playPause') }
  else if (e.key === 'ArrowRight') window.mini.command('next')
  else if (e.key === 'ArrowLeft') window.mini.command('previous')
  else if (e.key === 'ArrowUp') window.mini.command('volumeUp')
  else if (e.key === 'ArrowDown') window.mini.command('volumeDown')
})
window.addEventListener('wheel', (e) => window.mini.command(e.deltaY < 0 ? 'volumeUp' : 'volumeDown'), { passive: true })
