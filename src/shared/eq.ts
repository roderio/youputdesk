/** 10-band graphic EQ: centre frequencies, gain range and presets. */

export const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const GAIN_MIN = -12
export const GAIN_MAX = 12

export const bandLabel = (hz: number): string => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)

const flat = BANDS.map(() => 0)

export const PRESETS: Record<string, number[]> = {
  Flat: flat,
  'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Bass & Treble': [5, 4, 2, 0, -1, -1, 0, 2, 4, 5],
  Vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  Rock: [4, 3, 1, -1, -2, -1, 1, 3, 4, 4],
  Pop: [-1, 0, 2, 3, 4, 3, 1, 0, -1, -1],
  Electronic: [5, 4, 1, 0, -2, 1, 0, 1, 4, 5],
  'Hip-Hop': [5, 4, 2, 3, -1, -1, 1, -1, 2, 3],
  Acoustic: [3, 3, 2, 1, 1, 1, 2, 3, 2, 1],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Podcast: [-3, -2, 0, 2, 4, 4, 3, 1, -1, -3],
  'Late Night': [2, 2, 1, 0, 0, 0, -1, -2, -3, -4],
}

export const clampGain = (g: number): number => Math.min(GAIN_MAX, Math.max(GAIN_MIN, Math.round(g * 2) / 2))

/** Name of the preset matching these gains, if any. */
export function matchPreset(gains: number[], custom: Record<string, number[]>): string | null {
  const all = { ...PRESETS, ...custom }
  for (const [name, preset] of Object.entries(all)) {
    if (preset.length === gains.length && preset.every((g, i) => g === gains[i])) return name
  }
  return null
}
