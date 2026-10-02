/** Lightweight UI that floats over the page: the ad banner and toasts. */
import { useEffect, useState } from 'preact/hooks'
import { prettyAccelerator } from '../../shared/shortcuts'
import { runAction } from '../actions'
import { getState, useUi } from '../store'
import { Icon } from './icons'
import { Keys } from './ui'

export function AdBanner() {
  const ad = useUi((s) => s.ad)
  const enabled = useUi((s) => s.settings.notifications.ads)
  const keys = useUi((s) => s.settings.shortcuts.skipAd.accelerator)
  if (!ad.active || !enabled) return null
  return (
    <div class={`ad-banner ${ad.skippable ? 'ready' : ''}`} role="status">
      <span class="ad-tag">Ad</span>
      {ad.skippable ? (
        <>
          <span>You can skip this ad</span>
          <button type="button" class="ad-skip" onClick={() => runAction('skipAd')}>
            Skip <Icon name="next" size={16} />
          </button>
          <Keys accelerator={keys} muted />
        </>
      ) : (
        <span class="ad-wait">
          <span class="spinner" /> Skip will be ready in a moment · <Keys accelerator={keys} muted />
        </span>
      )}
    </div>
  )
}

/**
 * Visually hidden live regions for screen readers (NVDA, Narrator): song changes are announced
 * politely, a skippable ad assertively.
 */
export function Announcer() {
  const enabled = useUi((s) => s.settings.accessibility.announce)
  const songId = useUi((s) => (s.player && !s.player.ad ? s.player.videoId : ''))
  const skippable = useUi((s) => s.ad.active && s.ad.skippable)
  const keys = useUi((s) => s.settings.shortcuts.skipAd.accelerator)
  const [polite, setPolite] = useState('')
  const [urgent, setUrgent] = useState('')

  useEffect(() => {
    const p = getState().player
    if (!enabled || !songId || !p) return
    setPolite(`Now playing: ${p.title}${p.artist ? ` by ${p.artist}` : ''}`)
  }, [songId, enabled])

  useEffect(() => {
    if (!enabled || !skippable) return setUrgent('')
    const k = prettyAccelerator(keys).join(' ')
    setUrgent(k ? `Ad can be skipped. Press ${k}.` : 'Ad can be skipped.')
  }, [skippable, enabled])

  return (
    <>
      <div class="sr-only" role="status" aria-live="polite">{polite}</div>
      <div class="sr-only" aria-live="assertive">{urgent}</div>
    </>
  )
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div class="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div class="toast" key={t.id}>
          {t.icon && <Icon name={t.icon} size={18} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
