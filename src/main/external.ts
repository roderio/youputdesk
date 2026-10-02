import { shell } from 'electron'
import { isSafeExternal } from './navigation'

/** Open a link in the default browser, but only if it's a web page (see isSafeExternal). */
export function openExternal(url: string): void {
  if (isSafeExternal(url)) shell.openExternal(url).catch(() => {})
}
