/**
 * Browser identity. Google refuses sign-in from browsers it thinks are embedded or spoofed.
 * Everything that shapes how we present ourselves lives here so it is easy to patch if
 * Google changes its checks.
 *
 * - native:  Electron's own UA, untouched. This is what th-ch/youtube-music signs in with by
 *            default, and the most consistent fingerprint (UA, client hints and JS all agree).
 * - chrome:  Electron/app tokens stripped so we claim plain Chrome. Our first attempt; Google
 *            rejected it, likely because the rest of the fingerprint doesn't match real Chrome.
 * - firefox: Auth window only, claims Firefox and hides the Chromium-only signals.
 */
import { app, session } from 'electron'
import { PARTITION } from '../shared/config'
import { store, type Identity } from './store'

const NATIVE_UA = app.userAgentFallback
const KEEP_TOKENS = new Set(['Mozilla', 'AppleWebKit', 'Chrome', 'Safari'])

/** Electron's UA minus the Electron/app tokens, with the Chrome version reduced the way real Chrome reports it. */
function chromeUA(): string {
  return NATIVE_UA
    .replace(/\s([\w.-]+)\/[\w.]+/g, (token, name: string) => (KEEP_TOKENS.has(name) ? token : ''))
    .replace(/Chrome\/(\d+)[\d.]*/, 'Chrome/$1.0.0.0')
}

/** A current-looking Firefox UA. Firefox 128 shipped 2024-07-09 and releases every 4 weeks. */
export function firefoxUA(): string {
  const weeks = (Date.now() - Date.UTC(2024, 6, 9)) / (7 * 24 * 3600 * 1000)
  const version = 128 + Math.max(0, Math.floor(weeks / 4))
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`
}

/** webContents ids that should look like Firefox on the wire (no Chromium client hints). */
const firefoxContents = new Set<number>()

export function markFirefox(webContentsId: number): void {
  firefoxContents.add(webContentsId)
}

export function unmarkFirefox(webContentsId: number): void {
  firefoxContents.delete(webContentsId)
}

/** Applies the identity to the session. Windows created afterwards pick it up. */
export function applyIdentity(identity: Identity = store.get('auth.identity')): void {
  const ua = identity === 'chrome' ? chromeUA() : NATIVE_UA
  app.userAgentFallback = ua
  session.fromPartition(PARTITION).setUserAgent(ua)
}

/** Must run before any window is created. */
export function setupIdentity(): void {
  applyIdentity()

  // Firefox doesn't send Sec-CH-UA client hints; a "Firefox" that does is an obvious fake.
  session.fromPartition(PARTITION).webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.webContentsId !== undefined && firefoxContents.has(details.webContentsId)) {
      for (const header of Object.keys(details.requestHeaders)) {
        if (header.toLowerCase().startsWith('sec-ch-ua')) delete details.requestHeaders[header]
      }
    }
    callback({ requestHeaders: details.requestHeaders })
  })
}
