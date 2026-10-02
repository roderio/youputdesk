/** Windows toasts for ads and track changes. Only shown when the app isn't in front, where the in-page banner covers it. */
import { net, nativeImage, Notification } from 'electron'
import { prettyAccelerator } from '../shared/shortcuts'
import { assetImage, isMainFocused, sendAction, showMainWindow } from './context'
import { player } from './player'
import { store } from './store'

let current: Notification | null = null

function show(title: string, body: string, onClick: () => void, icon = assetImage('icon.png')): void {
  if (!Notification.isSupported()) return
  current?.close()
  const n = new Notification({ title, body, icon, silent: true })
  n.on('click', onClick)
  n.show()
  current = n
}

const skipKeys = (): string => {
  const b = store.get('shortcuts').skipAd
  return b?.accelerator ? prettyAccelerator(b.accelerator).join('+') : ''
}

async function artIcon(url: string) {
  try {
    const res = await net.fetch(url)
    if (res.ok) return nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer())).resize({ width: 96, height: 96 })
  } catch {
    // Fall back to the app icon.
  }
  return assetImage('icon.png')
}

/** From Settings: shows a toast right away, even with the window focused, so the user can check Windows lets us notify. */
export function showTestNotification(): void {
  if (!Notification.isSupported()) return
  const s = player.state
  const body = s?.title && !s.ad ? `Now playing: ${s.title}${s.artist ? ` · ${s.artist}` : ''}` : 'Notifications are working.'
  show('YouputDesk', body, showMainWindow)
}

/** A downloaded update. Shown even with the window focused: it's a one-off and there's no in-page banner for it. */
export function showUpdateReady(version: string, onClick: () => void): void {
  show('Update ready', `YouputDesk ${version} installs next time you open the app. Click to restart now.`, onClick)
}

/** After "Check for updates" found one; we ask about restarting once it's downloaded. */
export function showUpdateDownloading(version: string): void {
  show('Downloading update', `YouputDesk ${version} is downloading. We'll let you know when it's ready.`, showMainWindow)
}

export function setupNotifications(): void {
  player.on('ad', (ad) => {
    if (!ad.active) {
      current?.close()
      current = null
      return
    }
    if (!store.get('notifications.ads') || isMainFocused()) return
    const keys = skipKeys()
    if (ad.skippable) {
      show('You can skip this ad', keys ? `Press ${keys} or click here to skip.` : 'Click here to skip.', () => sendAction('skipAd'))
    } else {
      show('Ad playing', keys ? `We'll tell you when you can skip it (${keys}).` : "We'll tell you when you can skip it.", showMainWindow)
    }
  })

  player.on('track', async (s) => {
    if (!store.get('notifications.trackChange') || isMainFocused()) return
    const icon = s.artwork ? await artIcon(s.artwork) : undefined
    // A skip while the art loaded makes this toast stale.
    if (player.state?.videoId !== s.videoId) return
    show(s.title, [s.artist, s.album].filter(Boolean).join(' · '), showMainWindow, icon)
  })
}
