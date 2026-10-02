/**
 * Remembers the volume across launches. YTM starts every session at full volume, so on startup we
 * put YTM's volume slider back where it was, and only then start saving changes (otherwise YTM's
 * default would overwrite the saved position). We save the slider position, not the player volume:
 * the slider is what the user sees, and its scale isn't linear in the player's volume.
 */
import type { PlayerState } from '../shared/ipc'
import { readVolumeSlider, setVolumeSlider } from './page'
import { getState, updateSettings } from './store'

const SAVE_DELAY_MS = 500
/**
 * YTM can redraw the slider at our position yet reset the player's volume when the first song
 * loads, so keep re-applying the position until the player itself agrees. Tries only count once a
 * song is loaded; before that there may be nothing to apply it to.
 */
const RESTORE_TRIES = 10

let restored = false
let tries = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined

const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100

/**
 * Whether the player's volume fits the slider position. The scale is curved, so only the ends map
 * exactly (0 → 0, 100 → 100); anything between must be strictly between.
 */
export function volumeMatches(position: number, playerVolume: number): boolean {
  if (position === 0) return playerVolume === 0
  if (position === 100) return playerVolume === 100
  return playerVolume > 0 && playerVolume < 100
}

/** Call on every player poll. `player` is null until a song is loaded. */
export function syncVolume(player: PlayerState | null): void {
  const saved = getState().settings.playback.volume
  if (!restored) {
    if (!valid(saved)) {
      restored = true
      return
    }
    if (player && tries > 0 && volumeMatches(saved, player.volume)) {
      restored = true
      return
    }
    // Re-applied even when the slider already shows it: that's what makes YTM set the player.
    setVolumeSlider(saved)
    if (player && ++tries >= RESTORE_TRIES) restored = true
    return
  }
  if (!player || player.ad) return
  const position = readVolumeSlider()
  if (!valid(position) || position === saved) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => updateSettings('playback', { volume: position }), SAVE_DELAY_MS)
}
