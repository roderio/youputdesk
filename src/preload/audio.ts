/**
 * Audio engine. YouTube's <video> element is routed through Web Audio:
 *
 *   source → preamp → 10 × EQ band → bass shelf → [loudness compressor → makeup] → limiter → analyser → speakers
 *
 * When the EQ is off the chain is skipped (source → analyser → speakers) so audio is untouched.
 * The limiter only acts near 0 dBFS, so boosting bands can't clip.
 */
import { BANDS } from '../shared/eq'
import type { Settings } from '../shared/settings'

const SMOOTHING = 0.03 // seconds; avoids zipper noise/clicks when sliders move
const dbToGain = (db: number): number => 10 ** (db / 20)

export class AudioEngine {
  readonly ctx = new AudioContext({ latencyHint: 'playback' })
  private element: HTMLMediaElement | null = null
  private source: MediaElementAudioSourceNode | null = null
  private readonly preamp = this.ctx.createGain()
  private readonly bands = BANDS.map((freq, i) => {
    const f = this.ctx.createBiquadFilter()
    f.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking'
    f.frequency.value = freq
    f.Q.value = 1.1
    return f
  })
  private readonly bass = Object.assign(this.ctx.createBiquadFilter(), { type: 'lowshelf' as BiquadFilterType })
  private readonly leveller = this.ctx.createDynamicsCompressor()
  private readonly makeup = this.ctx.createGain()
  private readonly limiter = this.ctx.createDynamicsCompressor()
  readonly analyser = this.ctx.createAnalyser()
  private routed: { enabled: boolean; normalize: boolean } | null = null

  constructor() {
    this.bass.frequency.value = 90
    // Slow, gentle compression evens out loud and quiet tracks.
    this.leveller.threshold.value = -24
    this.leveller.knee.value = 12
    this.leveller.ratio.value = 3
    this.leveller.attack.value = 0.05
    this.leveller.release.value = 0.4
    this.makeup.gain.value = dbToGain(6)
    // Brick-wall-ish limiter just under full scale.
    this.limiter.threshold.value = -1
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.002
    this.limiter.release.value = 0.1
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.75
  }

  /** Hook a media element. Safe to call repeatedly; YTM sometimes swaps its <video>. */
  attach(element: HTMLMediaElement): void {
    if (element === this.element) return
    this.source?.disconnect()
    this.element = element
    this.source = this.ctx.createMediaElementSource(element)
    this.routed = null
    element.addEventListener('play', () => this.resume())
    this.resume()
  }

  get attached(): HTMLMediaElement | null {
    return this.element
  }

  resume(): void {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  apply(eq: Settings['eq']): void {
    const t = this.ctx.currentTime
    this.preamp.gain.setTargetAtTime(dbToGain(eq.preamp), t, SMOOTHING)
    this.bands.forEach((f, i) => f.gain.setTargetAtTime(eq.bands[i] ?? 0, t, SMOOTHING))
    this.bass.gain.setTargetAtTime(eq.bass, t, SMOOTHING)
    this.route(eq.enabled, eq.normalize)
  }

  private route(enabled: boolean, normalize: boolean): void {
    if (!this.source) return
    if (this.routed?.enabled === enabled && this.routed.normalize === normalize) return
    this.routed = { enabled, normalize }

    const nodes: AudioNode[] = [this.source, this.preamp, ...this.bands, this.bass, this.leveller, this.makeup, this.limiter, this.analyser]
    for (const n of nodes) n.disconnect()

    const chain: AudioNode[] = enabled
      ? [this.source, this.preamp, ...this.bands, this.bass, ...(normalize ? [this.leveller, this.makeup] : []), this.limiter, this.analyser]
      : [this.source, this.analyser]
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
    this.analyser.connect(this.ctx.destination)
  }
}

/** The running engine (created once the page has a <video>), for the visualizer. */
export const audio: { engine: AudioEngine | null } = { engine: null }
