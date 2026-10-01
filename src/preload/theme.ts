/** Applies the selected theme to YouTube Music by keeping one <style> element up to date. */
import { artBackgroundCss, BUILT_IN_THEMES, themeCss, type Theme } from '../shared/themes'
import { getState, subscribe, type UiState } from './store'

export const allThemes = (s: UiState): Theme[] => [...BUILT_IN_THEMES, ...s.settings.theme.custom]

export function activeTheme(s: UiState): Theme {
  return s.draftTheme ?? allThemes(s).find((t) => t.id === s.settings.theme.id) ?? BUILT_IN_THEMES[0]
}

/** Accent for our own overlay UI, so panels match the theme. */
export function accentOf(s: UiState): string {
  const theme = activeTheme(s)
  if (theme.dynamic && s.palette) return s.palette.accent
  return theme.original ? '#ff4e45' : theme.accent
}

export function setupTheme(): void {
  const style = document.createElement('style')
  style.id = 'youputdesk-theme'
  let last = ''

  const render = () => {
    const s = getState()
    const theme = activeTheme(s)
    const art = s.settings.theme.artBackground && !s.settings.ui.performanceMode && s.player?.artwork
    const css = themeCss(theme, theme.dynamic ? s.palette : null) + (art ? artBackgroundCss(art) : '')
    if (css === last) return
    last = css
    style.textContent = css
    // Keep ours last so it wins over YTM's own styles.
    if (style.parentNode !== document.head || document.head.lastElementChild !== style) document.head.append(style)
  }

  render()
  subscribe(render)
}
