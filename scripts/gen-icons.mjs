// Renders the app, tray and taskbar icons with no dependencies: shapes are sampled 4×4 per
// pixel for anti-aliasing, then written as PNG (and ICO for the installer).
// Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SS = 4

// --- PNG / ICO encoding -----------------------------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

// --- Shapes (all in unit coordinates, 0..1) ----------------------------------------------
const roundRect = (x0, y0, x1, y1, r) => (u, v) => {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false
  const cx = Math.min(Math.max(u, x0 + r), x1 - r)
  const cy = Math.min(Math.max(v, y0 + r), y1 - r)
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}
const polygon = (pts) => (u, v) => {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const ring = (cx, cy, r, w) => (u, v) => Math.abs(Math.hypot(u - cx, v - cy) - r) <= w / 2
const union = (...shapes) => (u, v) => shapes.some((s) => s(u, v))

/** Render: `layers` are [shape, colourFn(u,v) → [r,g,b]] painted in order. */
function render(size, layers) {
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size
          const v = (y + (sy + 0.5) / SS) / size
          // Composite this sample front-to-back over transparent.
          let cr = 0, cg = 0, cb = 0, ca = 0
          for (const [shape, colour] of layers) {
            if (!shape(u, v)) continue
            ;[cr, cg, cb] = colour(u, v)
            ca = 1
          }
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca
        }
      }
      const i = (y * size + x) * 4
      const n = SS * SS
      out[i] = a ? Math.round(r / a) : 0
      out[i + 1] = a ? Math.round(g / a) : 0
      out[i + 2] = a ? Math.round(b / a) : 0
      out[i + 3] = Math.round((a / n) * 255)
    }
  }
  return out
}

// --- Artwork ------------------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t
const FROM = [255, 78, 69] // coral red
const TO = [124, 77, 255] // violet
const gradient = (u, v) => {
  const t = Math.min(1, Math.max(0, (u + v) / 2))
  return FROM.map((c, i) => Math.round(lerp(c, TO[i], t)))
}
const white = () => [255, 255, 255]

// App icon: gradient squircle, white ring with a play triangle, and three EQ bars hinting at the audio engine.
const appIcon = (size, { ringOn = true } = {}) =>
  render(size, [
    [roundRect(0.04, 0.04, 0.96, 0.96, 0.23), gradient],
    [
      union(
        ...(ringOn ? [ring(0.5, 0.5, 0.29, 0.055)] : []),
        polygon([[0.43, 0.36], [0.43, 0.64], [0.66, 0.5]]),
      ),
      white,
    ],
  ])

// Taskbar thumbnail glyphs.
const glyphs = {
  play: polygon([[0.3, 0.2], [0.3, 0.8], [0.8, 0.5]]),
  pause: union(roundRect(0.25, 0.2, 0.42, 0.8, 0.03), roundRect(0.58, 0.2, 0.75, 0.8, 0.03)),
  next: union(polygon([[0.22, 0.22], [0.22, 0.78], [0.62, 0.5]]), roundRect(0.64, 0.22, 0.78, 0.78, 0.02)),
  prev: union(polygon([[0.78, 0.22], [0.78, 0.78], [0.38, 0.5]]), roundRect(0.22, 0.22, 0.36, 0.78, 0.02)),
}

mkdirSync('resources', { recursive: true })
mkdirSync('build', { recursive: true })

writeFileSync('resources/icon.png', png(256, appIcon(256)))
// Tray icons are tiny; the ring turns to mush at 16–32px, so drop it.
writeFileSync('resources/tray.png', png(32, appIcon(32, { ringOn: false })))
for (const [name, shape] of Object.entries(glyphs)) {
  writeFileSync(`resources/thumb-${name}.png`, png(16, render(16, [[shape, white]])))
  writeFileSync(`resources/thumb-${name}@2x.png`, png(32, render(32, [[shape, white]])))
}
writeFileSync(
  'build/icon.ico',
  ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: png(size, appIcon(size, { ringOn: size >= 48 })) }))),
)
console.log('Icons written to resources/ and build/icon.ico')
