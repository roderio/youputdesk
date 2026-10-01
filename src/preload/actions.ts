/** Every action, whatever triggered it: in-app key, global shortcut, tray, thumbar, toast or a button. */
import { ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { ActionId } from '../shared/shortcuts'
import { skipAd } from './ads'
import { changeVolume, clickRating, clickToggle, playerCommand, readPlayer, readToggles } from './page'
import { getState, openPanel, setState, toast, updateSettings } from './store'

export type Command = ActionId | 'seekTo'

const VOLUME_STEP = 5
const SEEK_STEP = 10

export function runAction(id: Command, arg?: number): void {
  const s = getState()
  switch (id) {
    case 'playPause':
      playerCommand('playPause')
      break
    case 'next':
      playerCommand('next')
      break
    case 'previous':
      playerCommand('previous')
      break
    case 'seekForward':
      playerCommand('seekBy', SEEK_STEP)
      break
    case 'seekBack':
      playerCommand('seekBy', -SEEK_STEP)
      break
    case 'seekTo':
      if (typeof arg === 'number') playerCommand('seekTo', arg)
      break
    case 'volumeUp':
    case 'volumeDown': {
      const v = changeVolume(id === 'volumeUp' ? VOLUME_STEP : -VOLUME_STEP)
      if (v !== null) toast(`Volume ${v}%`, 'volume')
      break
    }
    case 'like':
    case 'dislike': {
      const was = readPlayer()?.liked
      if (!clickRating(id)) toast('Play a song first', 'info')
      else if (id === 'like') toast(was === 'like' ? 'Removed from Liked music' : 'Added to Liked music', 'thumbUp')
      else toast(was === 'dislike' ? 'Dislike removed' : 'Disliked', 'thumbDown')
      break
    }
    case 'shuffle':
    case 'repeat': {
      if (!clickToggle(id)) {
        toast('Play a song first', 'info')
        break
      }
      // YTM updates the button a moment after the click.
      setTimeout(() => {
        const { shuffle, repeat } = readToggles()
        if (id === 'repeat') toast(repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off', 'repeat')
        else toast(shuffle === null ? 'Queue shuffled' : shuffle ? 'Shuffle on' : 'Shuffle off', 'shuffle')
      }, 300)
      break
    }
    case 'skipAd':
      if (!s.ad.active) toast('No ad playing', 'info')
      else
        skipAd().then((result) => {
          if (result === 'skipped') toast('Ad skipped', 'next')
          else if (result === 'not-skippable') toast("This ad can't be skipped yet", 'info')
          else toast("Couldn't skip this ad. Try YouTube's own Skip button.", 'warning')
        })
      break
    case 'toggleEq': {
      const enabled = !s.settings.eq.enabled
      updateSettings('eq', { enabled })
      toast(enabled ? 'Equalizer on' : 'Equalizer off', 'eq')
      break
    }
    case 'openEqualizer':
      openPanel('eq')
      break
    case 'openLyrics':
      openPanel('lyrics')
      break
    case 'openThemes':
      openPanel('themes')
      break
    case 'openShortcuts':
      openPanel('shortcuts')
      break
    case 'openSettings':
      openPanel('settings')
      break
    case 'fullLyrics':
      setState({ fullLyrics: !s.fullLyrics, panel: null })
      break
    case 'cheatSheet':
      setState({ cheatSheet: !s.cheatSheet })
      break
    case 'toggleWindow':
    case 'miniPlayer':
      ipcRenderer.send(IPC.appAction, id)
      break
  }
}
