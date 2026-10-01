import { ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc'
import { setState, updateSettings, useUi } from '../store'
import { Button, Keys, Row, Section, Switch } from './ui'

export function SettingsPanel() {
  const s = useUi((x) => x.settings)
  const discord = useUi((x) => x.discord)
  const version = useUi((x) => x.version)

  return (
    <div class="panel-body settings">
      <Section title="Notifications">
        <Row icon="bell" title="Ad alerts" hint={<>Banner and Windows notification when an ad plays, with a skip shortcut (<Keys accelerator={s.shortcuts.skipAd.accelerator} muted />)</>}>
          <Switch checked={s.notifications.ads} label="Ad alerts" onChange={(ads) => updateSettings('notifications', { ads })} />
        </Row>
        <Row icon="note" title="Now playing pop-ups" hint="Windows notification on song change while the app is in the background">
          <Switch checked={s.notifications.trackChange} label="Now playing pop-ups" onChange={(trackChange) => updateSettings('notifications', { trackChange })} />
        </Row>
      </Section>

      <Section
        title="Discord"
        aside={
          s.discord.enabled && (
            <span class={`status ${discord.connected ? 'ok' : ''}`}>
              <span class="dot" /> {discord.connected ? 'Connected' : 'Waiting for Discord…'}
            </span>
          )
        }
      >
        <Row icon="chat" title="Show what I'm listening to" hint="Song, artist and cover on your Discord profile">
          <Switch checked={s.discord.enabled} label="Discord status" onChange={(enabled) => updateSettings('discord', { enabled })} />
        </Row>
        <Row title="Keep status while paused">
          <Switch checked={s.discord.showWhenPaused} label="Keep status while paused" onChange={(showWhenPaused) => updateSettings('discord', { showWhenPaused })} />
        </Row>
      </Section>

      <Section title="Window">
        <Row icon="window" title="Keep playing in the tray when closed" hint="Right-click the tray icon to quit">
          <Switch checked={s.tray.closeToTray} label="Close to tray" onChange={(closeToTray) => updateSettings('tray', { closeToTray })} />
        </Row>
        <Row icon="mini" title="Mini player" hint={<>Click the tray icon, or press <Keys accelerator={s.shortcuts.miniPlayer.accelerator} muted /></>}>
          <Button onClick={() => ipcRenderer.send(IPC.appAction, 'miniPlayer')}>Open</Button>
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
