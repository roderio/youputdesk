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

## Development

```sh
npm install
npm run dev        # run with hot reload
npm test           # unit tests
npm run typecheck
npm run dist       # typecheck + test + build the NSIS installer into dist/
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
