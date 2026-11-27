# Linux support (x64 and arm64)

## Why

YouputDesk only runs on Windows. Linux users should be able to install it, get the same features, and
receive updates the same way Windows users do. macOS is out of scope: Apple's signing fee and the lack of
a Mac to test on make it not worth doing now.

## Goals

- Linux builds for **x64 and arm64**, published to the same GitHub release as the Windows files.
- Two package formats:
  - **AppImage**: one file that runs on almost any distro and updates itself through the existing
    updater.
  - **.deb**: for Ubuntu, Debian and Mint. It also updates through electron-updater, which asks for the
    admin password to install each update.
- The same features as on Windows, except the Windows-only ones listed below.
- Linux is labeled **beta** in the README and website for the first release (0.3.0).

## Non-goals

- macOS, Flatpak/Flathub, Snap, .rpm and AUR. Flatpak is the likely next step once this works.
- A Linux portable build. The AppImage already plays that role.
- Our own MPRIS integration. Chromium's Media Session already exposes play/pause/next/metadata to Linux
  media controls.

## Anti-goals (a failure even if it builds)

- Any change in Windows behavior, or in the Windows update feed (`latest.yml`).
- A release split across two drafts. Every job must upload to the one draft.
- Sign-in breaking on Linux because the app claims to be Windows.

## Approaches considered

1. **AppImage and .deb on GitHub Releases** (chosen). Built by electron-builder in the existing release
   workflow, with no new services. Both formats update through electron-updater
   (`latest-linux.yml`, `latest-linux-arm64.yml`).
2. **Also Flatpak on Flathub.** This reaches the most Linux users, but it needs a separate submission and
   review (like winget), a manifest repository, and sandbox permissions for Discord, the tray and global
   hotkeys. Deferred until the first Linux release has proved itself.
3. **AppImage only.** Least work, but Ubuntu/Debian users expect a .deb that shows up in their app menu
   and package manager. Dropped.

The user asked for Linux on x64 and arm64 and skipped the Mac; the formats are Claude's recommendation,
which the user accepted with "let's do Linux".

## What changes

### Build and release

- `package.json`:
  - `build.linux` with targets `AppImage` and `deb` for `x64` and `arm64`, category
    `AudioVideo;Audio;Player;`, icon from a 512×512 PNG in `build/icons`, and artifact names like
    `YouputDesk-<version>-<arch>.AppImage` and `youputdesk_<version>_<arch>.deb`.
  - `build.deb.maintainer` (see "Open question" below).
  - The `description` no longer says "for Windows".
- `scripts/gen-icons.mjs` also writes the Linux PNG icon sizes.
- `.github/workflows/release.yml`:
  - A `draft` job creates the draft release once (the existing step, moved).
  - The existing Windows job `needs: draft` and is otherwise unchanged.
  - A new `linux` job, a matrix over `ubuntu-24.04` (x64) and `ubuntu-24.04-arm` (arm64), `needs: draft`,
    and runs the same checks (audit, Electron audit, tag matches version, typecheck, tests) and then
    `electron-builder --linux --<arch> --publish always`. Each architecture builds natively.
- New npm scripts: `dist:linux` and `release:linux`. The existing `dist`/`release` stay Windows-only.
- CI (`ci.yml`) is unchanged. Its required checks are named `test` and `audit`, and branch protection
  depends on those names.

### App code (each change only takes effect on Linux, guarded by `process.platform`)

- **Window icon** (`window.ts`): use `icon.png` on Linux, since `icon.ico` is Windows-only.
- **App identity** (`index.ts`): call `setAppUserModelId` only on Windows.
- **Tray** (`tray.ts`): Linux tray icons (AppIndicator/StatusNotifier) don't send click or right-click
  events, so on Linux the tray sets its menu with `setContextMenu` and rebuilds it when the play state or
  song changes. The menu includes "Show YouputDesk" and "Mini player". The mini player already falls back
  to the cursor position when there are no tray bounds.
- **Close to tray** (`store`/`window.ts`): GNOME shows no tray icon without an extension, so closing to the
  tray could leave no visible way back. On Linux, "close to tray" is off by default for new installs;
  users can turn it on in Settings.
- **Tray hint** (`window.ts`/`tray.ts`): `displayBalloon` only works on Windows. On Linux, the
  "still playing in the tray" hint is a normal notification.
- **Taskbar** (`taskbar.ts`): thumbnail buttons only on Windows. The title and progress bar stay; KDE and
  Unity docks show the progress bar.
- **Firefox sign-in identity** (`ua.ts`): the Firefox UA uses the real platform token
  (`X11; Linux x86_64` / `X11; Linux aarch64`) on Linux. The default identity already reports Linux.
- **Global hotkeys under Wayland** (`index.ts`): enable Electron's `GlobalShortcutsPortal` feature so
  global shortcuts register through the desktop portal. Where the desktop doesn't support it,
  registration fails and the existing "another app is using this combo" warning shows.
- **Wording**: panels that say "Windows notification" or "Ctrl, Alt or Win" use neutral or
  platform-appropriate words ("desktop notification", "Super").

### Docs

- README: a Linux section under Install (AppImage, .deb, beta label), "Windows" removed from the tagline
  where it's no longer true, and the uninstall notes. On Linux, uninstalling doesn't delete
  `~/.config/YouputDesk`, so the README says how to remove it.
- Website install tabs get a Linux tab, and the download button detects Linux.
- SECURITY.md/PRIVACY.md: on Linux, cookies are encrypted with the system keyring (libsecret/KWallet).
  Without a keyring, Chromium falls back to weaker obfuscation.
- CONTRIBUTING.md: how to build and test the Linux packages.

## Testing

- Unit tests (vitest) for the pure parts: the Firefox UA per platform and the shortcut wording.
- Manual test of the x64 AppImage and .deb in the Ubuntu install on WSL2 (WSLg): sign-in, playback, the
  equalizer, lyrics, the mini player, tray menu, notifications, hotkeys and Discord status. Updating is
  tested by installing one version and publishing a newer test release.
- arm64 is built in CI only. Nothing here can run it, and the release notes say so.

## Known limitations (documented, not fixed)

- On GNOME without the AppIndicator extension there is no tray icon. Relaunching the app (or a global
  hotkey) brings the window back, since a second launch shows the running instance.
- Discord installed as Flatpak or Snap uses a different IPC socket path that the Discord library may not
  find.
- arm64 is untested on real hardware before release.

## Left to the builder

- The exact layout of the release workflow jobs and steps, within the constraints above.
- The icon sizes to generate.

## Open question for the user

- **The .deb maintainer field must include an email address**, and it's public in every .deb. Use the
  GitHub no-reply address (`170575546+roderio@users.noreply.github.com`) or another address you choose?
