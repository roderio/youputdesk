/** Text for the updater window. Pure, so it's shared with tests. */

/** Rotating lines while an update downloads, to keep the wait light. */
export const QUIPS = [
  'Tuning the bass…',
  'Polishing the treble…',
  'Untangling headphone cables…',
  'Warming up the vinyl…',
  'Dropping the beat…',
  'Dusting off the speakers…',
  'Finding the perfect fade-in…',
] as const

const mb = (bytes: number): string => (bytes / 1_048_576).toFixed(1)

/** "12.4 / 38.0 MB · 4.1 MB/s"; parts are left out when unknown. */
export function formatProgress(transferred: number, total?: number, bytesPerSecond?: number): string {
  const size = total && total > 0 ? `${mb(transferred)} / ${mb(total)} MB` : `${mb(transferred)} MB`
  return bytesPerSecond && bytesPerSecond > 0 ? `${size} · ${mb(bytesPerSecond)} MB/s` : size
}
