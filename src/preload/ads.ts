/** Watches for ads on free accounts. Premium accounts never see ads, so this simply stays idle. */
import { ipcRenderer } from 'electron'
import { IPC, type AdState } from '../shared/ipc'
import { AD_CLASS, SEL } from '../shared/selectors'

function skipButton(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(SEL.skipAdButton)) {
    // The skip button exists (hidden) before it becomes clickable.
    if (el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

const adPlaying = (): boolean => !!document.querySelector(SEL.player)?.classList.contains(AD_CLASS)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Gone means it worked: the ad ended, or at least its Skip button did. */
async function skipped(button: HTMLElement, ms: number): Promise<boolean> {
  await wait(ms)
  return !adPlaying() || !button.isConnected || skipButton() !== button
}

export type SkipResult = 'skipped' | 'not-skippable' | 'failed'

/** Lets our overlay ignore the mouse while we click Skip; set by the overlay when it mounts. */
let setClickThrough: (on: boolean) => void = () => {}
export function registerClickThrough(fn: (on: boolean) => void): void {
  setClickThrough = fn
}

/** Recent skip attempts and which method worked, for the debug handle. */
export const skipLog: string[] = []
function log(entry: string): void {
  skipLog.push(`${new Date().toLocaleTimeString()} ${entry}`)
  if (skipLog.length > 20) skipLog.shift()
}

/**
 * Press YouTube's own "Skip" button. Some versions of it ignore clicks made by script, so the
 * first try is a real mouse click (sent by main, exactly like the user clicking it); a script
 * click is the fallback, e.g. when our own panel covers the button.
 */
export async function skipAd(): Promise<SkipResult> {
  const button = skipButton()
  if (!button) return 'not-skippable'

  // Our panels can sit on top of the button (the corner video is under the side panel), and a
  // real click hits whatever is on top. Let clicks pass through our UI while we press Skip.
  setClickThrough(true)
  try {
    const r = button.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const hit = document.elementFromPoint(x, y)
    const onTop = !!hit && (hit === button || button.contains(hit))
    if (onTop) {
      ipcRenderer.send(IPC.skipAdClick, { x, y })
      if (await skipped(button, 600)) {
        log(`skipped by mouse click (${button.className})`)
        return 'skipped'
      }
    }
    button.click()
    const ok = await skipped(button, 600)
    log(`${ok ? 'skipped' : 'FAILED'} by script click (${button.className}; button ${onTop ? 'on top' : `covered by ${hit?.tagName}`})`)
    return ok ? 'skipped' : 'failed'
  } finally {
    setClickThrough(false)
  }
}

export function watchAds(onChange: (state: AdState) => void): void {
  let current: AdState = { active: false, skippable: false }
  let poll: ReturnType<typeof setInterval> | undefined
  let observed: Element | null = null

  const check = () => {
    const active = !!observed?.classList.contains(AD_CLASS)
    const next = { active, skippable: active && !!skipButton() }
    if (next.active !== current.active || next.skippable !== current.skippable) {
      current = next
      onChange(next)
    }
    // The skip button appears a few seconds into the ad without a class change, so poll only while an ad runs.
    if (active && !poll) poll = setInterval(check, 500)
    if (!active && poll) {
      clearInterval(poll)
      poll = undefined
    }
  }

  const classObserver = new MutationObserver(check)
  // The player element appears after load and may be replaced; re-find it every few seconds.
  const findPlayer = () => {
    const player = document.querySelector(SEL.player)
    if (player && player !== observed) {
      classObserver.disconnect()
      observed = player
      classObserver.observe(player, { attributes: true, attributeFilter: ['class'] })
      check()
    }
  }
  findPlayer()
  setInterval(findPlayer, 3000)
}
