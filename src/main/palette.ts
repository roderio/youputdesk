/**
 * Album-art colours for the "Album Art" theme. Done here rather than in the page because
 * reading image pixels in the page is blocked by CORS; main fetches the image directly.
 */
import { nativeImage, net } from 'electron'
import { IPC } from '../shared/ipc'
import { BUILT_IN_THEMES, type Palette } from '../shared/themes'
import { ctx } from './context'
import { player } from './player'
import { store } from './store'

let palette: Palette | null = null
let paletteFor = ''

export const currentPalette = (): Palette | null => palette

const isDynamic = (): boolean => {
  const id = store.get('theme.id')
  return [...BUILT_IN_THEMES, ...store.get('theme.custom')].some((t) => t.id === id && t.dynamic)
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

const hsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`

/** Most prominent saturated hue in the image, turned into a readable dark palette. */
export function paletteFromBitmap(bgra: Buffer): Palette {
  const bins = new Array<{ weight: number; h: number; s: number }>(12).fill(null as never).map(() => ({ weight: 0, h: 0, s: 0 }))
  let grey = 0
  for (let i = 0; i + 3 < bgra.length; i += 4) {
    const [h, s, l] = rgbToHsl(bgra[i + 2], bgra[i + 1], bgra[i])
    // Weight vivid mid-tones; near-black/white/grey pixels say little about the art's colour.
    const w = s * (1 - Math.abs(2 * l - 1))
    if (w < 0.08) { grey++; continue }
    const bin = bins[Math.floor(h / 30) % 12]
    bin.weight += w
    bin.h += h * w
    bin.s += s * w
  }
  const best = bins.reduce((a, b) => (b.weight > a.weight ? b : a))
  if (best.weight === 0) return { accent: hsl(0, 0, 0.85), background: hsl(0, 0, 0.04), surface: hsl(0, 0, 0.1) }
  const h = best.h / best.weight
  const s = Math.min(0.9, Math.max(0.45, best.s / best.weight))
  return {
    accent: hsl(h, s, 0.66),
    background: hsl(h, Math.min(0.5, s * 0.6), 0.06),
    surface: hsl(h, Math.min(0.4, s * 0.5), 0.12),
  }
}

async function compute(artwork: string, videoId: string): Promise<void> {
  if (!artwork || paletteFor === videoId) return
  paletteFor = videoId
  try {
    const res = await net.fetch(artwork)
    if (!res.ok) return
    const img = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer())).resize({ width: 32, height: 32, quality: 'good' })
    if (paletteFor !== videoId) return
    palette = paletteFromBitmap(img.toBitmap())
    ctx.main?.webContents.send(IPC.palette, palette)
  } catch {
    // Keep the previous palette; the theme falls back to its static colours.
  }
}

export function setupPalette(): void {
  player.on('track', (s) => {
    if (isDynamic()) compute(s.artwork, s.videoId)
  })
  store.onDidChange('theme', () => {
    const s = player.state
    if (s && isDynamic()) compute(s.artwork, s.videoId)
  })
}
