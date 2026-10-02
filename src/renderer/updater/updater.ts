import type { UpdateStatus } from '../../shared/ipc'
import type { UpdaterApi } from '../../preload/updater'
import { formatProgress, QUIPS } from '../../shared/update-ui'

declare global {
  interface Window {
    updater: UpdaterApi
  }
}

const $ = (id: string) => document.getElementById(id) as HTMLElement
const SKIP_AFTER_MS = 8_000
const QUIP_EVERY_MS = 2_200

let phase: UpdateStatus['phase'] | null = null
let quipTimer: number | undefined
let skipTimer: number | undefined
let quipIndex = Math.floor(Math.random() * QUIPS.length)

function nextQuip(): void {
  const el = $('quip')
  el.classList.add('out')
  setTimeout(() => {
    // The download may have finished while the old line faded out.
    if (phase !== 'downloading') return
    quipIndex = (quipIndex + 1) % QUIPS.length
    el.textContent = QUIPS[quipIndex]
    el.classList.remove('out')
  }, 200)
}

function enter(next: UpdateStatus['phase'], reduceMotion: boolean): void {
  phase = next
  $('card').className = `card ${next}`
  clearInterval(quipTimer)
  clearTimeout(skipTimer)
  $('skip').classList.remove('shown')
  $('quip').textContent = ''
  if (next === 'downloading') {
    $('quip').textContent = QUIPS[quipIndex]
    if (!reduceMotion) quipTimer = window.setInterval(nextQuip, QUIP_EVERY_MS)
    skipTimer = window.setTimeout(() => $('skip').classList.add('shown'), SKIP_AFTER_MS)
  }
}

window.updater.onStatus((s) => {
  document.documentElement.classList.toggle('reduce-motion', s.reduceMotion)
  if (s.phase !== phase) enter(s.phase, s.reduceMotion)
  const v = s.version ? ` ${s.version}` : ''
  if (s.phase === 'checking') {
    $('status').textContent = 'Checking for updates…'
  } else if (s.phase === 'downloading') {
    $('status').textContent = `Downloading YouputDesk${v}`
    $('fill').style.transform = `scaleX(${Math.min(100, Math.max(0, s.percent ?? 0)) / 100})`
    $('detail').textContent = s.transferred !== undefined ? formatProgress(s.transferred, s.total, s.bytesPerSecond) : ''
  } else if (s.phase === 'installing') {
    $('status').textContent = `Installing YouputDesk${v}…`
    $('detail').textContent = 'Back in a few seconds'
  }
})

$('skip').addEventListener('click', () => window.updater.skip())
