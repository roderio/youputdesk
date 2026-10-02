/**
 * Overlay styles (inside shadow roots). Animations only touch transform and opacity so they
 * stay on the compositor; performance mode (:host(.perf)) turns them and all blur off.
 */
export const STYLES = /* css */ `
:host {
  --accent: #ff4e45;
  --bg: rgba(16, 16, 20, 0.94);
  --bg-solid: #141418;
  --raise: rgba(255, 255, 255, 0.06);
  --raise-2: rgba(255, 255, 255, 0.1);
  --line: rgba(255, 255, 255, 0.08);
  --text: #f4f4f6;
  --muted: rgba(255, 255, 255, 0.62);
  --faint: rgba(255, 255, 255, 0.4);
  --radius: 16px;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --font: "YouTube Sans", Roboto, "Segoe UI", system-ui, sans-serif;
  font-family: var(--font);
  color: var(--text);
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
:host(.click-through) * { pointer-events: none !important; }
:host(.perf) *, :host(.perf) *::before, :host(.perf) *::after {
  transition: none !important; animation: none !important; backdrop-filter: none !important;
}
:host(.rm) *, :host(.rm) *::before, :host(.rm) *::after { transition: none !important; animation: none !important; }
/* High contrast: brighter secondary text, solid surfaces, visible edges and a bold focus ring. */
:host(.hc) {
  --bg: #000; --bg-solid: #000; --raise: #1c1c1c; --raise-2: #2a2a2a;
  --line: rgba(255, 255, 255, 0.55); --muted: rgba(255, 255, 255, 0.92); --faint: rgba(255, 255, 255, 0.75);
}
:host(.hc) .switch, :host(.hc) .btn, :host(.hc) .chip, :host(.hc) .select, :host(.hc) .text { border: 2px solid rgba(255, 255, 255, 0.8); }
:host(.hc) .switch .knob { top: 1px; left: 1px; }
:host(.hc) button:focus-visible, :host(.hc) input:focus-visible, :host(.hc) select:focus-visible, :host(.hc) textarea:focus-visible, :host(.hc) [tabindex]:focus-visible {
  outline: 3px solid #ffd400; outline-offset: 3px; box-shadow: 0 0 0 6px #000;
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.icon { display: block; flex: none; }
h2, h3, p { margin: 0; }

/* ---------- Toolbar (in YTM's top bar) ---------- */
.toolbar { display: flex; gap: 2px; align-items: center; padding: 0 6px; border-right: 1px solid var(--line); margin-right: 4px; }
.tb-btn {
  position: relative; width: 40px; height: 40px; border-radius: 50%;
  display: grid; place-items: center; color: rgba(255,255,255,0.86);
  transition: background-color 150ms, color 150ms, transform 150ms var(--ease);
}
.tb-btn:hover { background: var(--raise-2); color: #fff; }
.tb-btn:active { transform: scale(0.92); }
.tb-btn.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
.tb-dot { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px #030303; }
.fallback-launcher .toolbar { background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 4px; }

/* Tooltips */
[data-tip] { position: relative; }
[data-tip]::after {
  content: attr(data-tip); position: absolute; top: calc(100% + 8px); left: 50%;
  transform: translate(-50%, -4px); opacity: 0; pointer-events: none; white-space: nowrap;
  background: #2a2a30; color: #fff; font-size: 12px; padding: 5px 9px; border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.4); transition: opacity 120ms, transform 120ms var(--ease); z-index: 10;
}
[data-tip]:hover::after { opacity: 1; transform: translate(-50%, 0); transition-delay: 350ms; }

/* ---------- Drawer ---------- */
.drawer {
  position: absolute; top: 72px; right: 12px; bottom: 84px; width: min(400px, calc(100vw - 24px));
  display: flex; flex-direction: column; pointer-events: auto;
  background: var(--bg); border: 1px solid var(--line); border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3);
  backdrop-filter: blur(24px) saturate(1.2);
  transform: translateX(calc(100% + 24px)); opacity: 0; visibility: hidden;
  transition: transform 300ms var(--ease), opacity 200ms, visibility 0s 300ms;
}
.drawer.open { transform: none; opacity: 1; visibility: visible; transition: transform 320ms var(--ease), opacity 160ms, visibility 0s; }
:host(.perf) .drawer { background: var(--bg-solid); }
.tabs { display: flex; gap: 2px; padding: 8px; border-bottom: 1px solid var(--line); }
.tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 2px 6px;
  border-radius: 12px; font-size: 11px; color: var(--muted); transition: background-color 150ms, color 150ms;
}
.tab:hover { background: var(--raise); color: var(--text); }
.tab.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.tab.close { flex: 0 0 40px; justify-content: center; }
.tab.close [data-tip]::after, .tab.close::after { top: auto; bottom: calc(100% + 8px); }
.drawer-content { flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
.panel-body { padding: 16px 18px 22px; display: flex; flex-direction: column; gap: 16px; animation: panel-in 260ms var(--ease); }
@keyframes panel-in { from { opacity: 0; transform: translateY(6px); } }

.hero { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hero-title { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.hero-sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
.lead { color: var(--muted); font-size: 13px; }
.lead .icon { display: inline-block; vertical-align: -2px; }
.note { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; color: var(--muted); background: var(--raise); border-radius: 12px; padding: 10px 12px; }
.note .icon { margin-top: 1px; color: var(--accent); }
.credit { color: var(--faint); font-size: 11.5px; text-align: center; }

/* ---------- Sections, rows, controls ---------- */
.section { display: flex; flex-direction: column; gap: 2px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin: 6px 2px 6px; }
.section-head h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); }
.row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--raise); }
.section > .row:first-of-type, .section-head + .row { border-radius: 14px 14px 4px 4px; }
.section > .row:last-child { border-radius: 4px 4px 14px 14px; }
.section-head + .row:last-child { border-radius: 14px; }
.row-icon { color: var(--muted); }
.row-text { flex: 1; min-width: 0; }
.row-title { font-weight: 500; }
.row-hint { color: var(--muted); font-size: 12px; margin-top: 2px; }
.row-control { display: flex; align-items: center; gap: 10px; flex: none; }
.value { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12px; min-width: 44px; text-align: right; }

.switch { width: 40px; height: 24px; border-radius: 999px; background: rgba(255,255,255,0.18); position: relative; transition: background-color 180ms; flex: none; }
.switch .knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: transform 220ms var(--ease); }
.switch.on { background: var(--accent); }
.switch.on .knob { transform: translateX(16px); }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: var(--raise-2); font-weight: 500; font-size: 13px; transition: background-color 150ms, transform 120ms; }
.btn:hover { background: rgba(255,255,255,0.16); }
.btn:active { transform: scale(0.97); }
.btn.primary { background: var(--accent); color: #0b0b0b; }
.btn.primary:hover { filter: brightness(1.08); }
.btn:disabled { opacity: 0.45; cursor: default; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.icon-btn { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--muted); transition: background-color 150ms, color 150ms; }
.icon-btn:hover { background: var(--raise-2); color: var(--text); }
.icon-btn.active { color: var(--accent); }

.text { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; color: var(--text); font: inherit; resize: vertical; }
.text:focus { border-color: var(--accent); outline: none; }
.select { background: rgba(0,0,0,0.3); color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; font: inherit; max-width: 170px; }
.inline-form { display: flex; gap: 8px; width: 100%; }

input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,0.16); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; margin-top: -6px; box-shadow: 0 1px 4px rgba(0,0,0,0.5); transition: transform 120ms; }
input[type=range]:hover::-webkit-slider-thumb { transform: scale(1.15); }
.hslider { width: 110px; }

.keys { display: inline-flex; gap: 3px; align-items: center; }
.keys.none { color: var(--faint); font-size: 12px; }
kbd { font: 600 11px/1 var(--font); padding: 4px 6px; border-radius: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.12); border-bottom-width: 2px; color: var(--text); min-width: 22px; text-align: center; }
.keys.muted kbd { background: rgba(255,255,255,0.06); color: var(--muted); }
.keys.recording { color: var(--accent); font-size: 12px; font-weight: 600; animation: pulse 1.2s infinite; }
.keys.recording small { color: var(--faint); font-weight: 400; margin-left: 4px; }
@keyframes pulse { 50% { opacity: 0.55; } }

/* ---------- Equalizer ---------- */
.visualizer { width: 100%; height: 56px; display: block; border-radius: 12px; background: rgba(0,0,0,0.25); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 6px 12px; border-radius: 999px; background: var(--raise); font-size: 12.5px; color: var(--muted); border: 1px solid transparent; transition: background-color 150ms, color 150ms, border-color 150ms; }
.chip:hover { background: var(--raise-2); color: var(--text); }
.chip.selected { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 60%, transparent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.chip.custom { display: inline-flex; align-items: center; gap: 2px; padding-right: 4px; }
.chip-x { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; opacity: 0.6; }
.chip-x:hover { opacity: 1; background: var(--raise-2); }
.bands { display: grid; grid-template-columns: 26px repeat(10, 1fr); align-items: stretch; gap: 0; background: var(--raise); border-radius: 16px; padding: 12px 6px 10px 2px; }
.db-scale { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: var(--faint); padding: 22px 0 22px; text-align: right; }
.band { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.band-value { font-size: 10.5px; font-variant-numeric: tabular-nums; color: var(--faint); height: 14px; }
.band-value.pos { color: var(--accent); }
.band-value.neg { color: var(--muted); }
.band-label { font-size: 10.5px; color: var(--muted); }
.vslider { writing-mode: vertical-lr; direction: rtl; width: 24px; height: 150px; }
.vslider::-webkit-slider-runnable-track { width: 4px; height: auto; background: linear-gradient(to top, rgba(255,255,255,0.12), rgba(255,255,255,0.22)); }
.vslider::-webkit-slider-thumb { margin-top: 0; margin-left: -6px; background: var(--accent); }
.eq.off .bands, .eq.off .chips { opacity: 0.55; }

/* ---------- Lyrics ---------- */
.now-playing { display: flex; align-items: center; gap: 12px; min-width: 0; }
.now-playing img, .art-placeholder { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex: none; background: var(--raise); display: grid; place-items: center; color: var(--faint); }
.np-text { flex: 1; min-width: 0; }
.np-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-artist { color: var(--muted); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.font-controls { display: flex; }
.lyrics-panel { height: 100%; padding-bottom: 12px; }
.lyrics { position: relative; flex: 1; min-height: 240px; max-height: calc(100vh - 330px); overflow-y: auto; scrollbar-width: none; mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent); }
.lyrics p { padding: 6px 4px; font-weight: 600; line-height: 1.35; }
.lyrics.synced p { color: rgba(255,255,255,0.32); cursor: pointer; border-radius: 10px; transform-origin: left center; transition: color 250ms, transform 300ms var(--ease), opacity 250ms; }
.lyrics.synced p:hover { color: rgba(255,255,255,0.6); }
.lyrics.synced p.past { color: rgba(255,255,255,0.45); }
.lyrics.synced p.now { color: #fff; transform: scale(1.04); text-shadow: 0 0 24px color-mix(in srgb, var(--accent) 45%, transparent); }
.lyrics.plain p { color: rgba(255,255,255,0.85); font-weight: 500; padding: 2px 4px; }
.lyrics-note { color: var(--faint) !important; font-size: 12px; font-weight: 500 !important; margin-bottom: 8px; }
.lyrics-pad { height: 35%; }
.lyrics-empty .actions { justify-content: center; }
.lyrics-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: var(--muted); padding: 48px 12px; }
.lyrics-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 24px 4px; }
.lyrics-skeleton span { height: 18px; border-radius: 8px; background: linear-gradient(90deg, var(--raise) 0%, var(--raise-2) 50%, var(--raise) 100%); background-size: 200% 100%; animation: shimmer 1.3s linear infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }

.full-lyrics { position: absolute; inset: 0; pointer-events: auto; background: #08080b; display: flex; flex-direction: column; animation: fade-in 260ms var(--ease); overflow: hidden; }
.full-bg { position: absolute; inset: -80px; background: center / cover no-repeat; filter: blur(80px) saturate(1.5) brightness(0.4); transform: translateZ(0); }
.full-top { position: relative; display: flex; align-items: center; gap: 6px; padding: 24px 32px 0; }
.full-top .spacer { flex: 1; }
.full-lyrics .lyrics { position: relative; max-height: none; padding: 0 12vw; }
.full-lyrics .lyrics.big p { padding: 10px 6px; letter-spacing: -0.01em; }
.full-lyrics .lyrics-empty { position: relative; }
@keyframes fade-in { from { opacity: 0; } }

/* ---------- Themes ---------- */
.theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.theme-card { position: relative; border-radius: 14px; background: var(--raise); border: 2px solid transparent; transition: border-color 150ms, transform 150ms var(--ease); }
.theme-card:hover { transform: translateY(-2px); }
.theme-card.selected { border-color: var(--accent); }
.theme-pick { display: block; width: 100%; text-align: left; padding: 8px; }
.theme-name { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; padding: 8px 2px 2px; }
.theme-name .icon { color: var(--accent); }
.theme-tools { position: absolute; top: 12px; right: 12px; display: flex; gap: 2px; background: rgba(0,0,0,0.6); border-radius: 999px; opacity: 0; transition: opacity 150ms; }
.theme-card:hover .theme-tools, .theme-tools:focus-within { opacity: 1; }
.theme-card.new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 120px; color: var(--muted); border: 2px dashed var(--line); background: none; }
.theme-card.new:hover { color: var(--text); border-color: rgba(255,255,255,0.25); }
.swatch { position: relative; height: 78px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
.sw-side { position: absolute; left: 0; top: 0; bottom: 18px; width: 22%; opacity: 0.9; }
.sw-card { position: absolute; top: 10px; width: 28%; height: 34px; border-radius: 5px; }
.sw-card:nth-of-type(2) { left: 30%; }
.sw-card:nth-of-type(3) { left: 63%; }
.sw-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; }
.sw-progress { position: absolute; left: 0; top: 0; height: 3px; width: 45%; }
.sw-badge { position: absolute; right: 6px; bottom: 22px; color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
.swatch.dynamic { background-image: linear-gradient(135deg, rgba(255,78,69,0.35), rgba(124,77,255,0.35)) !important; }
.editor { display: flex; flex-direction: column; gap: 10px; }
.editor-head { display: flex; align-items: center; gap: 10px; }
.title-input { font-size: 16px; font-weight: 600; }
.live-badge { flex: none; font-size: 11px; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); padding: 4px 8px; border-radius: 999px; }
.color-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--raise); border-radius: 12px; cursor: pointer; }
.color-row span { flex: 1; }
.color-row code { color: var(--faint); font-size: 12px; }
.color-row input[type=color] { width: 32px; height: 32px; border: 0; padding: 0; border-radius: 8px; background: none; cursor: pointer; }
.color-row input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
.color-row input[type=color]::-webkit-color-swatch { border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; }
.editor .row { border-radius: 12px !important; }
.import { display: flex; flex-direction: column; gap: 8px; }

/* ---------- Shortcuts ---------- */
.shortcut { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; background: var(--raise); border-radius: 4px; }
.section-head + .shortcut { border-radius: 14px 14px 4px 4px; }
.shortcut:last-child { border-radius: 4px 4px 14px 14px; }
.shortcut-label { flex: 1; font-size: 13.5px; }
.problem { display: flex; align-items: center; gap: 4px; color: #ffb74d; font-size: 11.5px; margin-top: 2px; }
.keys-btn { padding: 6px 8px; border-radius: 10px; min-width: 96px; display: flex; justify-content: flex-end; transition: background-color 150ms; }
.keys-btn:hover { background: var(--raise-2); }
.global-toggle { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; color: var(--faint); transition: background-color 150ms, color 150ms; }
.global-toggle:hover { background: var(--raise-2); }
.global-toggle.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.global-toggle[data-tip]::after { left: auto; right: 0; transform: translate(0, -4px); }
.global-toggle[data-tip]:hover::after { transform: none; }

/* ---------- Settings ---------- */
.status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.status .dot { width: 8px; height: 8px; border-radius: 50%; background: #ffb74d; }
.status.ok .dot { background: #4caf50; box-shadow: 0 0 0 3px rgba(76,175,80,0.2); }

/* ---------- Modals ---------- */
.modal-backdrop { position: absolute; inset: 0; pointer-events: auto; background: rgba(0,0,0,0.55); display: grid; place-items: center; padding: 24px; animation: fade-in 200ms; backdrop-filter: blur(6px); }
.modal { width: min(760px, 100%); max-height: calc(100vh - 48px); overflow-y: auto; background: var(--bg-solid); border: 1px solid var(--line); border-radius: 24px; padding: 26px 28px; box-shadow: 0 30px 80px rgba(0,0,0,0.6); animation: modal-in 320ms var(--ease); }
@keyframes modal-in { from { opacity: 0; transform: translateY(16px) scale(0.98); } }
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.modal h2 { font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
.modal-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 22px; flex-wrap: wrap; }
.hint { color: var(--muted); font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.modal.privacy { width: min(600px, 100%); }
.welcome-head { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 22px; }
.welcome-head p { color: var(--muted); margin-top: 4px; }
.welcome-badge { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex: none; color: #0b0b0b; background: linear-gradient(135deg, var(--accent), #7c4dff); }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
.feature { text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 16px; background: var(--raise); border: 1px solid transparent; transition: border-color 150ms, transform 150ms var(--ease), background-color 150ms; }
.feature:not(:disabled):hover { border-color: color-mix(in srgb, var(--accent) 50%, transparent); transform: translateY(-2px); background: var(--raise-2); }
.feature:disabled { cursor: default; }
.feature-icon { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.feature-title { font-weight: 600; font-size: 15px; margin-top: 4px; }
.feature-text { color: var(--muted); font-size: 12.5px; flex: 1; }
.cheat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 22px; }
.cheat-grid h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); margin-bottom: 8px; }
.cheat-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.global-pill { display: inline-grid; place-items: center; margin-left: 6px; width: 18px; height: 18px; border-radius: 50%; color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); vertical-align: -3px; }

/* ---------- Ad banner & toasts ---------- */
.ad-banner {
  position: absolute; top: 74px; left: 50%; transform: translateX(-50%); pointer-events: auto;
  display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 8px; border-radius: 999px;
  background: var(--bg-solid); border: 1px solid var(--line); box-shadow: 0 10px 30px rgba(0,0,0,0.45);
  animation: drop-in 320ms var(--ease); font-size: 13.5px;
}
@keyframes drop-in { from { opacity: 0; transform: translate(-50%, -12px); } }
.ad-tag { background: #fbc02d; color: #111; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 999px; }
.ad-wait { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); }
.ad-banner.ready { border-color: color-mix(in srgb, var(--accent) 60%, transparent); }
.ad-skip { display: inline-flex; align-items: center; gap: 4px; background: var(--accent); color: #0b0b0b; font-weight: 600; padding: 6px 12px; border-radius: 999px; transition: transform 120ms; }
.ad-skip:hover { transform: scale(1.04); }
.spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); border-top-color: var(--accent); animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.toasts { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; }
.toast { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: rgba(36,36,42,0.96); border: 1px solid var(--line); box-shadow: 0 8px 24px rgba(0,0,0,0.4); font-size: 13.5px; animation: toast-in 260ms var(--ease); }
.toast .icon { color: var(--accent); }
@keyframes toast-in { from { opacity: 0; transform: translateY(10px) scale(0.96); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`
