/** Small building blocks shared by the panels. */
import type { ComponentChildren } from 'preact'
import { prettyAccelerator } from '../../shared/shortcuts'
import { Icon, type IconName } from './icons'

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} class={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span class="knob" />
    </button>
  )
}

/** A labelled settings row with a control on the right. */
export function Row({ icon, title, hint, children }: { icon?: IconName; title: string; hint?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <div class="row">
      {icon && <span class="row-icon"><Icon name={icon} /></span>}
      <div class="row-text">
        <div class="row-title">{title}</div>
        {hint && <div class="row-hint">{hint}</div>}
      </div>
      <div class="row-control">{children}</div>
    </div>
  )
}

export function Section({ title, children, aside }: { title: string; children: ComponentChildren; aside?: ComponentChildren }) {
  return (
    <section class="section">
      <div class="section-head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Keys({ accelerator, muted }: { accelerator: string; muted?: boolean }) {
  const parts = prettyAccelerator(accelerator)
  if (parts.length === 0) return <span class="keys none">Not set</span>
  return (
    <span class={`keys ${muted ? 'muted' : ''}`}>
      {parts.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
    </span>
  )
}

export function IconButton({ icon, label, onClick, active, size = 20, class: cls = '' }: {
  icon: IconName
  label: string
  onClick: () => void
  active?: boolean
  size?: number
  class?: string
}) {
  return (
    <button type="button" class={`icon-btn ${active ? 'active' : ''} ${cls}`} aria-label={label} data-tip={label} onClick={onClick}>
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Button({ icon, children, onClick, primary, danger, disabled }: {
  icon?: IconName
  children: ComponentChildren
  onClick: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button type="button" class={`btn ${primary ? 'primary' : ''} ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  )
}
