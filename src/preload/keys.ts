/** In-app shortcuts. Global ones are grabbed by Windows before they reach the page, so they're handled in main. */
import { ACTION_IDS, eventToAccelerator, normalize } from '../shared/shortcuts'
import { runAction } from './actions'
import { getState, setState, updateSettings } from './store'

const isTyping = (e: KeyboardEvent): boolean => {
  const el = e.composedPath()[0] as HTMLElement | undefined
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

export function setupKeys(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      const s = getState()
      if (s.recording) return

      if (e.key === 'Escape' && (s.panel || s.fullLyrics || s.cheatSheet || s.welcome)) {
        // Close the top-most overlay first.
        if (s.cheatSheet) setState({ cheatSheet: false })
        else if (s.welcome) {
          setState({ welcome: false })
          updateSettings('onboarding', { done: true })
        }
        else if (s.fullLyrics) setState({ fullLyrics: false })
        else setState({ panel: null, draftTheme: null })
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Plain keys while typing (e.g. in YTM's search box) belong to the text field.
      if (isTyping(e) && !e.ctrlKey && !e.altKey) return
      const accel = eventToAccelerator(e)
      if (!accel) return
      const pressed = normalize(accel)
      const bindings = s.settings.shortcuts
      const id = ACTION_IDS.find((a) => !bindings[a].global && bindings[a].accelerator && normalize(bindings[a].accelerator) === pressed)
      if (!id) return
      e.preventDefault()
      e.stopPropagation()
      runAction(id)
    },
    true,
  )
}
