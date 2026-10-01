import { useEffect, useState } from 'preact/hooks'
import { ACTION_IDS, ACTIONS, defaultBindings, eventToAccelerator, findConflicts, isSafeGlobal, normalize, type ActionId } from '../../shared/shortcuts'
import { setState, toast, updateSettings, useUi } from '../store'
import { Icon } from './icons'
import { Button, Keys } from './ui'

/** Click, press a combo, done. Esc cancels, Backspace clears. */
function Recorder({ id, onDone }: { id: ActionId; onDone: () => void }) {
  const bindings = useUi((s) => s.settings.shortcuts)
  useEffect(() => {
    setState({ recording: true })
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') return onDone()
      if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey) {
        updateSettings('shortcuts', { [id]: { ...bindings[id], accelerator: '' } })
        return onDone()
      }
      const accel = eventToAccelerator(e)
      if (!accel) return // waiting for a non-modifier key
      updateSettings('shortcuts', { [id]: { ...bindings[id], accelerator: normalize(accel) } })
      onDone()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      setState({ recording: false })
    }
  }, [id])
  return <span class="keys recording">Press keys… <small>Esc to cancel</small></span>
}

export function ShortcutsPanel() {
  const bindings = useUi((s) => s.settings.shortcuts)
  const failed = useUi((s) => s.failedShortcuts)
  const [editing, setEditing] = useState<ActionId | null>(null)
  const conflicts = findConflicts(bindings)
  const conflictWith = (id: ActionId) => conflicts.find((g) => g.includes(id))?.filter((x) => x !== id) ?? []
  const groups = [...new Set(ACTION_IDS.map((id) => ACTIONS[id].group))]

  return (
    <div class="panel-body shortcuts">
      <p class="lead">
        Click a shortcut to change it. Turn on <Icon name="globe" size={14} /> <b>Global</b> to make it work even when YouputDesk is in the background.
      </p>
      {groups.map((group) => (
        <section class="section" key={group}>
          <div class="section-head"><h3>{group}</h3></div>
          {ACTION_IDS.filter((id) => ACTIONS[id].group === group).map((id) => {
            const b = bindings[id]
            const others = conflictWith(id)
            const problem = others.length
              ? `Also used by “${ACTIONS[others[0]].label}”`
              : failed.includes(id) && b.global
                ? 'Another app is already using this combo'
                : b.global && b.accelerator && !isSafeGlobal(b.accelerator)
                  ? 'Global shortcuts need Ctrl, Alt or Win'
                  : ''
            return (
              <div class={`shortcut ${problem ? 'has-problem' : ''}`} key={id}>
                <div class="shortcut-label">
                  {ACTIONS[id].label}
                  {problem && <div class="problem"><Icon name="warning" size={14} /> {problem}</div>}
                </div>
                <button type="button" class="keys-btn" onClick={() => setEditing(editing === id ? null : id)} aria-label={`Change shortcut for ${ACTIONS[id].label}`}>
                  {editing === id ? <Recorder id={id} onDone={() => setEditing(null)} /> : <Keys accelerator={b.accelerator} />}
                </button>
                <button type="button" class={`global-toggle ${b.global ? 'on' : ''}`} aria-pressed={b.global}
                  data-tip={b.global ? 'Global: works everywhere' : 'Only while YouputDesk is focused'}
                  onClick={() => updateSettings('shortcuts', { [id]: { ...b, global: !b.global } })}>
                  <Icon name="globe" size={16} />
                </button>
              </div>
            )
          })}
        </section>
      ))}
      <div class="actions">
        <Button icon="reset" onClick={() => { updateSettings('shortcuts', defaultBindings()); toast('Shortcuts reset to defaults', 'reset') }}>
          Reset to defaults
        </Button>
      </div>
    </div>
  )
}
