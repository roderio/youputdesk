// Renders scripts/social-preview.html to docs/social-preview.png with headless Edge (or Chrome).
// Upload the result in GitHub → Settings → Social preview; the website uses it too.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
const browser = browsers.find(existsSync)
if (!browser) throw new Error('Needs Microsoft Edge or Google Chrome installed.')

const out = resolve('docs/social-preview.png')
execFileSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1280,640',
  '--virtual-time-budget=2000',
  `--screenshot=${out}`,
  pathToFileURL(resolve('scripts/social-preview.html')).href,
])
console.log(`Wrote ${out}`)
