/** Discord Rich Presence: "Listening to <song>" on the user's Discord profile. */
import { Client } from '@xhayper/discord-rpc'
import { DISCORD_CLIENT_ID } from '../shared/config'
import { IPC, type DiscordStatus, type PlayerState } from '../shared/ipc'
import { broadcast } from './context'
import { player } from './player'
import { store } from './store'

const RETRY_MS = 20_000
/** Discord rate-limits presence updates; coalesce bursts (seeks, track skips). */
const UPDATE_DEBOUNCE_MS = 1_500
const LISTENING = 2

let client: Client | null = null
let connected = false
let retryTimer: NodeJS.Timeout | undefined
let updateTimer: NodeJS.Timeout | undefined
let lastKey = ''

export const discordStatus = (): DiscordStatus => ({ enabled: store.get('discord.enabled'), connected })

function setConnected(value: boolean): void {
  connected = value
  broadcast(IPC.discordStatus, discordStatus())
}

async function connect(): Promise<void> {
  clearTimeout(retryTimer)
  if (!store.get('discord.enabled') || client) return
  const c = new Client({ clientId: DISCORD_CLIENT_ID, transport: { type: 'ipc' } })
  client = c
  c.on('ready', () => {
    setConnected(true)
    lastKey = ''
    scheduleUpdate()
  })
  c.on('disconnected', () => {
    if (client !== c) return
    client = null
    setConnected(false)
    retryTimer = setTimeout(connect, RETRY_MS)
  })
  try {
    await c.login()
  } catch {
    // Discord isn't running (or the user isn't logged in). Try again later.
    if (client === c) client = null
    setConnected(false)
    retryTimer = setTimeout(connect, RETRY_MS)
  }
}

async function disconnect(): Promise<void> {
  clearTimeout(retryTimer)
  const c = client
  client = null
  lastKey = ''
  if (c) await c.destroy().catch(() => {})
  setConnected(false)
}

const trim = (s: string, fallback: string): string => {
  // Discord requires 2–128 characters.
  const t = s.trim().slice(0, 128)
  return t.length >= 2 ? t : fallback
}

async function update(): Promise<void> {
  const s: PlayerState | null = player.state
  const user = client?.user
  if (!connected || !user) return
  const show = s && s.videoId && !s.ad && (s.playing || store.get('discord.showWhenPaused'))
  const key = show ? `${s.videoId}|${s.playing}|${Math.round(s.position / 5)}` : 'clear'
  if (key === lastKey) return
  lastKey = key
  try {
    if (!show) {
      await user.clearActivity()
      return
    }
    const now = Date.now()
    await user.setActivity({
      type: LISTENING,
      details: trim(s.title, 'Unknown song'),
      state: trim(s.artist, 'Unknown artist'),
      largeImageKey: s.artwork || undefined,
      largeImageText: trim(s.playing ? s.album || s.title : `Paused · ${s.title}`, 'YouTube Music'),
      ...(s.playing && s.duration
        ? { startTimestamp: now - s.position * 1000, endTimestamp: now + (s.duration - s.position) * 1000 }
        : {}),
      buttons: [{ label: 'Listen on YouTube Music', url: `https://music.youtube.com/watch?v=${s.videoId}` }],
    })
  } catch {
    lastKey = ''
  }
}

function scheduleUpdate(): void {
  clearTimeout(updateTimer)
  updateTimer = setTimeout(update, UPDATE_DEBOUNCE_MS)
}

export function setupDiscord(): void {
  player.on('track', scheduleUpdate)
  player.on('playback', scheduleUpdate)
  player.on('ad', scheduleUpdate)
  // Catch seeks: the timestamp key above changes when position jumps.
  let lastPos = 0
  player.on('state', (s) => {
    if (Math.abs(s.position - lastPos) > 3) scheduleUpdate()
    lastPos = s.position + 1
  })
  store.onDidChange('discord', (next, prev) => {
    if (next?.enabled && !prev?.enabled) connect()
    else if (!next?.enabled && prev?.enabled) disconnect()
    else scheduleUpdate()
  })
  connect()
}
