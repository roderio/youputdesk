# YouputDesk

A Windows desktop app for YouTube Music. It runs the real music.youtube.com (so Google sign-in
and Premium just work) and adds:

- **Equalizer**: 10 bands, presets, bass boost, loudness normalization and a limiter so boosts never distort
- **Synced lyrics**: from [LRCLIB](https://lrclib.net), with click-to-seek and a full-screen mode
- **Themes**: built-in palettes, an "Album Art" theme that follows the cover, a theme editor, import/export
- **Shortcuts**: in-app and global hotkeys, all rebindable, with conflict warnings
- **Ad alerts**: a banner and Windows notification when an ad plays, with one-key skip when YouTube allows it
- **Windows integration**: tray icon with mini player, taskbar buttons and progress, media keys / media overlay
- **Discord**: "Listening to…" status

Everything lives behind the toolbar added to YouTube Music's top bar. Press `Ctrl+/` for all shortcuts.

## Install

1. Download **`YouputDesk-Setup-<version>.exe`** from the [latest release](https://github.com/roderio/youputdesk/releases/latest).
2. Open it. YouputDesk installs in a few seconds (no admin rights needed) and starts.

Windows may show **"Windows protected your PC"** because the installer isn't code-signed yet. Click
**More info → Run anyway**. Releases will be signed through the SignPath Foundation once the project's
application is approved; see the [code signing policy](#code-signing-policy).

It runs on Windows 10 and 11, on both Intel/AMD (x64) and ARM PCs, and it updates itself. To uninstall,
go to Windows Settings → Apps; uninstalling also removes all of its data.

**Portable:** prefer not to install? Download `YouputDesk-<version>-portable.exe`, or the smaller
`-x64` / `-arm64` one for your PC, and run it from anywhere, even a USB stick. It keeps its data in a
`YouputDesk-data` folder beside the exe and doesn't auto-update. Your Google sign-in is encrypted for
your Windows account, so on another PC you'll be asked to sign in again.

## Privacy & security

No accounts, no analytics, no tracking. The first time it opens, YouputDesk asks which optional features
may talk to other services (Discord status, online lyrics, update checks), and nothing is sent until you
choose. See [PRIVACY.md](PRIVACY.md) for exactly what goes where, and [SECURITY.md](SECURITY.md) for how the
app is hardened and how to report a vulnerability.

## Development

```sh
npm install
npm run dev        # run with hot reload
npm test           # unit tests
npm run typecheck
npm run dist       # typecheck + test + build the installer and portable exes into dist/
npm run icons      # regenerate icons in resources/ and build/icon.ico
```

`YOUPUTDESK_PROFILE=test npm run dev` runs a separate profile (its own login, settings and
single-instance lock), so you can test without touching your everyday setup.

## Where things are

| Area | Code |
| --- | --- |
| Google sign-in, browser identity | `src/main/auth.ts`, `src/main/ua.ts` |
| Tray, mini player, taskbar, global shortcuts, toasts, Discord, lyrics | `src/main/*.ts` |
| Audio engine (Web Audio chain) | `src/preload/audio.ts` |
| Overlay UI (toolbar, panels, modals) | `src/preload/overlay/` |
| YouTube Music DOM selectors | `src/shared/selectors.ts` (first place to look when YTM changes its markup) |

If Google ever refuses sign-in ("This browser or app may not be secure"), press `Alt` →
**App → Sign-in identity** and try another option.

Debugging the overlay: open DevTools (`Alt` → App → Toggle Developer Tools), pick the
**Electron Isolated Context**, and use `__youputdesk.getState()`.

## Releasing

1. `npm version patch` (or `minor`/`major`): bumps `package.json` and creates the `vX.Y.Z` tag.
2. `git push --follow-tags`: GitHub Actions (`.github/workflows/release.yml`) tests, builds and uploads the
   installer, the portable exes and `latest.yml` (the auto-update feed) to a **draft** release.
3. Check the draft on GitHub, add release notes, and click **Publish**. Installed copies pick it up within six
   hours and install it when the app is next quit.

Releases are only ever built by CI. Keep 2FA on the GitHub account and protect the `main` branch and `v*` tags,
because anyone who can publish a release can ship an update.

Each published release is also submitted to WinGet automatically (`.github/workflows/winget.yml`, which needs
a `WINGET_TOKEN` secret: a classic token with the `public_repo` scope).

## Code signing policy

Free code signing for Windows releases is provided by [SignPath.io](https://about.signpath.io), with a
certificate from the [SignPath Foundation](https://signpath.org). *(Application pending: releases are unsigned
until it's approved.)*

- Only release builds made by GitHub Actions from this repository's tagged commits are signed. Nothing built
  on a personal machine is.
- Committers and reviewers: [roderio](https://github.com/roderio)
- Approvers: [roderio](https://github.com/roderio)
- Every team member uses multi-factor authentication for GitHub and SignPath.

**Privacy:** this program will not transfer any information to other networked systems unless specifically
requested by the user or the person installing or operating it. The optional features that contact other
services (Discord status, online lyrics, update checks) stay off until you allow them on first launch. See
[PRIVACY.md](PRIVACY.md).
