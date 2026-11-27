# Linux Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship YouputDesk for Linux as AppImage and .deb packages for x64 and arm64, built and smoke-tested by
GitHub Actions and published to the same release as the Windows files.

**Architecture:** OS-specific decisions go in one pure module (`src/shared/platform.ts`), which the
main process, the preloads and the tests all import. Main-process code checks `process.platform` only through
those helpers. electron-builder makes the Linux packages, a new `linux.yml` workflow smoke-tests them under
Xvfb over CDP, and `release.yml` gets a Linux matrix job that uploads to the same draft release.

**Tech Stack:** Electron 45, electron-vite 6, electron-builder 26, electron-updater 6, Preact 11, vitest 5,
GitHub Actions (`ubuntu-24.04`, `ubuntu-24.04-arm`).

**Spec:** `docs/superpowers/specs/2026-11-27-linux-support-design.md`

## Global Constraints

- Targets: `AppImage` and `deb`, arches `x64` and `arm64`. No Flatpak, Snap, rpm, macOS or Linux portable build.
- Windows behavior and Windows artifacts (`YouputDesk-Setup-*.exe`, portables, `latest.yml`) must not change.
- deb maintainer: `roderio <170575546+roderio@users.noreply.github.com>`.
- Desktop category: `AudioVideo;Audio;Player;`.
- Every Linux-only behavior is decided by a helper in `src/shared/platform.ts`. Don't scatter `process.platform` checks.
- `ci.yml`'s `test` and `audit` jobs keep their names (branch protection requires them).
- Actions stay pinned to commit SHAs, matching the existing workflows (checkout `3d3c42e5…` v7.0.1,
  setup-node `949feb24…` v7.1.0).
- All releases upload to the one draft that is created first. No job may create its own release.
- Linux is labeled "beta" in the README and on the website.

## Review Focus

1. **AppImage on Ubuntu 24.04 with unprivileged user namespaces restricted by AppArmor.** Chromium's sandbox
   can fail to start ("SUID sandbox helper binary … not configured correctly"). Expected: the smoke test
   shows it, and the AppImage is never shipped broken. If it fails, stop and bring the user the choice
   (document `--no-sandbox`, ship an AppArmor note, or drop AppImage for now). Don't silently add `--no-sandbox`.
2. **The .deb on Ubuntu 24.04.** electron-builder's postinst makes `chrome-sandbox` SUID root. Expected: the
   installed app starts without flags. Pinned by the deb leg of the smoke test (Task 6).
3. **GNOME without a tray.** Expected: closing the window quits by default (close-to-tray is off on
   Linux), and relaunching shows the running instance. Pinned by `defaultCloseToTray` tests (Task 1) and
   the WSL check (Task 9).
4. **Updates on Linux.** Expected: x64 and arm64 each read their own feed (`latest-linux.yml`,
   `latest-linux-arm64.yml`), and Windows still reads `latest.yml`. Pinned by the release-asset check in
   Task 7.
5. **Global hotkeys on a Wayland desktop without the GlobalShortcuts portal.** Expected: no crash; the
   Shortcuts panel shows "Another app is already using this combo" for those that fail. This can't be
   tested here (WSLg has no portal) and stays a documented beta limitation.

---

### Task 1: Platform helpers

**Files:**
- Create: `src/shared/platform.ts`
- Test: `tests/platform.test.ts`

