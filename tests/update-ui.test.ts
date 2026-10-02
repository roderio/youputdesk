import { describe, expect, it } from 'vitest'
import { formatProgress, QUIPS } from '../src/shared/update-ui'

describe('formatProgress', () => {
  it('shows size and speed in MB', () => {
    expect(formatProgress(13_002_342, 39_845_888, 4_299_161)).toBe('12.4 / 38.0 MB · 4.1 MB/s')
  })

  it('leaves out an unknown total', () => {
    expect(formatProgress(1_048_576, undefined, 1_048_576)).toBe('1.0 MB · 1.0 MB/s')
    expect(formatProgress(1_048_576, 0)).toBe('1.0 MB')
  })

  it('leaves out a zero speed', () => {
    expect(formatProgress(0, 1_048_576, 0)).toBe('0.0 / 1.0 MB')
  })
})

describe('QUIPS', () => {
  it('are non-empty and unique', () => {
    expect(QUIPS.length).toBeGreaterThan(1)
    expect(QUIPS.every((q) => q.trim().length > 0)).toBe(true)
    expect(new Set(QUIPS).size).toBe(QUIPS.length)
  })
})
