import { useEffect, useRef, useState } from 'preact/hooks'
import { BANDS, bandLabel, clampGain, GAIN_MAX, GAIN_MIN, matchPreset, PRESETS } from '../../shared/eq'
import { audio } from '../audio'
import { accentOf } from '../theme'
import { getState, toast, updateSettings, useUi } from '../store'
import { Icon } from './icons'
import { Button, Row, Section, Switch } from './ui'

/** Live spectrum. Only animates while visible, and never in performance mode. */
function Visualizer({ enabled }: { enabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const accent = useUi(accentOf)

  useEffect(() => {
    const el = canvas.current
    const engine = audio.engine
    if (!el || !engine || !enabled) return
    const g = el.getContext('2d')!
    const data = new Uint8Array(engine.analyser.frequencyBinCount)
    const bars = 48
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (document.hidden) return
      const { width, height } = el
      engine.analyser.getByteFrequencyData(data)
      g.clearRect(0, 0, width, height)
      g.fillStyle = accent
      const w = width / bars
      for (let i = 0; i < bars; i++) {
        // Log-spaced bins so bass doesn't take up half the display.
        const bin = Math.min(data.length - 1, Math.floor((Math.pow(data.length, i / bars) - 1)))
        const v = data[bin] / 255
        const h = Math.max(2, v * v * height)
        g.globalAlpha = 0.35 + v * 0.65
        g.beginPath()
        g.roundRect(i * w + 1.5, height - h, w - 3, h, 2)
        g.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [enabled, accent])

  return <canvas ref={canvas} class="visualizer" width={344} height={56} />
}

function BandSlider({ index, value, onInput }: { index: number; value: number; onInput: (i: number, v: number) => void }) {
  return (
    <div class="band" title="Double-click to reset">
      <span class={`band-value ${value > 0 ? 'pos' : value < 0 ? 'neg' : ''}`}>{value > 0 ? `+${value}` : value}</span>
      <input
        type="range"
        class="vslider"
        min={GAIN_MIN}
        max={GAIN_MAX}
        step={0.5}
        value={value}
        aria-label={`${bandLabel(BANDS[index])} Hz`}
        onInput={(e) => onInput(index, Number((e.target as HTMLInputElement).value))}
        onDblClick={() => onInput(index, 0)}
      />
      <span class="band-label">{bandLabel(BANDS[index])}</span>
    </div>
  )
}

export function EqPanel() {
  const eq = useUi((s) => s.settings.eq)
  const perf = useUi((s) => s.settings.ui.performanceMode)
  const hasAudio = useUi(() => !!audio.engine?.attached)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const current = matchPreset(eq.bands, eq.custom)

  // Touching any control turns the EQ on: you obviously want to hear it.
  const setBand = (i: number, v: number) => {
    const bands = [...eq.bands]
    bands[i] = clampGain(v)
    updateSettings('eq', { bands, enabled: true })
  }
  const applyPreset = (preset: string) => {
    updateSettings('eq', { bands: [...(PRESETS[preset] ?? eq.custom[preset])], enabled: true })
  }
  const savePreset = () => {
    const n = name.trim().slice(0, 24)
    if (!n) return
    if (PRESETS[n]) {
      toast('That name is taken by a built-in preset', 'warning')
      return
    }
    updateSettings('eq', { custom: { ...eq.custom, [n]: [...eq.bands] } })
    setNaming(false)
    setName('')
    toast(`Saved preset “${n}”`, 'check')
  }
  const deletePreset = (n: string) => {
    const custom = { ...getState().settings.eq.custom }
    delete custom[n]
    updateSettings('eq', { custom })
  }
  const peak = Math.max(...eq.bands, 0) + eq.bass

  return (
    <div class={`panel-body eq ${eq.enabled ? '' : 'off'}`}>
      <div class="hero">
        <div>
          <div class="hero-title">Equalizer</div>
          <div class="hero-sub">{eq.enabled ? (current ? `Preset: ${current}` : 'Custom sound') : 'Off: you hear the original audio'}</div>
        </div>
        <Switch checked={eq.enabled} label="Equalizer on/off" onChange={(enabled) => updateSettings('eq', { enabled })} />
      </div>

      {!perf && <Visualizer enabled={hasAudio} />}

      <div class="chips" role="listbox" aria-label="Presets">
        {Object.keys(PRESETS).map((p) => (
          <button type="button" key={p} class={`chip ${current === p && eq.enabled ? 'selected' : ''}`} onClick={() => applyPreset(p)}>
            {p}
          </button>
        ))}
        {Object.keys(eq.custom).map((p) => (
          <span key={p} class={`chip custom ${current === p && eq.enabled ? 'selected' : ''}`}>
            <button type="button" onClick={() => applyPreset(p)}>{p}</button>
            <button type="button" class="chip-x" aria-label={`Delete ${p}`} onClick={() => deletePreset(p)}>
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
      </div>

      <div class="bands">
        <div class="db-scale"><span>+12</span><span>0</span><span>−12</span></div>
        {eq.bands.map((v, i) => (
          <BandSlider key={i} index={i} value={v} onInput={setBand} />
        ))}
      </div>

      <Section title="Tone">
        <Row icon="volume" title="Preamp" hint="Lower this if boosted bands sound harsh">
          <span class="value">{eq.preamp > 0 ? '+' : ''}{eq.preamp} dB</span>
          <input type="range" class="hslider" min={-12} max={6} step={0.5} value={eq.preamp}
            onInput={(e) => updateSettings('eq', { preamp: Number((e.target as HTMLInputElement).value), enabled: true })} />
        </Row>
        <Row icon="eq" title="Bass boost" hint="Extra deep low end">
          <span class="value">+{eq.bass} dB</span>
          <input type="range" class="hslider" min={0} max={12} step={0.5} value={eq.bass}
            onInput={(e) => updateSettings('eq', { bass: Number((e.target as HTMLInputElement).value), enabled: true })} />
        </Row>
        <Row icon="tune" title="Loudness normalization" hint="Keeps quiet and loud songs at a similar volume">
          <Switch checked={eq.normalize} label="Loudness normalization" onChange={(normalize) => updateSettings('eq', { normalize, enabled: true })} />
        </Row>
      </Section>

      {eq.enabled && peak > 6 && eq.preamp > -peak / 2 && (
        <p class="note"><Icon name="info" size={16} /> Big boosts are kept from distorting by a built-in limiter. For the cleanest sound, lower the preamp a little.</p>
      )}
      {!hasAudio && <p class="note"><Icon name="info" size={16} /> Start playing a song and the equalizer will hook in automatically.</p>}

      <div class="actions">
        {naming ? (
          <form class="inline-form" onSubmit={(e) => { e.preventDefault(); savePreset() }}>
            <input class="text" autoFocus placeholder="Preset name" value={name} maxLength={24}
              onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            <Button primary icon="check" onClick={savePreset}>Save</Button>
            <Button onClick={() => setNaming(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <Button icon="add" onClick={() => setNaming(true)}>Save as preset</Button>
            <Button icon="reset" onClick={() => updateSettings('eq', { bands: BANDS.map(() => 0), preamp: 0, bass: 0, normalize: false })}>Reset</Button>
          </>
        )}
      </div>
    </div>
  )
}
