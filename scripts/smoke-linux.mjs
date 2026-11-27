// Starts a built YouputDesk and checks that it really works: the main window loads YouTube Music and our
// overlay (the preload) is injected. Then it quits the app. Used by CI on the Linux packages; it also runs
// against any build on any OS. Needs a display (CI wraps it in xvfb-run).
//
// Run: node scripts/smoke-linux.mjs <executable> [extra args…]
// e.g. node scripts/smoke-linux.mjs dist/YouputDesk-0.3.0-x86_64.AppImage
import { spawn } from 'node:child_process'

const PORT = 9333
const [exe, ...extra] = process.argv.slice(2)
if (!exe) {
  console.error('Usage: node scripts/smoke-linux.mjs <executable> [extra args…]')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const app = spawn(exe, [`--remote-debugging-port=${PORT}`, ...extra], {
  // An isolated profile, so the test never touches a real sign-in.
  env: { ...process.env, YOUPUTDESK_PROFILE: 'smoke-ci' },
  stdio: 'inherit',
})
let exited = null
app.on('exit', (code, signal) => (exited = { code, signal }))
app.on('error', (err) => fail(`couldn't start ${exe}: ${err.message}`))

function fail(reason) {
  console.error(`::error::Smoke test failed: ${reason}`)
  if (!exited) app.kill('SIGKILL')
  process.exit(1)
}

/** Polls check() until it returns something truthy, failing after timeoutMs or (unless allowExit) if the app exits. */
async function waitFor(what, timeoutMs, check, { allowExit = false } = {}) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (exited && !allowExit) fail(`the app exited (code ${exited.code}, signal ${exited.signal}) while waiting for ${what}`)
    try {
      const value = await check()
      if (value) return value
    } catch {
      // Not ready yet.
    }
    await sleep(1000)
  }
  fail(`timed out after ${timeoutMs / 1000}s waiting for ${what}`)
}

/** Evaluates an expression in a page over the DevTools protocol. */
function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => (ws.close(), reject(new Error('CDP timeout'))), 10_000)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id !== 1) return
      clearTimeout(timer)
      ws.close()
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result.result.value)
    }
    ws.onerror = () => (clearTimeout(timer), reject(new Error('CDP connection failed')))
  })
}

const page = await waitFor('the YouTube Music window', 90_000, async () => {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  return targets.find((t) => t.type === 'page' && t.url.startsWith('https://music.youtube.com'))
})
console.log(`Loaded ${page.url}`)

await waitFor('the YouputDesk overlay', 30_000, () => evaluate(page.webSocketDebuggerUrl, "!!document.querySelector('youputdesk-overlay')"))
console.log('Overlay injected')

app.kill('SIGTERM')
await waitFor('the app to quit', 15_000, () => exited, { allowExit: true })
console.log('Smoke test passed')
process.exit(0)
