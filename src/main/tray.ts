/** System tray icon: click for the mini player, right-click for controls. */
import { app, Menu, Tray } from 'electron'
import { assetImage, ctx, sendAction, showMainWindow } from './context'
import { setMiniAnchor, toggleMiniPlayer } from './mini'
import { player } from './player'

let tray: Tray | null = null

function buildMenu(): Menu {
  const s = player.state
  const nowPlaying = s?.title && !s.ad ? `${s.title} — ${s.artist}` : 'Nothing playing'
  return Menu.buildFromTemplate([
    { label: nowPlaying.length > 60 ? `${nowPlaying.slice(0, 57)}…` : nowPlaying, enabled: false },
    { type: 'separator' },
    { label: s?.playing ? 'Pause' : 'Play', click: () => sendAction('playPause') },
    { label: 'Next', click: () => sendAction('next') },
    { label: 'Previous', click: () => sendAction('previous') },
    { label: s?.liked === 'like' ? 'Remove like' : 'Like', click: () => sendAction('like'), enabled: !!s?.videoId },
    { type: 'separator' },
    { label: 'Mini player', click: toggleMiniPlayer },
    { label: 'Show YouputDesk', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        ctx.quitting = true
        app.quit()
      },
    },
  ])
}

export function setupTray(): void {
  tray = new Tray(assetImage('tray.png'))
  tray.setToolTip('YouputDesk')
  tray.on('click', () => {
    if (tray) setMiniAnchor(tray.getBounds())
    toggleMiniPlayer()
  })
  tray.on('double-click', showMainWindow)
  // Build the menu on demand so it always shows the current song and play state.
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()))

  let lastTip = ''
  player.on('state', (s) => {
    const tip = s.title && !s.ad ? `${s.playing ? '▶' : '❚❚'} ${s.title} — ${s.artist}` : 'YouputDesk'
    // Windows caps tray tooltips at 127 characters.
    if (tip !== lastTip) tray?.setToolTip((lastTip = tip).slice(0, 127))
  })
}

export function showTrayBalloon(title: string, content: string): void {
  tray?.displayBalloon({ title, content, iconType: 'info', noSound: true })
}