**Interfaces:**
- Produces (all pure, with no Electron import; `platform` is a `NodeJS.Platform` string and `arch` is Node's `process.arch`):
  - `isLinux(platform?: string): boolean`, which defaults to `process.platform`
  - `firefoxPlatformToken(platform: string, arch: string): string`
  - `superKeyName(platform: string): 'Win' | 'Super'`
  - `defaultCloseToTray(platform: string): boolean`
  - `windowIconName(platform: string): 'icon.ico' | 'icon.png'`
  - `notificationsHelp(platform: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { defaultCloseToTray, firefoxPlatformToken, notificationsHelp, superKeyName, windowIconName } from '../src/shared/platform'

describe('firefoxPlatformToken', () => {
  it('matches the real OS', () => {
    expect(firefoxPlatformToken('win32', 'x64')).toBe('Windows NT 10.0; Win64; x64')
    expect(firefoxPlatformToken('win32', 'arm64')).toBe('Windows NT 10.0; Win64; x64')
    expect(firefoxPlatformToken('linux', 'x64')).toBe('X11; Linux x86_64')
    expect(firefoxPlatformToken('linux', 'arm64')).toBe('X11; Linux aarch64')
  })
})
describe('superKeyName', () => {
  it('says Win on Windows and Super on Linux', () => {
    expect(superKeyName('win32')).toBe('Win')
    expect(superKeyName('linux')).toBe('Super')
  })
})
describe('defaultCloseToTray', () => {
  it('is on for Windows and off for Linux, where GNOME may have no tray', () => {
    expect(defaultCloseToTray('win32')).toBe(true)
    expect(defaultCloseToTray('linux')).toBe(false)
  })
})
describe('windowIconName', () => {
  it('uses ico on Windows and png on Linux', () => {
    expect(windowIconName('win32')).toBe('icon.ico')
    expect(windowIconName('linux')).toBe('icon.png')
  })
})
describe('notificationsHelp', () => {
  it('points at the right settings', () => {
    expect(notificationsHelp('win32')).toBe('Nothing appears? Check Windows Settings → System → Notifications, and Do not disturb')
    expect(notificationsHelp('linux')).toBe("Nothing appears? Check your desktop's notification settings, and Do not disturb")
  })
})
```

(Windows on ARM reports the x64 token, because that's what Firefox sends there.)

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/platform.test.ts`
Expected: FAIL, because `src/shared/platform` doesn't exist yet.

- [ ] **Step 3: Implement `src/shared/platform.ts`**, with the signatures above and the exact strings from
  the tests. Anything that isn't `'linux'` gets the Windows answer.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/platform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**: `git add src/shared/platform.ts tests/platform.test.ts && git commit -m "Add platform helpers for Linux support"`

### Task 2: Main-process Linux guards

**Files:**
- Modify: `src/main/index.ts:20-22` (the AppUserModelId) and the top of the file (the Wayland switch)
- Modify: `src/main/window.ts:47` (the window icon)
- Modify: `src/main/taskbar.ts:15-26` (the thumbnail buttons)
- Modify: `src/main/ua.ts:27-31` (the Firefox UA)
- Modify: `src/shared/settings.ts:80` (the close-to-tray default)
- Test: `tests/settings.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: `firefoxUA()` keeps its signature (`(): string`) but builds the UA from
  `firefoxPlatformToken(process.platform, process.arch)`.

- [ ] **Step 1: Write the failing test** in `tests/settings.test.ts`:

```ts
it('defaults close-to-tray by platform', () => {
  expect(DEFAULT_SETTINGS.tray.closeToTray).toBe(defaultCloseToTray(process.platform))
})
```

- [ ] **Step 2: Note what this test can and can't show**: on Windows it passes before and after the change,
  because the default stays `true`. It only bites on Linux, where `npm run dist:linux` (Task 6's CI job)
  runs the tests too. Add the import and go on to Step 3.
- [ ] **Step 3: Implement**
  - `settings.ts`: `tray: { closeToTray: defaultCloseToTray(process.platform), trayHintShown: false }`.
  - `index.ts`: call `app.setAppUserModelId(...)` only when `!isLinux()`. On Linux, before `app.whenReady()`,
    call `app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')`.
  - `window.ts`: `icon: asset(windowIconName(process.platform))`.
  - `taskbar.ts`: skip `setButtons` (both the `show` and `ready-to-show` handlers, and the call in the state
    listener) on Linux. Keep `setTitle` and `setProgressBar`.
  - `ua.ts`: build the Firefox UA from `firefoxPlatformToken(process.platform, process.arch)`.
- [ ] **Step 4: Verify**: `npm run typecheck && npm test`, with everything passing.
- [ ] **Step 5: Commit**: `git commit -am "Guard Windows-only main-process features on Linux"`

### Task 3: Tray on Linux

**Files:**
- Modify: `src/main/tray.ts`
- Modify: `src/main/window.ts:86-89` (the tray hint)

**Interfaces:**
- Consumes: `isLinux()`. `buildMenu()` stays as it is. The notification helper is
  `showTrayHint(title: string, body: string): void` in `tray.ts`, which replaces the export
  `showTrayBalloon`. It calls `tray.displayBalloon` on Windows, and on Linux shows an Electron `Notification`
  with `icon.png`, `silent: true`, and a click that calls `showMainWindow`.

- [ ] **Step 1: Implement the Linux tray in `setupTray()`.** On Linux, call `tray.setContextMenu(buildMenu())`
  once, and call it again from the existing `player.on('state')` listener only when
  `${s.playing}|${s.title}|${s.artist}|${s.liked}|${s.ad}|${s.videoId}` changes. Skip the `right-click`
  handler and `setMiniAnchor` on Linux. The `click` handler stays, since it's harmless where it never fires.
- [ ] **Step 2: Rename `showTrayBalloon` to `showTrayHint`** and update its caller in `window.ts`.
- [ ] **Step 3: Verify**: `npm run typecheck && npm test` passes. On Windows, run `npm run dev` and check
  that right-clicking the tray still opens the menu and the mini player still appears above the tray icon.
  (Use an isolated profile: `$env:YOUPUTDESK_PROFILE='dev-linux'`.)
- [ ] **Step 4: Commit**: `git commit -am "Linux tray: static context menu, notification instead of balloon"`

### Task 4: Platform-neutral wording in the panels

**Files:**
- Modify: `src/preload/overlay/ShortcutsPanel.tsx:58`
- Modify: `src/preload/overlay/SettingsPanel.tsx:20,23,26`
- Modify: `src/main/notifications.ts:1,34` (comments only)

**Interfaces:**
- Consumes: `superKeyName`, `notificationsHelp` (`process.platform` is available in sandboxed preloads).

- [ ] **Step 1: Change the copy**
  - ShortcutsPanel: `` `Global shortcuts need Ctrl, Alt or ${superKeyName(process.platform)}` ``.
  - SettingsPanel line 20: "Banner and desktop notification when an ad plays, …".
  - SettingsPanel line 23: "Desktop notification on song change. …".
  - SettingsPanel line 26: `hint={notificationsHelp(process.platform)}`.
  - notifications.ts comments: "Windows toasts" becomes "Desktop notifications", and "check Windows lets us
    notify" becomes "check the OS lets us notify".
- [ ] **Step 2: Verify the preload bundle stays self-contained**: run `npm run build`, then
  `node -e "const s=require('fs').readFileSync('out/preload/index.cjs','utf8');const r=[...s.matchAll(/require\(\"([^\"]+)\"\)/g)].map(m=>m[1]);console.log([...new Set(r)])"`.
  Expected: `[ 'electron' ]` only.
- [ ] **Step 3: Verify**: `npm run typecheck && npm test` passes.
- [ ] **Step 4: Commit**: `git commit -am "Platform-neutral wording for notifications and the Super key"`

### Task 5: Linux packaging

**Files:**
- Modify: `scripts/gen-icons.mjs:147-161` (writes Linux icons)
- Create: `build/icons/{16,32,48,64,128,256,512}x{same}.png` (generated)
- Modify: `package.json` (`description`, `scripts`, `build.linux`, `build.deb`, `build.appImage`)

**Interfaces:**
- Produces: npm scripts
  - `dist:linux`: `npm run typecheck && npm test && electron-vite build && electron-builder --linux`
  - `release:linux`: the same, plus `--publish always`
- Produces: artifacts in `dist/`:
  - `YouputDesk-<version>-<arch>.AppImage`, where electron-builder spells the arch `x86_64` or `arm64`
  - `youputdesk_<version>_<amd64|arm64>.deb`
  - `latest-linux.yml` / `latest-linux-arm64.yml`

- [ ] **Step 1: Generate the Linux icons.** In `gen-icons.mjs`, `mkdirSync('build/icons', { recursive: true })`
  and write `png(size, appIcon(size))` for each size above to `build/icons/${size}x${size}.png`. Run
  `npm run icons` and check that `build/icons/512x512.png` exists and that the other icon files are unchanged
  (`git status` shows only the new files).
- [ ] **Step 2: Update `package.json`**
  - `description`: "YouTube Music desktop app with an equalizer, synced lyrics, themes, a mini player and
    global hotkeys"
  - `build.linux`: `{ "target": [{ "target": "AppImage", "arch": ["x64","arm64"] }, { "target": "deb", "arch": ["x64","arm64"] }], "icon": "build/icons", "category": "AudioVideo;Audio;Player;", "synopsis": "YouTube Music desktop app", "maintainer": "roderio <170575546+roderio@users.noreply.github.com>", "executableName": "youputdesk" }`
  - `build.appImage`: `{ "artifactName": "${productName}-${version}-${arch}.${ext}" }`
  - the two npm scripts above
- [ ] **Step 3: Verify the config**: `npx electron-builder --linux --dir --x64` fails on Windows only for the
  platform reason, not with a config error. The real build happens in CI (Task 6).
- [ ] **Step 4: Commit**: `git add build/icons scripts/gen-icons.mjs package.json && git commit -m "Linux packaging: AppImage and deb for x64 and arm64"`

### Task 6: Linux smoke test and CI workflow

**Files:**
- Create: `scripts/smoke-linux.mjs`
- Create: `.github/workflows/linux.yml`

**Interfaces:**
- Produces: `node scripts/smoke-linux.mjs <executable> [extra electron args…]`, which exits 0 on success and
  1 on failure with a `::error::` line. Task 7 reuses it.

- [ ] **Step 1: Write `scripts/smoke-linux.mjs`**
  - Spawn `<executable>` with `--remote-debugging-port=9333` plus any extra args, with
    `env: { ...process.env, YOUPUTDESK_PROFILE: 'smoke-ci' }`, and pipe its output to the console.
  - Poll `http://127.0.0.1:9333/json/list` for up to 90 s until a `page` target's `url` starts with
    `https://music.youtube.com`.
  - Connect to that target's `webSocketDebuggerUrl` (Node 24's global `WebSocket`) and poll
    `Runtime.evaluate` with `!!document.querySelector('youputdesk-overlay')` for up to 30 s until it's `true`.
  - Send `SIGTERM` and require the process to exit within 15 s.
  - If the process exits early, a step times out, or the overlay never appears, print the reason with
    `::error::`, kill the process, and exit 1.
- [ ] **Step 2: Write `.github/workflows/linux.yml`**
  - `name: Linux build`, `on: pull_request` and `push: branches: [main]`, both with
    `paths-ignore: ['docs/**', '**/*.md']`, and `permissions: contents: read`.
  - Job `linux`, with a matrix over `runner: [ubuntu-24.04, ubuntu-24.04-arm]`.
  - Steps: checkout, setup-node (node 24, cache npm), `npm ci`,
    `sudo apt-get update && sudo apt-get install -y xvfb libfuse2t64`, `npm run dist:linux -- --publish never`.
  - Then two smoke steps:
    - **AppImage:** `chmod +x dist/*.AppImage` and `xvfb-run -a node scripts/smoke-linux.mjs dist/*.AppImage`
    - **deb:** `sudo apt-get install -y ./dist/*.deb` and `xvfb-run -a node scripts/smoke-linux.mjs /opt/YouputDesk/youputdesk`
  - Upload `dist/*.AppImage` and `dist/*.deb` as artifacts (7-day retention), so they can be tested by hand.
- [ ] **Step 3: Push the branch and open a draft PR.** Check that the `Linux build` checks pass on both arches.
  If the AppImage leg fails with a sandbox error, see Review Focus 1: stop and ask the user. Don't add
  `--no-sandbox`.
- [ ] **Step 4: Commit any fixes**: `git commit -am "Linux smoke test fixes"`

### Task 7: Release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Restructure into three jobs**
  - `draft` (ubuntu-latest): checkout, the "Tag matches package.json version" check, and the existing
    "Create draft release" command.
  - `windows` (the existing job, renamed from `release`): `needs: draft`. Remove its draft step. Everything
    else stays the same.
  - `linux`: `needs: draft`, with the same matrix as Task 6. Steps:
    1. checkout and setup-node
    2. `npm ci` and the two audit steps
    3. install xvfb and libfuse2t64
    4. `npm run release:linux` with `GH_TOKEN`
    5. the AppImage smoke step from Task 6

    A smoke failure turns the job red, and the draft must not be published.
- [ ] **Step 2: Update the header comment** so it says that Windows and Linux files upload to one draft.
- [ ] **Step 3: Verify.** Nothing can run a release before the first real tag, so read the YAML against Task 6's
  steps (same matrix, same smoke step, `needs: draft` on both build jobs). After the first real tag, run `gh release view v<version> --json assets --jq '.assets[].name'`.
  Expected:
  - the existing Windows files, unchanged
  - two `.AppImage` files
  - two `.deb` files
  - `latest-linux.yml` and `latest-linux-arm64.yml`
- [ ] **Step 4: Commit**: `git commit -am "Release Linux builds alongside Windows"`

### Task 8: Docs and website

**Files:**
- Modify: `README.md` (tagline, a Linux install section, uninstall)
- Modify: `docs/site/index.html` (a Linux install tab), `docs/site/app.js:115-140` (Linux download detection)
- Modify: `PRIVACY.md:8,13,35`, `SECURITY.md:21`, `CONTRIBUTING.md` (building Linux packages)
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml` (the "Windows version" field becomes "OS and version";
  "Installed or portable?" gains `AppImage` and `.deb`)

- [ ] **Step 1: README**
  - Tagline: "A desktop app for YouTube Music on Windows and Linux (beta)".
  - New **Linux (beta)** block under Install:
    - AppImage: `chmod +x` and run. Needs `libfuse2` (`libfuse2t64` on Ubuntu 24.04). Updates itself.
    - .deb: `sudo apt install ./youputdesk_<version>_amd64.deb`. Updates itself and asks for your password.
    - "Not tested on every desktop yet. Please report problems."
  - Uninstall: on Linux, remove `~/.config/YouputDesk` to delete your data.
- [ ] **Step 2: Website**
  - Add a `Linux` tab with the same instructions.
  - In `app.js`, detect Linux (`navigator.userAgentData?.platform === 'Linux'` or
    `/Linux/.test(navigator.platform)`, excluding Android). When it's Linux, point `setup-link` at the
    `.AppImage` asset for the arch, and set the meta text to `Version ${version}, ${mb} MB. For Linux (beta). Free and open source.`
- [ ] **Step 3: PRIVACY/SECURITY**
  - On Linux, data lives in `~/.config/YouputDesk`.
  - Cookies are encrypted with the system keyring (GNOME Keyring/KWallet). Without one, Chromium uses
    weaker obfuscation.
  - Uninstalling on Linux doesn't remove that folder.
- [ ] **Step 4: CONTRIBUTING**: add "Linux packages build in CI (`linux.yml`). Locally on Linux:
  `npm run dist:linux`."
- [ ] **Step 5: Verify**: open `docs/site/index.html` in the browser pane, then click the Linux tab and
  every Copy button.
- [ ] **Step 6: Commit**: `git commit -am "Docs and website: Linux (beta)"`

### Task 9: Hands-on check in WSL (x64)

Requires the user to run this once first, because it asks for their Linux password:
`wsl -d Ubuntu -- sudo apt-get install -y libnss3 libasound2t64 libxss1 libsecret-1-0 xdg-utils libfuse2t64`

- [ ] **Step 1:** Download the x64 AppImage and .deb artifacts from the Task 6 CI run
  (`gh run download <run-id> -n <artifact>`) into the scratchpad.
- [ ] **Step 2:** In WSL, run the AppImage with `YOUPUTDESK_PROFILE=wsl-test` and
  `--remote-debugging-port=9333`, then check over CDP and with screenshots:
  - the window and the music.youtube.com page load
  - the privacy screen shows
  - the equalizer panel, the lyrics panel and the mini player open
  - the Shortcuts panel says "Super"
  - Settings shows the Linux notification help
  - closing the window quits the app (close-to-tray is off by default)
  - a test notification appears
- [ ] **Step 3:** Same for the .deb. This needs the user to run `sudo apt install ./<deb>` in WSL; skip it
  if they'd rather not.
- [ ] **Step 4:** Delete the test profile (`~/.config/YouputDesk-wsl-test`) and report:
  - what passed
  - what WSL couldn't show (tray panel, Discord, Wayland hotkeys)
  - that arm64 only got the CI smoke test
