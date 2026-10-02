/**
 * App-wide guards, on top of each window's own sandbox and navigation rules: web content gets only
 * the browser permissions YouTube Music needs, and can't open webviews or unexpected windows.
 */
import { app, session } from 'electron'
import { PARTITION } from '../shared/config'
import { isAuthAllowed } from './navigation'

/** Everything else (camera, microphone, location, USB, HID, serial, MIDI, screen capture, web notifications…) is denied. */
const ALLOWED = new Set(['fullscreen', 'clipboard-sanitized-write'])

const allowed = (permission: string, origin: string): boolean =>
  ALLOWED.has(permission) && origin.startsWith('https://') && isAuthAllowed(origin)

function lockDown(s: Electron.Session, web: boolean): void {
  s.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(web && allowed(permission, details.requestingUrl || contents.getURL())),
  )
  s.setPermissionCheckHandler((_contents, permission, origin) => web && allowed(permission, origin))
  s.setDevicePermissionHandler(() => false)
}

/** Call before the app is ready. */
export function setupSecurity(): void {
  // Every renderer is sandboxed, even one a future change forgets to configure.
  app.enableSandbox()

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
    // Windows that open links set their own handler (which replaces this one); any other can't open windows.
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })

  app.whenReady().then(() => {
    lockDown(session.fromPartition(PARTITION), true)
    // The default session only hosts the mini player, a local page that needs no permissions.
    lockDown(session.defaultSession, false)
  })
}
