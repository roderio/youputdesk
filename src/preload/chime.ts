/**
 * Skip-ad chime: a soft two-note "ding-dong" when YouTube's Skip button becomes available, then
 * every few seconds until the ad is skipped, ends, or the repeat cap is reached. Synthesised with
 * its own AudioContext, outside the EQ chain, so it isn't muted or shaped along with the ad.
 */
import type { AdState } from '../shared/ipc'
import { getState, subscribe } from './store'

export const CHIME_INTERVAL_MS = 5000
/** The first chime plus five repeats: 25 seconds of reminders. */
export const MAX_CHIMES = 6

let ctx: AudioContext | null = null

export function playChime(volume: number): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const peak = Math.max(0, Math.min(1, volume)) * 0.4
    if (peak === 0) return
    const start = ctx.currentTime + 0.02
    // E5 then A5: a rising, friendly interval.
    for (const [i, freq] of [659.25, 880].entries()) {
      const t = start + i * 0.18
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.95)
    }
  } catch (err) {
    console.warn('[YouputDesk] chime unavailable', err)
  }
}

/** Starts and stops the chime as the ad state and settings change. Returns the ad-state handler. */
export function setupChime(): (ad: AdState) => void {
  let timer: ReturnType<typeof setInterval> | undefined
  let ad: AdState = { active: false, skippable: false }
  /** This skippable stretch has had its chimes; don't start again until Skip goes away. */
  let done = false

  const stop = () => {
    clearInterval(timer)
    timer = undefined
  }

  const sync = () => {
    const a11y = getState().settings.accessibility
    const wanted = a11y.adChime && ad.active && ad.skippable
    if (!wanted) {
      done = false
      return stop()
    }
    if (timer || done) return
    done = true
    let played = 1
    playChime(a11y.chimeVolume)
    timer = setInterval(() => {
      if (played >= MAX_CHIMES) return stop()
      played++
      playChime(getState().settings.accessibility.chimeVolume)
    }, CHIME_INTERVAL_MS)
  }

  subscribe(sync)
  return (next) => {
    ad = next
    sync()
  }
}
