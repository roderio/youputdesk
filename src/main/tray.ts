/**
 * System tray icon: click to open the app, right-click for controls and the mini player.
 * Linux tray icons (AppIndicator / StatusNotifier) don't report clicks, so there the menu is attached to
 * the icon and rebuilt when what it shows changes.
 */
import { app, Menu, Notification, Tray } from 'electron'
import { isLinux } from '../shared/platform'
import { assetImage, ctx, sendAction, showMainWindow } from './context'
import { setMiniAnchor, toggleMiniPlayer } from './mini'
import { player } from './player'
import { canUpdate, checkForUpdatesNow, pendingUpdate, restartToUpdate } from './updater'

let tray: Tray | null = null

function updateItems(): Electron.MenuItemConstructorOptions[] {
  // Portable and dev builds don't update; the App menu's item explains that.
  if (!canUpdate()) return []
  const pending = pendingUpdate()
  return [
    pending ? { label: `Restart to update (${pending})`, click: restartToUpdate } : { label: 'Check for updates', click: () => void checkForUpdatesNow() },
    { type: 'separator' },
  ]
}

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
    ...updateItems(),
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
  tray.on('click', showMainWindow)
  if (isLinux()) {
    // No bounds either, so the mini player opens at the cursor instead of above the icon.
    tray.setContextMenu(buildMenu())
  } else {
    // Build the menu on demand so it always shows the current song and play state.
    tray.on('right-click', () => {
      if (!tray) return
      // The menu's Mini player item pops the card up above the tray icon.
      setMiniAnchor(tray.getBounds())
      tray.popUpContextMenu(buildMenu())
    })
  }

  let lastTip = ''
  let lastMenu = ''
  player.on('state', (s) => {
    if (isLinux()) {
      // Only what the menu shows; position ticks would rebuild it several times a second.
      const key = `${s.playing}|${s.title}|${s.artist}|${s.liked}|${s.ad}|${s.videoId}`
      if (key !== lastMenu) tray?.setContextMenu(buildMenu())
      lastMenu = key
    }
    const tip = s.title && !s.ad ? `${s.playing ? '▶' : '❚❚'} ${s.title} — ${s.artist}` : 'YouputDesk'
    // Windows caps tray tooltips at 127 characters.
    if (tip !== lastTip) tray?.setToolTip((lastTip = tip).slice(0, 127))
  })
}

/** A one-off hint about the tray. Balloons are Windows-only; Linux gets an ordinary notification. */
export function showTrayHint(title: string, content: string): void {
  if (!isLinux()) {
    tray?.displayBalloon({ title, content, iconType: 'info', noSound: true })
    return
  }
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body: content, icon: assetImage('icon.png'), silent: true })
  n.on('click', showMainWindow)
  n.show()
}
