import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcRenderer: { invoke: vi.fn(() => Promise.resolve()), on: vi.fn(), send: vi.fn() } }))

/** Counts chimes: each chime starts two oscillators. */
let oscillators = 0
class FakeParam {
  value = 0
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  type = ''
  connect(n: FakeNode) { return n }
  start() {}
  stop() {}
}
class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = new FakeNode()
  resume() { return Promise.resolve() }
  createGain() { return new FakeNode() }
  createOscillator() { oscillators++; return new FakeNode() }
}
const chimes = () => oscillators / 2

const { DEFAULT_SETTINGS } = await import('../src/shared/settings')
const store = await import('../src/preload/store')
const { setupChime, CHIME_INTERVAL_MS, MAX_CHIMES } = await import('../src/preload/chime')

function init(adChime: boolean) {
  store.initState({
    settings: { ...DEFAULT_SETTINGS, accessibility: { ...DEFAULT_SETTINGS.accessibility, adChime } },
  } as never)
}

describe('skip-ad chime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    oscillators = 0
  })
  afterEach(() => vi.useRealTimers())

  it('chimes when Skip appears, every 5 s, and stops at the cap even as the page keeps updating', () => {
    init(true)
    const onAd = setupChime()
    onAd({ active: true, skippable: false })
    expect(chimes()).toBe(0)
    onAd({ active: true, skippable: true })
    expect(chimes()).toBe(1)
    vi.advanceTimersByTime(CHIME_INTERVAL_MS)
    expect(chimes()).toBe(2)
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(CHIME_INTERVAL_MS)
      store.setState({}) // player updates keep arriving
    }
    expect(chimes()).toBe(MAX_CHIMES)
  })

  it('stops as soon as the ad is skipped and starts fresh for the next ad', () => {
    init(true)
    const onAd = setupChime()
    onAd({ active: true, skippable: true })
    onAd({ active: false, skippable: false })
    vi.advanceTimersByTime(CHIME_INTERVAL_MS * 3)
    expect(chimes()).toBe(1)
    onAd({ active: true, skippable: true })
    expect(chimes()).toBe(2)
  })

  it('stays silent when turned off', () => {
    init(false)
    const onAd = setupChime()
    onAd({ active: true, skippable: true })
    vi.advanceTimersByTime(CHIME_INTERVAL_MS * 3)
    expect(chimes()).toBe(0)
  })
})
