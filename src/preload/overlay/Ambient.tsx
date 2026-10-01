/** Lightweight UI that floats over the page: the ad banner and toasts. */
import { runAction } from '../actions'
import { useUi } from '../store'
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
