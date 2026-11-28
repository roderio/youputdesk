/** Unison (https://unison.betterlyrics.org): community lyrics with word timing, looked up by YouTube video ID. */
export const UNISON_ORIGIN = 'https://unison.betterlyrics.org'

const VIDEO_ID = /^[\w-]{6,20}$/
const KEY_ID = /^[0-9a-f]{64}$/

/**
 * The credit links Unison's licence asks for. Main builds them from checked ids, so the YouTube Music page
 * (which we don't control) can never make the app open a link of its choosing.
 */
export function creditUrl(kind: unknown, id: unknown): string | null {
  if (typeof id !== 'string') return null
  if (kind === 'song' && VIDEO_ID.test(id)) return `${UNISON_ORIGIN}/song/${id}`
  if (kind === 'curator' && KEY_ID.test(id)) return `${UNISON_ORIGIN}/curator/${id}`
  return null
}

const MAX_NAME = 40

/** The submitter's display name as shown in the credit: one line, at most 40 characters. */
export function creditName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  return clean.length > MAX_NAME ? clean.slice(0, MAX_NAME - 1) + '…' : clean
}
