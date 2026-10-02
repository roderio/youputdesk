// The hero equalizer, the download button that points at the newest release, install tabs and copy buttons.
// Bands and presets mirror src/shared/eq.ts.

const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const MIN = -12
const MAX = 12
const PRESETS = {
  'Bass boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Bass & treble': [5, 4, 2, 0, -1, -1, 0, 2, 4, 5],
  Vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  Rock: [4, 3, 1, -1, -2, -1, 1, 3, 4, 4],
  Electronic: [5, 4, 1, 0, -2, 1, 0, 1, 4, 5],
  'Late night': [2, 2, 1, 0, 0, 0, -1, -2, -3, -4],
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}
const label = (hz) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)

function setupEq() {
  const root = document.getElementById('eq')
  const presetName = document.getElementById('eq-preset')
  if (!root) return
  const gains = BANDS.map(() => 0)
  const bands = BANDS.map((hz, i) => {
    const band = document.createElement('div')
    band.className = 'band'
    band.tabIndex = 0
    band.setAttribute('role', 'slider')
    band.setAttribute('aria-label', `${label(hz)} hertz`)
    band.setAttribute('aria-valuemin', MIN)
    band.setAttribute('aria-valuemax', MAX)
    band.innerHTML = `<div class="fill"></div><span class="hz">${label(hz)}</span>`
    root.append(band)
    band.addEventListener('keydown', (e) => {
      const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 3, PageDown: -3 }[e.key]
      if (step === undefined) return
      e.preventDefault()
      set(i, gains[i] + step)
      showName()
    })
    return band
  })

  const set = (i, g) => {
    gains[i] = Math.min(MAX, Math.max(MIN, Math.round(g)))
    // Never fully empty, so a -12 dB band is still visible.
    bands[i].style.setProperty('--h', `${6 + ((gains[i] - MIN) / (MAX - MIN)) * 94}%`)
    bands[i].setAttribute('aria-valuenow', gains[i])
    bands[i].setAttribute('aria-valuetext', `${gains[i] > 0 ? '+' : ''}${gains[i]} dB`)
  }
  const apply = (values) => values.forEach((g, i) => set(i, g))
  const showName = () => {
    const match = Object.entries(PRESETS).find(([, v]) => v.every((g, i) => g === gains[i]))
    presetName.textContent = match ? match[0] : 'Custom'
  }

  // One gradient across all bars, so a tall bar reaches violet and a short one stays coral.
  const sizeGradient = () => root.style.setProperty('--full', `${root.clientHeight}px`)
  sizeGradient()
  new ResizeObserver(sizeGradient).observe(root)

  // Drag: the band under the pointer follows it, and sweeping sideways paints across bands.
  let dragging = false
  const paint = (e) => {
    const col = bands.findIndex((b) => {
      const r = b.getBoundingClientRect()
      return e.clientX >= r.left - 6 && e.clientX <= r.right + 6
    })
    if (col < 0) return
    const r = bands[col].getBoundingClientRect()
    const t = 1 - (e.clientY - r.top) / r.height
    set(col, MIN + t * (MAX - MIN))
    bands.forEach((b, i) => b.classList.toggle('dragging', i === col))
    showName()
  }
  root.addEventListener('pointerdown', (e) => {
    dragging = true
    root.setPointerCapture(e.pointerId)
    paint(e)
  })
  root.addEventListener('pointermove', (e) => dragging && paint(e))
  const stop = () => {
    dragging = false
    bands.forEach((b) => b.classList.remove('dragging'))
  }
  root.addEventListener('pointerup', stop)
  root.addEventListener('pointercancel', stop)

  // Click the preset name to cycle through presets.
  presetName.setAttribute('role', 'button')
  presetName.tabIndex = 0
  presetName.title = 'Next preset'
  const names = Object.keys(PRESETS)
  const next = () => {
    const at = names.indexOf(presetName.textContent)
    const name = names[(at + 1) % names.length]
    apply(PRESETS[name])
    presetName.textContent = name
  }
  presetName.addEventListener('click', next)
  presetName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      next()
    }
  })

  // Start flat, then settle into Bass boost: the one moment of motion on the page.
  apply(PRESETS.Flat)
  requestAnimationFrame(() => requestAnimationFrame(() => apply(PRESETS['Bass boost'])))
}

async function setupDownload() {
  const button = document.getElementById('download')
  const meta = document.getElementById('download-meta')
  const setupLink = document.getElementById('setup-link')
  const portableLink = document.getElementById('portable-link')

  let arm = false
  try {
    const ua = await navigator.userAgentData?.getHighEntropyValues(['architecture'])
    arm = ua?.architecture === 'arm'
  } catch {}

  try {
    const res = await fetch('https://api.github.com/repos/roderio/youputdesk/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return
    const release = await res.json()
    const find = (re) => release.assets.find((a) => re.test(a.name))
    const setup = find(/^YouputDesk-Setup-.*\.exe$/)
    const portable = find(arm ? /-portable-arm64\.exe$/ : /-portable-x64\.exe$/) ?? find(/-portable\.exe$/)
    const version = release.tag_name.replace(/^v/, '')
    if (setup) {
      button.href = setupLink.href = setup.browser_download_url
      const mb = Math.round(setup.size / 1024 / 1024)
      meta.textContent = `Version ${version}, ${mb} MB. For Windows 10 and 11${arm ? ', including your ARM PC' : ''}. Free and open source.`
    }
    if (portable) portableLink.href = portable.browser_download_url
  } catch {
    // Offline or rate-limited: the links already point at the latest release page.
  }
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('[role=tab]')]
  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab
      t.setAttribute('aria-selected', on)
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on
    }
    tab.focus()
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
      if (d) select(tabs[(i + d + tabs.length) % tabs.length])
    })
  })
}

function setupCopy() {
  for (const button of document.querySelectorAll('.copy')) {
    button.addEventListener('click', async () => {
      const text = button.parentElement.querySelector('code').textContent
      try {
        await navigator.clipboard.writeText(text)
        button.textContent = 'Copied'
      } catch {
        button.textContent = 'Select and copy'
      }
      setTimeout(() => (button.textContent = 'Copy'), 1600)
    })
  }
}

setupEq()
setupDownload()
setupTabs()
setupCopy()
