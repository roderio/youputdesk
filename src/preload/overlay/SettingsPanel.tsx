import { ipcRenderer } from 'electron'
import { useState } from 'preact/hooks'
import { IPC } from '../../shared/ipc'
import { UI_SCALES } from '../../shared/settings'
import { playChime } from '../chime'
import { setState, updateSettings, useUi } from '../store'
import { PRIVACY_TEXT } from './Modals'
import { Button, Keys, Row, Section, Switch } from './ui'

export function SettingsPanel() {
  const s = useUi((x) => x.settings)
  const a11y = s.accessibility
  const discord = useUi((x) => x.discord)
  const version = useUi((x) => x.version)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div class="panel-body settings">
      <Section title="Notifications">
        <Row icon="bell" title="Ad alerts" hint={<>Banner and Windows notification when an ad plays, with a skip shortcut (<Keys accelerator={s.shortcuts.skipAd.accelerator} muted />)</>}>
          <Switch checked={s.notifications.ads} label="Ad alerts" onChange={(ads) => updateSettings('notifications', { ads })} />
        </Row>
        <Row icon="note" title="Now playing pop-ups" hint="Windows notification on song change. Shown only while YouputDesk is minimised, in the tray, or behind other windows">
          <Switch checked={s.notifications.trackChange} label="Now playing pop-ups" onChange={(trackChange) => updateSettings('notifications', { trackChange })} />
        </Row>
        <Row title="Test notifications" hint="Nothing appears? Check Windows Settings → System → Notifications, and Do not disturb">
          <Button onClick={() => ipcRenderer.send(IPC.appAction, 'testNotification')}>Send test</Button>
        </Row>
      </Section>

      <Section title="Accessibility">
        <Row icon="bell" title="Skip-ad chime" hint="Plays a chime when an ad can be skipped, then every 5 seconds (up to 6 times) until it's skipped">
          <Switch checked={a11y.adChime} label="Skip-ad chime" onChange={(adChime) => updateSettings('accessibility', { adChime })} />
        </Row>
        <Row icon="volume" title="Chime volume">
          <span class="value">{Math.round(a11y.chimeVolume * 100)}%</span>
          <input type="range" class="hslider" min={0} max={1} step={0.05} value={a11y.chimeVolume} aria-label="Chime volume"
            aria-valuetext={`${Math.round(a11y.chimeVolume * 100)} percent`}
            onInput={(e) => updateSettings('accessibility', { chimeVolume: Number((e.target as HTMLInputElement).value) })} />
          <Button onClick={() => playChime(a11y.chimeVolume)}>Play</Button>
        </Row>
        <Row icon="textSize" title="Text and UI size" hint="Zooms YouTube Music and YouputDesk's panels">
          <select class="select" aria-label="Text and UI size" value={String(a11y.uiScale)}
            onChange={(e) => updateSettings('accessibility', { uiScale: Number((e.target as HTMLSelectElement).value) })}>
            {UI_SCALES.map((v) => (
              <option key={v} value={String(v)}>{Math.round(v * 100)}%{v === 1 ? ' (default)' : ''}</option>
            ))}
          </select>
        </Row>
        <Row icon="palette" title="High contrast" hint="Brighter text, solid panels and a bold yellow keyboard focus ring">
          <Switch checked={a11y.highContrast} label="High contrast" onChange={(highContrast) => updateSettings('accessibility', { highContrast })} />
        </Row>
        <Row icon="sparkle" title="Reduce motion" hint="Turns off animations and transitions everywhere, including the mini player">
          <Switch checked={a11y.reduceMotion} label="Reduce motion" onChange={(reduceMotion) => updateSettings('accessibility', { reduceMotion })} />
        </Row>
        <Row icon="info" title="Screen reader announcements" hint="Announces song changes and when an ad can be skipped (NVDA, Narrator, JAWS)">
          <Switch checked={a11y.announce} label="Screen reader announcements" onChange={(announce) => updateSettings('accessibility', { announce })} />
        </Row>
      </Section>

      <Section
        title="Discord"
        aside={
          discord.enabled && (
            <span class={`status ${discord.connected ? 'ok' : ''}`}>
              <span class="dot" /> {discord.connected ? 'Connected' : 'Waiting for Discord…'}
            </span>
          )
        }
      >
        <Row icon="chat" title={PRIVACY_TEXT.discord.title} hint={`${PRIVACY_TEXT.discord.hint}. Needs Discord's Activity Privacy → “Share your detected activities” turned on`}>
          <Switch checked={s.discord.enabled} label="Discord status" onChange={(enabled) => updateSettings('discord', { enabled })} />
        </Row>
        <Row title="Keep status while paused" hint="Off: the status clears when you pause">
          <Switch checked={s.discord.showWhenPaused} label="Keep status while paused" onChange={(showWhenPaused) => updateSettings('discord', { showWhenPaused })} />
        </Row>
      </Section>

      <Section title="Privacy">
        <Row icon="lyrics" title={PRIVACY_TEXT.lyrics.title} hint={PRIVACY_TEXT.lyrics.hint}>
          <Switch checked={s.privacy.onlineLyrics} label={PRIVACY_TEXT.lyrics.title} onChange={(onlineLyrics) => updateSettings('privacy', { onlineLyrics })} />
        </Row>
        <Row icon="reset" title={PRIVACY_TEXT.updates.title} hint={PRIVACY_TEXT.updates.hint}>
          <Switch checked={s.privacy.updateChecks} label={PRIVACY_TEXT.updates.title} onChange={(updateChecks) => updateSettings('privacy', { updateChecks })} />
        </Row>
        <Row icon="lock" title="No tracking" hint="YouputDesk collects no analytics and has no servers. Your settings, lyrics cache and (encrypted) Google sign-in stay on this PC">
          <Button onClick={() => ipcRenderer.send(IPC.appAction, 'privacyPolicy')}>Privacy policy</Button>
        </Row>
        <Row icon="delete" title="Delete all my data" hint="Signs you out of Google and erases settings, themes, presets and the lyrics cache. YouputDesk then restarts">
          {confirmDelete ? (
            <>
              <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button danger onClick={() => ipcRenderer.send(IPC.appAction, 'deleteAllData')}>Delete everything</Button>
            </>
          ) : (
            <Button danger onClick={() => setConfirmDelete(true)}>Delete…</Button>
          )}
        </Row>
      </Section>

      <Section title="Window">
        <Row icon="window" title="Keep playing in the tray when closed" hint="Right-click the tray icon to quit">
          <Switch checked={s.tray.closeToTray} label="Close to tray" onChange={(closeToTray) => updateSettings('tray', { closeToTray })} />
        </Row>
        <Row icon="mini" title="Mini player" hint={<>Click the tray icon, or press <Keys accelerator={s.shortcuts.miniPlayer.accelerator} muted />. Drag it anywhere to keep it there</>}>
          <Button onClick={() => ipcRenderer.send(IPC.appAction, 'miniPlayer')}>Open</Button>
        </Row>
        <Row title="Mini player position" hint="Put it back above the tray icon">
          <Button onClick={() => ipcRenderer.send(IPC.appAction, 'resetMiniPosition')}>Reset</Button>
        </Row>
        <Row icon="bolt" title="Performance mode" hint="Turns off blur, animations and the visualizer">
          <Switch checked={s.ui.performanceMode} label="Performance mode" onChange={(performanceMode) => updateSettings('ui', { performanceMode })} />
        </Row>
      </Section>

      <Section title="Help">
        <Row icon="sparkle" title="Welcome tour" hint="See what YouputDesk adds to YouTube Music">
          <Button onClick={() => setState({ welcome: true, panel: null })}>Show</Button>
        </Row>
        <Row icon="keyboard" title="All shortcuts" hint={<Keys accelerator={s.shortcuts.cheatSheet.accelerator} muted />}>
          <Button onClick={() => setState({ cheatSheet: true, panel: null })}>Show</Button>
        </Row>
        <Row icon="info" title={`YouputDesk ${version}`} hint="Sign-in options: press Alt, then App → Sign-in identity" />
      </Section>
    </div>
  )
}
