/**
 * Themes recolour YouTube Music by overriding its CSS variables (and the few surfaces
 * that hardcode colours). YTM is dark-only, so themes are dark palettes.
 */

export interface Theme {
  id: string
  name: string
  accent: string
  background: string
  surface: string
  text: string
  /** Corner radius for album art and cards, in px. Undefined keeps YTM's. */
  radius?: number
  font?: string
  /** Colours come from the current album art at runtime. */
  dynamic?: boolean
  /** No overrides at all: YouTube Music's own look. */
  original?: boolean
}

export interface Palette {
  accent: string
  background: string
  surface: string
}

export const BUILT_IN_THEMES: Theme[] = [
  { id: 'original', name: 'YouTube Music', accent: '#ff0033', background: '#030303', surface: '#212121', text: '#ffffff', original: true },
  { id: 'dynamic', name: 'Album Art', accent: '#ff4e45', background: '#0b0b10', surface: '#17171f', text: '#ffffff', dynamic: true, radius: 10 },
  { id: 'amoled', name: 'AMOLED', accent: '#ff3d5a', background: '#000000', surface: '#0d0d0d', text: '#f5f5f5', radius: 8 },
  { id: 'midnight', name: 'Midnight', accent: '#4cc9f0', background: '#0a0f1e', surface: '#131a2e', text: '#e8eefc', radius: 12 },
  { id: 'sakura', name: 'Sakura', accent: '#ff8fb8', background: '#170d14', surface: '#24161f', text: '#fbeef4', radius: 14 },
  { id: 'forest', name: 'Forest', accent: '#6ee7a8', background: '#0a1410', surface: '#13211b', text: '#e9f7ef', radius: 10 },
  { id: 'sunset', name: 'Sunset', accent: '#ffb347', background: '#1a0f0a', surface: '#2a1a12', text: '#fff3e6', radius: 12 },
  { id: 'violet', name: 'Violet', accent: '#b388ff', background: '#100b1a', surface: '#1c1530', text: '#f1ebff', radius: 16 },
]

export const FONTS = ['YouTube Sans', 'Inter', 'Segoe UI', 'Roboto', 'Georgia', 'Consolas']

/** Strip anything that could break out of a CSS declaration. Theme JSON can be imported from anywhere. */
export function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^(?:rgba?|hsla?)\([\d\s.,%/]+\)$/i.test(value) ? value : fallback
}

const safeFont = (value: string | undefined): string | undefined =>
  value && /^[\w \-]+$/.test(value) ? value : undefined

export function isTheme(value: unknown): value is Theme {
  const t = value as Theme
  return !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string' &&
    ['accent', 'background', 'surface', 'text'].every((k) => typeof t[k as keyof Theme] === 'string')
}

/** CSS that applies a theme to YouTube Music. `palette` overrides colours for dynamic themes. */
export function themeCss(theme: Theme, palette?: Palette | null): string {
  if (theme.original) return ''
  const accent = safeColor(palette?.accent ?? theme.accent, '#ff4e45')
  const bg = safeColor(palette?.background ?? theme.background, '#030303')
  const surface = safeColor(palette?.surface ?? theme.surface, '#212121')
  const text = safeColor(theme.text, '#ffffff')
  const font = safeFont(theme.font)
  const radius = theme.radius !== undefined ? Math.max(0, Math.min(32, Number(theme.radius) || 0)) : undefined

  return `
html, ytmusic-app {
  --ytmusic-general-background-c: ${bg} !important;
  --ytmusic-general-background-a: ${surface} !important;
  --ytmusic-brand-background-solid: ${surface} !important;
  --ytmusic-player-bar-background: ${surface} !important;
  --ytmusic-search-background: ${surface} !important;
  --ytmusic-color-black1: ${surface} !important;
  --ytmusic-color-black2: ${surface} !important;
  --ytmusic-color-black4: ${bg} !important;
  --ytmusic-text-primary: ${text} !important;
  --yt-sys-color-baseline--base-background: ${bg} !important;
  --yt-sys-color-baseline--raised-background: ${surface} !important;
  --yt-sys-color-baseline--menu-background: ${surface} !important;
  --yt-sys-color-baseline--text-primary: ${text} !important;
  --yt-sys-color-baseline--static-brand-red: ${accent} !important;
  --yt-sys-color-baseline--brand-red: ${accent} !important;
  --yt-spec-static-brand-red: ${accent} !important;
  --ytmusic-color-youtubered: ${accent} !important;
  --ytmusic-color-lightred: ${accent} !important;
  --ypd-accent: ${accent} !important;
}
body, #guide-wrapper, ytmusic-player-page, #nav-bar-background, #mini-guide-background,
tp-yt-paper-dialog, ytmusic-menu-popup-renderer, tp-yt-paper-listbox {
  background-color: ${bg} !important;
}
#player-bar-background, ytmusic-miniplayer, ytmusic-search-box #input-box,
ytmusic-search-box .search-box { background-color: ${surface} !important; }
ytmusic-menu-popup-renderer, tp-yt-paper-listbox { background-color: ${surface} !important; }
::selection { background: ${accent}; color: #000; }
${font ? `ytmusic-app, ytmusic-app * { font-family: "${font}", "YouTube Sans", Roboto, sans-serif !important; }` : ''}
${radius !== undefined ? `
ytmusic-two-row-item-renderer #thumbnail, ytmusic-two-row-item-renderer img,
ytmusic-player #song-image, ytmusic-player #song-image img, ytmusic-thumbnail-renderer img,
ytmusic-responsive-list-item-renderer .left-items img { border-radius: ${radius}px !important; }
ytmusic-player #song-image, ytmusic-player #song-image img { border-radius: ${Math.round(radius * 1.5)}px !important; }` : ''}
`
}

/** Blurred album art behind the whole app. Static once painted, so it costs one composite layer. */
export function artBackgroundCss(artUrl: string): string {
  const url = artUrl.replace(/["\\\n]/g, '')
  return `
body::before {
  content: ""; position: fixed; inset: -80px; z-index: -1; pointer-events: none;
  background: url("${url}") center / cover no-repeat;
  filter: blur(70px) saturate(1.4) brightness(0.32);
  transform: translateZ(0);
}
body, #guide-wrapper, ytmusic-player-page, #nav-bar-background, #mini-guide-background, ytmusic-app-layout {
  background-color: transparent !important;
}
#player-bar-background, ytmusic-miniplayer { background-color: rgba(0, 0, 0, 0.45) !important; backdrop-filter: none; }
`
}
