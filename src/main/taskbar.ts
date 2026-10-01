/** Taskbar integration: thumbnail toolbar (prev / play-pause / next), progress and window title. */
import type { BrowserWindow } from 'electron'
import { assetImage, sendAction } from './context'
import { player } from './player'

export function setupTaskbar(win: BrowserWindow): void {
  const icons = {
    prev: assetImage('thumb-prev.png'),
    play: assetImage('thumb-play.png'),
    pause: assetImage('thumb-pause.png'),
    next: assetImage('thumb-next.png'),
  }
  let shownPlaying: boolean | null = null

  const setButtons = (playing: boolean) => {
    shownPlaying = playing
    win.setThumbarButtons([
      { tooltip: 'Previous', icon: icons.prev, click: () => sendAction('previous') },
      { tooltip: playing ? 'Pause' : 'Play', icon: playing ? icons.pause : icons.play, click: () => sendAction('playPause') },
      { tooltip: 'Next', icon: icons.next, click: () => sendAction('next') },
    ])
  }

  // Windows drops thumbnail buttons when a window is hidden, so re-add them on show.
  win.on('show', () => setButtons(player.state?.playing ?? false))
  win.once('ready-to-show', () => setButtons(false))

  win.on('page-title-updated', (e) => e.preventDefault())

  let lastTitle = ''
  player.on('state', (s) => {
    if (win.isDestroyed()) return
    if (s.playing !== shownPlaying) setButtons(s.playing)

    const title = s.ad ? 'Ad · YouputDesk' : s.title ? `${s.title} — ${s.artist} · YouputDesk` : 'YouputDesk'
    if (title !== lastTitle) win.setTitle((lastTitle = title))

    if (s.ad || !s.duration) win.setProgressBar(-1)
    else win.setProgressBar(s.position / s.duration, { mode: s.playing ? 'normal' : 'paused' })
  })
}
