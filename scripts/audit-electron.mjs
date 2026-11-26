// Fails on a high or critical advisory for Electron.
//
// Electron is a devDependency (electron-builder packages it into the app), so
// `npm audit --omit=dev` never looks at it, even though it is the runtime every user runs.
// Reads the lockfile only, so it works without `npm ci`. Run from the project root.
import { spawnSync } from 'node:child_process'

const FAIL_ON = new Set(['high', 'critical'])

// npm audit exits non-zero whenever it finds anything, so read its JSON rather than its exit code.
const { stdout, error } = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
})
if (error) throw error

let report
try {
  report = JSON.parse(stdout)
} catch {
  console.error('::error::npm audit did not return JSON:\n' + stdout.slice(0, 2000))
  process.exit(1)
}
if (report.error) {
  console.error(`::error::npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`)
  process.exit(1)
}

const entry = report.vulnerabilities?.electron
if (!entry) {
  console.log('electron: no known advisories')
  process.exit(0)
}

console.log(`electron: ${entry.severity} (affected range ${entry.range})`)
for (const via of entry.via) {
  if (typeof via === 'object') console.log(`  - [${via.severity}] ${via.title} ${via.url}`)
}
if (entry.fixAvailable) console.log('  Fix: update electron to a patched version (see the advisories above).')

if (FAIL_ON.has(entry.severity)) {
  console.error(`::error::electron has a ${entry.severity} severity advisory. It ships inside the app, so update it.`)
  process.exit(1)
}
