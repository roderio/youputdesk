/** URL rules shared by the main and auth windows. */

function host(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

const isOrSub = (h: string, domain: string): boolean => h === domain || h.endsWith(`.${domain}`)

export function isYtm(url: string): boolean {
  return host(url) === 'music.youtube.com'
}

/**
 * Interactive Google sign-in pages. These go to the auth window. Hops like ServiceLogin,
 * which redirect straight back when already signed in, run in place; if they land on a
 * sign-in page, the redirect is caught and moved to the auth window.
 */
export function isGoogleSignIn(url: string): boolean {
  if (host(url) !== 'accounts.google.com') return false
  return /^\/(?:v\d+\/)?signin\b|^\/(?:AccountChooser|InteractiveLogin|AddSession)\b/i.test(new URL(url).pathname)
}

/** Pages the main window may show: YTM plus the YouTube/Google hops for consent and sign-out. */
export function isMainAllowed(url: string): boolean {
  const h = host(url)
  return (
    isOrSub(h, 'youtube.com') ||
    h === 'consent.google.com' ||
    (h === 'accounts.google.com' && !isGoogleSignIn(url))
  )
}

/** Pages the auth window may show: the whole Google/YouTube sign-in redirect chain. */
export function isAuthAllowed(url: string): boolean {
  const h = host(url)
  return isOrSub(h, 'google.com') || isOrSub(h, 'youtube.com') || isOrSub(h, 'gstatic.com')
}
